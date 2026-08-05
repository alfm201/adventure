/*
 * Experimental FQ1-U8K runtime.
 *
 * Activated only when the page URL contains ?model=FQ1 (case-insensitive).
 * The normal Adventure runtime is left untouched for all other URLs.
 *
 * Root action selection keeps the existing adaptive confidence-stop/pruning
 * helpers from adventure.js. Only the continuation policy is replaced by FQ1,
 * and the per-action rollout ceiling is fixed at 8,192.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if ((params.get('model') || '').toUpperCase() !== 'FQ1') return;

  const MAX_ROLLOUTS = 8192;
  const MAX_CONTINUATION_STEPS = 512;
  const TFJS_VERSION = '4.22.0';
  const CDN_ROOT = 'https://cdn.jsdelivr.net/npm';
  const TFJS_URL = `${CDN_ROOT}/@tensorflow/tfjs@${TFJS_VERSION}/dist/tf.min.js`;
  const TFJS_WEBGPU_URL = `${CDN_ROOT}/@tensorflow/tfjs-backend-webgpu@${TFJS_VERSION}/dist/tf-backend-webgpu.min.js`;
  const TFJS_WASM_URL = `${CDN_ROOT}/@tensorflow/tfjs-backend-wasm@${TFJS_VERSION}/dist/tf-backend-wasm.min.js`;
  const TFJS_WASM_PATH = `${CDN_ROOT}/@tensorflow/tfjs-backend-wasm@${TFJS_VERSION}/dist/`;
  const FULL_DECK_MASK = 0x3fffffff;

  const runtime = {
    engine: null,
    policy: null,
    model: null,
    loading: null,
    scriptPromises: new Map(),
    modelId: 'FQ1',
  };

  window.__adventureFq1Mode = {
    active: true,
    maxRollouts: MAX_ROLLOUTS,
    get engine() { return runtime.engine; },
    get modelId() { return runtime.modelId; },
  };

  function loadScriptOnce(src) {
    if (runtime.scriptPromises.has(src)) return runtime.scriptPromises.get(src);
    const promise = new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find(script => script.src === src);
      if (existing) {
        if (existing.dataset.loaded === 'true') resolve();
        else {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', () => reject(new Error(`스크립트 로드 실패: ${src}`)), { once: true });
        }
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
    runtime.scriptPromises.set(src, promise);
    return promise;
  }

  async function ensureFq1Policy() {
    if (runtime.policy) return runtime.policy;
    if (!window.FQ1Policy) {
      await loadScriptOnce(new URL('./fq1.js', window.location.href).href);
    }
    if (!window.FQ1Policy) throw new Error('FQ1Policy를 불러오지 못했습니다.');
    runtime.policy = await window.FQ1Policy.load(new URL('./fq1_weights.bin', window.location.href));
    runtime.modelId = runtime.policy.header?.model_id || 'FQ1';
    return runtime.policy;
  }

  async function ensureTensorFlow(engine) {
    await loadScriptOnce(TFJS_URL);
    if (!window.tf) throw new Error('TensorFlow.js를 초기화하지 못했습니다.');

    if (engine === 'gpu') {
      if (!navigator.gpu) throw new Error('이 브라우저에서는 WebGPU를 사용할 수 없습니다.');
      await loadScriptOnce(TFJS_WEBGPU_URL);
      const ok = await window.tf.setBackend('webgpu');
      if (!ok) throw new Error('TensorFlow.js WebGPU 백엔드 초기화에 실패했습니다.');
    } else {
      await loadScriptOnce(TFJS_WASM_URL);
      if (window.tf.wasm?.setWasmPaths) window.tf.wasm.setWasmPaths(TFJS_WASM_PATH);
      const ok = await window.tf.setBackend('wasm');
      if (!ok) throw new Error('TensorFlow.js WASM CPU 백엔드 초기화에 실패했습니다.');
    }
    await window.tf.ready();
  }

  class FQ1TensorModel {
    constructor(policy, engine) {
      this.policy = policy;
      this.engine = engine;
      this.tf = window.tf;
      this.width = policy.width;
      this.heads = policy.heads;
      this.headWidth = policy.headWidth;
      this.weights = Object.create(null);
      this.batchSize = engine === 'gpu' ? 256 : 24;
      this.createWeights();
    }

    createWeights() {
      const names = [
        'global_encoder.0.weight', 'global_encoder.0.bias',
        'global_encoder.2.weight', 'global_encoder.2.bias',
        'action_encoder.0.weight', 'action_encoder.0.bias',
        'action_encoder.2.weight', 'action_encoder.2.bias',
        'final_norm.weight', 'final_norm.bias',
        'baseline.0.weight', 'baseline.0.bias',
        'baseline.2.weight', 'baseline.2.bias',
        'advantage.0.weight', 'advantage.0.bias',
        'advantage.2.weight', 'advantage.2.bias',
      ];
      for (let layer = 0; layer < 4; layer++) {
        const prefix = `interaction.layers.${layer}.`;
        names.push(
          `${prefix}norm1.weight`, `${prefix}norm1.bias`,
          `${prefix}self_attn.in_proj_weight`, `${prefix}self_attn.in_proj_bias`,
          `${prefix}self_attn.out_proj.weight`, `${prefix}self_attn.out_proj.bias`,
          `${prefix}norm2.weight`, `${prefix}norm2.bias`,
          `${prefix}linear1.weight`, `${prefix}linear1.bias`,
          `${prefix}linear2.weight`, `${prefix}linear2.bias`,
        );
      }
      for (const name of names) {
        const source = this.policy.tensors[name];
        if (!source) throw new Error(`FQ1 tensor 누락: ${name}`);
        this.weights[name] = this.tf.tensor(source.data, source.shape, 'float32');
      }
    }

    dispose() {
      Object.values(this.weights).forEach(tensor => tensor.dispose());
      this.weights = Object.create(null);
    }

    linear(input, weightName, biasName) {
      const tf = this.tf;
      const inputWidth = input.shape[input.shape.length - 1];
      const prefixShape = input.shape.slice(0, -1);
      const flat = input.reshape([-1, inputWidth]);
      const output = tf.matMul(flat, this.weights[weightName], false, true).add(this.weights[biasName]);
      return output.reshape([...prefixShape, this.weights[biasName].shape[0]]);
    }

    layerNorm(input, weightName, biasName) {
      const mean = input.mean(-1, true);
      const centered = input.sub(mean);
      const variance = centered.square().mean(-1, true);
      return centered.div(variance.add(1e-5).sqrt())
        .mul(this.weights[weightName])
        .add(this.weights[biasName]);
    }

    erfApprox(input) {
      const tf = this.tf;
      const sign = tf.sign(input);
      const a = input.abs();
      const t = tf.scalar(1).div(a.mul(0.3275911).add(1));
      let p = t.mul(1.061405429).sub(1.453152027);
      p = p.mul(t).add(1.421413741);
      p = p.mul(t).sub(0.284496736);
      p = p.mul(t).add(0.254829592);
      const y = tf.scalar(1).sub(p.mul(t).mul(a.square().neg().exp()));
      return sign.mul(y);
    }

    gelu(input) {
      const erf = this.erfApprox(input.div(Math.SQRT2));
      return input.mul(0.5).mul(erf.add(1));
    }

    transformerLayer(input, tokenMask, layer) {
      const tf = this.tf;
      const d = this.width;
      const prefix = `interaction.layers.${layer}.`;
      const norm1 = this.layerNorm(input, `${prefix}norm1.weight`, `${prefix}norm1.bias`);
      const projected = this.linear(norm1, `${prefix}self_attn.in_proj_weight`, `${prefix}self_attn.in_proj_bias`);
      const [q0, k0, v0] = tf.split(projected, 3, -1);
      const batch = input.shape[0];
      const q = q0.reshape([batch, 7, this.heads, this.headWidth]).transpose([0, 2, 1, 3]);
      const k = k0.reshape([batch, 7, this.heads, this.headWidth]).transpose([0, 2, 1, 3]);
      const v = v0.reshape([batch, 7, this.heads, this.headWidth]).transpose([0, 2, 1, 3]);
      let scores = tf.matMul(q, k, false, true).mul(1 / Math.sqrt(this.headWidth));
      const keyMask = tokenMask.reshape([batch, 1, 1, 7]);
      scores = scores.add(tf.scalar(1).sub(keyMask).mul(-1e9));
      const attended = tf.matMul(tf.softmax(scores, -1), v)
        .transpose([0, 2, 1, 3])
        .reshape([batch, 7, d]);
      const attentionOutput = this.linear(attended, `${prefix}self_attn.out_proj.weight`, `${prefix}self_attn.out_proj.bias`);
      let output = input.add(attentionOutput);
      const norm2 = this.layerNorm(output, `${prefix}norm2.weight`, `${prefix}norm2.bias`);
      let feedForward = this.linear(norm2, `${prefix}linear1.weight`, `${prefix}linear1.bias`);
      feedForward = this.gelu(feedForward);
      feedForward = this.linear(feedForward, `${prefix}linear2.weight`, `${prefix}linear2.bias`);
      output = output.add(feedForward);
      return output;
    }

    forward(state, actionFeatures, legal) {
      const tf = this.tf;
      const batch = state.shape[0];
      let global = this.linear(state, 'global_encoder.0.weight', 'global_encoder.0.bias');
      global = this.gelu(global);
      global = this.layerNorm(global, 'global_encoder.2.weight', 'global_encoder.2.bias');

      let actions = this.linear(actionFeatures, 'action_encoder.0.weight', 'action_encoder.0.bias');
      actions = this.gelu(actions);
      actions = this.layerNorm(actions, 'action_encoder.2.weight', 'action_encoder.2.bias');

      let tokens = tf.concat([global.expandDims(1), actions], 1);
      const tokenMask = tf.concat([tf.ones([batch, 1]), legal], 1);
      for (let layer = 0; layer < 4; layer++) {
        tokens = this.transformerLayer(tokens, tokenMask, layer);
      }
      tokens = this.layerNorm(tokens, 'final_norm.weight', 'final_norm.bias');

      const globalToken = tokens.slice([0, 0, 0], [batch, 1, this.width]).squeeze([1]);
      let baseline = this.linear(globalToken, 'baseline.0.weight', 'baseline.0.bias');
      baseline = this.gelu(baseline);
      baseline = this.linear(baseline, 'baseline.2.weight', 'baseline.2.bias');
      const normalization = this.policy.header.normalization;
      baseline = baseline.mul(normalization.baseline_std).add(normalization.baseline_mean);

      const actionTokens = tokens.slice([0, 1, 0], [batch, 6, this.width]);
      const repeatedGlobal = globalToken.expandDims(1).tile([1, 6, 1]);
      let advantage = this.linear(
        tf.concat([actionTokens, repeatedGlobal], -1),
        'advantage.0.weight',
        'advantage.0.bias',
      );
      advantage = this.gelu(advantage);
      advantage = this.linear(advantage, 'advantage.2.weight', 'advantage.2.bias').squeeze([-1]);
      advantage = advantage.mul(normalization.advantage_std);
      const legalCount = legal.sum(1, true);
      const advantageMean = advantage.mul(legal).sum(1, true).div(legalCount);
      const q = baseline.add(advantage).sub(advantageMean);
      return q.add(tf.scalar(1).sub(legal).mul(-1e9));
    }

    buildBatch(states) {
      const stateData = new Float32Array(states.length * 42);
      const actionData = new Float32Array(states.length * 6 * 51);
      const legalData = new Float32Array(states.length * 6);
      for (let index = 0; index < states.length; index++) {
        const raw = states[index];
        const legal = [true, ...raw.slice(7, 12).map(card => card !== 0)];
        const features = this.policy.buildFeatures(raw, legal);
        stateData.set(features.state, index * 42);
        actionData.set(features.actions, index * 6 * 51);
        for (let action = 0; action < 6; action++) {
          legalData[index * 6 + action] = legal[action] ? 1 : 0;
        }
      }
      return { stateData, actionData, legalData };
    }

    async predictActions(states) {
      if (states.length === 0) return new Int32Array(0);
      const output = new Int32Array(states.length);
      for (let start = 0; start < states.length; start += this.batchSize) {
        const end = Math.min(states.length, start + this.batchSize);
        const batchStates = states.slice(start, end);
        const data = this.buildBatch(batchStates);
        const actionTensor = this.tf.tidy(() => {
          const stateTensor = this.tf.tensor2d(data.stateData, [batchStates.length, 42]);
          const actionTensorInput = this.tf.tensor3d(data.actionData, [batchStates.length, 6, 51]);
          const legalTensor = this.tf.tensor2d(data.legalData, [batchStates.length, 6]);
          return this.forward(stateTensor, actionTensorInput, legalTensor).argMax(1);
        });
        const actions = await actionTensor.data();
        actionTensor.dispose();
        output.set(actions, start);
        await yieldToUi();
      }
      return output;
    }
  }

  async function ensureRuntime(engine) {
    if (runtime.loading && runtime.engine === engine) return runtime.loading;
    if (runtime.engine === engine && runtime.model && runtime.policy) return runtime;

    runtime.engine = engine;
    runtime.loading = (async () => {
      const policy = await ensureFq1Policy();
      if (runtime.model) {
        runtime.model.dispose();
        runtime.model = null;
      }
      await ensureTensorFlow(engine);
      runtime.model = new FQ1TensorModel(policy, engine);
      await verifyRuntimeParity();
      return runtime;
    })();

    try {
      return await runtime.loading;
    } catch (error) {
      runtime.engine = null;
      if (runtime.model) {
        runtime.model.dispose();
        runtime.model = null;
      }
      throw error;
    } finally {
      runtime.loading = null;
    }
  }

  function createParityState(score, diceUse, isDouble, cards, acquiredIds = []) {
    const safeScore = Math.max(1, Math.min(2898, score));
    const raw = new Array(42).fill(0);
    raw[0] = 0;
    raw[1] = 1;
    raw[2] = safeScore;
    raw[3] = Number(stage[safeScore - 1]?.[1] || 0);
    raw[4] = Number(stage[safeScore - 1]?.[2] || 0);
    raw[5] = diceUse;
    raw[6] = isDouble ? 1 : 0;
    cards.slice(0, 5).forEach((card, index) => { raw[7 + index] = card; });
    acquiredIds.forEach(card => {
      if (card >= 1 && card <= 30) raw[11 + card] = 1;
    });
    return raw;
  }

  async function verifyRuntimeParity() {
    const states = [
      createParityState(1, 0, false, []),
      createParityState(487, 32, false, [1, 8, 16, 24], [1, 8, 16]),
      createParityState(1987, 88, true, [3, 11, 19, 27, 30], [3, 11, 19, 27]),
    ];
    const expected = states.map(state => runtime.policy.chooseAction(state));
    const actual = Array.from(await runtime.model.predictActions(states));
    const mismatch = actual.findIndex((action, index) => action !== expected[index]);
    if (mismatch >= 0) {
      console.warn('FQ1 TensorFlow.js parity warning.', {
        state: states[mismatch],
        expected: expected[mismatch],
        actual: actual[mismatch],
        backend: window.tf.getBackend(),
      });
    }
  }

  function yieldToUi(delay = 0) {
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  function nextRandom(lanes, lane) {
    let t = (lanes.rng[lane] + 0x6d2b79f5) >>> 0;
    lanes.rng[lane] = t;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= (r + Math.imul(r ^ (r >>> 7), 61 | r)) >>> 0;
    return (r ^ (r >>> 14)) >>> 0;
  }

  function mixSeed(seed) {
    let value = seed >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    value ^= value >>> 16;
    return value >>> 0;
  }

  function popcount30(value) {
    value &= FULL_DECK_MASK;
    value -= (value >>> 1) & 0x55555555;
    value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
    return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  }

  class FQ1RolloutEngine {
    constructor(model) {
      this.model = model;
      this.stageId = Int32Array.from(stage, row => Number(row[1]) || 0);
      this.stageSpace = Int32Array.from(stage, row => Number(row[2]) || 0);
      this.stageMove = Int32Array.from(stage, row => Number(row[4]) || 0);
      this.stageEvent = Int32Array.from(stage, row => Number(row[5]) || 0);
      this.cardType = new Int32Array(31);
      this.cardValue = new Int32Array(31);
      for (const card of cardInfo) {
        const id = Number(card[0]) || 0;
        if (id >= 1 && id <= 30) {
          this.cardType[id] = Number(card[1]) || 0;
          this.cardValue[id] = Number(card[2]) || 0;
        }
      }
    }

    createLanes(rawState, count, seed) {
      const lanes = {
        count,
        score: new Int32Array(count),
        diceUse: new Int32Array(count),
        isDouble: new Uint8Array(count),
        hand: new Int32Array(count * 5),
        handCount: new Uint8Array(count),
        acquired: new Uint32Array(count),
        rng: new Uint32Array(count),
        done: new Uint8Array(count),
      };
      let rootMask = 0;
      for (let card = 1; card <= 30; card++) {
        if (rawState[11 + card]) rootMask |= (1 << (card - 1));
      }
      const rootCards = rawState.slice(7, 12).map(Number).filter(Boolean);
      for (let lane = 0; lane < count; lane++) {
        lanes.score[lane] = Math.max(1, Math.min(2898, Number(rawState[2]) || 1));
        lanes.diceUse[lane] = Number(rawState[5]) || 0;
        lanes.isDouble[lane] = rawState[6] ? 1 : 0;
        lanes.handCount[lane] = rootCards.length;
        for (let slot = 0; slot < rootCards.length; slot++) lanes.hand[lane * 5 + slot] = rootCards[slot];
        lanes.acquired[lane] = rootMask >>> 0;
        lanes.rng[lane] = mixSeed((seed + Math.imul(lane + 1, 0x9e3779b9)) >>> 0);
      }
      return lanes;
    }

    rollDice(lanes, lane) {
      const value1 = (nextRandom(lanes, lane) % 6) + 1;
      const value2 = (nextRandom(lanes, lane) % 6) + 1;
      if (lanes.isDouble[lane]) {
        lanes.isDouble[lane] = 0;
      } else {
        lanes.isDouble[lane] = value1 === value2 ? 1 : 0;
        lanes.diceUse[lane]++;
      }
      return value1 + value2;
    }

    drawCard(lanes, lane) {
      const handCount = lanes.handCount[lane];
      if (handCount >= 5) return;
      let acquired = lanes.acquired[lane] & FULL_DECK_MASK;
      let remaining = 30 - popcount30(acquired);
      if (remaining === 0) {
        acquired = 0;
        remaining = 30;
      }
      const pickedOffset = nextRandom(lanes, lane) % remaining;
      let seen = 0;
      let picked = 0;
      for (let card = 0; card < 30; card++) {
        if ((acquired & (1 << card)) !== 0) continue;
        if (seen === pickedOffset) {
          picked = card;
          break;
        }
        seen++;
      }
      acquired = (acquired | (1 << picked)) >>> 0;
      lanes.hand[lane * 5 + handCount] = picked + 1;
      lanes.handCount[lane] = handCount + 1;
      lanes.acquired[lane] = remaining === 1 ? 0 : acquired;
    }

    updateScore(lanes, lane, rawValue, stop) {
      let value = rawValue;
      const currentScore = lanes.score[lane];
      if (stop) {
        const endIndex = Math.min(2897, currentScore + value - 1);
        for (let index = currentScore; index < endIndex; index++) {
          const eventType = this.stageEvent[index] || 0;
          if (eventType === 6 || eventType === 9) {
            value = index - currentScore + 1;
            break;
          }
        }
      }
      lanes.score[lane] = Math.max(1, Math.min(2898, currentScore + value));
      for (let guard = 0; guard < 16; guard++) {
        const score = lanes.score[lane];
        const eventType = this.stageEvent[score - 1] || 0;
        if (eventType === 2) {
          this.drawCard(lanes, lane);
          break;
        }
        if (eventType === 4) {
          lanes.score[lane] = Math.max(1, Math.min(2898, score + (this.stageMove[score - 1] || 0)));
          continue;
        }
        break;
      }
    }

    stageCardMove(score, cardValue) {
      const targetStage = (this.stageId[score - 1] || 0) + cardValue;
      let value = targetStage;
      for (let index = score; index < 2897; index++) {
        if ((this.stageId[index] || 0) === targetStage) {
          value = index - score + 1;
          break;
        }
      }
      return value;
    }

    removeHand(lanes, lane, slot) {
      const base = lane * 5;
      const cardId = lanes.hand[base + slot];
      for (let index = slot; index < 4; index++) lanes.hand[base + index] = lanes.hand[base + index + 1];
      lanes.hand[base + 4] = 0;
      lanes.handCount[lane] = Math.max(0, lanes.handCount[lane] - 1);
      return cardId;
    }

    step(lanes, lane, action) {
      if (lanes.diceUse[lane] >= 100 && !lanes.isDouble[lane]) {
        lanes.done[lane] = 1;
        return true;
      }
      if (action === 0) {
        this.updateScore(lanes, lane, this.rollDice(lanes, lane), true);
      } else if (action <= lanes.handCount[lane]) {
        const cardId = this.removeHand(lanes, lane, action - 1);
        const type = this.cardType[cardId] || 0;
        const value = this.cardValue[cardId] || 0;
        if (type === 1) this.updateScore(lanes, lane, value, false);
        else if (type === 2) this.updateScore(lanes, lane, this.rollDice(lanes, lane) * value, false);
        else if (type === 3) this.updateScore(lanes, lane, this.stageCardMove(lanes.score[lane], value), false);
      }
      const done = lanes.diceUse[lane] >= 100 && !lanes.isDouble[lane];
      lanes.done[lane] = done ? 1 : 0;
      return done;
    }

    rawState(lanes, lane) {
      const raw = new Array(42).fill(0);
      const score = lanes.score[lane];
      raw[0] = 0;
      raw[1] = 1;
      raw[2] = score;
      raw[3] = this.stageId[score - 1] || 0;
      raw[4] = this.stageSpace[score - 1] || 0;
      raw[5] = lanes.diceUse[lane];
      raw[6] = lanes.isDouble[lane] ? 1 : 0;
      const base = lane * 5;
      for (let slot = 0; slot < 5; slot++) raw[7 + slot] = lanes.hand[base + slot];
      const mask = lanes.acquired[lane];
      for (let card = 0; card < 30; card++) raw[12 + card] = (mask >>> card) & 1;
      return raw;
    }

    async run(rawState, rootAction, rolloutCount, seed, options = {}) {
      const isCancelled = typeof options.isCancelled === 'function' ? options.isCancelled : () => false;
      const lanes = this.createLanes(rawState, rolloutCount, (seed ^ Math.imul(rootAction + 1, 0x85ebca6b)) >>> 0);
      for (let lane = 0; lane < rolloutCount; lane++) this.step(lanes, lane, rootAction);

      for (let step = 0; step < MAX_CONTINUATION_STEPS; step++) {
        if (isCancelled()) throw new Error('FQ1 계산이 취소되었습니다.');
        const activeLanes = [];
        const states = [];
        for (let lane = 0; lane < rolloutCount; lane++) {
          if (lanes.done[lane]) continue;
          activeLanes.push(lane);
          states.push(this.rawState(lanes, lane));
        }
        if (activeLanes.length === 0) break;
        const actions = await this.model.predictActions(states);
        for (let index = 0; index < activeLanes.length; index++) {
          this.step(lanes, activeLanes[index], actions[index]);
        }
        if (typeof options.onStep === 'function') options.onStep(step + 1, activeLanes.length, rolloutCount);
      }

      return Int32Array.from(lanes.score);
    }
  }

  function randomSeed() {
    if (typeof getGpuRandomSeed === 'function') return getGpuRandomSeed() >>> 0;
    if (window.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      window.crypto.getRandomValues(value);
      return value[0] >>> 0;
    }
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }

  function addScoresToStats(stats, scores) {
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

  function initializeExDisplay(actions) {
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

  async function calcExFq1(route = [0, 1, 2, 3, 4, 5]) {
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
      if (action === 0 || (env.cards[action - 1] !== undefined && route.includes(action))) displayActions.push(action);
    }
    initializeExDisplay(displayActions);
    if (displayActions.length === 0) {
      if (isCalcExRequestActive(calcRequestId)) updateBoard();
      return;
    }
    updateBoard();

    try {
      await ensureRuntime(computeSettings.engine === 'cpu' ? 'cpu' : 'gpu');
      if (!isCalcExRequestActive(calcRequestId)) return;
      const rolloutEngine = new FQ1RolloutEngine(runtime.model);
      const simulationState = env.getState();
      const initialIteration = Math.min(MAX_ROLLOUTS, getAdaptiveInitialIteration(MAX_ROLLOUTS));
      const batchIteration = Math.min(MAX_ROLLOUTS, getAdaptiveBatchIteration(MAX_ROLLOUTS));
      const maxIteration = MAX_ROLLOUTS;
      const actionStats = new Array(6).fill(0).map(() => createActionStats());
      let activeActions = displayActions.slice();
      const startedAt = performance.now();

      const isCurrent = () => isCalcExRequestActive(calcRequestId);
      const maxUsed = () => Math.max(0, ...actionStats.map(item => item.count));

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
        for (const action of actions) {
          if (!isCurrent()) return false;
          const remaining = maxIteration - actionStats[action].count;
          const count = Math.min(iteration, remaining);
          if (count <= 0) continue;
          const scores = await rolloutEngine.run(simulationState, action, count, randomSeed(), {
            isCancelled: () => !isCurrent(),
          });
          if (!isCurrent()) return false;
          addScoresToStats(actionStats[action], scores);
          const decision = getAdaptiveDecision(actionStats, activeActions);
          applyDecision(decision);
          updateBoard();
          await yieldToUi();
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
          console.log(`FQ1-U8K ${runtime.engine.toUpperCase()} adaptive used ${maxUsed()}/${MAX_ROLLOUTS}, elapsed=${(performance.now() - startedAt).toFixed(1)}ms`);
          return;
        }
        if (!isAdaptiveEarlyStopDisabled()) activeActions = pruneAdaptiveActions(actionStats, activeActions);
        decision = getAdaptiveDecision(actionStats, activeActions);
        applyDecision(decision);
        updateBoard();
        if (!isAdaptiveEarlyStopDisabled() && activeActions.length <= 1) return;
        const nextActions = getAdaptiveNextActions(actionStats, activeActions, maxIteration);
        if (nextActions.length === 0) return;
        if (!await sampleActions(nextActions, batchIteration)) return;
      }
    } catch (error) {
      if (!isCalcExRequestActive(calcRequestId)) return;
      console.error('FQ1-U8K calculation failed.', error);
      displayActions.forEach(action => {
        env.exScores[action] = 'FQ1 Error';
        env.exValues.status[action] = '오류';
      });
      env.exAction = undefined;
      env.exScore = Infinity;
      updateBoard();
    }
  }

  function createEngineOption(name, value, detail, available, selected) {
    return `
      <label data-fq1-engine-card="${value}" style="display:block;border:1px solid ${selected ? '#2563eb' : '#cbd5e1'};border-radius:10px;padding:14px;cursor:${available ? 'pointer' : 'not-allowed'};background:${selected ? '#eff6ff' : '#f8fafc'};opacity:${available ? '1' : '.58'};">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">
          <span style="display:flex;align-items:center;gap:8px;">
            <input type="radio" name="fq1-engine" value="${value}" ${selected ? 'checked' : ''} ${available ? '' : 'disabled'}>
            <strong style="font-size:15px;">${name}</strong>
          </span>
          ${value === 'gpu' && available ? '<span style="border-radius:999px;background:#16a34a;color:white;font-size:11px;font-weight:800;padding:3px 8px;">권장</span>' : ''}
          ${!available ? '<span style="border-radius:999px;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:800;padding:3px 8px;">사용 불가</span>' : ''}
        </div>
        <div style="font-size:12px;line-height:1.55;color:#475569;">${detail}</div>
      </label>`;
  }

  function showFq1ComputeModeModal(onDone) {
    hideLoadingOverlay();
    document.getElementById('adventure-compute-modal')?.remove();
    const gpuAvailable = Boolean(navigator.gpu);
    let selected = computeSettings.engine === 'cpu' ? 'cpu' : (gpuAvailable ? 'gpu' : 'cpu');

    const root = document.createElement('div');
    root.id = 'adventure-compute-modal';
    root.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.68);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:16px;box-sizing:border-box;';
    root.innerHTML = `
      <div data-compute-card="true" style="width:min(540px,100%);max-height:calc(100dvh - 32px);overflow:auto;border-radius:12px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.38);border:1px solid rgba(15,23,42,.12);padding:22px;box-sizing:border-box;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <h2 style="margin:0;font-size:21px;color:#0f172a;">FQ1-U8K 테스트 모델</h2>
              <span style="border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:900;padding:3px 8px;">실험용</span>
            </div>
            <p style="margin:8px 0 0;color:#475569;font-size:13px;line-height:1.6;">기존 adaptive root의 후보 제거·신뢰구간 조기종료 로직은 유지하고, rollout continuation 정책만 FQ1으로 교체합니다.</p>
          </div>
        </div>
        <div style="margin:14px 0;padding:11px 12px;border-radius:9px;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;font-size:12px;line-height:1.6;">
          <strong>고정 설정</strong> · 행동별 최대 rollout 8,192 · continuation horizon 512 · Fast/Quality 및 부하 단계 선택 없음
        </div>
        <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:8px;">계산 엔진</div>
        <div id="fq1-engine-options" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
          ${createEngineOption('GPU', 'gpu', 'WebGPU에서 FQ1 배치 추론을 수행합니다. 환경 transition은 브라우저에서 진행합니다.', gpuAvailable, selected === 'gpu')}
          ${createEngineOption('CPU', 'cpu', 'WebAssembly CPU 백엔드로 동일한 FQ1 모델을 실행합니다. GPU보다 상당히 느릴 수 있습니다.', true, selected === 'cpu')}
        </div>
        <div id="fq1-load-status" style="min-height:20px;margin-top:13px;color:#64748b;font-size:12px;line-height:1.5;"></div>
        <button id="fq1-start-button" type="button" style="width:100%;margin-top:4px;border:0;border-radius:9px;background:#2563eb;color:#fff;font-size:14px;font-weight:850;padding:12px 14px;cursor:pointer;">FQ1 테스트 시작</button>
        <div style="margin-top:10px;color:#94a3b8;font-size:11px;line-height:1.45;text-align:center;">이 모드는 모델 비교·검증용이며 일반 URL의 운영 정책에는 영향을 주지 않습니다.</div>
      </div>`;
    document.body.appendChild(root);

    const cards = Array.from(root.querySelectorAll('[data-fq1-engine-card]'));
    function refreshSelection() {
      cards.forEach(card => {
        const active = card.dataset.fq1EngineCard === selected;
        card.style.borderColor = active ? '#2563eb' : '#cbd5e1';
        card.style.background = active ? '#eff6ff' : '#f8fafc';
        const radio = card.querySelector('input');
        if (radio && !radio.disabled) radio.checked = active;
      });
    }
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const radio = card.querySelector('input');
        if (!radio || radio.disabled) return;
        selected = card.dataset.fq1EngineCard;
        refreshSelection();
      });
    });

    const button = root.querySelector('#fq1-start-button');
    const status = root.querySelector('#fq1-load-status');
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.style.opacity = '.65';
      button.style.cursor = 'wait';
      status.style.color = '#2563eb';
      status.textContent = `${selected === 'gpu' ? 'WebGPU' : 'WASM CPU'} 엔진과 FQ1 가중치를 불러오는 중입니다...`;
      try {
        await ensureRuntime(selected);
        computeSettings.engine = selected;
        computeSettings.cpuPolicy = 'fq1';
        computeSettings.cpuIteration = MAX_ROLLOUTS;
        computeSettings.cpuMaxPct = 100;
        computeSettings.gpuIteration = MAX_ROLLOUTS;
        computeSettings.gpuMaxPct = 100;
        computeSettings.gpuBatchPct = 100;
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

  prepareGpuReadbackModeOnLoad = async function prepareFq1ModeOnLoad() {
    gpuDisabledReason = navigator.gpu ? '' : 'WebGPU is unavailable for FQ1 mode.';
  };
  isGpuAvailable = function isFq1GpuAvailable() {
    return Boolean(navigator.gpu);
  };
  showComputeModeModal = showFq1ComputeModeModal;
  calcEx = calcExFq1;

  computeSettings.cpuPolicy = 'fq1';
  computeSettings.cpuIteration = MAX_ROLLOUTS;
  computeSettings.cpuMaxPct = 100;
  computeSettings.gpuIteration = MAX_ROLLOUTS;
  computeSettings.gpuMaxPct = 100;
  computeSettings.gpuBatchPct = 100;

  document.title = 'Adventure · FQ1-U8K Test';
})();
