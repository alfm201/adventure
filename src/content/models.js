export const modelComparison = {
  lyra: { meanScore: 1879.173486191134, relativeTime: "GPU 빠름 · CPU 보통" },
  vela: { meanScore: 1877, relativeTime: "매우 빠름" },
  x36: { meanScore: 1859.9914, relativeTime: "GPU 보통 · CPU 느림" },
};

// Measured startup/inference/transition peaks plus headroom, not minimum hardware limits.
// Evidence: temp/lyra-memory-20261016/{report,switch-report}.json
export const lyraMemory = {
  cpu: { low: { ram: 600e6 }, medium: { ram: 600e6 }, high: { ram: 600e6 } },
  gpu: {
    low: { ram: 1.2e9, gpu: 150e6 },
    medium: { ram: 1.5e9, gpu: 300e6 },
    high: { ram: 3e9, gpu: 1.2e9 },
  },
};
