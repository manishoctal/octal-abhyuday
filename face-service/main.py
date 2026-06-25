"""
Octal Face Service — InsightFace microservice
Runs on localhost:8001 (not exposed externally).
Next.js calls this via FACE_SERVICE_URL=http://localhost:8001
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
import numpy as np
from PIL import Image
import requests
import io
import insightface
from insightface.app import FaceAnalysis
import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("face-service")

app = FastAPI(title="Octal Face Service")

# ---------------------------------------------------------------------------
# Model init — loads ~300 MB buffalo_sc model on startup (once only).
# buffalo_sc = lightweight CPU model; accurate enough for ~100-300 employees.
# ctx_id=-1 = CPU; set ctx_id=0 for GPU if available.
# ---------------------------------------------------------------------------
face_app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
face_app.prepare(ctx_id=-1, det_size=(640, 640))
log.info("InsightFace model loaded.")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fetch_image_numpy(url: str) -> np.ndarray:
    """Download image from S3/CloudFront URL into RAM as numpy BGR array."""
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    img = Image.open(io.BytesIO(resp.content)).convert("RGB")
    # InsightFace expects BGR
    return np.array(img)[:, :, ::-1]


def bytes_to_numpy(data: bytes) -> np.ndarray:
    """Decode uploaded image bytes into numpy BGR array."""
    img = Image.open(io.BytesIO(data)).convert("RGB")
    return np.array(img)[:, :, ::-1]


def get_largest_face_embedding(img_bgr: np.ndarray) -> list[float] | None:
    """Return 512-dim embedding for the largest detected face, or None."""
    faces = face_app.get(img_bgr)
    if not faces:
        return None
    # pick face with largest bounding-box area
    best = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    return best.embedding.tolist()


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class EmbedUrlRequest(BaseModel):
    url: str  # S3 / CloudFront URL

class EmbedResponse(BaseModel):
    embedding: list[float]  # 512 floats
    face_found: bool

class SearchCandidate(BaseModel):
    employee_id: int
    embedding: list[float]  # 512 floats from DB

class SearchRequest(BaseModel):
    candidates: list[SearchCandidate]
    threshold: float = 0.50  # cosine similarity cutoff

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
    return {"ok": True}


@app.post("/embed/url", response_model=EmbedResponse)
def embed_from_url(req: EmbedUrlRequest):
    """Fetch image from S3 URL and return face embedding."""
    try:
        img = fetch_image_numpy(req.url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch image: {e}")

    embedding = get_largest_face_embedding(img)
    if embedding is None:
        return EmbedResponse(embedding=[], face_found=False)
    return EmbedResponse(embedding=embedding, face_found=True)


@app.post("/embed/upload", response_model=EmbedResponse)
async def embed_from_upload(file: UploadFile = File(...)):
    """Accept selfie bytes (multipart) and return face embedding."""
    data = await file.read()
    try:
        img = bytes_to_numpy(data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not decode image: {e}")

    embedding = get_largest_face_embedding(img)
    if embedding is None:
        return EmbedResponse(embedding=[], face_found=False)
    return EmbedResponse(embedding=embedding, face_found=True)


class EmbedAllResponse(BaseModel):
    embeddings: list[list[float]]  # one 512-dim vector per detected face
    face_count: int


@app.post("/embed-all/url", response_model=EmbedAllResponse)
def embed_all_from_url(req: EmbedUrlRequest):
    """Return embeddings for ALL faces detected in the image (for group photos)."""
    try:
        img = fetch_image_numpy(req.url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch image: {e}")

    faces = face_app.get(img)
    embeddings = [f.embedding.tolist() for f in faces]
    return EmbedAllResponse(embeddings=embeddings, face_count=len(embeddings))


@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest):
    """
    Compare selfie embedding (first candidate with employee_id=-1) against
    the rest. Actually: accepts selfie_embedding inline + candidates list.
    """
    raise HTTPException(status_code=400, detail="Use /search/by-url or /search/by-upload")


class SearchByUrlRequest(BaseModel):
    url: str
    candidates: list[SearchCandidate]
    threshold: float = 0.50


@app.post("/search/by-url", response_model=SearchResponse)
def search_by_url(req: SearchByUrlRequest):
    """Fetch selfie from URL, compare against all candidate embeddings."""
    try:
        img = fetch_image_numpy(req.url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch selfie: {e}")

    embedding = get_largest_face_embedding(img)
    if embedding is None:
        return SearchResponse(matches=[], face_found=False)

    selfie_vec = np.array(embedding)
    matches = []
    for c in req.candidates:
        sim = cosine_similarity(selfie_vec, np.array(c.embedding))
        if sim >= req.threshold:
            matches.append(SearchMatch(employee_id=c.employee_id, similarity=round(sim, 4)))

    matches.sort(key=lambda m: m.similarity, reverse=True)
    return SearchResponse(matches=matches, face_found=True)


class SearchByUploadRequest(BaseModel):
    candidates: list[SearchCandidate]
    threshold: float = 0.50


@app.post("/search/by-upload", response_model=SearchResponse)
async def search_by_upload(
    file: UploadFile = File(...),
    threshold: float = 0.50,
):
    """Accept selfie bytes, compare against all candidate embeddings passed as JSON body."""
    # candidates are passed as a query param JSON string for multipart compatibility
    raise HTTPException(status_code=400, detail="Use /search/by-url instead")


# ---------------------------------------------------------------------------
# Startup: warm up model by running a blank inference
# ---------------------------------------------------------------------------
@app.on_event("startup")
def warmup():
    blank = np.zeros((100, 100, 3), dtype=np.uint8)
    face_app.get(blank)
    log.info("Warmup complete.")
