(() => {
  if (new URLSearchParams(location.search).get('mode') !== 'test') return;

  const startedAt = performance.now();
  const lines = [];
  const PARITY_RECORD_STRIDE = 24;
  const PARITY_LOG_INDICES = Object.freeze([0, 1, 2, 3, 7, 15, 31, 47, 63, 64, 95, 127, 128, 191, 223, 255]);
  let root;
  let pre;
  let capturedDoubleSelfTest = null;
  let parityScheduled = false;
  let parityRunning = false;

  const errText = error => error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error ?? 'unknown error');

  const json = value => {
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
    root.style.cssText = 'position:fixed;z-index:30000;left:8px;right:8px;bottom:8px;max-height:58vh;display:flex;flex-direction:column;gap:6px;padding:10px;border:1px solid #475569;border-radius:8px;background:rgba(15,23,42,.96);color:#e2e8f0;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;box-shadow:0 12px 36px rgba(0,0,0,.45)';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px';
    const title = document.createElement('strong');
    title.textContent = 'WebGPU 진단 · ?mode=test';
    const copy = document.createElement('button');
    copy.textContent = '전체 복사';
    copy.style.cssText = 'padding:6px 10px;border:0;border-radius:6px;background:#2563eb;color:white;font-weight:700';
    copy.onclick = async () => {
      const value = lines.join('\n');
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = value;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      copy.textContent = '복사 완료';
      setTimeout(() => copy.textContent = '전체 복사', 1000);
    };
    header.append(title, copy);
    pre = document.createElement('pre');
    pre.style.cssText = 'margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word;user-select:text';
    root.append(header, pre);
    document.body.appendChild(root);
  }

  function diag(stage, message, extra) {
    ensureUi();
    const ms = (performance.now() - startedAt).toFixed(1).padStart(7, ' ');
    const suffix = extra === undefined ? '' : ` · ${json(extra)}`;
    lines.push(`[+${ms}ms] ${stage} ${message}${suffix}`);
    pre.textContent = lines.join('\n');
    pre.scrollTop = pre.scrollHeight;
    console.log('[GPU TEST]', stage, message, extra ?? '');
  }

  // Global function declarations are often writable but non-configurable.
  // Try defineProperty first, then direct assignment so adventure.js globals can
  // still be observed without changing normal-mode code.
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
        if (target[name] === wrapped) return true;
      } catch (_) {}
    }
    diag('DIAG', `${name} hook 실패`, 'property is not writable');
    return false;
  }

  function instrumentBuffer(buffer, descriptor) {
    const mapRead = typeof GPUBufferUsage !== 'undefined' ? GPUBufferUsage.MAP_READ : 1;
    if (!buffer || typeof buffer.mapAsync !== 'function' || !(Number(descriptor?.usage || 0) & mapRead)) return;
    wrapMethod(buffer, 'mapAsync', original => async (...args) => {
      diag('S9 mapAsync', '시작', { size: descriptor?.size, args });
      try {
        const result = await original(...args);
        diag('S9 mapAsync', '성공');
        return result;
      } catch (error) {
        diag('FAIL mapAsync', errText(error));
        throw error;
      }
    });
  }

  function instrumentDevice(device) {
    if (!device) return;
    const limits = device.limits || {};
    diag('S3 requestDevice', '성공', {
      maxBufferSize: limits.maxBufferSize,
      maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
      maxComputeWorkgroupsPerDimension: limits.maxComputeWorkgroupsPerDimension,
      maxComputeInvocationsPerWorkgroup: limits.maxComputeInvocationsPerWorkgroup,
    });
    device.lost?.then?.(info => diag('FAIL device.lost', info?.reason || 'unknown', info?.message || ''));

    wrapMethod(device, 'createShaderModule', original => descriptor => {
      diag('S4 shader', 'createShaderModule');
      try {
        const result = original(descriptor);
        diag('S4 shader', '생성 호출 성공');
        return result;
      } catch (error) {
        diag('FAIL shader', errText(error));
        throw error;
      }
    });

    for (const name of ['createComputePipelineAsync', 'createComputePipeline']) {
      wrapMethod(device, name, original => async descriptor => {
        diag('S5 pipeline', `${name} 시작`);
        try {
          const result = await original(descriptor);
          diag('S5 pipeline', '성공');
          return result;
        } catch (error) {
          diag('FAIL pipeline', errText(error));
          throw error;
        }
      });
    }

    wrapMethod(device, 'createBuffer', original => descriptor => {
      try {
        const result = original(descriptor);
        instrumentBuffer(result, descriptor);
        return result;
      } catch (error) {
        diag('FAIL createBuffer', errText(error), { size: descriptor?.size, usage: descriptor?.usage });
        throw error;
      }
    });

    if (device.queue) {
      wrapMethod(device.queue, 'submit', original => buffers => {
        diag('S8 queue.submit', '시작', { commandBuffers: buffers?.length || 0 });
        try {
          const result = original(buffers);
          diag('S8 queue.submit', '호출 성공');
          return result;
        } catch (error) {
          diag('FAIL queue.submit', errText(error));
          throw error;
        }
      });
    }
  }

  function instrumentAdapter(adapter) {
    const info = adapter?.info || {};
    diag('S2 requestAdapter', '성공', {
      vendor: info.vendor,
      architecture: info.architecture,
      device: info.device,
      description: info.description,
    });
    wrapMethod(adapter, 'requestDevice', original => async (...args) => {
      diag('S3 requestDevice', '시작', args[0] || {});
      try {
        const device = await original(...args);
        instrumentDevice(device);
        return device;
      } catch (error) {
        diag('FAIL requestDevice', errText(error));
        throw error;
      }
    });
  }

  function instrumentGpu() {
    if (!navigator.gpu) {
      diag('FAIL navigator.gpu', 'navigator.gpu 없음');
      return;
    }
    diag('S1 navigator.gpu', '존재');
    wrapMethod(navigator.gpu, 'requestAdapter', original => async (...args) => {
      diag('S2 requestAdapter', '시작', args[0] || {});
      try {
        const adapter = await original(...args);
        if (!adapter) {
          diag('FAIL requestAdapter', 'adapter=null');
          return null;
        }
        instrumentAdapter(adapter);
        return adapter;
      } catch (error) {
        diag('FAIL requestAdapter', errText(error));
        throw error;
      }
    });
  }

  function u32(value) {
    return Number(value) >>> 0;
  }

  function hex32(value) {
    return `0x${u32(value).toString(16).padStart(8, '0')}`;
  }

  function nextRandCpu(holder) {
    const t = u32(holder.value + 0x6D2B79F5);
    holder.value = t;
    let r = u32(Math.imul(u32(t ^ (t >>> 15)), u32(1 | t)));
    r = u32(r ^ u32(r + Math.imul(u32(r ^ (r >>> 7)), 61)));
    return u32(r ^ (r >>> 14));
  }

  function getParityTables() {
    if (typeof buildGpuTables === 'function') return buildGpuTables();
    if (typeof stage === 'undefined' || typeof cardInfo === 'undefined') {
      throw new Error('stage/cardInfo globals are unavailable');
    }
    return {
      stageId: stage.map(row => Number(row[1] || 0)),
      stageMove: stage.map(row => Number(row[4] || 0)),
      stageEvent: stage.map(row => Number(row[5] || 0)),
      cardType: [0, ...cardInfo.map(row => Number(row[1] || 0))],
      cardValue: [0, ...cardInfo.map(row => Number(row[2] || 0))],
    };
  }

  function getParityState() {
    if (capturedDoubleSelfTest?.state?.length >= 42) return capturedDoubleSelfTest.state.slice();
    if (typeof createGpuSelfTestState === 'function') {
      return createGpuSelfTestState({ diceUse: 100, isDouble: 1 });
    }
    if (typeof Board === 'function') {
      const state = new Board().getState().slice();
      state[1] = true;
      state[5] = 100;
      state[6] = 1;
      return state;
    }
    throw new Error('double-state를 만들 수 없음');
  }

  function stageEventAt(tables, index) {
    return index < 0 || index >= 2898 ? 0 : Number(tables.stageEvent[index] || 0);
  }

  function stageMoveAt(tables, index) {
    return index < 0 || index >= 2898 ? 0 : Number(tables.stageMove[index] || 0);
  }

  function cpuSingleStep(tables, state, baseSeed, rolloutIndex) {
    const rng0 = u32(baseSeed + Math.imul(rolloutIndex, 747796405) + 2891336453);
    const rng = { value: rng0 };
    const rand1 = nextRandCpu(rng);
    const rand2 = nextRandCpu(rng);
    const dice1 = rand1 % 6 + 1;
    const dice2 = rand2 % 6 + 1;
    const diceSum = dice1 + dice2;
    let score = Number(state[2]);
    let diceUse = Number(state[5]);
    let isDouble = Number(state[6]);

    if (isDouble !== 0) {
      isDouble = 0;
    } else {
      isDouble = dice1 === dice2 ? 1 : 0;
      diceUse += 1;
    }

    let value = diceSum;
    let stopEvent = 0;
    const endIndex = Math.min(2897, score + value - 1);
    for (let i = score; i < endIndex; i++) {
      const eventType = stageEventAt(tables, i);
      if (eventType === 6 || eventType === 9) {
        stopEvent = eventType;
        value = i - score + 1;
        break;
      }
    }

    score = Math.min(2898, score + value);
    const landing = score;
    const firstEvent = stageEventAt(tables, score - 1);
    const firstMove = firstEvent === 4 ? stageMoveAt(tables, score - 1) : 0;
    let afterFirstJump = score;
    let secondEvent = 0;
    let secondMove = 0;
    let afterSecondJump = score;
    let jumpCount = 0;

    for (let guard = 0; guard < 16; guard++) {
      const eventType = stageEventAt(tables, score - 1);
      if (eventType === 2) break;
      if (eventType === 4) {
        const move = stageMoveAt(tables, score - 1);
        score = Math.min(2898, score + move);
        jumpCount += 1;
        if (jumpCount === 1) {
          afterFirstJump = score;
          secondEvent = stageEventAt(tables, score - 1);
          secondMove = secondEvent === 4 ? stageMoveAt(tables, score - 1) : 0;
        } else if (jumpCount === 2) {
          afterSecondJump = score;
        }
        continue;
      }
      break;
    }

    if (jumpCount === 0) {
      afterFirstJump = landing;
      afterSecondJump = landing;
    } else if (jumpCount === 1) {
      afterSecondJump = afterFirstJump;
    }

    return {
      rolloutIndex,
      rng0,
      rand1,
      rand2,
      dice1,
      dice2,
      diceSum,
      startScore: Number(state[2]),
      diceUseBefore: Number(state[5]),
      isDoubleBefore: Number(state[6]),
      landing,
      firstEvent,
      firstMove,
      afterFirstJump,
      secondEvent,
      secondMove,
      afterSecondJump,
      jumpCount,
      finalScore: score,
      finalEvent: stageEventAt(tables, score - 1),
      diceUseAfter: diceUse,
      isDoubleAfter: isDouble,
      stopEvent,
      endIndex,
    };
  }

  function parityShaderSource() {
    return `
struct Params {
  baseSeed: u32,
  rolloutCount: u32,
  pad0: u32,
  pad1: u32,
}

@group(0) @binding(0) var<storage, read> stageMove: array<i32>;
@group(0) @binding(1) var<storage, read> stageEvent: array<i32>;
@group(0) @binding(2) var<storage, read> inputState: array<i32>;
@group(0) @binding(3) var<storage, read_write> outData: array<u32>;
@group(0) @binding(4) var<uniform> params: Params;

const RECORD_STRIDE: u32 = 24u;

fn next_rand(rng: ptr<function, u32>) -> u32 {
  var t = (*rng) + 0x6D2B79F5u;
  (*rng) = t;
  var r = (t ^ (t >> 15u)) * (1u | t);
  r = r ^ (r + ((r ^ (r >> 7u)) * 61u));
  return r ^ (r >> 14u);
}

fn stage_move_at(index: i32) -> i32 {
  if (index < 0 || index >= 2898) { return 0; }
  return stageMove[u32(index)];
}

fn stage_event_at(index: i32) -> i32 {
  if (index < 0 || index >= 2898) { return 0; }
  return stageEvent[u32(index)];
}

fn write_i32(base: u32, offset: u32, value: i32) {
  outData[base + offset] = bitcast<u32>(value);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let rolloutIndex = globalId.x;
  if (rolloutIndex >= params.rolloutCount) { return; }

  let base = rolloutIndex * RECORD_STRIDE;
  var rng = params.baseSeed + rolloutIndex * 747796405u + 2891336453u;
  let rng0 = rng;
  let rand1 = next_rand(&rng);
  let rand2 = next_rand(&rng);
  let dice1 = i32(rand1 % 6u) + 1;
  let dice2 = i32(rand2 % 6u) + 1;
  let diceSum = dice1 + dice2;
  var score = inputState[2];
  var diceUse = inputState[5];
  var isDouble = inputState[6];

  if (isDouble != 0) {
    isDouble = 0;
  } else {
    isDouble = select(0, 1, dice1 == dice2);
    diceUse = diceUse + 1;
  }

  var value = diceSum;
  var stopEvent = 0;
  let endIndex = min(2897, score + value - 1);
  for (var i = score; i < endIndex; i = i + 1) {
    let eventType = stage_event_at(i);
    if (eventType == 6 || eventType == 9) {
      stopEvent = eventType;
      value = i - score + 1;
      break;
    }
  }

  score = min(2898, score + value);
  let landing = score;
  let firstEvent = stage_event_at(score - 1);
  var firstMove = 0;
  if (firstEvent == 4) { firstMove = stage_move_at(score - 1); }
  var afterFirstJump = score;
  var secondEvent = 0;
  var secondMove = 0;
  var afterSecondJump = score;
  var jumpCount = 0;

  for (var guard = 0; guard < 16; guard = guard + 1) {
    let eventType = stage_event_at(score - 1);
    if (eventType == 2) { break; }
    if (eventType == 4) {
      let jumpMoveValue = stage_move_at(score - 1);
      score = min(2898, score + jumpMoveValue);
      jumpCount = jumpCount + 1;
      if (jumpCount == 1) {
        afterFirstJump = score;
        secondEvent = stage_event_at(score - 1);
        if (secondEvent == 4) { secondMove = stage_move_at(score - 1); }
      } else if (jumpCount == 2) {
        afterSecondJump = score;
      }
      continue;
    }
    break;
  }

  if (jumpCount == 0) {
    afterFirstJump = landing;
    afterSecondJump = landing;
  } else if (jumpCount == 1) {
    afterSecondJump = afterFirstJump;
  }

  outData[base + 0u] = rolloutIndex;
  outData[base + 1u] = rng0;
  outData[base + 2u] = rand1;
  outData[base + 3u] = rand2;
  write_i32(base, 4u, dice1);
  write_i32(base, 5u, dice2);
  write_i32(base, 6u, diceSum);
  write_i32(base, 7u, inputState[2]);
  write_i32(base, 8u, inputState[5]);
  write_i32(base, 9u, inputState[6]);
  write_i32(base, 10u, landing);
  write_i32(base, 11u, firstEvent);
  write_i32(base, 12u, firstMove);
  write_i32(base, 13u, afterFirstJump);
  write_i32(base, 14u, secondEvent);
  write_i32(base, 15u, secondMove);
  write_i32(base, 16u, afterSecondJump);
  write_i32(base, 17u, jumpCount);
  write_i32(base, 18u, score);
  write_i32(base, 19u, stage_event_at(score - 1));
  write_i32(base, 20u, diceUse);
  write_i32(base, 21u, isDouble);
  write_i32(base, 22u, stopEvent);
  write_i32(base, 23u, endIndex);
}
`;
  }

  function createParityStorageBuffer(device, typedArray, usage = GPUBufferUsage.STORAGE) {
    const buffer = device.createBuffer({
      size: Math.max(4, typedArray.byteLength),
      usage: usage | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, typedArray);
    return buffer;
  }

  function signed32(value) {
    return value | 0;
  }

  function decodeGpuRecord(values, rolloutIndex) {
    const base = rolloutIndex * PARITY_RECORD_STRIDE;
    return {
      rolloutIndex: values[base + 0] >>> 0,
      rng0: values[base + 1] >>> 0,
      rand1: values[base + 2] >>> 0,
      rand2: values[base + 3] >>> 0,
      dice1: signed32(values[base + 4]),
      dice2: signed32(values[base + 5]),
      diceSum: signed32(values[base + 6]),
      startScore: signed32(values[base + 7]),
      diceUseBefore: signed32(values[base + 8]),
      isDoubleBefore: signed32(values[base + 9]),
      landing: signed32(values[base + 10]),
      firstEvent: signed32(values[base + 11]),
      firstMove: signed32(values[base + 12]),
      afterFirstJump: signed32(values[base + 13]),
      secondEvent: signed32(values[base + 14]),
      secondMove: signed32(values[base + 15]),
      afterSecondJump: signed32(values[base + 16]),
      jumpCount: signed32(values[base + 17]),
      finalScore: signed32(values[base + 18]),
      finalEvent: signed32(values[base + 19]),
      diceUseAfter: signed32(values[base + 20]),
      isDoubleAfter: signed32(values[base + 21]),
      stopEvent: signed32(values[base + 22]),
      endIndex: signed32(values[base + 23]),
    };
  }

  async function runGpuSingleStepParity(tables, state, baseSeed, rolloutCount) {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('parity adapter=null');
    const device = await adapter.requestDevice();
    const shader = device.createShaderModule({ code: parityShaderSource() });
    if (typeof shader.getCompilationInfo === 'function') {
      const info = await shader.getCompilationInfo();
      const errors = info.messages.filter(message => message.type === 'error');
      if (errors.length) {
        throw new Error(`parity shader compile: ${errors.map(message => message.message).join(' | ')}`);
      }
    }
    const pipelineDescriptor = {
      layout: 'auto',
      compute: { module: shader, entryPoint: 'main' },
    };
    const pipeline = typeof device.createComputePipelineAsync === 'function'
      ? await device.createComputePipelineAsync(pipelineDescriptor)
      : await device.createComputePipeline(pipelineDescriptor);

    const stageMoveBuffer = createParityStorageBuffer(device, new Int32Array(tables.stageMove));
    const stageEventBuffer = createParityStorageBuffer(device, new Int32Array(tables.stageEvent));
    const inputStateBuffer = createParityStorageBuffer(device, new Int32Array(state));
    const byteLength = rolloutCount * PARITY_RECORD_STRIDE * Uint32Array.BYTES_PER_ELEMENT;
    const outputBuffer = device.createBuffer({
      size: byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const readBuffer = device.createBuffer({
      size: byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const paramsBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([baseSeed >>> 0, rolloutCount >>> 0, 0, 0]));

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: stageMoveBuffer } },
        { binding: 1, resource: { buffer: stageEventBuffer } },
        { binding: 2, resource: { buffer: inputStateBuffer } },
        { binding: 3, resource: { buffer: outputBuffer } },
        { binding: 4, resource: { buffer: paramsBuffer } },
      ],
    });

    const started = performance.now();
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(rolloutCount / 64));
    pass.end();
    encoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, byteLength);
    device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(GPUMapMode.READ);
    const values = new Uint32Array(readBuffer.getMappedRange()).slice();
    readBuffer.unmap();
    const elapsedMs = performance.now() - started;

    stageMoveBuffer.destroy();
    stageEventBuffer.destroy();
    inputStateBuffer.destroy();
    outputBuffer.destroy();
    readBuffer.destroy();
    paramsBuffer.destroy();

    return { values, elapsedMs, adapterInfo: adapter.info || {} };
  }

  function summaryFromRecords(records) {
    if (!records.length) return { count: 0, mean: 0, min: 0, max: 0 };
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    records.forEach(record => {
      sum += record.finalScore;
      min = Math.min(min, record.finalScore);
      max = Math.max(max, record.finalScore);
    });
    return { count: records.length, mean: sum / records.length, min, max };
  }

  function compactRecord(record) {
    return {
      rng0: hex32(record.rng0),
      rand1: hex32(record.rand1),
      rand2: hex32(record.rand2),
      dice: `${record.dice1}+${record.dice2}=${record.diceSum}`,
      state: `${record.startScore}/${record.diceUseBefore}/${record.isDoubleBefore}`,
      landing: record.landing,
      event: record.firstEvent,
      jumpMove: record.firstMove,
      afterJump: record.afterFirstJump,
      event2: record.secondEvent,
      jumpMove2: record.secondMove,
      afterJump2: record.afterSecondJump,
      jumps: record.jumpCount,
      final: record.finalScore,
      finalEvent: record.finalEvent,
      diceUseAfter: record.diceUseAfter,
      isDoubleAfter: record.isDoubleAfter,
      stopEvent: record.stopEvent,
    };
  }

  function firstDivergence(cpu, gpu) {
    const groups = [
      ['state-read', ['startScore', 'diceUseBefore', 'isDoubleBefore']],
      ['rng-init', ['rng0']],
      ['rng', ['rand1', 'rand2']],
      ['dice', ['dice1', 'dice2', 'diceSum']],
      ['stop/landing', ['stopEvent', 'endIndex', 'landing']],
      ['event-lookup', ['firstEvent']],
      ['jump-1', ['firstMove', 'afterFirstJump']],
      ['jump-2', ['secondEvent', 'secondMove', 'afterSecondJump', 'jumpCount']],
      ['final', ['finalScore', 'finalEvent', 'diceUseAfter', 'isDoubleAfter']],
    ];
    for (const [label, keys] of groups) {
      if (keys.some(key => cpu[key] !== gpu[key])) return label;
    }
    return null;
  }

  function summariesEqual(a, b) {
    if (!a || !b) return false;
    const meanA = Number(a.mean ?? a.avg);
    const meanB = Number(b.mean ?? b.avg);
    return Number(a.count) === Number(b.count)
      && Math.abs(meanA - meanB) < 1e-9
      && Number(a.min) === Number(b.min)
      && Number(a.max) === Number(b.max);
  }

  async function runDoubleStateParityDiagnostic() {
    if (parityRunning) return;
    parityRunning = true;
    try {
      if (!navigator.gpu) {
        diag('P0 parity', '건너뜀: navigator.gpu 없음');
        return;
      }

      const tables = getParityTables();
      const state = getParityState();
      const baseSeed = capturedDoubleSelfTest?.seed ?? ((0x4d4f4231 ^ 0x55555555) >>> 0);
      const rolloutCount = capturedDoubleSelfTest?.rolloutCount || 256;
      const cpuRecords = Array.from({ length: rolloutCount }, (_, rolloutIndex) => (
        cpuSingleStep(tables, state, baseSeed, rolloutIndex)
      ));
      const cpuSummary = summaryFromRecords(cpuRecords);

      diag('P0 parity', 'double-state single-step 시작', {
        baseSeed: hex32(baseSeed),
        rolloutCount,
        state: { score: state[2], diceUse: state[5], isDouble: state[6] },
        productionSummary: capturedDoubleSelfTest?.summary || null,
      });
      diag('P1 CPU', '참조 summary', cpuSummary);

      const gpuRun = await runGpuSingleStepParity(tables, state, baseSeed, rolloutCount);
      const gpuRecords = Array.from({ length: rolloutCount }, (_, rolloutIndex) => (
        decodeGpuRecord(gpuRun.values, rolloutIndex)
      ));
      const gpuSummary = summaryFromRecords(gpuRecords);
      const divergenceCounts = {};
      const mismatches = [];

      for (let i = 0; i < rolloutCount; i++) {
        const divergence = firstDivergence(cpuRecords[i], gpuRecords[i]);
        if (divergence) {
          mismatches.push(i);
          divergenceCounts[divergence] = (divergenceCounts[divergence] || 0) + 1;
        }
      }

      diag('P2 GPU', 'debug shader summary', {
        ...gpuSummary,
        elapsedMs: gpuRun.elapsedMs,
        mismatchCount: mismatches.length,
        firstMismatch: mismatches[0] ?? null,
        divergenceCounts,
      });

      const logIndices = [...new Set([
        ...PARITY_LOG_INDICES.filter(index => index < rolloutCount),
        ...mismatches.slice(0, 4),
      ])].sort((a, b) => a - b);

      logIndices.forEach(index => {
        const cpu = cpuRecords[index];
        const gpu = gpuRecords[index];
        const divergence = firstDivergence(cpu, gpu);
        diag('P3 lane', `#${String(index).padStart(3, '0')} ${divergence ? `FAIL@${divergence}` : 'PASS'}`, {
          baseSeed: hex32(baseSeed),
          rolloutIndex: index,
          cpu: compactRecord(cpu),
          gpu: compactRecord(gpu),
        });
      });

      const productionSummary = capturedDoubleSelfTest?.summary || null;
      diag('P4 reduction', productionSummary
        ? (summariesEqual(gpuSummary, productionSummary) ? 'debug GPU == production summary' : 'debug GPU != production summary')
        : 'production double summary 캡처 없음', {
        cpu: cpuSummary,
        debugGpu: gpuSummary,
        production: productionSummary,
      });

      if (mismatches.length > 0) {
        diag('P5 RESULT', 'CPU↔GPU single-step divergence 검출', {
          mismatchCount: mismatches.length,
          firstMismatch: mismatches[0],
          divergenceCounts,
        });
      } else if (productionSummary && !summariesEqual(gpuSummary, productionSummary)) {
        diag('P5 RESULT', 'single-step은 일치하지만 production shader/reduction 경로가 다름', {
          debugGpu: gpuSummary,
          production: productionSummary,
        });
      } else {
        diag('P5 RESULT', '선택한 double-state batch에서 CPU↔GPU single-step 일치', {
          rolloutCount,
          productionMatched: Boolean(productionSummary),
        });
      }
    } catch (error) {
      diag('FAIL parity', errText(error), error?.stack || '');
    } finally {
      parityRunning = false;
    }
  }

  function scheduleDoubleStateParity() {
    if (parityScheduled) return;
    parityScheduled = true;
    setTimeout(() => runDoubleStateParityDiagnostic(), 0);
  }

  function instrumentWorkbench() {
    const wb = window.gpuRolloutWorkbench;
    if (!wb) {
      diag('FAIL workbench', 'window.gpuRolloutWorkbench 없음');
      return;
    }
    diag('S6 workbench', 'gpuRolloutWorkbench 존재');
    wrapMethod(wb, 'prepareGpuReadbackMode', original => async args => {
      diag('S7 prepare', 'prepareGpuReadbackMode 시작');
      try {
        const result = await original(args);
        diag('S7 prepare', `성공 (${result})`);
        return result;
      } catch (error) {
        diag('FAIL prepare', errText(error));
        throw error;
      }
    });
    for (const name of ['runGpu', 'runGpuAllActions']) {
      wrapMethod(wb, name, original => async args => {
        diag('S8 self-test', `${name} 시작`, {
          rolloutCount: args?.rolloutCount,
          action: args?.action,
          actionCount: args?.sample?.actionCount,
        });
        try {
          const result = await original(args);
          if (name === 'runGpu'
            && Number(args?.action) === 0
            && Number(args?.sample?.state?.[5]) === 100
            && Number(args?.sample?.state?.[6]) === 1) {
            capturedDoubleSelfTest = {
              seed: Number(args.seed) >>> 0,
              rolloutCount: Number(args.rolloutCount) || 0,
              state: Array.from(args.sample.state),
              summary: result,
            };
            diag('P0 capture', 'double self-test 입력/결과 캡처', {
              seed: hex32(capturedDoubleSelfTest.seed),
              rolloutCount: capturedDoubleSelfTest.rolloutCount,
              summary: result,
            });
          }
          diag('S8 self-test', `${name} 성공`, {
            count: result?.count,
            bestAction: result?.bestAction,
            elapsedMs: result?.elapsedMs,
          });
          return result;
        } catch (error) {
          diag('FAIL self-test', `${name}: ${errText(error)}`);
          throw error;
        }
      });
    }
  }

  function instrumentAdventureSelfTest() {
    if (typeof window.verifyGpuEngineOnLoad === 'function') {
      wrapMethod(window, 'verifyGpuEngineOnLoad', original => async (...args) => {
        diag('S10 verifyGpuEngineOnLoad', '시작');
        try {
          const result = await original(...args);
          diag('S10 verifyGpuEngineOnLoad', '반환', result);
          if (result?.ok === false) diag('FINAL self-test FAIL', String(result.reason || '(reason 없음)'));
          else if (result?.ok === true) diag('FINAL self-test PASS', 'ok=true');
          scheduleDoubleStateParity();
          return result;
        } catch (error) {
          diag('FAIL verifyGpuEngineOnLoad', errText(error));
          scheduleDoubleStateParity();
          throw error;
        }
      });
    } else {
      diag('DIAG', 'verifyGpuEngineOnLoad hook 대상 없음');
    }

    if (typeof window.markGpuUnavailable === 'function') {
      wrapMethod(window, 'markGpuUnavailable', original => reason => {
        diag('FINAL GPU unavailable', String(reason || '(reason 없음)'));
        return original(reason);
      });
    } else {
      diag('DIAG', 'markGpuUnavailable hook 대상 없음');
    }
  }

  window.addEventListener('error', event => diag('WINDOW error', event.message || errText(event.error)));
  window.addEventListener('unhandledrejection', event => diag('WINDOW rejection', errText(event.reason)));

  ensureUi();
  diag('S0 bootstrap', '진단 시작', {
    href: location.href,
    secureContext: window.isSecureContext,
    userAgent: navigator.userAgent,
  });
  instrumentGpu();
  instrumentWorkbench();
  instrumentAdventureSelfTest();
})();
