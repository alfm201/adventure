(() => {
  'use strict';

  const query = new URLSearchParams(window.location.search);
  if ((query.get('model') || '').toUpperCase() !== 'FQ1') return;

  const MAX_ROLLOUTS = 8192;
  const ENGINE_URL = new URL('./js/fq1_webgpu.js?v=20260806080000000000', window.location.href).href;
  const POLICY_URL = new URL('./fq1.js', window.location.href).href;
  const WEIGHTS_URL = new URL('./fq1_weights.bin', window.location.href).href;

  const legacyCalcEx = calcEx;
  const scriptLoads = new Map();
  let policy = null;
  let gpuEngine = null;
  let gpuEnginePromise = null;

  function loadScriptOnce(src) {
    if (scriptLoads.has(src)) return scriptLoads.get(src);
    const promise = new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find(script => script.src === src);
      if (existing) {
        if (existing.dataset.loaded === 'true' || existing.readyState === 'complete') {
          resolve();
          return;
        }
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error(`스크립트 로드 실패: ${src}`)), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
      }, { once: true });
      script.addEventListener('error', () => reject(new Error(`스크립트 로드 실패: ${src}`)), { once: true });
      document.head.appendChild(script);
    });
    scriptLoads.set(src, promise);
    return promise;
  }

  async function ensurePolicy() {
    if (policy) return policy;
    if (!window.FQ1Policy) await loadScriptOnce(POLICY_URL);
    if (!window.FQ1Policy) throw new Error('FQ1Policy를 불러오지 못했습니다.');
    policy = await window.FQ1Policy.load(WEIGHTS_URL);
    return policy;
  }

  function makeParityState(score, diceUse, isDouble, cards, acquired = []) {
    const safeScore = Math.max(1, Math.min(2898, Math.trunc(score)));
    const raw = new Array(42).fill(0);
    raw[0] = 0;
    raw[1] = 1;
    raw[2] = safeScore;
    raw[3] = Number(stage[safeScore - 1]?.[1] || 0);
    raw[4] = Number(stage[safeScore - 1]?.[2] || 0);
    raw[5] = diceUse;
    raw[6] = isDouble ? 1 : 0;
    cards.slice(0, 5).forEach((card, index) => { raw[7 + index] = card; });
    acquired.forEach(card => {
      if (card >= 1 && card <= 30) raw[11 + card] = 1;
    });
    return raw;
  }

  function parityStates() {
    return [
      makeParityState(1, 0, false, []),
      makeParityState(487, 32, false, [1, 8, 16, 24], [1, 8, 16]),
      makeParityState(1136, 67, false, [2, 7, 13, 21, 29], [2, 7, 13, 21, 29]),
      makeParityState(1987, 88, true, [3, 11, 19, 27, 30], [3, 11, 19, 27]),
      makeParityState(2710, 99, false, [5, 12, 18, 26], [5, 12, 18, 26]),
    ];
  }

  async function ensureGpuEngine(onStatus) {
    if (gpuEngine) return gpuEngine;
    if (gpuEnginePromise) return gpuEnginePromise;
    gpuEnginePromise = (async () => {
      onStatus?.('FQ1 가중치를 읽는 중...');
      const loadedPolicy = await ensurePolicy();
      onStatus?.('raw WebGPU compute pipeline을 컴파일하는 중...');
      await loadScriptOnce(ENGINE_URL);
      if (!window.FQ1WebGPUEngine) throw new Error('FQ1 WebGPU 엔진을 불러오지 못했습니다.');
      const engine = await window.FQ1WebGPUEngine.create(loadedPolicy, {
        stage,
        laneCapacity: query.get('fq1Batch') || undefined,
        checkInterval: query.get('fq1Check') || undefined,
      });
      onStatus?.('CPU 기준 구현과 WebGPU 행동 parity를 검사하는 중...');
      await engine.verifyParity(parityStates(), { allowedNearTieMargin: 0.05 });
      gpuEngine = engine;
      const diagnostics = engine.diagnostics();
      console.log('FQ1 raw WebGPU engine ready.', diagnostics);
      window.__adventureFq1Mode = {
        active: true,
        backend: 'raw-webgpu',
        maxRollouts: MAX_ROLLOUTS,
        modelId: loadedPolicy.header?.model_id || 'FQ1',
        diagnostics: () => gpuEngine?.diagnostics() || null,
        resetGpu: resetGpuEngine,
      };
      return engine;
    })();

    try {
      return await gpuEnginePromise;
    } catch (error) {
      gpuEngine?.destroy();
      gpuEngine = null;
      throw error;
    } finally {
      gpuEnginePromise = null;
    }
  }

  function resetGpuEngine() {
    if (gpuEngine) gpuEngine.destroy();
    gpuEngine = null;
    gpuEnginePromise = null;
  }

  function randomSeed() {
    if (typeof getGpuRandomSeed === 'function') return getGpuRandomSeed() >>> 0;
    if (window.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return values[0] >>> 0;
    }
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }

  function addScores(stats, scores) {
    for (let index = 0; index < scores.length; index++) {
      const score = Number(scores[index]) || 0;
      stats.count++;
      stats.sum += score;
      stats.sumSq += score * score;
      stats.min = Math.min(stats.min, score);
      stats.max = Math.max(stats.max, score);
      if (score >= 0 && score < stats.scoreCounts.length) {
        stats.scoreCounts[score]++;
        stats.scoreCountTotal++;
      }
    }
  }

  function initializeDisplay(actions) {
    env.exScores = new Array(6).fill(0);
    env.exHighlights = new Array(6).fill(false);
    env.exValues = {
      min: new Array(6).fill(0),
      max: new Array(6).fill(0),
      std: new Array(6).fill(0),
      mid: new Array(6).fill(0),
      count: new Array(6).fill(0),
      se: new Array(6).fill(0),
      gap: new Array(6).fill(0),
      z: new Array(6).fill(0),
      status: new Array(6).fill(''),
    };
    actions.forEach(action => {
      env.exScores[action] = '계산중...';
      env.exValues.status[action] = '계산중';
    });
  }

  async function calcExRawWebGpu(route = [0, 1, 2, 3, 4, 5]) {
    if (!computeModeReady) {
      pendingInitialCalc = true;
      return;
    }
    const calcRequestId = beginCalcExRequest();
    if (env.autoProcess) {
      showDiceOverlay = false;
      diceOverlayHoverIndex = -1;
      if (typeof isDraggingCharacter !== 'undefined') isDraggingCharacter = false;
      if (typeof characterDragTargetScore !== 'undefined') characterDragTargetScore = null;
      if (typeof characterDragStartScore !== 'undefined') characterDragStartScore = null;
    }
    restorePredictionInteractionFromLastPointer({ update: false });

    const displayActions = [];
    for (let action = 0; action < 6; action++) {
      if (action === 0 || (env.cards[action - 1] !== undefined && route.includes(action))) {
        displayActions.push(action);
      }
    }
    initializeDisplay(displayActions);
    if (!displayActions.length) {
      if (isCalcExRequestActive(calcRequestId)) updateBoard();
      return;
    }
    updateBoard();

    const isCurrent = () => isCalcExRequestActive(calcRequestId);
    try {
      const engine = await ensureGpuEngine();
      if (!isCurrent()) return;

      const simulationState = env.getState();
      const initialIteration = Math.min(MAX_ROLLOUTS, getAdaptiveInitialIteration(MAX_ROLLOUTS));
      const batchIteration = Math.min(MAX_ROLLOUTS, getAdaptiveBatchIteration(MAX_ROLLOUTS));
      const maxIteration = MAX_ROLLOUTS;
      const actionStats = new Array(6).fill(0).map(() => createActionStats());
      let activeActions = displayActions.slice();
      const startedAt = performance.now();
      const maxUsed = () => Math.max(0, ...actionStats.map(stat => stat.count));

      function applyDecision(decision) {
        if (!isCurrent()) return;
        const activeSet = new Set(activeActions);
        env.exHighlights = new Array(6).fill(false);
        env.exAction = decision.bestAction;
        if (decision.bestAction === undefined) {
          env.exScore = Infinity;
          return;
        }
        const best = decision.summaries[decision.bestAction];
        env.exScore = best.avg;
        displayActions.forEach(action => {
          const summary = decision.summaries[action];
          env.exScores[action] = summary.avg;
          env.exValues.min[action] = summary.min;
          env.exValues.max[action] = summary.max;
          env.exValues.mid[action] = summary.mid;
          env.exValues.std[action] = Number(summary.std.toFixed(3));
          env.exValues.count[action] = summary.count;
          env.exValues.se[action] = Number(summary.se.toFixed(3));
          env.exValues.status[action] = action === decision.bestAction ? '추천' : activeSet.has(action) ? '후보' : '제외';
          const gap = best.avg - summary.avg;
          const combinedSe = Math.sqrt(best.se * best.se + summary.se * summary.se);
          env.exValues.gap[action] = Number(gap.toFixed(3));
          env.exValues.z[action] = combinedSe > 0 && Number.isFinite(combinedSe) ? Number((gap / combinedSe).toFixed(3)) : 0;
          env.exHighlights[action] = action === decision.bestAction || gap <= calcHighlightMargin(maxUsed(), best, summary);
        });
      }

      async function sampleActions(actions, iteration) {
        const sharedSeed = randomSeed();
        for (const action of actions) {
          if (!isCurrent()) return false;
          const remaining = maxIteration - actionStats[action].count;
          const count = Math.min(iteration, remaining);
          if (count <= 0) continue;
          env.exValues.status[action] = `FQ1 GPU ${actionStats[action].count}/${maxIteration}`;
          updateBoard();
          const scores = await engine.run(simulationState, action, count, sharedSeed, {
            isCancelled: () => !isCurrent(),
            onProgress: completed => {
              if (!isCurrent()) return;
              env.exValues.status[action] = `FQ1 GPU ${actionStats[action].count + completed}/${maxIteration}`;
            },
          });
          if (!isCurrent()) return false;
          addScores(actionStats[action], scores);
          const decision = getAdaptiveDecision(actionStats, activeActions);
          applyDecision(decision);
          updateBoard();
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        return true;
      }

      env.exAction = undefined;
      env.exScore = Infinity;
      updateBoard();
      if (!await sampleActions(activeActions, initialIteration)) return;

      while (isCurrent()) {
        let decision = getAdaptiveDecision(actionStats, activeActions);
        applyDecision(decision);
        updateBoard();
        if (shouldStopAdaptive(decision, actionStats, activeActions, maxIteration)) {
          console.log(`FQ1-U8K raw WebGPU adaptive used ${maxUsed()}/${MAX_ROLLOUTS}, elapsed=${(performance.now() - startedAt).toFixed(1)}ms`, engine.diagnostics());
          return;
        }
        if (!isAdaptiveEarlyStopDisabled()) activeActions = pruneAdaptiveActions(actionStats, activeActions);
        decision = getAdaptiveDecision(actionStats, activeActions);
        applyDecision(decision);
        updateBoard();
        if (!isAdaptiveEarlyStopDisabled() && activeActions.length <= 1) return;
        const nextActions = getAdaptiveNextActions(actionStats, activeActions, maxIteration);
        if (!nextActions.length) return;
        if (!await sampleActions(nextActions, batchIteration)) return;
      }
    } catch (error) {
      if (!isCurrent()) return;
      console.error('FQ1 raw WebGPU calculation failed.', error);
      displayActions.forEach(action => {
        env.exScores[action] = 'FQ1 GPU Error';
        env.exValues.status[action] = '오류';
      });
      env.exAction = undefined;
      env.exScore = Infinity;
      updateBoard();
    }
  }

  function calcExPatched(route) {
    if (computeSettings.engine === 'cpu') return legacyCalcEx(route);
    return calcExRawWebGpu(route);
  }

  function engineCard(label, value, detail, available, selected) {
    return `<label data-fq1-engine="${value}" style="display:block;border:1px solid ${selected ? '#2563eb' : '#cbd5e1'};border-radius:10px;padding:14px;cursor:${available ? 'pointer' : 'not-allowed'};background:${selected ? '#eff6ff' : '#f8fafc'};opacity:${available ? '1' : '.58'};"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;"><span style="display:flex;align-items:center;gap:8px;"><input type="radio" name="fq1-engine-v2" value="${value}" ${selected ? 'checked' : ''} ${available ? '' : 'disabled'}><strong>${label}</strong></span>${value === 'gpu' && available ? '<span style="border-radius:999px;background:#16a34a;color:white;font-size:11px;font-weight:800;padding:3px 8px;">권장</span>' : ''}${!available ? '<span style="border-radius:999px;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:800;padding:3px 8px;">사용 불가</span>' : ''}</div><div style="font-size:12px;line-height:1.55;color:#475569;">${detail}</div></label>`;
  }

  function showRawFq1Modal(onDone) {
    hideLoadingOverlay();
    document.getElementById('adventure-compute-modal')?.remove();
    const gpuAvailable = Boolean(navigator.gpu);
    let selected = gpuAvailable ? 'gpu' : 'cpu';
    const root = document.createElement('div');
    root.id = 'adventure-compute-modal';
    root.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.68);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:16px;box-sizing:border-box;';
    root.innerHTML = `<div data-compute-card="true" style="width:min(580px,100%);max-height:calc(100dvh - 32px);overflow:auto;border-radius:12px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.38);border:1px solid rgba(15,23,42,.12);padding:22px;box-sizing:border-box;"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><h2 style="margin:0;font-size:21px;color:#0f172a;">FQ1-U8K 테스트 모델</h2><span style="border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:900;padding:3px 8px;">실험용</span><span style="border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:900;padding:3px 8px;">raw WebGPU</span></div><p style="margin:9px 0 0;color:#475569;font-size:13px;line-height:1.6;">기존 adaptive root의 조기종료·후보 제거 로직은 유지하고 continuation만 FQ1으로 실행합니다. GPU 모드는 TFJS를 사용하지 않으며 상태, feature, Transformer, 환경 transition을 고정 WebGPU 버퍼에서 처리합니다.</p><div style="margin:14px 0;padding:11px 12px;border-radius:9px;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;font-size:12px;line-height:1.65;"><strong>고정 설정</strong> · 행동별 최대 8,192 rollout · horizon 512<br><strong>메모리 안전</strong> · 고정 lane chunk와 재사용 버퍼 · decision 중 GPU→CPU 상태 readback 없음 · 최종 점수만 readback</div><div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:8px;">계산 엔진</div><div id="fq1-v2-engine-options" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">${engineCard('GPU','gpu','전용 WGSL compute pipeline입니다. 기존 X36 GPU 엔진처럼 rollout 상태를 GPU에 유지합니다.',gpuAvailable,selected === 'gpu')}${engineCard('CPU','cpu','기존 CPU 경로입니다. FQ1 WebGPU 검증 실패 시 비교용으로만 사용하세요.',true,selected === 'cpu')}</div><div id="fq1-v2-status" style="min-height:36px;margin-top:13px;color:#64748b;font-size:12px;line-height:1.55;"></div><button id="fq1-v2-start" type="button" style="width:100%;border:0;border-radius:9px;background:#2563eb;color:#fff;font-size:14px;font-weight:850;padding:12px 14px;cursor:pointer;">FQ1 테스트 시작</button><div style="margin-top:10px;color:#94a3b8;font-size:11px;line-height:1.45;text-align:center;">일반 URL의 X36 운영 정책에는 영향을 주지 않습니다.</div></div>`;
    document.body.appendChild(root);
    const cards = Array.from(root.querySelectorAll('[data-fq1-engine]'));
    function refresh() {
      cards.forEach(card => {
        const active = card.dataset.fq1Engine === selected;
        card.style.borderColor = active ? '#2563eb' : '#cbd5e1';
        card.style.background = active ? '#eff6ff' : '#f8fafc';
        const input = card.querySelector('input');
        if (input && !input.disabled) input.checked = active;
      });
    }
    cards.forEach(card => card.addEventListener('click', () => {
      const input = card.querySelector('input');
      if (!input || input.disabled) return;
      selected = card.dataset.fq1Engine;
      refresh();
    }));
    const button = root.querySelector('#fq1-v2-start');
    const status = root.querySelector('#fq1-v2-status');
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.style.opacity = '.65';
      button.style.cursor = 'wait';
      status.style.color = '#2563eb';
      try {
        if (selected === 'gpu') {
          const engine = await ensureGpuEngine(message => { status.textContent = message; });
          const info = engine.diagnostics();
          status.textContent = `초기화 완료 · 고정 GPU 버퍼 ${info.allocatedMiB.toFixed(1)} MiB · lane chunk ${info.laneCapacity} · 종료 확인 ${info.checkInterval} step`;
        } else {
          status.textContent = 'CPU 비교 경로를 선택했습니다.';
        }
        computeSettings.engine = selected;
        computeSettings.cpuIteration = MAX_ROLLOUTS;
        computeSettings.cpuMaxPct = 100;
        computeSettings.gpuIteration = MAX_ROLLOUTS;
        computeSettings.gpuMaxPct = 100;
        computeSettings.gpuBatchPct = 100;
        await new Promise(resolve => setTimeout(resolve, 250));
        root.remove();
        onDone?.();
      } catch (error) {
        console.error(error);
        status.style.color = '#b91c1c';
        status.textContent = `초기화 실패: ${error?.message || error}`;
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
      }
    });
  }

  prepareGpuReadbackModeOnLoad = async function prepareFq1RawWebGpuMode() {
    gpuDisabledReason = navigator.gpu ? '' : 'WebGPU is unavailable for FQ1 mode.';
  };
  isGpuAvailable = function isFq1RawGpuAvailable() { return Boolean(navigator.gpu); };
  showComputeModeModal = showRawFq1Modal;
  calcEx = calcExPatched;
  computeSettings.cpuIteration = MAX_ROLLOUTS;
  computeSettings.cpuMaxPct = 100;
  computeSettings.gpuIteration = MAX_ROLLOUTS;
  computeSettings.gpuMaxPct = 100;
  computeSettings.gpuBatchPct = 100;
  window.__fq1WebGpuReset = resetGpuEngine;
  window.addEventListener('pagehide', resetGpuEngine, { once: true });
  document.title = 'Adventure · FQ1-U8K raw WebGPU Test';
})();