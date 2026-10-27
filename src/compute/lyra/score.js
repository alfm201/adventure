import { createPredictor } from '../../policies/lyra/predictor.mjs';
import { deadline } from '../../platform/requests.js';
import { ASSET_URL, MANIFEST, PACKAGE_SHA256 } from './model.js';
import { hashBytes } from './package.js';

export const SCORE_ID = 'lyra-v2-score-v1';
const SCORE_FORMAT = 'lyra-v1-score-v1'; // v2 retains the v1 serialized predictor schema.
export const SCORE_SHA256 = '1b0b203bd4b4438cde952763e0a9142b4e9029215b8794e25ed9041b3223b9fa';

export function matchedPredictor(model, rules) {
  if (MANIFEST.horizon !== 1 || MANIFEST.precision !== 'fp32'
      || model.format !== SCORE_FORMAT || model.usePhi !== false
      || model.sourceModelSha256 !== MANIFEST.sourceSha256
      || model.sourceOnnxSha256 !== MANIFEST.sha256
      || model.sourcePackageSha256 !== PACKAGE_SHA256
      || model.classOf.length !== rules.idmap.length
      || model.classOf.some((value, id) => value !== rules.idmap[id]))
    throw Error('LYRA score predictor/model mismatch');
  return createPredictor(model);
}

export async function loadScorePredictor(rules) {
  const request = deadline(undefined, 8000);
  try {
    const url = new URL(`predictor.json?sha256=${SCORE_SHA256}`, ASSET_URL);
    const response = await fetch(url, { signal: request.signal, cache: 'force-cache' });
    if (!response.ok) throw Error(`LYRA score predictor unavailable (${response.status})`);
    const bytes = await response.arrayBuffer();
    if (await hashBytes(bytes) !== SCORE_SHA256) throw Error('LYRA score predictor integrity check failed');
    return { predict: matchedPredictor(JSON.parse(new TextDecoder().decode(bytes)), rules),
      info: { id: SCORE_ID, sha256: SCORE_SHA256, state: 'ready' } };
  } finally { request.dispose(); }
}
