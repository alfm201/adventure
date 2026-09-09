import { modelKey, sameModel, validateManifest, fetchManifest, LOCAL_MODEL } from "./model.js";
import { writeBytes } from "./files.js";

const KEY = "adventure-vela-cache-consent-v2";
export const CACHE_DIRECTORY = "adventure-vela";
export async function removeRetiredModelCaches() {
  try {
    for (const key of Object.keys(localStorage))
      if (/^adventure-[a-z]+-cache-consent-v1$/.test(key)) localStorage.removeItem(key);
  } catch {}
  if (!navigator.storage?.getDirectory) return;
  const root = await navigator.storage.getDirectory();
  for await (const [name, handle] of root.entries())
    if (handle.kind === "directory" && /^adventure-[a-z]+-v4$/.test(name) && name !== CACHE_DIRECTORY)
      await root.removeEntry(name, { recursive: true });
}
export function cacheAllowed() {
  if (LOCAL_MODEL) return false;
  try { return localStorage.getItem(KEY) === "yes"; } catch { return false; }
}
export function rememberCacheChoice(allowed) {
  if (LOCAL_MODEL && allowed) return false;
  try {
    if (allowed) localStorage.setItem(KEY, "yes");
    else localStorage.removeItem(KEY);
    return cacheAllowed() === allowed;
  } catch { return false; }
}
export async function clearModelCache() {
  rememberCacheChoice(false);
  if (!navigator.storage?.getDirectory) return;
  const root = await navigator.storage.getDirectory();
  try { await root.removeEntry(CACHE_DIRECTORY, { recursive: true }); }
  catch (error) { if (error.name !== "NotFoundError") throw error; }
}
export async function hasModelCache() {
  if (!navigator.storage?.getDirectory) return false;
  try {
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(CACHE_DIRECTORY);
    for await (const entry of directory.keys()) return true;
  } catch {}
  return false;
}
export async function modelDirectory(manifest, create = false) {
  const root = await navigator.storage.getDirectory();
  const cache = await root.getDirectoryHandle(CACHE_DIRECTORY, { create });
  return cache.getDirectoryHandle(modelKey(manifest), { create });
}
export async function hasCachedModel(manifest, includeStaged = false) {
  try {
    const directory = await modelDirectory(manifest);
    let complete = false;
    for (const name of includeStaged ? ["complete.json", "staged.json"] : ["complete.json"]) {
      try {
        const meta = JSON.parse(await (await (await directory.getFileHandle(name)).getFile()).text());
        if (sameModel(validateManifest(meta.manifest), manifest)) { complete = true; break; }
      } catch {}
    }
    if (!complete) return false;
    for (const [name, bytes] of [["model.gz", manifest.bytes], ["module.mjs", manifest.runtime.module.bytes], ["module.wasm", manifest.runtime.wasm.bytes]])
      if ((await (await directory.getFileHandle(name)).getFile()).size !== bytes) return false;
    return true;
  } catch { return false; }
}
export async function writeJson(directory, name, value) {
  await writeBytes(directory, name, new TextEncoder().encode(JSON.stringify(value)));
}
export async function selectCachedModel(manifest) {
  const root = await navigator.storage.getDirectory();
  const cache = await root.getDirectoryHandle(CACHE_DIRECTORY);
  await writeJson(cache, "selected.json", { key: modelKey(manifest) });
}
export async function pruneCachedModels(manifest) {
  const root = await navigator.storage.getDirectory();
  const cache = await root.getDirectoryHandle(CACHE_DIRECTORY);
  const keep = modelKey(manifest);
  for await (const [name, directory] of cache.entries())
    if (directory.kind === "directory" && name.startsWith("vela-") && name !== keep)
      await cache.removeEntry(name, { recursive: true });
}
export async function readCachedModel() {
  if (!navigator.storage?.getDirectory) return null;
  const root = await navigator.storage.getDirectory();
  let cache;
  try { cache = await root.getDirectoryHandle(CACHE_DIRECTORY); }
  catch (error) { if (error.name === "NotFoundError") return null; throw error; }
  let selected;
  try { selected = JSON.parse(await (await (await cache.getFileHandle("selected.json")).getFile()).text()).key; } catch {}
  const complete = [];
  for await (const [name, directory] of cache.entries()) {
    if (directory.kind !== "directory" || !name.startsWith("vela-")) continue;
    try {
      const meta = JSON.parse(await (await (await directory.getFileHandle("complete.json")).getFile()).text());
      const manifest = validateManifest(meta.manifest);
      if (name !== modelKey(manifest)) continue;
      for (const [file, bytes] of [["model.gz", manifest.bytes], ["module.mjs", manifest.runtime.module.bytes], ["module.wasm", manifest.runtime.wasm.bytes]])
        if ((await (await directory.getFileHandle(file)).getFile()).size !== bytes) throw Error("Incomplete model cache");
      if (name === selected) return manifest;
      complete.push({ manifest, savedAt: meta.savedAt || 0 });
    } catch {}
  }
  return complete.sort((a, b) => b.savedAt - a.savedAt)[0]?.manifest ?? null;
}
export async function inspectModels(signal) {
  const [latest, cached] = await Promise.allSettled([
    fetchManifest(signal), cacheAllowed() ? readCachedModel() : Promise.resolve(null),
  ]);
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const saved = cached.status === "fulfilled" ? cached.value : null;
  if (latest.status === "rejected" && !saved) throw latest.reason;
  return { latest: latest.status === "fulfilled" ? latest.value : null, cached: saved };
}
