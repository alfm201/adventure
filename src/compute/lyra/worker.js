import { Features, evaluate } from '../../policies/lyra/policy.js';
import { MANIFEST, ASSET_URL, ORT_URL, adapterDetails, usageProfile } from './model.js';
import { researchState, slotValues } from './state.js';
import { unpackPackage } from './package.js';
import { loadScorePredictor, SCORE_ID, SCORE_SHA256 } from './score.js';

let ort, session, features, meta, model, info, preference, usage, runningEngine, lost = false;
let packageInfo,wasmBinaries;
let predictScore, scoreInfo;
async function prepareScorePredictor() {
  try {
    const loaded = await loadScorePredictor(meta.rules);
    predictScore = loaded.predict; scoreInfo = loaded.info;
  } catch (error) {
    predictScore = null;
    scoreInfo = { id: SCORE_ID, sha256: SCORE_SHA256, state: 'unavailable', error: error.message };
    console.error('LYRA score predictor unavailable', error);
  }
}
const post = (type, data = {}) => self.postMessage({ type, ...data });
async function verified(file, hash) {
  const response = await fetch(new URL(file, ASSET_URL), { cache: 'no-store' });
  if (!response.ok) throw Error(`LYRA asset ${response.status}: ${file}`);
  const bytes = await response.arrayBuffer();
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
  if (digest !== hash) throw Error(`LYRA integrity check failed: ${file}`);
  return bytes;
}
async function infer({ tokens, base }, count) {
  const a = new ort.Tensor('float32', tokens, [count, 24, 256]);
  const b = new ort.Tensor('float32', base, [count]);
  let output;
  try {
    output = await session.run({ tokens: a, base: b });
    const values = Array.from(output.value.data); // Includes synchronized GPU -> CPU readback.
    if (values.some(v => !Number.isFinite(v))) throw Error('Non-finite LYRA value');
    return values;
  } finally { output?.value.dispose(); a.dispose(); b.dispose(); }
}
async function predict({ tokens, base }, count) {
  const batch = usage === 'low' ? (runningEngine === 'cpu' ? 8 : 16) : usage === 'medium' ? 64 : count;
  const pauseMs = usage === 'low' ? (runningEngine === 'cpu' ? 16 : 8) : 0;
  const values = [];
  for (let offset = 0; offset < count; offset += batch) {
    const end = Math.min(count, offset + batch);
    values.push(...await infer({ tokens: tokens.subarray(offset * 6144, end * 6144), base: base.subarray(offset, end) }, end - offset));
    if (end < count && usage !== 'high') await new Promise(resolve => setTimeout(resolve, pauseMs));
  }
  return values;
}
async function initialize(engine) {
  runningEngine = engine;
  post('progress', { phase: 'initialize', engine });
  let adapter;
  if (engine === 'gpu') {
    if (!navigator.gpu) throw Error('WebGPU unavailable');
    adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance', forceFallbackAdapter: false });
    if (!adapter || adapter.info?.isFallbackAdapter) throw Error('No hardware WebGPU adapter');
  }
  // The uploaded GPU binary is the JSEP build, paired with ort.all (the
  // webgpu-only frontend instead requires a different asyncify binary).
  if(!ort){
    ort=await import(new URL(engine === 'gpu' ? 'ort.all.min.mjs' : 'ort.wasm.min.mjs', ORT_URL));
    ort.env.wasm.wasmBinary=wasmBinaries[engine]; wasmBinaries=null;
  }
  ort.env.wasm.numThreads = 1; // Works without changing the site's COOP/COEP headers.
  ort.env.wasm.wasmPaths = ORT_URL.href;
  if (adapter) ort.env.webgpu.adapter = adapter;
  session = await ort.InferenceSession.create(model, { executionProviders: [engine === 'gpu' ? 'webgpu' : 'wasm'], graphOptimizationLevel: 'all' });
  delete ort.env.wasm.wasmBinary; // The initialized module no longer needs the input binary option.
  lost = false;
  if (engine === 'gpu') {
    const device = await ort.env.webgpu.device;
    device.lost.then(() => { lost = true; });
  }
  // A real model execution verifies more than adapter presence. No tuning.
  post('progress', { phase: 'warmup', engine });
  await predict(features.create([[1, 0, 0, 0, 0, 0, 0, 0, 0, 0x3fffffff, 0]]), 1);
  info = { ...packageInfo, manifest: MANIFEST, preference, engine, ...usageProfile(engine, usage), adapter: adapter ? adapterDetails(adapter) : null,
    runtimeCachePolicy: engine === 'gpu' ? 'lyra-postrun-v2' : null,
    ortVersion: ort.env.versions, threads: 1, fallback: info?.fallback ?? null, scorePredictor: scoreInfo };
}
async function cpuFallback(error) {
  const reason = String(error?.message ?? error);
  try { await session?.release(); } catch { /* A lost device may already be released. */ }
  session = null;
  globalThis.__lyraTrimGpuCache?.(0);
  info = { ...info, fallback: reason };
  await initialize('cpu');
  model = null; // Auto has completed its one-way fallback; no further GPU restart uses these weights.
  post('backend', info);
}
async function prepare(device, level = 'medium', data) {
  if (!['auto', 'cpu', 'gpu'].includes(device)) throw Error('Invalid LYRA device');
  if (!['low', 'medium', 'high'].includes(level)) throw Error('Invalid LYRA usage');
  preference = device; usage = level;
  post('progress', { phase: 'load' });
  await loadAssets(data, device);
  const predictorReady = prepareScorePredictor();
  if (device === 'cpu') await initialize('cpu');
  else {
    try { await initialize('gpu'); }
    catch (error) { if (device !== 'auto') throw error; await cpuFallback(error); }
  }
  if (device !== 'auto' || runningEngine === 'cpu') model = null;
  await predictorReady;
  info.scorePredictor = scoreInfo;
  post('ready', info);
}
async function loadAssets(data, device) {
  // This scope ends before ORT compilation: no views keep the decoded 66 MB
  // container alive while the engine allocates its own model and working memory.
  const files = await unpackPackage(data.packageBytes, data.packageManifest);
  packageInfo = data.packageInfo; data.packageBytes = null;
  meta = JSON.parse(new TextDecoder().decode(await verified('assets.json', MANIFEST.metadataSha256)));
  if (meta.model_sha256 !== MANIFEST.sourceSha256 || meta.onnx_sha256 !== MANIFEST.sha256 || meta.features_sha256 !== MANIFEST.featuresSha256)
    throw Error('Unexpected LYRA checkpoint');
  model = files['lyra-v20-fp32.onnx'].slice();
  features = new Features(meta, files['features.bin'].slice().buffer);
  // Auto without WebGPU uses the small CPU runtime from the start.
  wasmBinaries = {};
  if (device !== 'gpu') wasmBinaries.cpu = files['ort-wasm-simd-threaded.wasm'].slice();
  if (device !== 'cpu') wasmBinaries.gpu = files['ort-wasm-simd-threaded.jsep.wasm'].slice();
}
async function run(data) {
  if (data.type === 'prepare') { await prepare(data.device, data.usage, data); return; }
  if (data.type === 'configure') {
    if (!session || !['low','medium','high'].includes(data.usage)) throw Error('Invalid LYRA usage change');
    usage = data.usage; packageInfo = { ...packageInfo, ...data.cacheInfo };
    if (runningEngine === 'gpu') globalThis.__lyraTrimGpuCache?.(usage === 'low' ? 67108864 : usage === 'medium' ? 134217728 : 268435456);
    info = { ...info, ...data.cacheInfo, ...usageProfile(runningEngine, usage) };
    post('configured', { id: data.id, info }); return;
  }
  if (data.type !== 'evaluate' || !session) throw Error('LYRA is not ready');
  const raw = researchState(data.snapshot), start = performance.now();
  let result;
  try {
    if (lost && info.engine === 'gpu') throw Error('WebGPU device lost');
    result = await evaluate(raw, meta.rules, features, predict);
  } catch (error) {
    if (preference !== 'auto' || info.engine !== 'gpu') throw error;
    await cpuFallback(error);
    result = await evaluate(raw, meta.rules, features, predict);
  }
  // All session.run outputs have been read back and disposed at this point.
  // Never trim the intra-run pool while graph nodes still need to reuse it.
  const gpuCache = runningEngine === 'gpu' ? globalThis.__lyraTrimGpuCache?.() : undefined;
  let expectedFinalScore;
  try { expectedFinalScore = predictScore?.(data.snapshot, Math.max(...result.q)); }
  catch (error) { console.error('LYRA score prediction failed', error); }
  post('result', { id: data.id, ...slotValues(data.snapshot, result, meta.rules), expectedFinalScore,
    elapsedMs: performance.now() - start, engine: info.engine, gpuCache });
}
// Session.run is asynchronous: never overlap evaluations on one GPU session.
let queue = Promise.resolve();
self.onmessage = ({ data }) => { queue = queue.then(() => run(data)).catch(error => post('error', { id: data.id, message: error.message, stack: error.stack, code: 'lyra-runtime' })); };
