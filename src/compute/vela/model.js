import { fetchJson } from "../../platform/requests.js";
import { MODEL_ORIGIN, isHttpsOrigin, isLocalModelSource, modelPath } from "./source.js";
export const MODEL_URL = new URL("../../../public/models/vela-v4/", import.meta.url);
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
