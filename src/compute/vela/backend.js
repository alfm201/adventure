import { validateSnapshot } from "../../environment/state.js";
import { sameModel } from "./model.js";
const aborted = () => new DOMException("Calculation cancelled", "AbortError");
export class VelaBackend {
  constructor() {
    this.worker = null; this.ready = false; this.sequence = 0;
    this.active = null; this.queued = null; this.preparing = null;
  }
  prepare({ persist = false, manifest, cachedOnly = false, stageOnly = false, signal, onProgress = () => {} } = {}) {
    if (signal?.aborted) return Promise.reject(aborted());
    if (this.ready && (!manifest || sameModel(this.info.manifest, manifest))) return Promise.resolve(this.info);
    if (this.ready) this.dispose();
    if (this.preparing) {
      if (!manifest || sameModel(this.preparing.manifest, manifest)) return this.preparing.promise;
      this.dispose();
    }
    const worker = this.worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onerror = (event) => { event.preventDefault(); if (this.worker === worker) this.dispose(Error(event.message || "VELA worker failed")); };
    const promise = new Promise((resolve, reject) => {
      const cancel = () => this.dispose(aborted());
      this.preparing = { manifest, resolve, reject, onProgress, cleanup: () => signal?.removeEventListener("abort", cancel) };
      signal?.addEventListener("abort", cancel, { once: true });
      worker.onmessage = ({ data }) => {
        if (this.worker !== worker) return;
        if (data.type === "progress") this.preparing?.onProgress(data);
        else if (data.type === "ready") {
          const p = this.preparing; this.preparing = null;
          this.ready = true; this.info = data; p?.cleanup(); p?.resolve(data);
        } else if (data.type === "error") this.dispose(Object.assign(Error(data.message), { code: data.code, ...(data.stack ? { stack: data.stack } : {}) }));
        else if (data.type === "committed" && this.committing?.id === data.id) {
          Object.assign(this.info, { cacheSaved: data.cacheSaved ?? this.info.cacheSaved, cacheFailed: !!data.cacheIssue, cacheIssue: data.cacheIssue || null });
          this.committing?.resolve(data); this.committing = null;
        }
        else if (data.type === "result" && this.active?.id === data.id) {
          const job = this.active; this.active = null;
          job.cleanup(); if (!job.signal?.aborted) job.resolve(data);
          this.dispatch();
        }
      };
      this.worker.postMessage({ type: "prepare", persist, manifest, cachedOnly, stageOnly });
    });
    if (this.preparing) this.preparing.promise = promise;
    return promise;
  }
  run(snapshot, { signal } = {}) {
    validateSnapshot(snapshot);
    if (!this.ready) return Promise.reject(Error("VELA is not ready"));
    if (signal?.aborted) return Promise.reject(aborted());
    return new Promise((resolve, reject) => {
      if (this.queued) { this.queued.cleanup(); this.queued.reject(aborted()); }
      const job = { id: ++this.sequence, snapshot, signal, resolve, reject };
      const cancel = () => {
        if (this.queued === job) this.queued = null;
        job.cleanup(); reject(aborted());
      };
      job.cleanup = () => signal?.removeEventListener("abort", cancel);
      signal?.addEventListener("abort", cancel, { once: true });
      this.queued = job; this.dispatch();
    });
  }
  commit({ persist = !!this.info?.cacheSaved } = {}) {
    if (!this.ready) return Promise.reject(Error("VELA is not ready"));
    if (!persist) return Promise.resolve({ cacheSaved: false, cacheIssue: null });
    if (this.committing) return this.committing.promise;
    const id = ++this.sequence;
    const promise = new Promise((resolve, reject) => {
      this.committing = { id, resolve, reject };
      this.worker.postMessage({ type: "commit", id, persist });
    });
    if (this.committing) this.committing.promise = promise;
    return promise;
  }
  dispatch() {
    if (this.active || !this.queued) return;
    this.active = this.queued; this.queued = null;
    this.worker.postMessage({ type: "evaluate", id: this.active.id, snapshot: this.active.snapshot });
  }
  dispose(error = aborted()) {
    this.worker?.terminate(); this.worker = null; this.ready = false;
    for (const job of [this.preparing, this.active, this.queued, this.committing]) { job?.cleanup?.(); job?.reject(error); }
    this.preparing = null; this.active = null; this.queued = null; this.committing = null;
  }
}
