import { IMAGE_MANIFEST } from './image-manifest.js';

const base = new URL('../../public/assets/', import.meta.url);
// Scoped to this application path; the version describes storage format, not page releases.
const cacheName = `adventure-images-v1:${base.pathname}`;
const retentionMs = 7 * 24 * 60 * 60 * 1000;
const keyFor = (name, entry) => new URL(`__cache__/${name}/${entry.sha256}`, base).href;
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
let opened;

async function openCache() {
  if (!globalThis.caches || !globalThis.crypto?.subtle) return null;
  if (!opened) opened = (async () => {
    try {
      const cache = await caches.open(cacheName);
      const current = new Set(Object.entries(IMAGE_MANIFEST).map(([name, entry]) => keyFor(name, entry)));
      // Keep recently replaced entries briefly for other open tabs and rollback.
      for (const request of await cache.keys()) {
        if (current.has(request.url)) continue;
        const response = await cache.match(request);
        const saved = Number(response?.headers.get('X-Image-Saved-At'));
        if (!saved || Date.now() - saved > retentionMs) await cache.delete(request);
      }
      return cache;
    } catch { return null; }
  })();
  return opened;
}

export async function imageSource(id, { signal, priority = 'low' } = {}) {
  const name = `${id}.png`, entry = IMAGE_MANIFEST[name];
  const url = new URL(name, base);
  if (!entry || !globalThis.crypto?.subtle) return { url: url.href };
  const key = keyFor(name, entry), cache = await openCache();
  signal?.throwIfAborted();
  if (cache) {
    try {
      const response = await cache.match(key);
      if (response) {
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength === entry.bytes && await digest(bytes) === entry.sha256) {
          signal?.throwIfAborted();
          return blobSource(bytes);
        }
        await cache.delete(key);
      }
    } catch { signal?.throwIfAborted(); }
  }
  url.searchParams.set('sha256', entry.sha256);
  const response = await fetch(url, { signal, priority, cache: 'no-cache' });
  if (!response.ok) throw Error(`Image unavailable (${response.status})`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== entry.bytes || await digest(bytes) !== entry.sha256) throw Error('Image integrity mismatch');
  signal?.throwIfAborted();
  if (cache) {
    try {
      await cache.put(key, new Response(bytes, { headers: { 'Content-Type': 'image/png', 'Content-Length': String(bytes.byteLength), 'X-Image-Saved-At': String(Date.now()) } }));
    } catch { /* Storage is optional; the downloaded image can still be displayed. */ }
  }
  signal?.throwIfAborted();
  return blobSource(bytes);
}

function blobSource(bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  return { url, release: () => URL.revokeObjectURL(url) };
}
