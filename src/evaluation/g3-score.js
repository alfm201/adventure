import { createPredictor } from "../policies/g3/predictor.mjs";
import { fetchJson } from "../platform/requests.js";

let loading;
export function loadG3Predictor() {
  return loading ??= fetchJson(new URL("../../public/models/g3-score/model.json", import.meta.url))
    .then(createPredictor)
    .catch(error => { console.error("G3 score predictor unavailable", error); return null; });
}

export async function predictG3Score(snapshot) {
  if (snapshot.diceUsed >= 100 && !snapshot.bonusRoll) return snapshot.position;
  const predict = await loadG3Predictor();
  try {
    const value = predict?.(snapshot);
    return Number.isFinite(value) ? value : undefined;
  } catch (error) { console.error("G3 score prediction failed", error); }
}
