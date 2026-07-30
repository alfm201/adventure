/*
 * Standalone CPU inference for FQPI-T16-P1 (FQ1).
 *
 * Browser:
 *   const fq1 = await FQ1Policy.load('./fq1_weights.bin');
 *   const action = fq1.chooseAction(board);
 *
 * Node:
 *   const { FQ1Policy } = require('./fq1.js');
 *   const fq1 = await FQ1Policy.load('./fq1_weights.bin');
 *   const action = fq1.predict(rawState).action;
 *
 * This test-only runtime has no ML-library dependency. It intentionally does
 * not modify Board.prototype or the operational policy.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FQ1Policy = api.FQ1Policy;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAGIC = 'FQ1JS01';
  const SQRT2 = Math.sqrt(2);
  const EVENT_VALUES = [0, 1, 2, 3, 4, 5, 6, 9];
  const DICE_WEIGHTS = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];

  function asArrayBuffer(value) {
    if (value instanceof ArrayBuffer) return value;
    if (ArrayBuffer.isView(value)) {
      return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    }
    throw new TypeError('FQ1 weights must be an ArrayBuffer or typed array');
  }

  async function readWeights(source) {
    if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
      return asArrayBuffer(source);
    }
    if (typeof source !== 'string' && !(source instanceof URL)) {
      throw new TypeError('FQ1Policy.load expects a URL, path, or ArrayBuffer');
    }
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const fs = require('fs');
      const data = await fs.promises.readFile(source instanceof URL ? source : String(source));
      return asArrayBuffer(data);
    }
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Unable to load FQ1 weights: HTTP ${response.status}`);
    return response.arrayBuffer();
  }

  function parseCheckpoint(buffer) {
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder();
    if (decoder.decode(bytes.subarray(0, 7)) !== MAGIC || bytes[7] !== 0) {
      throw new Error('Invalid FQ1 checkpoint magic');
    }
    const view = new DataView(buffer);
    const headerLength = view.getUint32(8, true);
    const header = JSON.parse(decoder.decode(bytes.subarray(12, 12 + headerLength)).trim());
    if (header.format !== 'fq1-js-fp32-v1') throw new Error(`Unsupported FQ1 format: ${header.format}`);
    const dataOffset = 12 + headerLength;
    const tensors = Object.create(null);
    for (const item of header.tensors) {
      const start = dataOffset + item.offset;
      const length = item.bytes >>> 2;
      const data = item.dtype === 'f32'
        ? new Float32Array(buffer, start, length)
        : new Int32Array(buffer, start, length);
      tensors[item.name] = { data, shape: item.shape };
    }
    return { header, tensors };
  }

  function erf(x) {
    const sign = x < 0 ? -1 : 1;
    const a = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * a);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
      - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
    return sign * y;
  }

  function geluInPlace(values) {
    for (let i = 0; i < values.length; i++) {
      const x = values[i];
      values[i] = Math.fround(0.5 * x * (1 + erf(x / SQRT2)));
    }
    return values;
  }

  function linear(input, rows, inputWidth, weight, bias, outputWidth) {
    const output = new Float32Array(rows * outputWidth);
    for (let row = 0; row < rows; row++) {
      const inputBase = row * inputWidth;
      const outputBase = row * outputWidth;
      for (let out = 0; out < outputWidth; out++) {
        let sum = bias[out];
        let wi = out * inputWidth;
        let i = 0;
        for (; i + 3 < inputWidth; i += 4) {
          sum += input[inputBase + i] * weight[wi + i]
            + input[inputBase + i + 1] * weight[wi + i + 1]
            + input[inputBase + i + 2] * weight[wi + i + 2]
            + input[inputBase + i + 3] * weight[wi + i + 3];
        }
        for (; i < inputWidth; i++) sum += input[inputBase + i] * weight[wi + i];
        output[outputBase + out] = Math.fround(sum);
      }
    }
    return output;
  }

  function layerNorm(input, rows, width, weight, bias) {
    const output = new Float32Array(input.length);
    for (let row = 0; row < rows; row++) {
      const base = row * width;
      let mean = 0;
      for (let i = 0; i < width; i++) mean += input[base + i];
      mean /= width;
      let variance = 0;
      for (let i = 0; i < width; i++) {
        const delta = input[base + i] - mean;
        variance += delta * delta;
      }
      const inverse = 1 / Math.sqrt(variance / width + 1e-5);
      for (let i = 0; i < width; i++) {
        output[base + i] = Math.fround((input[base + i] - mean) * inverse * weight[i] + bias[i]);
      }
    }
    return output;
  }

  function add(left, right) {
    const output = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) output[i] = Math.fround(left[i] + right[i]);
    return output;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  class FQ1Policy {
    static async load(source = './fq1_weights.bin') {
      return new FQ1Policy(parseCheckpoint(await readWeights(source)));
    }

    constructor(checkpoint) {
      this.header = checkpoint.header;
      this.tensors = checkpoint.tensors;
      this.width = this.header.config.action_width;
      this.heads = this.header.config.heads;
      this.headWidth = this.width / this.heads;
      if (this.width !== 576 || this.heads !== 8 || this.header.config.layers !== 4) {
        throw new Error('This runtime only supports the audited FQ1 T16 architecture');
      }
    }

    tensor(name) {
      const tensor = this.tensors[name];
      if (!tensor) throw new Error(`Missing FQ1 tensor: ${name}`);
      return tensor.data;
    }

    chooseAction(boardOrState, legalMask) {
      return this.predict(boardOrState, legalMask).action;
    }

    predict(boardOrState, legalMask) {
      let raw;
      if (boardOrState && typeof boardOrState.getState === 'function') {
        raw = Array.from(boardOrState.getState(), Number);
        // Training/evaluation states use canonical policy-mode flags.
        raw[0] = 0;
        raw[1] = 1;
      } else {
        raw = Array.from(boardOrState, Number);
      }
      if (raw.length !== 42) throw new Error(`FQ1 expects a 42-value state, got ${raw.length}`);
      const legal = legalMask
        ? Array.from(legalMask, Boolean)
        : [true, ...raw.slice(7, 12).map(card => card !== 0)];
      if (legal.length !== 6 || !legal[0]) throw new Error('FQ1 expects a six-action legal mask with roll legal');

      const features = this.buildFeatures(raw, legal);
      const qValues = this.forward(features.state, features.actions, legal);
      let action = 0;
      for (let i = 1; i < 6; i++) {
        if (legal[i] && qValues[i] > qValues[action]) action = i;
      }
      const expectedFinalScores = qValues.map(value => Number.isFinite(value) ? raw[2] + value : -Infinity);
      return {
        action,
        recommendedAction: action,
        qValues,
        expectedFinalScores,
        legalMask: legal,
        modelId: this.header.model_id,
        scoreSource: 'FQ1-Q^X36',
      };
    }

    forward(state, actionFeatures, legal) {
      const d = this.width;
      const globalWeight = this.tensor('global_encoder.0.weight');
      const globalBias = this.tensor('global_encoder.0.bias');
      let global = linear(state, 1, 42, globalWeight, globalBias, d);
      geluInPlace(global);
      global = layerNorm(
        global, 1, d,
        this.tensor('global_encoder.2.weight'),
        this.tensor('global_encoder.2.bias'),
      );

      let actions = linear(
        actionFeatures, 6, 51,
        this.tensor('action_encoder.0.weight'),
        this.tensor('action_encoder.0.bias'),
        d,
      );
      geluInPlace(actions);
      actions = layerNorm(
        actions, 6, d,
        this.tensor('action_encoder.2.weight'),
        this.tensor('action_encoder.2.bias'),
      );

      let tokens = new Float32Array(7 * d);
      tokens.set(global, 0);
      tokens.set(actions, d);
      const tokenMask = [true, ...legal];
      for (let layer = 0; layer < 4; layer++) {
        tokens = this.transformerLayer(tokens, tokenMask, layer);
      }
      tokens = layerNorm(
        tokens, 7, d,
        this.tensor('final_norm.weight'),
        this.tensor('final_norm.bias'),
      );

      const globalToken = tokens.subarray(0, d);
      let baselineHidden = linear(
        globalToken, 1, d,
        this.tensor('baseline.0.weight'),
        this.tensor('baseline.0.bias'),
        d,
      );
      geluInPlace(baselineHidden);
      const baselineNormalized = linear(
        baselineHidden, 1, d,
        this.tensor('baseline.2.weight'),
        this.tensor('baseline.2.bias'),
        1,
      )[0];

      const advantageInput = new Float32Array(6 * d * 2);
      for (let action = 0; action < 6; action++) {
        const base = action * d * 2;
        advantageInput.set(tokens.subarray((action + 1) * d, (action + 2) * d), base);
        advantageInput.set(globalToken, base + d);
      }
      let advantageHidden = linear(
        advantageInput, 6, d * 2,
        this.tensor('advantage.0.weight'),
        this.tensor('advantage.0.bias'),
        d,
      );
      geluInPlace(advantageHidden);
      const advantageNormalized = linear(
        advantageHidden, 6, d,
        this.tensor('advantage.2.weight'),
        this.tensor('advantage.2.bias'),
        1,
      );

      const normalization = this.header.normalization;
      const advantage = new Float64Array(6);
      let advantageSum = 0;
      let legalCount = 0;
      for (let action = 0; action < 6; action++) {
        if (!legal[action]) continue;
        advantage[action] = advantageNormalized[action] * normalization.advantage_std;
        advantageSum += advantage[action];
        legalCount++;
      }
      const advantageMean = advantageSum / legalCount;
      const baseline = baselineNormalized * normalization.baseline_std + normalization.baseline_mean;
      const q = new Array(6);
      for (let action = 0; action < 6; action++) {
        q[action] = legal[action] ? baseline + advantage[action] - advantageMean : -Infinity;
      }
      return q;
    }

    transformerLayer(input, tokenMask, layer) {
      const d = this.width;
      const prefix = `interaction.layers.${layer}.`;
      const norm1 = layerNorm(
        input, 7, d,
        this.tensor(`${prefix}norm1.weight`),
        this.tensor(`${prefix}norm1.bias`),
      );
      const projected = linear(
        norm1, 7, d,
        this.tensor(`${prefix}self_attn.in_proj_weight`),
        this.tensor(`${prefix}self_attn.in_proj_bias`),
        d * 3,
      );
      const attended = new Float32Array(7 * d);
      const scale = 1 / Math.sqrt(this.headWidth);
      const scores = new Float64Array(7);
      for (let query = 0; query < 7; query++) {
        const qBase = query * d * 3;
        for (let head = 0; head < this.heads; head++) {
          const headOffset = head * this.headWidth;
          let maximum = -Infinity;
          for (let key = 0; key < 7; key++) {
            if (!tokenMask[key]) {
              scores[key] = -Infinity;
              continue;
            }
            const kBase = key * d * 3 + d + headOffset;
            let score = 0;
            for (let i = 0; i < this.headWidth; i++) {
              score += projected[qBase + headOffset + i] * projected[kBase + i];
            }
            score *= scale;
            scores[key] = score;
            if (score > maximum) maximum = score;
          }
          let denominator = 0;
          for (let key = 0; key < 7; key++) {
            if (!tokenMask[key]) continue;
            scores[key] = Math.exp(scores[key] - maximum);
            denominator += scores[key];
          }
          const outputBase = query * d + headOffset;
          for (let i = 0; i < this.headWidth; i++) {
            let value = 0;
            for (let key = 0; key < 7; key++) {
              if (!tokenMask[key]) continue;
              const vBase = key * d * 3 + d * 2 + headOffset;
              value += (scores[key] / denominator) * projected[vBase + i];
            }
            attended[outputBase + i] = Math.fround(value);
          }
        }
      }
      const attentionOutput = linear(
        attended, 7, d,
        this.tensor(`${prefix}self_attn.out_proj.weight`),
        this.tensor(`${prefix}self_attn.out_proj.bias`),
        d,
      );
      let output = add(input, attentionOutput);
      const norm2 = layerNorm(
        output, 7, d,
        this.tensor(`${prefix}norm2.weight`),
        this.tensor(`${prefix}norm2.bias`),
      );
      let feedForward = linear(
        norm2, 7, d,
        this.tensor(`${prefix}linear1.weight`),
        this.tensor(`${prefix}linear1.bias`),
        d * 4,
      );
      geluInPlace(feedForward);
      feedForward = linear(
        feedForward, 7, d * 4,
        this.tensor(`${prefix}linear2.weight`),
        this.tensor(`${prefix}linear2.bias`),
        d,
      );
      return add(output, feedForward);
    }

    buildFeatures(raw, legal) {
      const score = clamp(Math.trunc(raw[2]), 1, this.header.feature.board_size);
      const hand = raw.slice(7, 12).map(value => clamp(Math.trunc(value), 0, 30));
      const quality = this.x36Quality(raw, legal, score, hand);
      let x36Action = 0;
      for (let action = 1; action < 6; action++) {
        if (legal[action] && quality[action] > quality[x36Action]) x36Action = action;
      }
      let qualityMean = 0;
      let legalCount = 0;
      for (let action = 0; action < 6; action++) {
        if (legal[action]) {
          qualityMean += quality[action];
          legalCount++;
        }
      }
      qualityMean /= legalCount;

      const mean = this.tensor('feature.normalization_mean');
      const std = this.tensor('feature.normalization_std');
      const state = new Float32Array(42);
      for (let i = 0; i < 42; i++) state[i] = Math.fround((raw[i] - mean[i]) / std[i]);

      const transition = this.exactActionFeatures(raw, score, hand, x36Action);
      const actions = new Float32Array(6 * 51);
      for (let action = 0; action < 6; action++) {
        actions.set(transition.subarray(action * 50, (action + 1) * 50), action * 51);
        actions[action * 51 + 50] = legal[action]
          ? Math.fround((quality[action] - qualityMean) / this.header.feature.x36_quality_scale)
          : 0;
      }
      return { state, actions };
    }

    exactActionFeatures(raw, score, hand, x36Action) {
      const event = this.tensor('feature.stage_event');
      const closureScore = this.tensor('feature.closure_score');
      const closureDraw = this.tensor('feature.closure_draw');
      const closureHops = this.tensor('feature.closure_hops');
      const stopDelta = this.tensor('feature.stop_delta');
      const stageDelta = this.tensor('feature.stage_delta');
      const cardTypes = this.tensor('feature.card_types');
      const cardValues = this.tensor('feature.card_values');
      const pairSums = this.tensor('feature.pair_sums');
      const pairDouble = this.tensor('feature.pair_double');
      const ids = [0, ...hand];
      const handCount = hand.filter(Boolean).length;
      const acquired = raw.slice(12, 42).map(Number);
      let availableCount = acquired.reduce((sum, value) => sum + (value ? 0 : 1), 0);
      const resetDeck = availableCount === 0;
      if (resetDeck) availableCount = 30;
      const drawType = [0, 0, 0];
      let drawValue = 0;
      for (let card = 1; card <= 30; card++) {
        if (!resetDeck && acquired[card - 1]) continue;
        const type = cardTypes[card];
        if (type >= 1 && type <= 3) drawType[type - 1] += 1 / availableCount;
        drawValue += cardValues[card] / availableCount;
      }
      const result = new Float32Array(6 * 50);
      for (let action = 0; action < 6; action++) {
        const id = ids[action];
        const type = cardTypes[id];
        const cardValue = cardValues[id];
        const stochastic = action === 0 || type === 2;
        const consumed = action > 0 ? 1 : 0;
        const postHand = handCount - consumed;
        const canDraw = postHand < 5 ? 1 : 0;
        const deltaValues = new Float64Array(36);
        const finalDelta = new Float64Array(36);
        const jumps = new Float64Array(36);
        const rawEvents = new Int32Array(36);
        const finalEvents = new Int32Array(36);
        let deltaSum = 0;
        let deltaMin = Infinity;
        let deltaMax = -Infinity;
        let finalDeltaSum = 0;
        let jumpSum = 0;
        let hopsSum = 0;
        let drawSum = 0;
        let postDoubleSum = 0;
        let terminalSum = 0;
        const diceIncrement = stochastic && !raw[6] ? 1 : 0;
        for (let pair = 0; pair < 36; pair++) {
          let delta;
          if (action === 0) delta = stopDelta[score * 13 + pairSums[pair]];
          else if (type === 2) delta = cardValue * pairSums[pair];
          else if (type === 1) delta = cardValue;
          else delta = stageDelta[score];
          const rawPosition = clamp(score + delta, 1, 2898);
          const finalPosition = closureScore[rawPosition];
          const postDouble = stochastic ? (raw[6] ? 0 : pairDouble[pair]) : (raw[6] ? 1 : 0);
          const terminal = raw[5] + diceIncrement >= 100 && !postDouble ? 1 : 0;
          deltaValues[pair] = delta;
          finalDelta[pair] = finalPosition - score;
          jumps[pair] = finalPosition - rawPosition;
          rawEvents[pair] = event[rawPosition];
          finalEvents[pair] = event[finalPosition];
          deltaSum += delta;
          deltaMin = Math.min(deltaMin, delta);
          deltaMax = Math.max(deltaMax, delta);
          finalDeltaSum += finalPosition - score;
          jumpSum += finalPosition - rawPosition;
          hopsSum += closureHops[rawPosition];
          drawSum += closureDraw[rawPosition];
          postDoubleSum += postDouble;
          terminalSum += terminal;
        }
        const drawProbability = drawSum / 36 * canDraw;
        const values = [
          deltaSum / 36 / 120,
          deltaMin / 120,
          deltaMax / 120,
          finalDeltaSum / 36 / 160,
          jumpSum / 36 / 100,
          hopsSum / 36 / 4,
          drawProbability,
          postDoubleSum / 36,
          diceIncrement,
          terminalSum / 36,
          consumed,
          action === x36Action ? 1 : 0,
          postHand / 5,
          postHand === 5 ? 1 : 0,
          type === 3 ? 0.2 : 0,
          type === 0 ? 1 : 0,
          type === 1 ? 1 : 0,
          type === 2 ? 1 : 0,
          type === 3 ? 1 : 0,
          cardValue / 12,
          id / 30,
        ];
        for (const wanted of EVENT_VALUES) {
          let count = 0;
          for (let pair = 0; pair < 36; pair++) if (rawEvents[pair] === wanted) count++;
          values.push(count / 36);
        }
        for (const wanted of EVENT_VALUES) {
          let count = 0;
          for (let pair = 0; pair < 36; pair++) if (finalEvents[pair] === wanted) count++;
          values.push(count / 36);
        }
        values.push(
          drawProbability * drawType[0],
          drawProbability * drawType[1],
          drawProbability * drawType[2],
          drawProbability * drawValue / 12,
          score / 2898,
          raw[5] / 100,
          raw[6] ? 1 : 0,
          handCount / 5,
          acquired.reduce((sum, value) => sum + value, 0) / 30,
          handCount === 5 ? 1 : 0,
          raw[5] >= 80 ? 1 : 0,
          raw[3] / 75,
          raw[4] / 50,
        );
        if (values.length !== 50) throw new Error(`Internal FQ1 feature width error: ${values.length}`);
        for (let i = 0; i < 50; i++) result[action * 50 + i] = Math.fround(values[i]);
      }
      return result;
    }

    x36Quality(raw, legal, score, hand) {
      const event = this.tensor('feature.stage_event');
      const move = this.tensor('feature.stage_move');
      const stageId = this.tensor('feature.stage_id');
      const closureScore = this.tensor('feature.closure_score');
      const stopDelta = this.tensor('feature.stop_delta');
      const cardTypes = this.tensor('feature.card_types');
      const cardValues = this.tensor('feature.card_values');
      const handCount = hand.filter(Boolean).length;
      const qualities = new Array(6).fill(-Infinity);
      let roll = 0;
      for (let dice = 2; dice <= 12; dice++) {
        const landing = clamp(score + stopDelta[score * 13 + dice], 1, 2898);
        let value = 0;
        if (event[landing] === 2 && handCount < 5) value += 179;
        else if (event[landing] === 4) {
          value += Math.max(0, move[landing]) * 2;
          if (handCount < 5 && event[closureScore[landing]] === 2) value += 299;
        }
        roll += DICE_WEIGHTS[dice] * value;
      }
      qualities[0] = roll;
      const post = ((handCount === 5 || raw[5] + handCount >= 100) ? 98 * 36 : 0)
        + (raw[5] >= 70 ? 3 * 36 : 0);
      const rawLanding = value => clamp(score + value, 1, 2898);
      const cardOption = (landing, closure) =>
        event[landing] === 2 || (event[landing] === 4 && event[closure] === 2);
      for (let slot = 0; slot < 5; slot++) {
        const id = hand[slot];
        if (!id || !legal[slot + 1]) continue;
        const type = cardTypes[id];
        const cardValue = cardValues[id];
        let value = -(2 ** 30);
        if (type === 1) {
          const landing = rawLanding(cardValue);
          value = -80 * 36;
          if (event[landing] === 2) value += 139 * 36;
          else if (event[landing] === 4) {
            value += Math.max(0, move[landing]) * 2 * 36;
            if (event[closureScore[landing]] === 2) value += 101 * 36;
          }
        } else if (type === 2) {
          value = -20 * 36;
          for (let dice = 2; dice <= 12; dice++) {
            const landing = rawLanding(dice * cardValue);
            let branch = 0;
            if (event[landing] === 2) branch += 142;
            else if (event[landing] === 4) {
              branch += Math.max(0, move[landing]) * 2;
              if (event[closureScore[landing]] === 2) branch += 141;
            }
            value += DICE_WEIGHTS[dice] * branch;
          }
        } else if (type === 3) {
          const targetStage = stageId[score] + cardValue;
          let delta = targetStage;
          for (let physical = score + 1; physical < 2898; physical++) {
            if (stageId[physical] === targetStage) {
              delta = physical - score;
              break;
            }
          }
          const landing = rawLanding(delta);
          let same = 0;
          const begin = Math.min(2897, score + 1);
          const end = Math.min(2897, score + 50);
          for (let position = begin; position < end; position++) {
            if (stageId[Math.min(2898, position + 1)] === stageId[score]) same++;
          }
          value = -2 * 36 + same * 36;
          if (event[landing] === 4) value += Math.max(0, move[landing]) * 2 * 36;
        }
        if (type === 1) {
          const landing = rawLanding(cardValue);
          const closure = closureScore[landing];
          let chain = event[landing] === 4 && cardOption(landing, closure);
          for (let other = 0; other < 5 && !chain; other++) {
            if (other === slot || cardTypes[hand[other]] !== 1) continue;
            const secondLanding = clamp(closure + cardValues[hand[other]], 1, 2898);
            const secondClosure = closureScore[secondLanding];
            chain = cardOption(secondLanding, secondClosure);
          }
          if (chain) value += 37 * 36;
        }
        qualities[slot + 1] = value + post;
      }
      return qualities;
    }
  }

  return { FQ1Policy };
});
