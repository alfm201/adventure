(() => {
  const qs = new URLSearchParams(location.search);
  if (qs.get('mode') !== 'test') return;

  const startedAt = performance.now();
  const lines = [];
  const BASE_SEED = 0x6a09e667;
  const WORKGROUP_SIZE = 64;
  const PARTIAL_STRIDE = 5;
  const FULL_ROLLOUTS = queryInt('fullRollouts', 65536, 4096, 262144);
  const FULL_REPEATS = queryInt('fullRepeats', 3, 1, 8);
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
    title.textContent = 'Production WebGPU RNG 검증 · 서비스 실측 중지';
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

  function createReservoir(seed) {
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
struct Params { seed:u32, lanes:u32, pad0:u32, pad1:u32, }
struct Reservoir { word:u32, bits:u32, calls:u32, rejects:u32, }
@group(0) @binding(0) var<storage, read_write> output:array<u32>;
@group(0) @binding(1) var<uniform> params:Params;

fn next_rand(rng:ptr<function,u32>)->u32 {
  var t=(*rng)+0x6D2B79F5u;
  (*rng)=t;
  var r=(t^(t>>15u))*(1u|t);
  r=r^(r+((r^(r>>7u))*61u));
  return r^(r>>14u);
}
fn bits_for_bound(bound:u32)->u32 {
  if(bound<=1u){return 0u;}
  if(bound<=2u){return 1u;}
  if(bound<=4u){return 2u;}
  if(bound<=8u){return 3u;}
  if(bound<=16u){return 4u;}
  return 5u;
}
fn reservoir(rng:ptr<function,u32>,state:ptr<function,Reservoir>,bound:u32)->u32 {
  if(bound<=1u){return 0u;}
  let bits=bits_for_bound(bound);
  let mask=(1u<<bits)-1u;
  loop {
    if((*state).bits<bits){
      (*state).word=next_rand(rng);
      (*state).bits=32u;
      (*state).calls=(*state).calls+1u;
    }
    let candidate=(*state).word&mask;
    (*state).word=(*state).word>>bits;
    (*state).bits=(*state).bits-bits;
    if(candidate<bound){return candidate;}
    (*state).rejects=(*state).rejects+1u;
  }
}

@compute @workgroup_size(64)
fn legacy_mod(@builtin(global_invocation_id) gid:vec3<u32>) {
  let lane=gid.x;
  if(lane>=params.lanes){return;}
  let base=lane*4u;
  var rng=params.seed+lane*747796405u+2891336453u;
  let a=i32(next_rand(&rng)%6u)+1;
  let b=i32(next_rand(&rng)%6u)+1;
  output[base]=bitcast<u32>(a);
  output[base+1u]=bitcast<u32>(b);
  output[base+2u]=rng;
  output[base+3u]=select(0u,1u,a<1||a>6||b<1||b>6);
}

@compute @workgroup_size(64)
fn reservoir_parity(@builtin(global_invocation_id) gid:vec3<u32>) {
  let lane=gid.x;
  if(lane>=params.lanes){return;}
  let base=lane*100u;
  var rng=params.seed+lane*747796405u+2891336453u;
  var state:Reservoir;
  state.word=0u; state.bits=0u; state.calls=0u; state.rejects=0u;
  var cardBound=1u;
  for(var i=0u;i<96u;i=i+1u){
    var bound=6u;
    if(i>=48u){
      bound=cardBound;
      cardBound=cardBound+1u;
      if(cardBound>30u){cardBound=1u;}
    }
    output[base+i]=reservoir(&rng,&state,bound);
  }
  output[base+96u]=state.calls;
  output[base+97u]=state.rejects;
  output[base+98u]=rng;
  output[base+99u]=state.bits;
}
`;
  }

  async function compilePipeline(device, module, entryPoint) {
    const descriptor = { layout:'auto', compute:{ module, entryPoint } };
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

  async function newDevice() {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference:'high-performance' });
    if (!adapter) throw new Error('adapter=null');
    return { adapter, device:await adapter.requestDevice() };
  }

  async function dispatchRead(device, pipeline, lanes, stride, paramsData) {
    const byteLength = lanes * stride * 4;
    const output = device.createBuffer({ size:byteLength, usage:GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const read = device.createBuffer({ size:byteLength, usage:GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const uniform = device.createBuffer({ size:16, usage:GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(uniform, 0, paramsData);
    const bindGroup = device.createBindGroup({ layout:pipeline.getBindGroupLayout(0), entries:[
      {binding:0,resource:{buffer:output}}, {binding:1,resource:{buffer:uniform}},
    ]});
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup); pass.dispatchWorkgroups(Math.ceil(lanes/WORKGROUP_SIZE)); pass.end();
    encoder.copyBufferToBuffer(output,0,read,0,byteLength);
    device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);
    const values = new Uint32Array(read.getMappedRange()).slice();
    read.unmap(); output.destroy(); read.destroy(); uniform.destroy();
    return values;
  }

  async function runSamplerChecks() {
    const { device } = await newDevice();
    const module = device.createShaderModule({ code:diagnosticShader() });
    await checkShader(module, 'diagnostic shader');
    const legacyPipeline = await compilePipeline(device,module,'legacy_mod');
    const parityPipeline = await compilePipeline(device,module,'reservoir_parity');

    const legacy = await dispatchRead(device,legacyPipeline,256,4,new Uint32Array([BASE_SEED,256,0,0]));
    let legacyMismatch=0, legacyInvalid=0, firstLegacy=null;
    for(let lane=0;lane<256;lane++){
      const seed=u32(BASE_SEED+Math.imul(lane,747796405)+2891336453);
      const rng={value:seed};
      const raw1=nextRandCpu(rng),raw2=nextRandCpu(rng);
      const cpu=[raw1%6+1,raw2%6+1];
      const gpu=[legacy[lane*4]|0,legacy[lane*4+1]|0];
      legacyInvalid+=legacy[lane*4+3];
      if(cpu[0]!==gpu[0]||cpu[1]!==gpu[1]){
        legacyMismatch++;
        if(!firstLegacy) firstLegacy={lane,seed:hex32(seed),raw1:hex32(raw1),raw2:hex32(raw2),cpu,gpu};
      }
    }
    log('R4A LEGACY MOD',legacyMismatch?'구형 modulo 오류 재현':'구형 modulo PASS',{mismatchedLanes:legacyMismatch,invalidLanes:legacyInvalid,firstMismatch:firstLegacy});

    const values = await dispatchRead(device,parityPipeline,256,100,new Uint32Array([BASE_SEED,256,0,0]));
    let mismatches=0, first=null;
    for(let lane=0;lane<256;lane++){
      const seed=u32(BASE_SEED+Math.imul(lane,747796405)+2891336453);
      const state=createReservoir(seed);
      let cardBound=1;
      for(let draw=0;draw<96;draw++){
        let bound=6;
        if(draw>=48){bound=cardBound++;if(cardBound>30)cardBound=1;}
        const cpu=reservoirCpu(state,bound);
        const gpu=values[lane*100+draw];
        if(cpu!==gpu){mismatches++;if(!first)first={lane,draw,cpu,gpu};}
      }
      const meta=[state.calls,state.rejects,state.rng.value,state.bits];
      for(let k=0;k<4;k++){
        const gpu=values[lane*100+96+k];
        if(u32(meta[k])!==gpu){mismatches++;if(!first)first={lane,meta:k,cpu:u32(meta[k]),gpu};}
      }
    }
    log('R4 GPU parity',`bit-reservoir ${mismatches?'FAIL':'exact PASS'}`,{comparedValues:25600,mismatches,firstMismatch:first});
    return { legacyMismatch, legacyInvalid, reservoirParityPass:mismatches===0 };
  }

  function storageBuffer(device, typedArray) {
    const buffer = device.createBuffer({ size:Math.max(4,typedArray.byteLength), usage:GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(buffer,0,typedArray);
    return buffer;
  }

  function summarizePartials(values) {
    let count=0,sum=0,sumSq=0,min=Infinity,max=-Infinity;
    for(let i=0;i<values.length;i+=PARTIAL_STRIDE){
      const c=values[i]; if(!c)continue;
      count+=c; sum+=values[i+1]; sumSq+=values[i+2]; min=Math.min(min,values[i+3]); max=Math.max(max,values[i+4]);
    }
    const mean=sum/count;
    const variance=Math.max(0,sumSq/count-mean*mean);
    return {count,mean,std:Math.sqrt(variance),min,max,sum,sumSq};
  }

  function mergeRuns(runs) {
    const count=runs.reduce((s,r)=>s+r.count,0);
    const sum=runs.reduce((s,r)=>s+r.sum,0);
    const sumSq=runs.reduce((s,r)=>s+r.sumSq,0);
    const mean=sum/count;
    const variance=Math.max(0,sumSq/count-mean*mean);
    return {count,mean,std:Math.sqrt(variance),min:Math.min(...runs.map(r=>r.min)),max:Math.max(...runs.map(r=>r.max)),se:Math.sqrt(variance/count)};
  }

  async function runProductionFull() {
    if(typeof window.shaderSource!=='function'||typeof window.buildGpuTables!=='function'||typeof window.buildX36GpuLookupData!=='function') throw new Error('production GPU helper 없음');
    const tables=window.buildGpuTables();
    const { adapter,device }=await newDevice();
    const source=window.shaderSource(tables);
    const forbiddenDice=(source.match(/next_rand\(rng\) % 6u/g)||[]).length;
    const forbiddenCard=(source.match(/next_rand\(rng\) % remaining/g)||[]).length;
    const boundedDice=(source.match(/next_bounded\(rng, 6u\)/g)||[]).length;
    const boundedCard=(source.match(/next_bounded\(rng, remaining\)/g)||[]).length;
    log('R5 PROD SOURCE','production sampler 구조',{legacyDiceModuloUses:forbiddenDice,legacyCardModuloUses:forbiddenCard,boundedDiceUses:boundedDice,boundedCardUses:boundedCard});
    if(forbiddenDice!==0||forbiddenCard!==0||boundedDice!==2||boundedCard!==1) throw new Error('production sampler 구조가 예상과 다름');

    const module=device.createShaderModule({code:source});
    await checkShader(module,'production shader');
    const pipeline=await compilePipeline(device,module,'main');
    const shared={
      stageId:storageBuffer(device,window.buildX36GpuLookupData(tables)),
      stageMove:storageBuffer(device,new Int32Array(tables.stageMove)),
      stageEvent:storageBuffer(device,new Int32Array(tables.stageEvent)),
      cardType:storageBuffer(device,new Int32Array(tables.cardType)),
      cardValue:storageBuffer(device,new Int32Array(tables.cardValue)),
    };

    async function runOne(state,rolloutCount,seed){
      const input=storageBuffer(device,new Int32Array(state));
      const workgroups=Math.ceil(rolloutCount/WORKGROUP_SIZE);
      const byteLength=workgroups*PARTIAL_STRIDE*4;
      const output=device.createBuffer({size:byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
      const read=device.createBuffer({size:byteLength,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
      const uniform=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
      device.queue.writeBuffer(uniform,0,new Uint32Array([rolloutCount,0,seed>>>0,512,1,0,0,0]));
      const bindGroup=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
        {binding:0,resource:{buffer:shared.stageId}},{binding:1,resource:{buffer:shared.stageMove}},
        {binding:2,resource:{buffer:shared.stageEvent}},{binding:3,resource:{buffer:shared.cardType}},
        {binding:4,resource:{buffer:shared.cardValue}},{binding:5,resource:{buffer:input}},
        {binding:6,resource:{buffer:output}},{binding:7,resource:{buffer:uniform}},
      ]});
      const encoder=device.createCommandEncoder();
      const pass=encoder.beginComputePass();
      pass.setPipeline(pipeline);pass.setBindGroup(0,bindGroup);pass.dispatchWorkgroups(workgroups);pass.end();
      encoder.copyBufferToBuffer(output,0,read,0,byteLength);
      const t0=performance.now();
      device.queue.submit([encoder.finish()]);
      await read.mapAsync(GPUMapMode.READ);
      const elapsedMs=performance.now()-t0;
      const values=new Uint32Array(read.getMappedRange()).slice();
      read.unmap();input.destroy();output.destroy();read.destroy();uniform.destroy();
      return {...summarizePartials(values),elapsedMs,rolloutsPerSec:rolloutCount/(elapsedMs/1000)};
    }

    const initial=new Board().getState().slice();initial[1]=true;
    const doneState=initial.slice();doneState[5]=100;doneState[6]=0;
    const doubleState=initial.slice();doubleState[5]=100;doubleState[6]=1;
    const done=await runOne(doneState,1024,BASE_SEED^0x44444444);
    const doubleResult=await runOne(doubleState,8192,BASE_SEED^0x55555555);
    const sanityPass=done.mean===1&&done.min===1&&done.max===1&&doubleResult.min>=4&&doubleResult.max<=22;
    log('R6 PROD SANITY',sanityPass?'PASS':'FAIL',{done,double:doubleResult,expectedDouble:{min:4,max:22}});

    await runOne(initial,2048,BASE_SEED);
    const runs=[];
    for(let r=0;r<FULL_REPEATS;r++){
      const seed=u32(BASE_SEED+Math.imul(r+1,0x9e3779b1));
      runs.push(await runOne(initial,FULL_ROLLOUTS,seed));
    }
    const aggregate=mergeRuns(runs);
    const medianRolloutsPerSec=median(runs.map(run=>run.rolloutsPerSec));
    const distributionPass=aggregate.mean>=1200&&aggregate.mean<=2200&&aggregate.max<=2700;
    log('R7 PROD FULL',distributionPass?'PASS':'FAIL',{rolloutsPerRun:FULL_ROLLOUTS,repeats:FULL_REPEATS,runs,aggregate,medianRolloutsPerSec,adapterInfo:adapter.info||{}});
    Object.values(shared).forEach(buffer=>buffer.destroy());
    return {sourcePass:true,sanityPass,distributionPass,aggregate,medianRolloutsPerSec};
  }

  async function run() {
    if(running)return;
    running=true;
    try{
      log('R0 CONFIG','production reservoir 검증 시작',{fullRollouts:FULL_ROLLOUTS,fullRepeats:FULL_REPEATS,cpuDecision:'현행 유지',productionMeasurementsStopped:true});
      if(!navigator.gpu)throw new Error('navigator.gpu 없음');
      const sampler=await runSamplerChecks();
      let production=null;
      try{production=await runProductionFull();}catch(error){log('FAIL PROD FULL',errText(error),error?.stack||'');}
      log('R8 FINAL','검증 완료',{
        legacyModuloBugReproduced:sampler.legacyMismatch>0,
        reservoirParityPass:sampler.reservoirParityPass,
        productionSourcePass:production?.sourcePass??false,
        productionSanityPass:production?.sanityPass??false,
        productionDistributionPass:production?.distributionPass??false,
        productionMean:production?.aggregate?.mean??null,
        productionMedianRolloutsPerSec:production?.medianRolloutsPerSec??null,
        cpuPatchRecommended:false,
        productionChanged:true,
        productionMeasurementsStopped:true,
      });
    }catch(error){
      log('FAIL diagnostic',errText(error),error?.stack||'');
    }finally{running=false;}
  }

  window.addEventListener('error',event=>log('WINDOW error',event.message||errText(event.error)));
  window.addEventListener('unhandledrejection',event=>log('WINDOW rejection',errText(event.reason)));
  ensureUi();
  log('S0 bootstrap','진단 시작',{href:location.href,secureContext:window.isSecureContext,userAgent:navigator.userAgent});
  log('S1 navigator.gpu',navigator.gpu?'존재':'없음');
  stopProductionMeasurements();
  setTimeout(run,0);
})();
