// The hosted package is shared by CPU and GPU.
import { isLocalModelSource } from '../vela/source.js';
export const MODEL_ID = 'lyra-v2';
export const MODEL_NAME = 'LYRA v2';
export const ASSET_URL = new URL('../../../public/models/lyra-v2/', import.meta.url);
export const ORT_URL = new URL('../../../public/runtime/onnxruntime-web/1.30.0/', import.meta.url);
export const PACKAGE_URL = 'https://adventure.alfm201.workers.dev/models/lyra-v2/lyra-v2.bin.gz';
export const LOCAL_MODEL = isLocalModelSource(ASSET_URL);
export const LOCAL_PACKAGE_URL = new URL('lyra-v2.bin.gz', ASSET_URL);
export const PACKAGE_SHA256 = '455878806a8289d50c29c6272e3a4a5132b1ca505996be7f8e4716f71b1ff67e';
export const PACKAGE_BYTES = 67737222;
export const DECODED_BYTES = 106520738;
export const MANIFEST = Object.freeze({
  id: MODEL_ID, name: MODEL_NAME, version: '2', researchValue: 'M₄₀', researchPolicy: 'M₄₀ 1-step', horizon: 1,
  d: 384, layers: 8, heads: 8, modelFile: 'lyra-m40-fp32.onnx',
  precision: 'fp32', sourceSha256: 'a1423ac38c60ee5a59d48b212880e402ede9f048d5920e26217395049d902f00',
  sha256: '70b19df60a4940cb607479090cdfc3247557c0fcd9f170334b57c7f261747ca1',
  featuresSha256: '60d8c2688ce6081a64acd4927d0874dc3f6a6c3d4f4ba35471b64f2d61cef6ec',
  metadataSha256: '00346c81c8df480264eaf235172052fecb0372236b71fd66d9a3bb070ba4dd31',
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
