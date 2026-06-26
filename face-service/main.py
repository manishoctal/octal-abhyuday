"""
Octal Face Service — InsightFace microservice
Runs on localhost:8001 (not exposed externally).

Model: buffalo_l  — full ArcFace (ResNet50 backbone)
  More accurate than buffalo_sc for cross-photo matching.
  Downloads ~500 MB on first run (stored in ~/.insightface/).

Threshold guide for buffalo_l cosine similarity:
  > 0.28  — likely same person  (use for production)
  > 0.20  — possible match     (use for lenient search)
  < 0.15  — different people
"""

# On Windows, asyncio defaults to SelectorEventLoop which hits a 512-fd limit
# under concurrent load. ProactorEventLoop uses Windows IOCP with no fd limit.
import sys
if sys.platform == "win32":
    import asyncio
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
import numpy as np
from PIL import Image
import requests
import io
import logging
import threading
from insightface.app import FaceAnalysis

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("face-service")

app = FastAPI(title="Octal Face Service")

# ---------------------------------------------------------------------------
# Model — buffalo_l: full ArcFace ResNet50, best accuracy for cross-photo matching
# det_thresh=0.35  → catches more faces in group photos (default 0.5 misses partial faces)
# det_size=(640,640) → good balance of speed vs detection quality
# ---------------------------------------------------------------------------
face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
face_app.prepare(ctx_id=-1, det_size=(640, 640))
# Lower detection threshold so faces at angles/in groups are not missed
face_app.models["detection"].det_thresh = 0.35
log.info("InsightFace buffalo_l model loaded.")

# Cap concurrent face analyses — the model is CPU-bound so running more than
# this in parallel just queues behind the GIL anyway and wastes file descriptors.
_face_sem = threading.Semaphore(4)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fetch_image_numpy(url: str) -> np.ndarray:
    """Download from S3/CloudFront URL into RAM as BGR numpy array."""
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    img = Image.open(io.BytesIO(resp.content)).convert("RGB")
    arr = np.array(img)
    # InsightFace expects BGR
    return arr[:, :, ::-1]


def bytes_to_numpy(data: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    arr = np.array(img)
    return arr[:, :, ::-1]


def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class EmbedUrlRequest(BaseModel):
    url: str


class EmbedResponse(BaseModel):
    embedding: list[float]
    face_found: bool


class EmbedAllResponse(BaseModel):
    embeddings: list[list[float]]   # one per detected face
    face_count: int


class SearchCandidate(BaseModel):
    employee_id: int
    embedding: list[float]


class SearchMatch(BaseModel):
    employee_id: int
    similarity: float


class SearchResponse(BaseModel):
    matches: list[SearchMatch]
    face_found: bool


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"ok": True, "model": "buffalo_l"}


# ── Single face (largest) — for employee profile photos ──────────────────

@app.post("/embed/url", response_model=EmbedResponse)
def embed_from_url(req: EmbedUrlRequest):
    """Embed the largest face found in an S3 image URL."""
    try:
        img = fetch_image_numpy(req.url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch image: {e}")

    with _face_sem:
        faces = face_app.get(img)
    if not faces:
        log.info(f"No face detected in {req.url}")
        return EmbedResponse(embedding=[], face_found=False)

    best = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    log.info(f"Embedded face from {req.url} (det_score={best.det_score:.2f})")
    return EmbedResponse(embedding=best.embedding.tolist(), face_found=True)


@app.post("/embed/upload", response_model=EmbedResponse)
async def embed_from_upload(file: UploadFile = File(...)):
    """Embed the largest face from an uploaded selfie."""
    data = await file.read()
    try:
        img = bytes_to_numpy(data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not decode image: {e}")

    with _face_sem:
        faces = face_app.get(img)
    if not faces:
        log.info("No face detected in uploaded selfie")
        return EmbedResponse(embedding=[], face_found=False)

    best = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    log.info(f"Selfie embedded (det_score={best.det_score:.2f})")
    return EmbedResponse(embedding=best.embedding.tolist(), face_found=True)


# ── All faces — for group/event photos ───────────────────────────────────

@app.post("/embed-all/url", response_model=EmbedAllResponse)
def embed_all_from_url(req: EmbedUrlRequest):
    """Return embeddings for ALL faces in a photo (for group photos)."""
    try:
        img = fetch_image_numpy(req.url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch image: {e}")

    with _face_sem:
        faces = face_app.get(img)
    log.info(f"Detected {len(faces)} face(s) in {req.url}")
    return EmbedAllResponse(
        embeddings=[f.embedding.tolist() for f in faces],
        face_count=len(faces),
    )


# ── Debug: compare two images directly ───────────────────────────────────

class DebugRequest(BaseModel):
    url1: str   # employee profile photo URL
    url2: str   # test photo / selfie URL


class DebugResponse(BaseModel):
    similarity: float
    face1_found: bool
    face2_found: bool
    verdict: str


@app.post("/debug/similarity", response_model=DebugResponse)
def debug_similarity(req: DebugRequest):
    """
    Compare two image URLs and return cosine similarity.
    Use this from Swagger to tune the threshold for your photos.
    Typical buffalo_l values:
      Same person, different photos: 0.25 – 0.55
      Different people:              0.05 – 0.18
    """
    try:
        img1 = fetch_image_numpy(req.url1)
        img2 = fetch_image_numpy(req.url2)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    faces1 = face_app.get(img1)
    faces2 = face_app.get(img2)

    if not faces1 or not faces2:
        return DebugResponse(
            similarity=0.0,
            face1_found=bool(faces1),
            face2_found=bool(faces2),
            verdict="Could not detect face in one or both images",
        )

    e1 = max(faces1, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1])).embedding
    e2 = max(faces2, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1])).embedding
    sim = cosine_sim(e1, e2)

    if sim > 0.40:
        verdict = "Strong match — same person"
    elif sim > 0.28:
        verdict = "Likely same person"
    elif sim > 0.18:
        verdict = "Weak match — possible same person"
    else:
        verdict = "Different people"

    log.info(f"Debug similarity: {sim:.4f} → {verdict}")
    return DebugResponse(similarity=round(sim, 4), face1_found=True, face2_found=True, verdict=verdict)


# ---------------------------------------------------------------------------
# Warmup
# ---------------------------------------------------------------------------

@app.on_event("startup")
def warmup():
    blank = np.zeros((100, 100, 3), dtype=np.uint8)
    face_app.get(blank)
    log.info("Warmup complete.")
