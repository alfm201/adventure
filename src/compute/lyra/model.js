// The hosted package is shared by CPU and GPU.
import { isLocalModelSource } from '../vela/source.js';
export const MODEL_ID = 'lyra-v1';
export const MODEL_NAME = 'LYRA v1';
export const ASSET_URL = new URL('../../../public/models/lyra-v1/', import.meta.url);
export const ORT_URL = new URL('../../../public/runtime/onnxruntime-web/1.30.0/', import.meta.url);
export const PACKAGE_URL = 'https://adventure.alfm201.workers.dev/models/lyra-v1/lyra-v1.bin.gz';
export const LOCAL_MODEL = isLocalModelSource(ASSET_URL);
export const LOCAL_PACKAGE_URL = new URL('lyra-v1.bin.gz', ASSET_URL);
export const PACKAGE_SHA256 = '274b82225574723b6236c9f87da653b22c2d5bb0318c00241c4e7af91055ddcd';
export const MANIFEST = Object.freeze({
  id: MODEL_ID, name: MODEL_NAME, version: '1', researchValue: 'V₂₀', researchPolicy: 'π₂₀', horizon: 1,
  precision: 'fp32', sourceSha256: 'b4edb84d4c64cd4b7d0d16bcc8db0eab6f521d5090b13426f797b50ac363d09a',
  sha256: 'bbab87b3d9f11b2f04e3936c15b6085bb8129fd964486f3aa4da20b72250725f',
  featuresSha256: 'c8b39ce537ac64d7f74848fb28579544e5b46bcd690eabc3553672cdd61950f6',
  metadataSha256: 'cfaad02340bd0fd7e936ec88178397a51216fbc32f097edb80ca656de118889a',
});
export const usageProfile = (engine, usage) => ({ usage,
  batchSize: usage === 'high' ? null : usage === 'medium' ? 64 : engine === 'cpu' ? 8 : 16,
  pauseMs: usage === 'low' ? engine === 'cpu' ? 16 : 8 : 0 });

export async function probeLyraGpu() {
  if (!globalThis.isSecureContext || !navigator.gpu) return { available: false, code: 'gpu-api' };
  let device;
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance', forceFallbackAdapter: false });
    if (!adapter || adapter.info?.isFallbackAdapter) return { available: false, code: 'gpu-adapter' };
    device = await adapter.requestDevice();
    return { available: true, adapter: adapterDetails(adapter) };
  } catch { return { available: false, code: 'gpu-device' }; }
  finally { device?.destroy(); }
}
export function adapterDetails(adapter) {
  const info = adapter.info ?? {};
  return Object.fromEntries(['vendor', 'architecture', 'device', 'description', 'isFallbackAdapter'].map(k => [k, info[k] ?? null]));
}
