import { velaSearch } from "../policies/vela/search.js";
export const modelComparison = {
  lyra: { meanScore: 1880.09, relativeTime: "GPU 빠름 · CPU 보통" },
  vela: { meanScore: velaSearch("normal").score, relativeTime: "매우 빠름" },
  x36: { meanScore: 1859.9914, relativeTime: "GPU 보통 · CPU 느림" },
};

// Measured startup/inference/transition peaks plus headroom, not minimum hardware limits.
// Evidence: temp/lyra-v2-integration/memory.json. Timings include concurrent workloads.
export const lyraMemory = {
  cpu: { low: { ram: 1e9 }, medium: { ram: 1e9 }, high: { ram: 1e9 } },
  gpu: {
    low: { ram: 1.5e9, gpu: 300e6 },
    medium: { ram: 2e9, gpu: 500e6 },
    high: { ram: 4e9, gpu: 2e9 },
  },
};
