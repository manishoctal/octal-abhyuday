import { emitter } from '@/lib/events';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return new Response('Not signed in', { status: 401 });
  }

  const encoder = new TextEncoder();
  let onUpdate: ((e: unknown) => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream already closed — listener cleanup happens in cancel()
        }
      };
      send(`data: ${JSON.stringify({ type: 'connected', at: Date.now() })}\n\n`);
      onUpdate = (e) => send(`data: ${JSON.stringify(e)}\n\n`);
      emitter.on('update', onUpdate);
      // Keep proxies/browsers from closing an idle connection
      heartbeat = setInterval(() => send(': ping\n\n'), 25000);
    },
    cancel() {
      if (onUpdate) emitter.off('update', onUpdate);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
