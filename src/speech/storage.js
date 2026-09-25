import { CACHE_NAME, CACHE_PREFIX, packUrl } from "./manifest.js";
import { phraseCatalog, ROLL_VARIATIONS } from "./messages.js";

const check = signal => signal?.throwIfAborted();
const hash = async buffer => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)), b => b.toString(16).padStart(2, "0")).join("");
const needsDownload = () => Object.assign(Error("저장된 음성을 사용할 수 없습니다. 다운로드 용량을 확인한 뒤 다시 받아주세요."), { code: "download-required" });

export async function inspectVoiceCache() {
  const result = { available: false, bytes: 0, files: {}, freeBytes: null };
  if (!globalThis.caches) return result;
  try {
    for (const name of (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX))) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request), bytes = Number(response?.headers.get("Content-Length")) || 0;
        result.bytes += bytes;
        if (name === CACHE_NAME) result.files[request.url] = bytes;
      }
    }
    const estimate = await navigator.storage?.estimate?.().catch(() => ({})) || {};
    result.available = true;
    result.freeBytes = Number.isFinite(estimate.quota) ? Math.max(0, estimate.quota - (estimate.usage || 0)) : null;
  } catch { result.reason = "storage"; }
  return result;
}
export const isPackCached = (cache, pack) => !!pack && cache.files?.[packUrl(pack)] === pack.bytes;
export async function clearVoiceCache() {
  if (!globalThis.caches) return;
  for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX)) await caches.delete(name);
}

export class VoicePack {
  constructor(buffer, descriptor) {
    const bytes = new Uint8Array(buffer), view = new DataView(buffer), decoder = new TextDecoder();
    if (bytes.length < 12 || decoder.decode(bytes.subarray(0, 8)) !== "ADVAUD2\n") throw Error("음성 파일 형식이 올바르지 않습니다.");
    const length = view.getUint32(8, true);
    if (length > 1000000 || length + 12 >= bytes.length) throw Error("음성 파일 형식이 올바르지 않습니다.");
    const header = JSON.parse(decoder.decode(bytes.subarray(12, 12 + length)));
    if (header.schema !== 2 || header.id !== descriptor.id || header.version !== descriptor.version || header.mime !== "audio/mpeg") throw Error("음성 파일의 버전이 올바르지 않습니다.");
    const keys = Object.keys(phraseCatalog(descriptor.language));
    if (!header.clips || Object.keys(header.clips).length !== keys.length) throw Error("일부 안내 음성이 없습니다.");
    let end = 0;
    for (const key of keys) {
      const entry = header.clips[key];
      if (!Array.isArray(entry) || entry.length !== 3 || !Number.isSafeInteger(entry[0]) || !Number.isSafeInteger(entry[1]) || entry[0] !== end || entry[1] <= 0 || !Number.isFinite(entry[2]) || entry[2] <= 0 || entry[2] > 40) throw Error("안내 음성을 확인하지 못했습니다.");
      end += entry[1];
    }
    if (end !== bytes.length - 12 - length) throw Error("음성 파일의 크기가 올바르지 않습니다.");
    this.descriptor = descriptor; this.clips = header.clips; this.bytes = bytes.subarray(12 + length); this.urls = new Map();
  }
  url(id) {
    let key = id;
    if (key === "roll") {
      const candidates = ROLL_VARIATIONS.filter(name => this.clips[name]);
      if (candidates.length) key = candidates[Math.floor(Math.random() * candidates.length)];
    }
    const entry = this.clips[key];
    if (!entry || !this.bytes) throw Error("안내 음성을 찾지 못했습니다.");
    let url = this.urls.get(key);
    if (url) this.urls.delete(key);
    else url = URL.createObjectURL(new Blob([this.bytes.subarray(entry[0], entry[0] + entry[1])], { type: "audio/mpeg" }));
    this.urls.set(key, url);
    while (this.urls.size > 16) { const first = this.urls.keys().next().value; URL.revokeObjectURL(this.urls.get(first)); this.urls.delete(first); }
    return url;
  }
  dispose() { for (const url of this.urls.values()) URL.revokeObjectURL(url); this.urls.clear(); this.bytes = null; }
}

export async function loadVoicePack(pack, { signal, download = false, persist = false, progress = () => {} } = {}) {
  check(signal);
  let cache, buffer, stored = false, cacheFailed = false;
  if (globalThis.caches) {
    try {
      if ((await caches.keys()).includes(CACHE_NAME) || persist) cache = await caches.open(CACHE_NAME);
      const response = await cache?.match(packUrl(pack));
      if (response) {
        const cached = await response.arrayBuffer(); check(signal);
        if (cached.byteLength === pack.bytes && await hash(cached) === pack.sha256) buffer = cached;
        else await cache.delete(packUrl(pack));
      }
    } catch (error) { check(signal); cacheFailed = persist; }
  } else cacheFailed = persist;
  check(signal);
  stored = !!buffer;
  if (!buffer) {
    if (!download) throw needsDownload();
    const controller = new AbortController(), abort = () => controller.abort(signal.reason);
    signal?.addEventListener("abort", abort, { once: true });
    let timer;
    const touch = () => { clearTimeout(timer); timer = setTimeout(() => controller.abort(), 30000); };
    touch();
    try {
      const response = await fetch(packUrl(pack), { signal: controller.signal, cache: "no-store", credentials: "omit" });
      if (!response.ok || !response.body) throw Error("음성 파일을 받지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
      const reader = response.body.getReader(), bytes = new Uint8Array(pack.bytes); let loaded = 0;
      try {
        while (true) {
          check(signal); const { done, value } = await reader.read(); if (done) break; touch();
          if (loaded + value.length > bytes.length) throw Error("음성 파일의 크기가 올바르지 않습니다.");
          bytes.set(value, loaded); loaded += value.length; progress({ phase: "download", loaded, total: pack.bytes });
        }
      } finally { await reader.cancel().catch(() => {}); }
      if (loaded !== pack.bytes) throw Error("음성 파일을 끝까지 받지 못했습니다.");
      buffer = bytes.buffer;
      progress({ phase: "verify", loaded, total: pack.bytes });
      if (await hash(buffer) !== pack.sha256) throw Error("음성 파일을 확인하지 못했습니다. 다시 받아주세요.");
    } catch (error) {
      check(signal);
      if (controller.signal.aborted) throw Error("음성 다운로드가 지연되고 있습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
      throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
  }
  check(signal);
  const library = new VoicePack(buffer, pack);
  try {
    if (persist && cache && !stored) {
      try { await cache.put(packUrl(pack), new Response(buffer, { headers: { "Content-Length": String(pack.bytes), "Content-Type": "application/octet-stream" } })); }
      catch { cacheFailed = true; }
    }
    check(signal);
    return { library, cacheFailed };
  } catch (error) { library.dispose(); throw error; }
}
