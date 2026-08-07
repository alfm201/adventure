(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('mode') !== 'test') return;

  const startedAt = performance.now();
  const lines = [];
  const U32_RANGE = 0x100000000;
  const BASE_SEED = 0x6a09e667;
  const PARITY_LANES = 256;
  const PARITY_DRAWS = 96;
  const PARITY_STRIDE = 100;
  const PROD_MOD_STRIDE = 6;
  const BENCH_LANES = 4096;
  const BENCH_STRIDE = 10;
  const DEFAULT_SAMPLES = 1048576;
  const DEFAULT_REPEATS = 3;
  let root;
  let pre;
  let scheduled = false;
  let running = false;
  let serviceStopLogged = false;

  const errText = error => error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error ?? 'unknown error');

  const safeJson = value => {
    try {
      return JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? String(item) : item);
    } catch {
      return String(value);
    }
  };

  function ensureUi() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'gpu-test-diagnostic';
    root.style.cssText = 'position:fixed;z-index:30000;left:8px;right:8px;bottom:8px;max-height:68vh;display:flex;flex-direction:column;gap:6px;padding:10px;border:1px solid #475569;border-radius:8px;background:rgba(15,23,42,.97);color:#e2e8f0;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;box-shadow:0 12px 36px rgba(0,0,0,.45)';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px';
    const title = document.createElement('strong');
    title.textContent = 'WebGPU/RNG sampler 진단 · production 실측 중지';
    const copy = document.createElement('button');
    copy.textContent = '전체 복사';
    copy.style.cssText = 'padding:6px 10px;border:0;border-radius:6px;background:#2563eb;color:white;font-weight:700';
    copy.onclick = async () => {
      const text = lines.join('\n');
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      copy.textContent = '복사 완료';
      setTimeout(() => copy.textContent = '전체 복사', 1000);
    };

    pre = document.createElement('pre');
    pre.style.cssText = 'margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word;user-select:text';
    header.append(title, copy);
    root.append(header, pre);
    document.body.appendChild(root);
  }

  function diag(stage, message, extra) {
    ensureUi();
    const ms = (performance.now() - startedAt).toFixed(1).padStart(7, ' ');
    const suffix = extra === undefined ? '' : ` · ${safeJson(extra)}`;
    lines.push(`[+${ms}ms] ${stage} ${message}${suffix}`);
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

  function logServiceStop(message, extra) {
    if (!serviceStopLogged) {
      serviceStopLogged = true;
      diag('T0 SERVICE STOP', message, extra);
    } else {
      diag('T0 SERVICE STOP', message, extra);
    }
  }

  function stopProductionMeasurements() {
    const blocked = [];

    if (typeof window.prepareGpuReadbackModeOnLoad === 'function') {
      wrapMethod(window, 'prepareGpuReadbackModeOnLoad', () => async () => {
        logServiceStop('production GPU 초기 점검/실측 차단');
      });
      blocked.push('prepareGpuReadbackModeOnLoad');
    }

    if (typeof window.verifyGpuEngineOnLoad === 'function') {
      wrapMethod(window, 'verifyGpuEngineOnLoad', () => async () => {
        logServiceStop('production verifyGpuEngineOnLoad 차단');
        return { ok: true, skipped: true, reason: 'mode=test sampler diagnostic' };
      });
      blocked.push('verifyGpuEngineOnLoad');
    }

    if (typeof window.calcEx === 'function') {
      wrapMethod(window, 'calcEx', () => async () => {
        logServiceStop('production calcEx 실측 차단');
        return undefined;
      });
      blocked.push('calcEx');
    }

    if (typeof window.showComputeModeModal === 'function') {
      wrapMethod(window, 'showComputeModeModal', () => callback => {
        logServiceStop('production 계산방식/자동 벤치 경로 차단');
        if (typeof callback === 'function') callback();
      });
      blocked.push('showComputeModeModal');
    }

    const wb = window.gpuRolloutWorkbench;
    if (wb) {
      for (const name of ['prepareGpuReadbackMode', 'runGpu', 'runGpuAllActions']) {
        if (typeof wb[name] !== 'function') continue;
        wrapMethod(wb, name, () => async () => {
          logServiceStop(`production workbench.${name} 차단`);
          throw new Error(`mode=test: production ${name} disabled`);
        });
        blocked.push(`gpuRolloutWorkbench.${name}`);
      }
    }

    diag('T0 SERVICE STOP', '테스트 모드에서 기존 서비스 실측 진입점 차단 완료', { blocked });
  }

  function u32(value) {
    return Number(value) >>> 0;
  }

  function hex32(value) {
    return `0x${u32(value).toString(16).padStart(8, '0')}`;
  }

  function queryInt(name, fallback, min, max) {
    const raw = params.get(name);
    if (raw === null || raw === '') return fallback;
    const value = Math.trunc(Number(raw));
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }

  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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

  function createReservoir(seed) {
    return {
      rng: { value: u32(seed) },
      word: 0,
      bits: 0,
      rngCalls: 0,
      rejects: 0,
    };
  }

  function reservoirBounded(state, bound) {
    if (bound <= 1) return 0;
    const bitsNeeded = bitsForBound(bound);
    const mask = (1 << bitsNeeded) - 1;
    while (true) {
      if (state.bits < bitsNeeded) {
        state.word = nextRandCpu(state.rng);
        state.bits = 32;
        state.rngCalls++;
      }
      const candidate = state.word & mask;
      state.word >>>= bitsNeeded;
      state.bits -= bitsNeeded;
      if (candidate < bound) return candidate;
      state.rejects++;
    }
  }

  function freshMaskBounded(rng, bound, counters) {
    if (bound <= 1) return 0;
    const bitsNeeded = bitsForBound(bound);
    const mask = (1 << bitsNeeded) - 1;
    while (true) {
      const candidate = nextRandCpu(rng) & mask;
      counters.rngCalls++;
      if (candidate < bound) return candidate;
      counters.rejects++;
    }
  }

  const rejectLimits = Array.from(
    { length: 31 },
    (_, bound) => bound ? Math.floor(U32_RANGE / bound) * bound : 0,
  );

  function rejectModuloBounded(rng, bound, counters) {
    if (bound <= 1) return 0;
    const limit = rejectLimits[bound];
    while (true) {
      const raw = nextRandCpu(rng);
      counters.rngCalls++;
      if (raw < limit) return raw % bound;
      counters.rejects++;
    }
  }

  function mathRandomExactBounded(bound, counters) {
    if (bound <= 1) return 0;
    const limit = rejectLimits[bound];
    while (true) {
      const raw = Math.floor(Math.random() * U32_RANGE);
      counters.rngCalls++;
      if (raw < limit) return raw % bound;
      counters.rejects++;
    }
  }

  function distributionStats(counts) {
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (!total) return { total: 0, chiSquare: 0, maxDeviationPct: 0 };
    const expected = total / counts.length;
    let chiSquare = 0;
    let maxDeviationPct = 0;
    for (const count of counts) {
      const delta = count - expected;
      chiSquare += delta * delta / expected;
      maxDeviationPct = Math.max(maxDeviationPct, Math.abs(delta) / expected * 100);
    }
    return { total, chiSquare, maxDeviationPct };
  }

  function config() {
    const requestedSamples = queryInt('rngSamples', DEFAULT_SAMPLES, 262144, 16777216);
    const repeats = queryInt('rngRepeats', DEFAULT_REPEATS, 1, 8);
    const drawsPerLane = Math.max(1, Math.ceil(requestedSamples / BENCH_LANES));
    return {
      requestedSamples,
      repeats,
      lanes: BENCH_LANES,
      drawsPerLane,
      actualSamples: BENCH_LANES * drawsPerLane,
    };
  }

  function cpuBoundaryTest() {
    let passed = 0;
    let total = 0;
    const failures = [];
    for (let bound = 2; bound <= 30; bound++) {
      const limit = rejectLimits[bound];
      total++;
      if ((limit - 1) % bound === bound - 1) passed++;
      else failures.push({ bound, case: 'limit-1' });

      if (limit < U32_RANGE) {
        total++;
        const source = [u32(limit), 0];
        let sourceIndex = 0;
        let rejects = 0;
        let value = -1;
        while (true) {
          const raw = source[sourceIndex++];
          if (raw < limit) {
            value = raw % bound;
            break;
          }
          rejects++;
        }
        if (value === 0 && rejects === 1) passed++;
        else failures.push({ bound, case: 'reject-limit', value, rejects });
      }
    }
    return { passed, total, failures: failures.slice(0, 5) };
  }

  function benchCpu(method, kind, cfg) {
    const times = [];
    let finalStats;
    for (let run = 0; run <= cfg.repeats; run++) {
      const rng = { value: BASE_SEED };
      const reservoir = createReservoir(BASE_SEED);
      const counters = { rngCalls: 0, rejects: 0 };
      const counts = new Array(6).fill(0);
      const pairCounts = new Array(36).fill(0);
      let previous = -1;
      let cardBound = 1;
      let invalid = 0;
      let checksum = 2166136261 >>> 0;
      const t0 = performance.now();

      for (let i = 0; i < cfg.actualSamples; i++) {
        const bound = kind === 0 ? 6 : cardBound;
        if (kind === 1) {
          cardBound++;
          if (cardBound > 30) cardBound = 1;
        }

        let sampled = 0;
        if (method === 0) {
          sampled = Math.floor(Math.random() * bound);
        } else if (method === 1) {
          sampled = mathRandomExactBounded(bound, counters);
        } else if (method === 2) {
          sampled = nextRandCpu(rng) % bound;
          counters.rngCalls++;
        } else if (method === 3) {
          sampled = rejectModuloBounded(rng, bound, counters);
        } else if (method === 4) {
          sampled = freshMaskBounded(rng, bound, counters);
        } else {
          sampled = reservoirBounded(reservoir, bound);
        }

        if (sampled >= bound) invalid++;
        if (kind === 0 && sampled < 6) {
          counts[sampled]++;
          if (previous >= 0) pairCounts[previous * 6 + sampled]++;
          previous = sampled;
        }
        checksum = u32(Math.imul(u32(checksum ^ u32(sampled + 0x9E3779B9)), 1664525) + 1013904223);
      }

      const elapsedMs = performance.now() - t0;
      if (run > 0) times.push(elapsedMs);
      const rngCalls = method === 5 ? reservoir.rngCalls : method === 0 ? 0 : counters.rngCalls;
      const rejects = method === 5 ? reservoir.rejects : method === 0 ? 0 : counters.rejects;
      finalStats = {
        checksum: hex32(checksum),
        invalid,
        rngCalls,
        rngCallsPerSample: rngCalls / cfg.actualSamples,
        rejects,
        rejectRate: rejects / Math.max(1, rejects + cfg.actualSamples),
        counts: kind === 0 ? counts : undefined,
        distribution: kind === 0 ? distributionStats(counts) : undefined,
        pairDistribution: kind === 0 ? distributionStats(pairCounts) : undefined,
      };
    }

    const med = median(times);
    return {
      medianMs: med,
      minMs: Math.min(...times),
      samplesPerSec: cfg.actualSamples / (med / 1000),
      ...finalStats,
    };
  }

  function samplerWgsl() {
    return `
struct Params {
  baseSeed: u32,
  laneCount: u32,
  drawsPerLane: u32,
  method: u32,
  kind: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
}
struct Reservoir {
  word: u32,
  bits: u32,
  rngCalls: u32,
  rejects: u32,
}
@group(0) @binding(0) var<storage, read_write> outData: array<u32>;
@group(0) @binding(1) var<uniform> params: Params;
const PARITY_DRAWS: u32 = 96u;
const PARITY_STRIDE: u32 = 100u;
const PROD_MOD_STRIDE: u32 = 6u;
const BENCH_STRIDE: u32 = 10u;

fn next_rand(rng: ptr<function, u32>) -> u32 {
  var t = (*rng) + 0x6D2B79F5u;
  (*rng) = t;
  var r = (t ^ (t >> 15u)) * (1u | t);
  r = r ^ (r + ((r ^ (r >> 7u)) * 61u));
  return r ^ (r >> 14u);
}

fn bits_for_bound(bound: u32) -> u32 {
  if (bound <= 1u) { return 0u; }
  if (bound <= 2u) { return 1u; }
  if (bound <= 4u) { return 2u; }
  if (bound <= 8u) { return 3u; }
  if (bound <= 16u) { return 4u; }
  return 5u;
}

fn bounded_fresh_mask(
  rng: ptr<function, u32>,
  rngCalls: ptr<function, u32>,
  rejects: ptr<function, u32>,
  bound: u32,
) -> u32 {
  if (bound <= 1u) { return 0u; }
  let bitsNeeded = bits_for_bound(bound);
  let mask = (1u << bitsNeeded) - 1u;
  loop {
    let candidate = next_rand(rng) & mask;
    (*rngCalls) = (*rngCalls) + 1u;
    if (candidate < bound) { return candidate; }
    (*rejects) = (*rejects) + 1u;
  }
}

fn bounded_reservoir(
  rng: ptr<function, u32>,
  reservoirState: ptr<function, Reservoir>,
  bound: u32,
) -> u32 {
  if (bound <= 1u) { return 0u; }
  let bitsNeeded = bits_for_bound(bound);
  let mask = (1u << bitsNeeded) - 1u;
  loop {
    if ((*reservoirState).bits < bitsNeeded) {
      (*reservoirState).word = next_rand(rng);
      (*reservoirState).bits = 32u;
      (*reservoirState).rngCalls = (*reservoirState).rngCalls + 1u;
    }
    let candidate = (*reservoirState).word & mask;
    (*reservoirState).word = (*reservoirState).word >> bitsNeeded;
    (*reservoirState).bits = (*reservoirState).bits - bitsNeeded;
    if (candidate < bound) { return candidate; }
    (*reservoirState).rejects = (*reservoirState).rejects + 1u;
  }
}

fn production_dice_pair(rng: ptr<function, u32>) -> vec2<i32> {
  let val1 = i32(next_rand(rng) % 6u) + 1;
  let val2 = i32(next_rand(rng) % 6u) + 1;
  return vec2<i32>(val1, val2);
}

@compute @workgroup_size(64)
fn production_mod_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let lane = gid.x;
  if (lane >= params.laneCount) { return; }
  let base = lane * PROD_MOD_STRIDE;
  var rng = params.baseSeed + lane * 747796405u + 2891336453u;
  let rngBefore = rng;
  let pair = production_dice_pair(&rng);
  outData[base + 0u] = rngBefore;
  outData[base + 1u] = bitcast<u32>(pair.x);
  outData[base + 2u] = bitcast<u32>(pair.y);
  outData[base + 3u] = bitcast<u32>(pair.x + pair.y);
  outData[base + 4u] = rng;
  outData[base + 5u] = select(0u, 1u, pair.x < 1 || pair.x > 6 || pair.y < 1 || pair.y > 6);
}

@compute @workgroup_size(64)
fn parity_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let lane = gid.x;
  if (lane >= params.laneCount) { return; }
  let base = lane * PARITY_STRIDE;
  var rng = params.baseSeed + lane * 747796405u + 2891336453u;
  var reservoirState: Reservoir;
  reservoirState.word = 0u;
  reservoirState.bits = 0u;
  reservoirState.rngCalls = 0u;
  reservoirState.rejects = 0u;
  var directCalls = 0u;
  var directRejects = 0u;
  var cardBound = 1u;

  for (var i = 0u; i < PARITY_DRAWS; i = i + 1u) {
    var bound = 6u;
    if (i >= 48u) {
      bound = cardBound;
      cardBound = cardBound + 1u;
      if (cardBound > 30u) { cardBound = 1u; }
    }
    if (params.method == 1u) {
      outData[base + i] = bounded_fresh_mask(&rng, &directCalls, &directRejects, bound);
    } else {
      outData[base + i] = bounded_reservoir(&rng, &reservoirState, bound);
    }
  }

  if (params.method == 1u) {
    outData[base + 96u] = directCalls;
    outData[base + 97u] = directRejects;
    outData[base + 98u] = rng;
    outData[base + 99u] = 0u;
  } else {
    outData[base + 96u] = reservoirState.rngCalls;
    outData[base + 97u] = reservoirState.rejects;
    outData[base + 98u] = rng;
    outData[base + 99u] = reservoirState.bits;
  }
}

@compute @workgroup_size(64)
fn bench_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let lane = gid.x;
  if (lane >= params.laneCount) { return; }
  let base = lane * BENCH_STRIDE;
  var rng = params.baseSeed + lane * 747796405u + 2891336453u;
  var reservoirState: Reservoir;
  reservoirState.word = 0u;
  reservoirState.bits = 0u;
  reservoirState.rngCalls = 0u;
  reservoirState.rejects = 0u;
  var directCalls = 0u;
  var directRejects = 0u;
  var checksum = 2166136261u;
  var invalid = 0u;
  var c0 = 0u; var c1 = 0u; var c2 = 0u; var c3 = 0u; var c4 = 0u; var c5 = 0u;
  var cardBound = 1u;

  for (var i = 0u; i < params.drawsPerLane; i = i + 1u) {
    var bound = 6u;
    if (params.kind == 1u) {
      bound = cardBound;
      cardBound = cardBound + 1u;
      if (cardBound > 30u) { cardBound = 1u; }
    }

    var sampled = 0u;
    if (params.method == 0u) {
      sampled = next_rand(&rng) % bound;
      directCalls = directCalls + 1u;
    } else if (params.method == 1u) {
      sampled = bounded_fresh_mask(&rng, &directCalls, &directRejects, bound);
    } else {
      sampled = bounded_reservoir(&rng, &reservoirState, bound);
    }

    if (sampled >= bound) {
      invalid = invalid + 1u;
    } else if (params.kind == 0u) {
      if (sampled == 0u) { c0 = c0 + 1u; }
      else if (sampled == 1u) { c1 = c1 + 1u; }
      else if (sampled == 2u) { c2 = c2 + 1u; }
      else if (sampled == 3u) { c3 = c3 + 1u; }
      else if (sampled == 4u) { c4 = c4 + 1u; }
      else if (sampled == 5u) { c5 = c5 + 1u; }
    }
    checksum = (checksum ^ (sampled + 0x9E3779B9u)) * 1664525u + 1013904223u;
  }

  let rngCalls = select(directCalls, reservoirState.rngCalls, params.method == 2u);
  let rejects = select(directRejects, reservoirState.rejects, params.method == 2u);
  outData[base + 0u] = checksum;
  outData[base + 1u] = rngCalls;
  outData[base + 2u] = rejects;
  outData[base + 3u] = invalid;
  outData[base + 4u] = c0;
  outData[base + 5u] = c1;
  outData[base + 6u] = c2;
  outData[base + 7u] = c3;
  outData[base + 8u] = c4;
  outData[base + 9u] = c5;
}
`;
  }

  function cpuParityRows(method) {
    const rows = [];
    for (let lane = 0; lane < PARITY_LANES; lane++) {
      const seed = u32(BASE_SEED + Math.imul(lane, 747796405) + 2891336453);
      const rng = { value: seed };
      const reservoir = createReservoir(seed);
      const counters = { rngCalls: 0, rejects: 0 };
      const samples = [];
      let cardBound = 1;

      for (let i = 0; i < PARITY_DRAWS; i++) {
        let bound = 6;
        if (i >= 48) {
          bound = cardBound++;
          if (cardBound > 30) cardBound = 1;
        }
        samples.push(method === 1
          ? freshMaskBounded(rng, bound, counters)
          : reservoirBounded(reservoir, bound));
      }

      rows.push(method === 1
        ? { samples, rngCalls: counters.rngCalls, rejects: counters.rejects, rng: rng.value, bits: 0 }
        : { samples, rngCalls: reservoir.rngCalls, rejects: reservoir.rejects, rng: reservoir.rng.value, bits: reservoir.bits });
    }
    return rows;
  }

  function aggregateGpu(values, cfg, kind) {
    let checksum = 0;
    let rngCalls = 0;
    let rejects = 0;
    let invalid = 0;
    const counts = new Array(6).fill(0);
    for (let lane = 0; lane < cfg.lanes; lane++) {
      const base = lane * BENCH_STRIDE;
      checksum ^= values[base];
      rngCalls += values[base + 1];
      rejects += values[base + 2];
      invalid += values[base + 3];
      if (kind === 0) {
        for (let i = 0; i < 6; i++) counts[i] += values[base + 4 + i];
      }
    }
    return {
      checksum: hex32(checksum),
      rngCalls,
      rngCallsPerSample: rngCalls / cfg.actualSamples,
      rejects,
      rejectRate: rejects / Math.max(1, rejects + cfg.actualSamples),
      invalid,
      counts: kind === 0 ? counts : undefined,
      distribution: kind === 0 ? distributionStats(counts) : undefined,
    };
  }

  async function compilePipeline(device, module, entryPoint) {
    const descriptor = { layout: 'auto', compute: { module, entryPoint } };
    return typeof device.createComputePipelineAsync === 'function'
      ? await device.createComputePipelineAsync(descriptor)
      : await device.createComputePipeline(descriptor);
  }

  async function runGpuTests(cfg) {
    if (!navigator.gpu) throw new Error('navigator.gpu 없음');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('adapter=null');
    const device = await adapter.requestDevice();
    const module = device.createShaderModule({ code: samplerWgsl() });

    if (typeof module.getCompilationInfo === 'function') {
      const info = await module.getCompilationInfo();
      const errors = info.messages.filter(message => message.type === 'error');
      if (errors.length) {
        throw new Error(`sampler shader compile: ${errors.map(message => message.message).join(' | ')}`);
      }
    }

    const productionPipeline = await compilePipeline(device, module, 'production_mod_main');
    const parityPipeline = await compilePipeline(device, module, 'parity_main');
    const benchPipeline = await compilePipeline(device, module, 'bench_main');
    const uniformBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    async function dispatchRead(pipeline, laneCount, stride, uniformData) {
      const bytes = laneCount * stride * 4;
      const output = device.createBuffer({
        size: bytes,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
      const read = device.createBuffer({
        size: bytes,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformData);
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: output } },
          { binding: 1, resource: { buffer: uniformBuffer } },
        ],
      });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(laneCount / 64));
      pass.end();
      encoder.copyBufferToBuffer(output, 0, read, 0, bytes);
      const t0 = performance.now();
      device.queue.submit([encoder.finish()]);
      await read.mapAsync(GPUMapMode.READ);
      const elapsedMs = performance.now() - t0;
      const values = new Uint32Array(read.getMappedRange()).slice();
      read.unmap();
      output.destroy();
      read.destroy();
      return { values, elapsedMs };
    }

    const productionRun = await dispatchRead(
      productionPipeline,
      PARITY_LANES,
      PROD_MOD_STRIDE,
      new Uint32Array([BASE_SEED, PARITY_LANES, 2, 0, 0, 0, 0, 0]),
    );
    let productionInvalid = 0;
    let productionMismatch = 0;
    let firstProductionMismatch = null;
    for (let lane = 0; lane < PARITY_LANES; lane++) {
      const base = lane * PROD_MOD_STRIDE;
      const seed = u32(BASE_SEED + Math.imul(lane, 747796405) + 2891336453);
      const rng = { value: seed };
      const raw1 = nextRandCpu(rng);
      const raw2 = nextRandCpu(rng);
      const cpu1 = raw1 % 6 + 1;
      const cpu2 = raw2 % 6 + 1;
      const gpu1 = productionRun.values[base + 1] | 0;
      const gpu2 = productionRun.values[base + 2] | 0;
      productionInvalid += productionRun.values[base + 5];
      if (gpu1 !== cpu1 || gpu2 !== cpu2) {
        productionMismatch++;
        if (!firstProductionMismatch) {
          firstProductionMismatch = {
            lane,
            seed: hex32(seed),
            raw1: hex32(raw1),
            raw2: hex32(raw2),
            cpu: [cpu1, cpu2],
            gpu: [gpu1, gpu2],
          };
        }
      }
    }
    diag('R4A GPU prod-mod', productionMismatch === 0 ? 'production 표현 parity PASS' : 'production 표현 modulo 오류 재현', {
      lanes: PARITY_LANES,
      mismatchedLanes: productionMismatch,
      invalidLanes: productionInvalid,
      firstMismatch: firstProductionMismatch,
      elapsedMs: productionRun.elapsedMs,
    });

    async function runParity(method, label) {
      const run = await dispatchRead(
        parityPipeline,
        PARITY_LANES,
        PARITY_STRIDE,
        new Uint32Array([BASE_SEED, PARITY_LANES, PARITY_DRAWS, method, 0, 0, 0, 0]),
      );
      const cpuRows = cpuParityRows(method);
      let mismatches = 0;
      let firstMismatch = null;
      for (let lane = 0; lane < PARITY_LANES; lane++) {
        const base = lane * PARITY_STRIDE;
        const cpu = cpuRows[lane];
        for (let i = 0; i < PARITY_DRAWS; i++) {
          if (run.values[base + i] !== cpu.samples[i]) {
            mismatches++;
            if (!firstMismatch) firstMismatch = { lane, draw: i, cpu: cpu.samples[i], gpu: run.values[base + i] };
          }
        }
        const meta = [cpu.rngCalls, cpu.rejects, cpu.rng, cpu.bits];
        for (let i = 0; i < 4; i++) {
          if (run.values[base + 96 + i] !== u32(meta[i])) {
            mismatches++;
            if (!firstMismatch) firstMismatch = { lane, meta: i, cpu: u32(meta[i]), gpu: run.values[base + 96 + i] };
          }
        }
      }
      diag('R4 GPU parity', `${label} CPU↔GPU ${mismatches === 0 ? 'exact PASS' : 'FAIL'}`, {
        lanes: PARITY_LANES,
        drawsPerLane: PARITY_DRAWS,
        comparedValues: PARITY_LANES * (PARITY_DRAWS + 4),
        mismatches,
        firstMismatch,
        elapsedMs: run.elapsedMs,
      });
      return mismatches;
    }

    const freshMismatches = await runParity(1, 'fresh-mask-reject');
    const reservoirMismatches = await runParity(2, 'bit-reservoir');

    const benchBytes = cfg.lanes * BENCH_STRIDE * 4;
    const benchOut = device.createBuffer({
      size: benchBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const benchRead = device.createBuffer({
      size: benchBytes,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const benchGroup = device.createBindGroup({
      layout: benchPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: benchOut } },
        { binding: 1, resource: { buffer: uniformBuffer } },
      ],
    });

    async function dispatchBench(method, kind, readBack) {
      device.queue.writeBuffer(
        uniformBuffer,
        0,
        new Uint32Array([BASE_SEED, cfg.lanes, cfg.drawsPerLane, method, kind, 0, 0, 0]),
      );
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(benchPipeline);
      pass.setBindGroup(0, benchGroup);
      pass.dispatchWorkgroups(Math.ceil(cfg.lanes / 64));
      pass.end();
      if (readBack) encoder.copyBufferToBuffer(benchOut, 0, benchRead, 0, benchBytes);
      const t0 = performance.now();
      device.queue.submit([encoder.finish()]);
      if (!readBack) {
        await device.queue.onSubmittedWorkDone();
        return { elapsedMs: performance.now() - t0 };
      }
      await benchRead.mapAsync(GPUMapMode.READ);
      const elapsedMs = performance.now() - t0;
      const values = new Uint32Array(benchRead.getMappedRange()).slice();
      benchRead.unmap();
      return { elapsedMs, values };
    }

    const methodNames = ['legacy-mod', 'fresh-mask-reject', 'bit-reservoir'];
    const results = { dice6: [], card1to30: [] };
    for (const kind of [0, 1]) {
      const key = kind === 0 ? 'dice6' : 'card1to30';
      for (let method = 0; method < 3; method++) {
        await dispatchBench(method, kind, false);
        const times = [];
        for (let repeat = 0; repeat < cfg.repeats; repeat++) {
          times.push((await dispatchBench(method, kind, false)).elapsedMs);
        }
        const readResult = await dispatchBench(method, kind, true);
        const med = median(times);
        results[key].push({
          method: methodNames[method],
          medianMs: med,
          minMs: Math.min(...times),
          samplesPerSec: cfg.actualSamples / (med / 1000),
          ...aggregateGpu(readResult.values, cfg, kind),
        });
      }
      diag(kind === 0 ? 'R5 GPU dice' : 'R6 GPU card', `${key} benchmark`, {
        samples: cfg.actualSamples,
        repeats: cfg.repeats,
        results: results[key],
      });
    }

    benchOut.destroy();
    benchRead.destroy();
    uniformBuffer.destroy();

    return {
      productionMismatch,
      productionInvalid,
      freshMismatches,
      reservoirMismatches,
      results,
      adapterInfo: adapter.info || {},
    };
  }

  async function runSamplerDiagnostics() {
    if (running) return;
    running = true;
    const cfg = config();

    try {
      diag('R0 CONFIG', 'sampler 진단 시작', {
        requestedSamples: cfg.requestedSamples,
        actualSamplesPerMethod: cfg.actualSamples,
        repeats: cfg.repeats,
        gpuLanes: cfg.lanes,
        drawsPerLane: cfg.drawsPerLane,
        strongerRun: '?mode=test&rngSamples=4194304&rngRepeats=5',
        productionMeasurementsStopped: true,
      });
      diag('R0 CPU note', '현재 Board CPU는 Math.floor(Math.random()*N); 후보 비교에는 동일 Math.random 기반 exact rejection도 포함');

      const boundary = cpuBoundaryTest();
      diag('R1 CPU boundary', boundary.passed === boundary.total ? 'exact rejection boundary PASS' : 'boundary FAIL', {
        ...boundary,
        dice6ModuloBias: {
          quotient: Math.floor(U32_RANGE / 6),
          highResidues: U32_RANGE % 6,
          bucketCountDifferencePerFullU32Cycle: 1,
          probabilityStep: 1 / U32_RANGE,
        },
      });

      const cpuNames = [
        'board-math-random',
        'math-random-rejection-exact',
        'legacy-u32-mod',
        'rejection-mod-exact',
        'fresh-mask-reject',
        'bit-reservoir',
      ];
      const cpu = { dice6: [], card1to30: [] };
      for (const kind of [0, 1]) {
        const key = kind === 0 ? 'dice6' : 'card1to30';
        for (let method = 0; method < cpuNames.length; method++) {
          await new Promise(resolve => setTimeout(resolve, 0));
          cpu[key].push({ method: cpuNames[method], ...benchCpu(method, kind, cfg) });
        }
        diag(kind === 0 ? 'R2 CPU dice' : 'R3 CPU card', `${key} benchmark`, {
          samples: cfg.actualSamples,
          repeats: cfg.repeats,
          results: cpu[key],
        });
      }

      let gpu = null;
      try {
        gpu = await runGpuTests(cfg);
      } catch (error) {
        diag('FAIL sampler GPU', errText(error), error?.stack || '');
      }

      const gpuLegacy = gpu?.results?.dice6?.find(result => result.method === 'legacy-mod');
      const gpuFresh = gpu?.results?.dice6?.find(result => result.method === 'fresh-mask-reject');
      const gpuReservoir = gpu?.results?.dice6?.find(result => result.method === 'bit-reservoir');
      const cpuBoard = cpu.dice6.find(result => result.method === 'board-math-random');
      const cpuMathExact = cpu.dice6.find(result => result.method === 'math-random-rejection-exact');
      const cpuReservoir = cpu.dice6.find(result => result.method === 'bit-reservoir');

      diag('R7 RESULT', 'sampler 후보 종합', {
        productionExpressionModuloMismatch: gpu?.productionMismatch ?? null,
        productionExpressionInvalidLanes: gpu?.productionInvalid ?? null,
        gpuFreshParityPass: gpu ? gpu.freshMismatches === 0 : false,
        gpuReservoirParityPass: gpu ? gpu.reservoirMismatches === 0 : false,
        gpuLegacyInvalidDice: gpuLegacy?.invalid ?? null,
        gpuFreshInvalidDice: gpuFresh?.invalid ?? null,
        gpuReservoirInvalidDice: gpuReservoir?.invalid ?? null,
        gpuFreshVsLegacySpeed: gpuFresh && gpuLegacy ? gpuFresh.samplesPerSec / gpuLegacy.samplesPerSec : null,
        gpuReservoirVsLegacySpeed: gpuReservoir && gpuLegacy ? gpuReservoir.samplesPerSec / gpuLegacy.samplesPerSec : null,
        cpuMathExactVsBoardSpeed: cpuMathExact && cpuBoard ? cpuMathExact.samplesPerSec / cpuBoard.samplesPerSec : null,
        cpuReservoirVsBoardSpeed: cpuReservoir && cpuBoard ? cpuReservoir.samplesPerSec / cpuBoard.samplesPerSec : null,
        productionChanged: false,
        productionMeasurementsStopped: true,
      });
    } finally {
      running = false;
    }
  }

  function scheduleDiagnostics() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      runSamplerDiagnostics().catch(error => diag('FAIL sampler', errText(error), error?.stack || ''));
    }, 0);
  }

  window.addEventListener('error', event => diag('WINDOW error', event.message || errText(event.error)));
  window.addEventListener('unhandledrejection', event => diag('WINDOW rejection', errText(event.reason)));

  ensureUi();
  diag('S0 bootstrap', '진단 시작', {
    href: location.href,
    secureContext: window.isSecureContext,
    userAgent: navigator.userAgent,
  });
  diag('S1 navigator.gpu', navigator.gpu ? '존재' : '없음');
  stopProductionMeasurements();
  scheduleDiagnostics();
})();
