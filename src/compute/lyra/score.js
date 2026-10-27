import { createPredictor } from '../../policies/lyra/predictor.mjs';
import { deadline } from '../../platform/requests.js';
import { ASSET_URL, MANIFEST, PACKAGE_SHA256 } from './model.js';
import { hashBytes } from './package.js';

export const SCORE_ID = 'lyra-v1-score-v1';
export const SCORE_SHA256 = '68284138211148822856667503e2ea4dae58c81b8ace884c676b9283606ab440';

export function matchedPredictor(model, rules) {
  if (MANIFEST.horizon !== 1 || MANIFEST.precision !== 'fp32'
      || model.format !== SCORE_ID || model.usePhi !== false
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
