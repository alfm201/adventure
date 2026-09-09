import { RULES_VERSION } from "../../rules/index.js";
import { POLICY_VERSION } from "../../policies/versions.js";
const cancelled = () => new DOMException("Cancelled", "AbortError");
export class CpuBackend {
  constructor(size = 1) {
    this.size = size;
    this.slots = [];
    this.queue = [];
    this.nextId = 1;
    this.disposed = false;
    this.requests = new Map();
  }
  setSize(size) {
    if (!Number.isInteger(size) || size < 1) throw Error("Invalid worker count");
    this.size = size;
    // Park excess slots with their LUTs intact; busy slots finish their current job.
    if (this.queue.length) this.pump();
  }
  // Each idle slot receives one warmup job; module/LUT/JIT work precedes timing.
  async prepare(snapshot, signal) {
    await Promise.all(Array.from({ length: this.size }, (_, i) => this.run({
      snapshot, action: 0, count: 32, start: i * 32, seed: 713,
    }, signal)));
  }
  run(job, signal) {
    if (this.disposed || signal?.aborted) return Promise.reject(cancelled());
    return new Promise((resolve, reject) => {
      const entry = {
        ...job, id: this.nextId++, rulesVersion: RULES_VERSION,
        protocolVersion: 1, policyVersion: POLICY_VERSION,
      };
      let group = this.requests.get(signal);
      if (!group) {
        group = { jobs: new Set(), abort: () => {
          // Reject consumers now, but retain busy slots until their replies arrive.
          this.queue = this.queue.filter(j => j.signal !== signal);
          for (const j of [...group.jobs]) j.reject(cancelled());
        } };
        this.requests.set(signal, group);
        signal?.addEventListener("abort", group.abort, { once: true });
      }
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        group.jobs.delete(task);
        if (!group.jobs.size) {
          signal?.removeEventListener("abort", group.abort);
          if (this.requests.get(signal) === group) this.requests.delete(signal);
        }
        callback(value);
      };
      const task = { entry, signal,
        resolve: value => finish(resolve, value),
        reject: error => finish(reject, error),
      };
      group.jobs.add(task);
      this.queue.push(task);
      try { this.pump(); } catch (error) { this.dispose(error); }
    });
  }
  pump() {
    if (this.disposed) return;
    while (this.slots.length < this.size) {
      const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
      const slot = { worker, job: null };
      worker.onmessage = ({ data }) => {
        const job = slot.job;
        if (!job || data.id !== job.entry.id) return;
        slot.job = null;
        if (data.requestId !== job.entry.requestId ||
            data.revision !== job.entry.revision ||
            data.rulesVersion !== RULES_VERSION || data.protocolVersion !== 1 ||
            data.policyVersion !== POLICY_VERSION || data.batchId !== job.entry.batchId)
          job.reject(Error("Mismatched worker response"));
        else if (job.signal?.aborted) job.reject(cancelled());
        else if (data.error) job.reject(Object.assign(Error(data.error), data.stack ? { stack: data.stack } : {}));
        else job.resolve(data.stats);
        this.pump();
      };
      worker.onerror = e => {
        e.preventDefault();
        this.dispose(Error(e.message || "CPU worker failed"));
      };
      this.slots.push(slot);
    }
    for (const slot of this.slots.slice(0, this.size)) {
      if (slot.job) continue;
      while (this.queue.length) {
        const job = this.queue.shift();
        if (job.signal?.aborted) { job.reject(cancelled()); continue; }
        slot.job = job;
        slot.worker.postMessage(job.entry);
        break;
      }
    }
  }
  dispose(reason = cancelled()) {
    this.disposed = true;
    for (const slot of this.slots) {
      slot.worker.terminate();
      slot.job?.reject(reason);
    }
    for (const job of this.queue) job.reject(reason);
    this.slots = [];
    this.queue = [];
  }
}
