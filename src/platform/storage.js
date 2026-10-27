import { IMAGE_CACHE_NAME, clearImageCache } from '../content/image-cache.js';
import { PACKAGE_CACHE_NAME, rememberCacheChoice as rememberLyra } from '../compute/lyra/package.js';
import { CACHE_DIRECTORY, rememberCacheChoice as rememberVela } from '../compute/vela/storage.js';
import { CACHE_PREFIX } from '../speech/manifest.js';

const voiceRoot = new URL('../../public/voice/', import.meta.url).href;
const voiceEntry = url => url.startsWith(voiceRoot);
const modelEntry = name => /^vela-[a-z0-9.-]+$/.test(name);
const lyraName = url => {
  const version = new URL(url).pathname.match(/\/lyra-(v\d+(?:\.\d+)*)\/__cache__\//)?.[1];
  return version ? `LYRA ${version}` : 'LYRA';
};
async function responseSize(response) {
  if (!response) return 0;
  const length = response.headers.get('Content-Length');
  if (length !== null && Number.isSafeInteger(Number(length)) && Number(length) >= 0) {
    await response.body?.cancel(); return Number(length);
  }
  // Older LYRA entries have no length header. Count chunks without making a
  // second full-sized model copy or downloading anything.
  let bytes = 0;
  const reader = response.body?.getReader();
  if (reader) try { for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; } }
  finally { reader.releaseLock(); }
  return bytes;
}
async function directorySize(directory) {
  let bytes = 0, files = 0;
  for await (const entry of directory.values()) {
    if (entry.kind === 'directory') { const size = await directorySize(entry); bytes += size.bytes; files += size.files; }
    else { bytes += (await entry.getFile()).size; files++; }
  }
  return { bytes, files };
}
export async function inspectBrowserStorage() {
  const items = [], unavailable = [];
  if (globalThis.caches) {
    try {
      for (const name of await caches.keys()) {
        const kind = name === IMAGE_CACHE_NAME ? 'images' : name === PACKAGE_CACHE_NAME ? 'lyra' : name.startsWith(CACHE_PREFIX) ? 'voice' : null;
        if (!kind) continue;
        const cache = await caches.open(name);
        let imageBytes = 0, imageFiles = 0;
        for (const request of await cache.keys()) {
          if (kind === 'voice' && !voiceEntry(request.url)) continue;
          const bytes = await responseSize(await cache.match(request));
          if (kind === 'images') { imageBytes += bytes; imageFiles++; continue; }
          const pack = kind === 'voice' ? new URL(request.url).pathname.split('/').pop().match(/^(ko|en|ja|zh)-(F|M)-/) : null;
          items.push({ kind, cache: name, url: request.url, bytes, files: 1,
            name: kind === 'lyra' ? lyraName(request.url) : '음성 파일', language: pack?.[1], voice: pack?.[2] });
        }
        if (imageFiles) items.push({ kind: 'images', cache: name, name: '게임 이미지', bytes: imageBytes, files: imageFiles });
      }
    } catch { unavailable.push('파일 캐시'); }
  } else unavailable.push('파일 캐시');
  if (navigator.storage?.getDirectory) {
    try {
      const root = await navigator.storage.getDirectory();
      let directory;
      try { directory = await root.getDirectoryHandle(CACHE_DIRECTORY); }
      catch (error) { if (error.name !== 'NotFoundError') throw error; }
      if (directory) for await (const [key, entry] of directory.entries()) {
        if (entry.kind !== 'directory' || !modelEntry(key)) continue;
        const size = await directorySize(entry);
        let name = key.match(/^vela-(v[\d.]+)/)?.[1];
        // IDs and manifest labels are never inserted as HTML.
        items.push({ kind: 'vela', key, name: name ? `VELA ${name.replace(/\.$/, '')}` : 'VELA', ...size });
      }
    } catch { unavailable.push('모델 저장소'); }
  } else unavailable.push('모델 저장소');
  return { items, unavailable, bytes: items.reduce((sum, item) => sum + item.bytes, 0) };
}
export async function deleteStoredItem(item) {
  if (item.kind === 'images' && item.cache === IMAGE_CACHE_NAME) return clearImageCache();
  if ((item.kind === 'lyra' && item.cache === PACKAGE_CACHE_NAME) ||
      (item.kind === 'voice' && item.cache.startsWith(CACHE_PREFIX) && voiceEntry(item.url))) {
    // Match/delete individual entries; other packs and unrelated caches survive.
    if ((await caches.keys()).includes(item.cache)) await (await caches.open(item.cache)).delete(item.url);
    if (item.kind === 'lyra') rememberLyra(false);
    return;
  }
  if (item.kind === 'vela' && modelEntry(item.key)) {
    const root = await navigator.storage.getDirectory();
    const cache = await root.getDirectoryHandle(CACHE_DIRECTORY);
    try { await cache.removeEntry(item.key, { recursive: true }); }
    catch (error) { if (error.name !== 'NotFoundError') throw error; }
    let remaining = false;
    for await (const [name, entry] of cache.entries()) if (entry.kind === 'directory' && modelEntry(name)) remaining = true;
    if (!remaining) rememberVela(false);
    return;
  }
  throw Error('Unsupported storage item');
}
