(() => {
  const qs = new URLSearchParams(location.search);
  if (qs.get('mode') !== 'test') return;

  const startedAt = performance.now();
  const lines = [];
  const BASE_SEED = 0x6a09e667;
  const WORKGROUP_SIZE = 64;
  const PARTIAL_STRIDE = 5;
  const FULL_ROLLOUTS = queryInt('fullRollouts', 65536, 4096, 131072);
  const FULL_REPEATS = queryInt('fullRepeats', 5, 1, 8);
  let root;
  let pre;
  let running = false;

  function queryInt(name, fallback, min, max) {
    const raw = qs.get(name);
    if (raw === null || raw === '') return fallback;
    const value = Math.trunc(Number(raw));
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }

  const u32 = value => Number(value) >>> 0;
  const hex32 = value => `0x${u32(value).toString(16).padStart(8, '0')}`;
  const errText = error => error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function ensureUi() {
    if (root) return;
    root = document.createElement('div');
    root.style.cssText = 'position:fixed;z-index:30000;left:8px;right:8px;bottom:8px;max-height:72vh;padding:10px;background:rgba(15,23,42,.97);color:#e2e8f0;border:1px solid #475569;border-radius:8px;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;display:flex;flex-direction:column;gap:6px';
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;gap:8px';
    const title = document.createElement('strong');
    title.textContent = 'RNG full-rollout 진단 · production 중지';
    const copy = document.createElement('button');
    copy.textContent = '전체 복사';
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(lines.join('\n')); } catch (_) {}
    };
    pre = document.createElement('pre');
    pre.style.cssText = 'margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word;user-select:text';
    header.append(title, copy);
    root.append(header, pre);
    document.body.appendChild(root);
  }

  function log(stage, message, extra) {
    ensureUi();
    const ms = (performance.now() - startedAt).toFixed(1).padStart(7, ' ');
    lines.push(`[+${ms}ms] ${stage} ${message}${extra === undefined ? '' : ` · ${JSON.stringify(extra)}`}`);
    pre.textContent = lines.join('\n');
    pre.scrollTop = pre.scrollHeight;
    console.log('[GPU TEST]', stage, message, extra ?? '');
  }

  function wrapMethod(target, name, makeWrapper) {
    if (!target || typeof target[name] !== 'function') return false;
    const original = target[name].bind(target);
    const wrapped = makeWrapper(original);
    try {
      Object.defineProperty(target, name, { configurable: true, writable: true, value: wrapped });
      return true;
    } catch (_) {
      try {
        target[name] = wrapped;
        return target[name] === wrapped;
      } catch (_) {
        return false;
      }
    }
  }

  function stopProductionMeasurements() {
    const blocked = [];
    if (typeof window.prepareGpuReadbackModeOnLoad === 'function') {
      wrapMethod(window, 'prepareGpuReadbackModeOnLoad', () => async () => log('T0 SERVICE STOP', 'production GPU init 차단'));
      blocked.push('prepareGpuReadbackModeOnLoad');
    }
    if (typeof window.verifyGpuEngineOnLoad === 'function') {
      wrapMethod(window, 'verifyGpuEngineOnLoad', () => async () => ({ ok: true, skipped: true }));
      blocked.push('verifyGpuEngineOnLoad');
    }
    if (typeof window.calcEx === 'function') {
      wrapMethod(window, 'calcEx', () => async () => log('T0 SERVICE STOP', 'production calcEx 차단'));
      blocked.push('calcEx');
    }
    if (typeof window.showComputeModeModal === 'function') {
      wrapMethod(window, 'showComputeModeModal', () => callback => {
        log('T0 SERVICE STOP', 'production modal/benchmark 차단');
        if (typeof callback === 'function') callback();
      });
      blocked.push('showComputeModeModal');
    }
    const wb = window.gpuRolloutWorkbench;
    if (wb) {
      for (const name of ['prepareGpuReadbackMode', 'runGpu', 'runGpuAllActions']) {
        if (typeof wb[name] !== 'function') continue;
        wrapMethod(wb, name, () => async () => { throw new Error(`mode=test production ${name} disabled`); });
        blocked.push(`gpuRolloutWorkbench.${name}`);
      }
    }
    log('T0 SERVICE STOP', '기존 서비스 실측 차단 완료', { blocked });
  }

  function nextRandCpu(holder) {
    const t = u32(holder.value + 0x6D2B79F5);
    holder.value = t;
    let r = u32(Math.imul(u32(t ^ (t >>> 15)), u32(1 | t)));
    r = u32(r ^ u32(r + Math.imul(u32(r ^ (r >>> 7)), 61)));
    return u32(r ^ (r >>> 14));
  }

  function bitsForBound(bound) {
    if (bound <= 1) return 0;
    if (bound <= 2) return 1;
    if (bound <= 4) return 2;
    if (bound <= 8) return 3;
    if (bound <= 16) return 4;
    return 5;
  }

  function freshCpu(rng, bound) {
    if (bound <= 1) return 0;
    const bits = bitsForBound(bound);
    const mask = (1 << bits) - 1;
    while (true) {
      const candidate = nextRandCpu(rng) & mask;
      if (candidate < bound) return candidate;
    }
  }

  function reservoirState(seed) {
    return { rng: { value: u32(seed) }, word: 0, bits: 0, calls: 0, rejects: 0 };
  }

  function reservoirCpu(state, bound) {
    if (bound <= 1) return 0;
    const bits = bitsForBound(bound);
    const mask = (1 << bits) - 1;
    while (true) {
      if (state.bits < bits) {
        state.word = nextRandCpu(state.rng);
        state.bits = 32;
        state.calls++;
      }
      const candidate = state.word & mask;
      state.word >>>= bits;
      state.bits -= bits;
      if (candidate < bound) return candidate;
      state.rejects++;
    }
  }

  function diagnosticShader() {
    return `
struct Params { seed:u32, lanes:u32, method:u32, pad:u32, }
struct Reservoir { word:u32, bits:u32, calls:u32, rejects:u32, }
@group(0) @binding(0) var<storage, read_write> output: array<u32>;
@group(0) @binding(1) var<uniform> params: Params;

fn next_rand(rng: ptr<function, u32>) -> u32 {
  var t = (*rng) + 0x6D2B79F5u;
  (*rng) = t;
  var r = (t ^ (t >> 15u)) * (1u | t);
  r = r ^ (r + ((r ^ (r >> 7u)) * 61u));
  return r ^ (r >> 14u);
}
fn bits_for_bound(bound:u32) -> u32 {
  if (bound <= 1u) { return 0u; }
  if (bound <= 2u) { return 1u; }
  if (bound <= 4u) { return 2u; }
  if (bound <= 8u) { return 3u; }
  if (bound <= 16u) { return 4u; }
  return 5u;
}
fn fresh(rng:ptr<function,u32>, bound:u32) -> u32 {
  if (bound <= 1u) { return 0u; }
  let bits = bits_for_bound(bound);
  let mask = (1u << bits) - 1u;
  loop {
    let candidate = next_rand(rng) & mask;
    if (candidate < bound) { return candidate; }
  }
}
fn reservoir(rng:ptr<function,u32>, state:ptr<function,Reservoir>, bound:u32) -> u32 {
  if (bound <= 1u) { return 0u; }
  let bits = bits_for_bound(bound);
  let mask = (1u << bits) - 1u;
  loop {
    if ((*state).bits < bits) {
      (*state).word = next_rand(rng);
      (*state).bits = 32u;
      (*state).calls = (*state).calls + 1u;
    }
    let candidate = (*state).word & mask;
    (*state).word = (*state).word >> bits;
    (*state).bits = (*state).bits - bits;
    if (candidate < bound) { return candidate; }
    (*state).rejects = (*state).rejects + 1u;
  }
}

@compute @workgroup_size(64)
fn prod_mod(@builtin(global_invocation_id) gid:vec3<u32>) {
  let lane = gid.x;
  if (lane >= params.lanes) { return; }
  let base = lane * 4u;
  var rng = params.seed + lane * 747796405u + 2891336453u;
  let a = i32(next_rand(&rng) % 6u) + 1;
  let b = i32(next_rand(&rng) % 6u) + 1;
  output[base] = bitcast<u32>(a);
  output[base + 1u] = bitcast<u32>(b);
  output[base + 2u] = rng;
  output[base + 3u] = select(0u, 1u, a < 1 || a > 6 || b < 1 || b > 6);
}

@compute @workgroup_size(64)
fn parity(@builtin(global_invocation_id) gid:vec3<u32>) {
  let lane = gid.x;
  if (lane >= params.lanes) { return; }
  let base = lane * 100u;
  var rng = params.seed + lane * 747796405u + 2891336453u;
  var state:Reservoir;
  state.word = 0u; state.bits = 0u; state.calls = 0u; state.rejects = 0u;
  var cardBound = 1u;
  for (var i=0u; i<96u; i=i+1u) {
    var bound = 6u;
    if (i >= 48u) {
      bound = cardBound;
      cardBound = cardBound + 1u;
      if (cardBound > 30u) { cardBound = 1u; }
    }
    output[base+i] = select(reservoir(&rng,&state,bound), fresh(&rng,bound), params.method == 1u);
  }
  output[base+96u] = state.calls;
  output[base+97u] = state.rejects;
  output[base+98u] = rng;
  output[base+99u] = state.bits;
}
`;
  }

  async function compilePipeline(device, module, entryPoint) {
    const descriptor = { layout: 'auto', compute: { module, entryPoint } };
    return typeof device.createComputePipelineAsync === 'function'
      ? await device.createComputePipelineAsync(descriptor)
      : device.createComputePipeline(descriptor);
  }

  async function checkShader(module, label) {
    if (typeof module.getCompilationInfo !== 'function') return;
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter(message => message.type === 'error');
    if (errors.length) throw new Error(`${label}: ${errors.map(message => message.message).join(' | ')}`);
  }

  async function dispatchRead(device, pipeline, lanes, stride, paramsData) {
    const byteLength = lanes * stride * 4;
    const output = device.createBuffer({ size: byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const read = device.createBuffer({ size: byteLength, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const uniform = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(uniform, 0, paramsData);
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: output } },
        { binding: 1, resource: { buffer: uniform } },
      ],
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(lanes / WORKGROUP_SIZE));
    pass.end();
    encoder.copyBufferToBuffer(output, 0, read, 0, byteLength);
    device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);
    const values = new Uint32Array(read.getMappedRange()).slice();
    read.unmap();
    output.destroy(); read.destroy(); uniform.destroy();
    return values;
  }

  async function newDiagnosticDevice() {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('adapter=null');
    return adapter.requestDevice();
  }

  async function runParity() {
    const device = await newDiagnosticDevice();
    const module = device.createShaderModule({ code: diagnosticShader() });
    await checkShader(module, 'diagnostic shader');
    const prodPipeline = await compilePipeline(device, module, 'prod_mod');
    const parityPipeline = await compilePipeline(device, module, 'parity');

    const prod = await dispatchRead(device, prodPipeline, 256, 4, new Uint32Array([BASE_SEED, 256, 0, 0]));
    let mismatchedLanes = 0;
    let invalidLanes = 0;
    let firstMismatch = null;
    for (let lane=0; lane<256; lane++) {
      const seed = u32(BASE_SEED + Math.imul(lane, 747796405) + 2891336453);
      const rng = { value: seed };
      const raw1 = nextRandCpu(rng);
      const raw2 = nextRandCpu(rng);
      const cpu = [raw1 % 6 + 1, raw2 % 6 + 1];
      const gpu = [prod[lane*4] | 0, prod[lane*4+1] | 0];
      invalidLanes += prod[lane*4+3];
      if (cpu[0] !== gpu[0] || cpu[1] !== gpu[1]) {
        mismatchedLanes++;
        if (!firstMismatch) firstMismatch = { lane, seed:hex32(seed), raw1:hex32(raw1), raw2:hex32(raw2), cpu, gpu };
      }
    }
    log('R4A GPU prod-mod', mismatchedLanes ? 'production modulo 오류 재현' : 'production modulo PASS', { mismatchedLanes, invalidLanes, firstMismatch });

    for (const method of [1, 2]) {
      const values = await dispatchRead(device, parityPipeline, 256, 100, new Uint32Array([BASE_SEED, 256, method, 0]));
      let mismatches = 0;
      let first = null;
      for (let lane=0; lane<256; lane++) {
        const seed = u32(BASE_SEED + Math.imul(lane, 747796405) + 2891336453);
        const rng = { value: seed };
        const state = reservoirState(seed);
        let cardBound = 1;
        for (let draw=0; draw<96; draw++) {
          let bound = 6;
          if (draw >= 48) {
            bound = cardBound++;
            if (cardBound > 30) cardBound = 1;
          }
          const cpu = method === 1 ? freshCpu(rng, bound) : reservoirCpu(state, bound);
          const gpu = values[lane*100 + draw];
          if (cpu !== gpu) {
            mismatches++;
            if (!first) first = { lane, draw, cpu, gpu };
          }
        }
        if (method === 2) {
          const meta = [state.calls, state.rejects, state.rng.value, state.bits];
          for (let k=0; k<4; k++) {
            const gpu = values[lane*100 + 96 + k];
            if (u32(meta[k]) !== gpu) {
              mismatches++;
              if (!first) first = { lane, meta:k, cpu:u32(meta[k]), gpu };
            }
          }
        } else {
          const gpuRng = values[lane*100 + 98];
          if (u32(rng.value) !== gpuRng) {
            mismatches++;
            if (!first) first = { lane, meta:'rng', cpu:u32(rng.value), gpu:gpuRng };
          }
        }
      }
      log('R4 GPU parity', `${method === 1 ? 'fresh-mask' : 'bit-reservoir'} ${mismatches ? 'FAIL' : 'exact PASS'}`, {
        sampleValues: 256*96,
        mismatches,
        firstMismatch:first,
      });
    }
    return { mismatchedLanes, invalidLanes };
  }

  function samplerInjection(kind) {
    const common = `\nfn diag_bits_for_bound(bound:u32)->u32{if(bound<=1u){return 0u;}if(bound<=2u){return 1u;}if(bound<=4u){return 2u;}if(bound<=8u){return 3u;}if(bound<=16u){return 4u;}return 5u;}\n`;
    if (kind === 'fresh') {
      return common + `fn diag_sample(rng:ptr<function,u32>,bound:u32)->u32{if(bound<=1u){return 0u;}let bits=diag_bits_for_bound(bound);let mask=(1u<<bits)-1u;loop{let candidate=next_rand(rng)&mask;if(candidate<bound){return candidate;}}}\n`;
    }
    return common + `var<private> diag_word:u32;var<private> diag_bits:u32;fn diag_sample(rng:ptr<function,u32>,bound:u32)->u32{if(bound<=1u){return 0u;}let bits=diag_bits_for_bound(bound);let mask=(1u<<bits)-1u;loop{if(diag_bits<bits){diag_word=next_rand(rng);diag_bits=32u;}let candidate=diag_word&mask;diag_word=diag_word>>bits;diag_bits=diag_bits-bits;if(candidate<bound){return candidate;}}}\n`;
  }

  function makeProductionVariant(tables, kind) {
    let source = window.shaderSource(tables);
    const diceUses = (source.match(/next_rand\(rng\) % 6u/g) || []).length;
    const cardUses = (source.match(/next_rand\(rng\) % remaining/g) || []).length;
    if (diceUses !== 2 || cardUses !== 1) throw new Error(`production sampler 위치 불일치 dice=${diceUses} card=${cardUses}`);
    source = source.replaceAll('next_rand(rng) % 6u', 'diag_sample(rng, 6u)');
    source = source.replaceAll('next_rand(rng) % remaining', 'diag_sample(rng, remaining)');
    const marker = 'fn stage_id_at(index: i32) -> i32 {';
    const index = source.indexOf(marker);
    if (index < 0) throw new Error('WGSL injection marker 없음');
    return source.slice(0, index) + samplerInjection(kind) + source.slice(index);
  }

  function storageBuffer(device, typedArray) {
    const buffer = device.createBuffer({ size: Math.max(4, typedArray.byteLength), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(buffer, 0, typedArray);
    return buffer;
  }

  function summarizePartials(values) {
    let count=0, sum=0, sumSq=0, min=Infinity, max=-Infinity;
    for (let i=0; i<values.length; i+=PARTIAL_STRIDE) {
      const c = values[i];
      if (!c) continue;
      count += c;
      sum += values[i+1];
      sumSq += values[i+2];
      min = Math.min(min, values[i+3]);
      max = Math.max(max, values[i+4]);
    }
    const mean = sum / count;
    const variance = Math.max(0, sumSq / count - mean * mean);
    return { count, mean, std:Math.sqrt(variance), min, max, sum, sumSq };
  }

  function mergeRuns(runs) {
    const count = runs.reduce((s,r)=>s+r.count,0);
    const sum = runs.reduce((s,r)=>s+r.sum,0);
    const sumSq = runs.reduce((s,r)=>s+r.sumSq,0);
    const mean = sum / count;
    const variance = Math.max(0, sumSq / count - mean * mean);
    return { count, mean, std:Math.sqrt(variance), min:Math.min(...runs.map(r=>r.min)), max:Math.max(...runs.map(r=>r.max)), se:Math.sqrt(variance / count) };
  }

  async function runFullRolloutAB() {
    if (typeof window.shaderSource !== 'function' || typeof window.buildGpuTables !== 'function' || typeof window.buildX36GpuLookupData !== 'function') {
      throw new Error('production GPU helper 없음');
    }
    const tables = window.buildGpuTables();
    const device = await newDiagnosticDevice();
    const pipelines = {};
    for (const kind of ['fresh','reservoir']) {
      const module = device.createShaderModule({ code: makeProductionVariant(tables, kind) });
      await checkShader(module, `full ${kind}`);
      pipelines[kind] = await compilePipeline(device, module, 'main');
    }

    const shared = {
      stageId: storageBuffer(device, window.buildX36GpuLookupData(tables)),
      stageMove: storageBuffer(device, new Int32Array(tables.stageMove)),
      stageEvent: storageBuffer(device, new Int32Array(tables.stageEvent)),
      cardType: storageBuffer(device, new Int32Array(tables.cardType)),
      cardValue: storageBuffer(device, new Int32Array(tables.cardValue)),
    };

    async function runOne(kind, state, rolloutCount, seed) {
      const input = storageBuffer(device, new Int32Array(state));
      const partialCount = Math.ceil(rolloutCount / WORKGROUP_SIZE);
      const byteLength = partialCount * PARTIAL_STRIDE * 4;
      const output = device.createBuffer({ size:byteLength, usage:GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
      const read = device.createBuffer({ size:byteLength, usage:GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const uniform = device.createBuffer({ size:32, usage:GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(uniform, 0, new Uint32Array([rolloutCount,0,seed>>>0,512,1,0,0,0]));
      const bindGroup = device.createBindGroup({ layout:pipelines[kind].getBindGroupLayout(0), entries:[
        {binding:0,resource:{buffer:shared.stageId}}, {binding:1,resource:{buffer:shared.stageMove}},
        {binding:2,resource:{buffer:shared.stageEvent}}, {binding:3,resource:{buffer:shared.cardType}},
        {binding:4,resource:{buffer:shared.cardValue}}, {binding:5,resource:{buffer:input}},
        {binding:6,resource:{buffer:output}}, {binding:7,resource:{buffer:uniform}},
      ]});
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipelines[kind]); pass.setBindGroup(0, bindGroup); pass.dispatchWorkgroups(partialCount); pass.end();
      encoder.copyBufferToBuffer(output,0,read,0,byteLength);
      const t0 = performance.now();
      device.queue.submit([encoder.finish()]);
      await read.mapAsync(GPUMapMode.READ);
      const elapsedMs = performance.now() - t0;
      const values = new Uint32Array(read.getMappedRange()).slice();
      read.unmap(); input.destroy(); output.destroy(); read.destroy(); uniform.destroy();
      return { ...summarizePartials(values), elapsedMs, rolloutsPerSec:rolloutCount/(elapsedMs/1000) };
    }

    const initial = new Board().getState().slice();
    initial[1] = true;
    const doubleState = initial.slice();
    doubleState[5] = 100;
    doubleState[6] = 1;
    const sanity = {};
    for (const kind of ['fresh','reservoir']) sanity[kind] = await runOne(kind,doubleState,8192,BASE_SEED ^ 0x55555555);
    log('R8 GPU full sanity','double-state',{expected:{min:4,max:22},results:sanity});

    const result = {};
    const seeds = Array.from({length:FULL_REPEATS},(_,i)=>u32(BASE_SEED + Math.imul(i+1,0x9e3779b1)));
    for (const kind of ['fresh','reservoir']) {
      await runOne(kind,initial,2048,BASE_SEED);
      const runs = [];
      for (const seed of seeds) runs.push(await runOne(kind,initial,FULL_ROLLOUTS,seed));
      result[kind] = {
        runs,
        medianRolloutsPerSec:median(runs.map(r=>r.rolloutsPerSec)),
        aggregate:mergeRuns(runs),
      };
    }

    const speedRatio = result.reservoir.medianRolloutsPerSec / result.fresh.medianRolloutsPerSec;
    const meanDelta = result.reservoir.aggregate.mean - result.fresh.aggregate.mean;
    const deltaSe = Math.sqrt(result.reservoir.aggregate.se ** 2 + result.fresh.aggregate.se ** 2);
    const zScore = deltaSe > 0 ? meanDelta / deltaSe : 0;
    log('R9 GPU full A/B','production X36 sampler 비교',{
      rolloutsPerRun:FULL_ROLLOUTS,repeats:FULL_REPEATS,
      fresh:result.fresh,reservoir:result.reservoir,
      reservoirVsFreshSpeed:speedRatio,aggregateMeanDelta:meanDelta,deltaSe,zScore,
    });

    Object.values(shared).forEach(buffer => buffer.destroy());
    return { speedRatio, meanDelta, deltaSe, zScore, result };
  }

  async function run() {
    if (running) return;
    running = true;
    try {
      log('R0 CONFIG','GPU full-rollout 진단 시작',{
        fullRollouts:FULL_ROLLOUTS,fullRepeats:FULL_REPEATS,
        totalPerSampler:FULL_ROLLOUTS*FULL_REPEATS,
        cpuDecision:'현행 유지 (이전 full A/B에서 fast -2.47%, quality +0.14%)',
        strongerRun:'?mode=test&fullRollouts=131072&fullRepeats=8',
        productionMeasurementsStopped:true,
      });
      if (!navigator.gpu) throw new Error('navigator.gpu 없음');
      const parity = await runParity();
      let full = null;
      try { full = await runFullRolloutAB(); }
      catch (error) { log('FAIL GPU full A/B',errText(error),error?.stack || ''); }
      log('R12 FINAL','진단 완료',{
        moduloBugReproduced:parity.mismatchedLanes>0,
        fullGpuReservoirVsFreshSpeed:full?.speedRatio ?? null,
        fullGpuMeanDelta:full?.meanDelta ?? null,
        fullGpuDeltaZ:full?.zScore ?? null,
        cpuPatchRecommended:false,
        productionChanged:false,
        productionMeasurementsStopped:true,
      });
    } catch (error) {
      log('FAIL diagnostic',errText(error),error?.stack || '');
    } finally {
      running = false;
    }
  }

  window.addEventListener('error', event => log('WINDOW error',event.message || errText(event.error)));
  window.addEventListener('unhandledrejection', event => log('WINDOW rejection',errText(event.reason)));
  ensureUi();
  log('S0 bootstrap','진단 시작',{href:location.href,secureContext:window.isSecureContext,userAgent:navigator.userAgent});
  log('S1 navigator.gpu',navigator.gpu?'존재':'없음');
  stopProductionMeasurements();
  setTimeout(run,0);
})();
