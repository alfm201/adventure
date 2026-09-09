const GPU_BASE_ITERATION = 100000;
export function getGpuUsageSettings(value) {
  if (value === "high") {
    return {
      gpuIteration: GPU_BASE_ITERATION,
      gpuBatchPct: 200,
      gpuMaxPct: getGpuMaxPctForUsage("high"),
      gpuLoad: "high",
      targetChunkMs: 1000,
      yieldMs: 0,
      initialChunkPct: 100,
      minChunkPct: 100,
    };
  }
  if (value === "low") {
    return {
      gpuIteration: GPU_BASE_ITERATION,
      gpuBatchPct: 50,
      gpuMaxPct: getGpuMaxPctForUsage("low"),
      gpuLoad: "low",
      targetChunkMs: 200,
      yieldMs: 12,
      initialChunkPct: 100,
      minChunkPct: 50,
    };
  }
  return {
    gpuIteration: GPU_BASE_ITERATION,
    gpuBatchPct: 100,
    gpuMaxPct: getGpuMaxPctForUsage("medium"),
    gpuLoad: "medium",
    targetChunkMs: 500,
    yieldMs: 4,
    initialChunkPct: 100,
    minChunkPct: 75,
  };
}

export function getGpuMaxPctForUsage(value) {
  if (value === "high") return 10000;
  if (value === "low") return 1000;
  return 2000;
}

export function getGpuLoadConfig(gpuLoad = "medium") {
  if (gpuLoad === "low")
    return {
      targetChunkMs: 200,
      yieldMs: 12,
      cooldownRatio: 0.35,
      initialChunkPct: 100,
      minChunkPct: 50,
    };
  if (gpuLoad === "medium")
    return {
      targetChunkMs: 500,
      yieldMs: 4,
      cooldownRatio: 0.05,
      initialChunkPct: 100,
      minChunkPct: 75,
    };
  return {
    targetChunkMs: 1000,
    yieldMs: 0,
    cooldownRatio: 0,
    initialChunkPct: 100,
    minChunkPct: 100,
  };
}

export function createGpuDispatchTuner(batchIteration, settings = {}) {
  let loadConfig = getGpuLoadConfig(settings.gpuLoad);
  let targetChunkMs = Math.max(
    4,
    settings.targetChunkMs || loadConfig.targetChunkMs,
  );
  let baseYieldMs = Math.max(
    0,
    settings.yieldMs !== undefined ? settings.yieldMs : loadConfig.yieldMs,
  );
  let cooldownRatio = Math.max(
    0,
    settings.cooldownRatio !== undefined
      ? settings.cooldownRatio
      : loadConfig.cooldownRatio || 0,
  );
  let currentYieldMs = baseYieldMs;
  let initialChunkPct = Math.max(
    1,
    Math.min(100, settings.initialChunkPct || loadConfig.initialChunkPct),
  );
  let minChunkPct = Math.max(
    0,
    Math.min(100, settings.minChunkPct || loadConfig.minChunkPct || 0),
  );
  let fixedChunkPct =
    settings.gpuLoad === "low" ? Math.max(minChunkPct, initialChunkPct) : 0;
  if (fixedChunkPct > 0) {
    minChunkPct = fixedChunkPct;
    cooldownRatio = Math.min(cooldownRatio, 0.25);
  }
  let minDispatchIteration = Math.max(
    64,
    Math.floor((batchIteration * Math.max(minChunkPct, 0.5)) / 100),
  );
  let maxDispatchIteration = Math.max(minDispatchIteration, batchIteration);
  let dispatchIteration = Math.max(
    minDispatchIteration,
    Math.min(
      maxDispatchIteration,
      Math.floor((batchIteration * initialChunkPct) / 100),
    ),
  );

  return {
    get yieldMs() {
      return currentYieldMs;
    },
    next(remaining) {
      return Math.max(1, Math.min(remaining, Math.round(dispatchIteration)));
    },
    record(elapsedMs, iteration) {
      if (!elapsedMs || elapsedMs <= 0 || !isFinite(elapsedMs)) return;
      currentYieldMs = Math.min(1500, baseYieldMs + elapsedMs * cooldownRatio);
      if (fixedChunkPct > 0) return;
      let targetIteration = (iteration * targetChunkMs) / elapsedMs;
      let blend = elapsedMs > targetChunkMs * 1.4 ? 0.45 : 0.25;
      dispatchIteration =
        dispatchIteration * (1 - blend) + targetIteration * blend;
      dispatchIteration = Math.max(
        minDispatchIteration,
        Math.min(maxDispatchIteration, dispatchIteration),
      );
    },
  };
}
