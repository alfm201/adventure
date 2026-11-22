import { modelKey, sameModel, validateManifest, fetchManifest, LOCAL_MODEL, MODEL_ID } from "./model.js";
import { writeBytes } from "./files.js";
import { versionMismatch } from "../version.js";

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
    // 모델 폴더가 있을 때만 저장본이 있다고 본다. 예전 배포가 남긴 selected.json 같은 파일은 세지 않는다.
    for await (const handle of directory.values()) if (handle.kind === "directory") return true;
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
// 이전 배포(v4.3)의 worker.js가 이 이름을 가져온다. 브라우저가 예전 worker.js를 보관한 채 이 파일만 새로 받으면
// 이름이 없어 worker가 뜨지 못하므로, 하는 일 없이 이름만 남긴다. v5의 worker.js는 쓰지 않으니 다음 모델 전환 때 지운다.
export async function selectCachedModel() {}
// 캐시 폴더 이름은 modelKey, 곧 `${id}-${version}-${모델 해시}-${mjs 해시}-${wasm 해시}`이고
// version은 배포 날짜(YYYYMMDD)로 끝난다. 폴더 이름에서 그 날짜를 읽는다.
const releaseDate = (name) => /-(\d{8})-[0-9a-f]{16}-[0-9a-f]{16}-[0-9a-f]{16}$/.exec(name)?.[1] ?? null;
// 정리할 폴더인지: 자기보다 먼저 배포된 모델만 지운다.
// 배포 날짜가 같거나 더 늦은 폴더는 같은 브라우저에서 새 버전의 화면이 저장한 것일 수 있다. 열려 있던 예전 화면이
// 그것을 지우면 새 화면이 모델을 다시 받아야 하므로 남긴다. 날짜를 읽지 못한 이름도 남긴다.
// 같은 날짜의 다른 빌드는 어느 쪽이 새 것인지 알 수 없어 둘 다 두고, 다음 날짜의 배포가 정리한다.
export function isEarlierRelease(name, keep) {
  const date = releaseDate(name), current = releaseDate(keep);
  return !!date && !!current && date < current;
}
export async function pruneCachedModels(manifest, signal) {
  validateManifest(manifest);
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  if (!navigator.storage?.getDirectory) return;
  const root = await navigator.storage.getDirectory();
  let cache;
  try { cache = await root.getDirectoryHandle(CACHE_DIRECTORY); }
  catch (error) { if (error.name === "NotFoundError") return; throw error; }
  const keep = modelKey(manifest);
  for await (const [name, directory] of cache.entries()) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    if (directory.kind === "directory" && name.startsWith("vela-") && isEarlierRelease(name, keep))
      await cache.removeEntry(name, { recursive: true });
  }
}
export async function inspectModels(signal) {
  const latest = await fetchManifest(signal);
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  if (latest.id !== MODEL_ID) throw versionMismatch();
  try { await pruneCachedModels(latest, signal); }
  catch (error) {
    if (signal?.aborted) throw error;
    console.error("Model cache cleanup failed", error);
  }
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  // 이 화면이 쓸 모델의 저장본이 있는지 직접 확인한다. 다른 배포의 저장본이 함께 있어도 영향을 받지 않는다.
  const cached = cacheAllowed() && await hasCachedModel(latest);
  return { latest, cached: cached ? latest : null };
}
