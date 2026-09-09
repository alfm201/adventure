import { abortError } from "../../platform/requests.js";
import { diagnostics } from "../../platform/report.js";

export function velaRequirements(scope = globalThis) {
  if (!scope.WebAssembly) return { available: false, code: "wasm" };
  if (!scope.Worker) return { available: false, code: "worker" };
  if (!scope.ReadableStream || !scope.TransformStream || !scope.TextEncoder) return { available: false, code: "streams" };
  if (!scope.crypto?.subtle) return { available: false, code: "crypto" };
  return { available: true };
}
export function probeVela({ manifest, persist = false, storage = false, signal } = {}) {
  return new Promise((resolve, reject) => {
    let worker, timer;
    const finish = (value, error) => {
      clearTimeout(timer); signal?.removeEventListener("abort", cancel); worker?.terminate();
      error ? reject(error) : resolve(value);
    };
    const cancel = () => finish(null, abortError(signal));
    if (signal?.aborted) { cancel(); return; }
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
      worker.onerror = event => { event.preventDefault(); diagnostics.capture(Error(event.message || "VELA worker failed"), "vela.probe", { file: event.filename, line: event.lineno }); finish({ available: false, code: "worker", uncertain: true }); };
      worker.onmessage = ({ data }) => {
        if (data.type === "support") finish(data);
        else if (data.type === "error") {
          diagnostics.capture(Object.assign(Error(data.message), { code: data.code, ...(data.stack ? { stack: data.stack } : {}) }), storage ? "vela.storage" : "vela.probe");
          finish({ available: false, code: data.code || "network", uncertain: !["wasm", "worker", "streams", "crypto"].includes(data.code) });
        }
      };
      timer = setTimeout(() => finish({ available: false, code: "check-timeout", uncertain: true }), 16000);
      worker.postMessage({ type: storage ? "storage" : "probe", manifest, persist });
    } catch (error) { diagnostics.capture(error, "vela.probe"); finish({ available: false, code: "worker" }); }
  });
}
