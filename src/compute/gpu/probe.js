import { Board } from "../../environment/board.js";
import { snapshot } from "../../environment/state.js";
import { diagnostics } from "../../platform/report.js";

export async function probeGpu(backend) {
  if (!navigator.gpu) return { available: false, code: "gpu-unsupported" };
  let timer;
  const controller = new AbortController();
  const state = snapshot(new Board());
  try {
    await Promise.race([
      (async () => {
        const [done] = await backend.run({ snapshot: { ...state, diceUsed: 100 }, actions: [0], count: 64, seed: 718 }, controller.signal);
        if (done.count !== 64 || done.sum !== 64 || done.min !== 1 || done.max !== 1) throw Error("GPU check failed");
        const [initial] = await backend.run({ snapshot: state, actions: [0], count: 64, seed: 718 }, controller.signal);
        const mean = initial.sum / initial.count;
        if (initial.count !== 64 || !Number.isFinite(mean) || mean < 1000 || mean > 2400 || initial.min < 1 || initial.max > 2898 || initial.truncated) throw Error("GPU check failed");
      })(),
      new Promise((_, reject) => timer = setTimeout(() => reject(Object.assign(Error("GPU check timed out"), { code: "check-timeout" })), 15000)),
    ]);
    return { available: true };
  } catch (error) {
    diagnostics.capture(error, "gpu.probe");
    controller.abort(); backend.device?.destroy();
    return { available: false, code: error.code || (error.message === "GPU를 사용할 수 없습니다." ? "gpu-adapter" : "gpu-test"), uncertain: error.code === "check-timeout" };
  } finally { clearTimeout(timer); }
}
