/// <reference lib="webworker" />
/**
 * fastbeam service worker.
 *  1. Precache the app shell so it opens with no network.
 *  2. Stream received files to disk: the page posts chunks over a MessagePort and this worker answers a
 *     navigation to /fb-download/<id> with a ReadableStream, so the browser saves it as a normal download.
 *  3. Android Share Target: files POSTed to /share are parked in the Cache API and the page picks them up.
 */
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

const STREAM_PREFIX = '/fb-download/'
const KEEPALIVE = '/fb-keepalive'
const SHARE_PATH = '/share'
const SHARE_CACHE = 'fastbeam-share'

interface StreamEntry {
  name: string
  size: number
  mime: string
  port: MessagePort
  controller: ReadableStreamDefaultController<Uint8Array> | null
  queue: ArrayBuffer[]
  ended: boolean
  closed: boolean
  aborted: boolean
}

const streams = new Map<string, StreamEntry>()

function enqueue(entry: StreamEntry, buf: ArrayBuffer): void {
  entry.controller!.enqueue(new Uint8Array(buf))
  entry.port.postMessage({ type: 'ack', bytes: buf.byteLength })
}

/** Push queued chunks into the stream while it has room, then close if everything has been delivered. */
function drain(entry: StreamEntry): void {
  const c = entry.controller
  if (!c || entry.closed) return
  while (entry.queue.length && (c.desiredSize ?? 0) > 0) enqueue(entry, entry.queue.shift()!)
  if (entry.ended && entry.queue.length === 0) {
    // Close as soon as the last byte is handed over; never wait for another pull that may not come
    // (browsers stop pulling once Content-Length is satisfied).
    entry.closed = true
    try {
      c.close()
    } catch {
      /* already closed by the consumer */
    }
    entry.port.postMessage({ type: 'done' })
  }
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string; id?: string; name?: string; size?: number; mime?: string } | undefined
  if (!data) return
  if (data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
    return
  }
  if (data.type === 'fb-stream' && data.id && event.ports[0]) {
    const port = event.ports[0]
    const entry: StreamEntry = {
      name: data.name ?? 'file',
      size: data.size ?? 0,
      mime: data.mime ?? 'application/octet-stream',
      port,
      controller: null,
      queue: [],
      ended: false,
      closed: false,
      aborted: false,
    }
    streams.set(data.id, entry)
    port.onmessage = (e: MessageEvent<{ type: string; buf?: ArrayBuffer }>) => {
      const m = e.data
      if (entry.closed || entry.aborted) return
      if (m.type === 'chunk' && m.buf) {
        if (entry.controller && entry.queue.length === 0 && (entry.controller.desiredSize ?? 0) > 0) enqueue(entry, m.buf)
        else entry.queue.push(m.buf)
      } else if (m.type === 'end') {
        entry.ended = true
        drain(entry)
      } else if (m.type === 'abort') {
        entry.aborted = true
        try {
          entry.controller?.error(new Error('aborted'))
        } catch {
          /* already closed */
        }
      }
    }
    port.postMessage({ type: 'ready' })
    // Garbage-collect streams nobody navigated to.
    setTimeout(() => {
      if (streams.get(data.id!) === entry && !entry.controller) {
        streams.delete(data.id!)
        port.postMessage({ type: 'cancelled' })
      }
    }, 60_000)
  }
})

function streamResponse(id: string, entry: StreamEntry): Response {
  streams.delete(id)
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      entry.controller = controller
      drain(entry)
    },
    pull() {
      drain(entry)
    },
    cancel() {
      entry.aborted = true
      entry.port.postMessage({ type: 'cancelled' })
    },
  })
  const headers = new Headers({
    'Content-Type': entry.mime,
    'Content-Disposition': `attachment; filename="${entry.name.replace(/["\\]/g, '_').replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(entry.name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  })
  if (entry.size > 0) headers.set('Content-Length', String(entry.size))
  return new Response(body, { headers })
}

async function handleShare(request: Request): Promise<Response> {
  try {
    const form = await request.formData()
    const cache = await caches.open(SHARE_CACHE)
    const files = form.getAll('files').filter((f): f is File => f instanceof File)
    let i = 0
    for (const f of files) {
      await cache.put(
        new Request(`/__share/${i++}`),
        new Response(f, {
          headers: {
            'content-type': f.type || 'application/octet-stream',
            'x-fastbeam-kind': 'file',
            'x-fastbeam-name': encodeURIComponent(f.name || 'shared'),
          },
        }),
      )
    }
    const text = [form.get('title'), form.get('text'), form.get('url')]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .join('\n')
    if (!files.length && text) {
      await cache.put(new Request('/__share/text'), new Response(text, { headers: { 'x-fastbeam-kind': 'text' } }))
    }
  } catch {
    /* fall through to the app either way */
  }
  return Response.redirect('/?share=1', 303)
}

self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith(STREAM_PREFIX)) {
    const id = url.pathname.slice(STREAM_PREFIX.length)
    const entry = streams.get(id)
    event.respondWith(entry ? streamResponse(id, entry) : new Response('Not found', { status: 404 }))
    return
  }
  if (url.pathname === KEEPALIVE) {
    event.respondWith(new Response('ok', { headers: { 'Cache-Control': 'no-store' } }))
    return
  }
  if (url.pathname === SHARE_PATH && event.request.method === 'POST') {
    event.respondWith(handleShare(event.request))
  }
})

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/fb-download\//, /^\/share$/, /^\/fb-keepalive$/],
  }),
)

void self.skipWaiting()
clientsClaim()
