import { fetchJson } from "../../platform/requests.js";
import { MODEL_ORIGIN, isHttpsOrigin, isLocalModelSource, modelPath } from "./source.js";
export const MODEL_ID = "vela-v5";
// 화면과 worker 사이의 약속을 가리키는 식별자(../version.js). 모델이 바뀌면 함께 바뀐다.
// 같은 모델에서 두 쪽이 주고받는 메시지의 형식을 바꾸면 뒤의 숫자를 올린다.
export const WORKER_VERSION = `${MODEL_ID}:1`;
export const MODEL_NAME = "VELA v5";
export const MODEL_URL = new URL(`../../../public/models/${MODEL_ID}/`, import.meta.url);
export const MODEL_FILE_DIR = MODEL_ID;
export const RELEASE_URL = 'https://github.com/alfm201/adventure/releases/tag/vela-v5';
export const MODEL_FILENAME = `${MODEL_ID}.bin.gz`;
export const MODEL_FILE = MODEL_FILENAME;
export const LOCAL_MODEL = isLocalModelSource(MODEL_URL);
const hash = /^[a-f0-9]{64}$/;
const positive = (n) => Number.isSafeInteger(n) && n > 0 && n < 2147483648;
export function validateManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !/^vela-[a-z0-9.-]{1,32}$/.test(manifest.id) ||
      !/^[a-z0-9.-]{1,48}$/.test(manifest.version) || !/^VELA[ a-zA-Z0-9.-]{0,48}$/.test(manifest.name) ||
      !positive(manifest.bytes) || !positive(manifest.decodedBytes) || !positive(manifest.chunkBytes) ||
      !hash.test(manifest.sha256) || !hash.test(manifest.decodedSha256) ||
      !Array.isArray(manifest.chunkHashes) || manifest.chunkHashes.length !== Math.ceil(manifest.decodedBytes / manifest.chunkBytes) ||
      !manifest.chunkHashes.every(value => hash.test(value))) throw Error("Invalid model manifest");
  for (const record of [manifest, manifest.runtime?.module, manifest.runtime?.wasm]) {
    if (!record || !positive(record.bytes) || !hash.test(record.sha256) || typeof record.file !== "string" ||
        new URL(record.file, MODEL_URL).origin !== MODEL_URL.origin) throw Error("Invalid model file");
  }
  return manifest;
}
export const modelKey = (manifest) => `${manifest.id}-${manifest.version}-${manifest.sha256.slice(0, 16)}-${manifest.runtime.module.sha256.slice(0, 16)}-${manifest.runtime.wasm.sha256.slice(0, 16)}`;
export const sameModel = (a, b) => !!a && !!b && modelKey(a) === modelKey(b);
export function modelFileUrl(manifest, origin = MODEL_ORIGIN, baseUrl = MODEL_URL) {
  if (!origin || isLocalModelSource(baseUrl)) return new URL(manifest.file, baseUrl);
  if (!isHttpsOrigin(origin)) throw Error("Invalid model origin");
  return new URL(modelPath(manifest), origin);
}
export async function fetchManifest(signal) {
  return validateManifest(await fetchJson(new URL("manifest.json", MODEL_URL), { signal }));
}
