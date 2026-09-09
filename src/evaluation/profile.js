import { getGpuUsageSettings } from "../compute/gpu/scheduling.js";
export function workerLimit(
  logical = globalThis.navigator?.hardwareConcurrency || 6,
) {
  return Math.max(
    2,
    Math.min(Math.max(2, Math.ceil(logical / 2)), logical - 1),
  );
}
export function profile(settings, { noEarlyStop = false } = {}) {
  const gpu = settings.engine === "gpu",
    workers = Math.max(
      1,
      Math.min(
        workerLimit(),
        Number(settings.workers) || Math.ceil(workerLimit() / 2),
      ),
    ),
    usage = ["low", "medium", "high"].includes(settings.usage)
      ? settings.usage
      : "medium";
  const maxPct = gpu
    ? { low: 1000, medium: 2000, high: 10000 }[usage]
    : workers <= 1
      ? 200
      : workers >= workerLimit()
        ? 1000
        : 500;
  const gpuSettings = gpu
    ? getGpuUsageSettings(usage)
    : null;
  return {
    version: "adaptive-ordered-hand-v1",
    engine: gpu ? "gpu" : "cpu",
    workers,
    usage,
    base: gpu ? 100000 : 10000,
    initial: gpu ? 10000 : 1000,
    batch: gpu
      ? Math.floor((gpuSettings.gpuIteration * gpuSettings.gpuBatchPct) / 100)
      : 500,
    max: ((gpu ? 100000 : 10000) * maxPct) / 100,
    chunk: gpu ? null : 250,
    gpuSettings,
    yieldMs: gpu ? gpuSettings.yieldMs : 0,
    noEarlyStop,
  };
}
