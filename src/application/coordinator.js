import { profile, workerLimit } from "../evaluation/profile.js";
import { freshSeed } from "../environment/random.js";
import { cacheAllowed, rememberCacheChoice, clearModelCache, inspectModels, hasCachedModel, hasModelCache } from "../compute/vela/storage.js";
import { sameModel, LOCAL_MODEL } from "../compute/vela/model.js";
import { velaRequirements, probeVela } from "../compute/vela/support.js";
import { compatibilityMessage } from "../content/compatibility.js";
import { diagnostics } from "../platform/report.js";
export class Coordinator extends EventTarget {
  constructor(session) {
    super();
    this.session = session;
    this.settings = {
      model: "x36",
      engine: "gpu",
      usage: "medium",
      workers: null,
    };
    this.gpu = null;
    this.requestId = 0;
    this.result = { status: "disabled", actions: [] };
    this.enabled = false;
    this.modelEpoch = 0;
    this.gpuEpoch = 0;
    this.gpuSupport = { state: "unchecked" };
    this.velaSupport = { state: "unchecked" };
    session.addEventListener("change", () => {
      this.cancel();
      if (this.enabled) this.recalculate();
    });
  }
  publish(result) {
    this.result = result;
    if (result.status === "complete" || result.status === "error") diagnostics.record("calculation.result", result);
    this.dispatchEvent(new Event("change"));
  }
  get maxWorkers() {
    return workerLimit();
  }
  get velaCacheAllowed() { return cacheAllowed(); }
  notice(message) { const event = new Event("notice"); event.message = message; this.dispatchEvent(event); }
  supportChanged() { this.dispatchEvent(new Event("capabilities")); }
  checkGpu(force = false) {
    if (!force && this.gpuSupport.state === "checking" && this.gpuCheck) return this.gpuCheck;
    if (!force && this.gpuCheck && this.gpuCheckedBackend === this.gpu) return this.gpuCheck;
    const epoch = ++this.gpuEpoch;
    this.gpuSupport = { state: "checking" }; this.supportChanged();
    const task = (async () => {
      const [{ GpuBackend }, { probeGpu }] = await Promise.all([import("../compute/gpu/backend.js"), import("../compute/gpu/probe.js")]);
      if (epoch !== this.gpuEpoch) return { available: false, code: "gpu-test" };
      if (force && this.gpu) { this.gpu.device?.destroy(); this.gpu.dispose().catch(() => {}); this.gpu = null; }
      const backend = this.gpu ??= new GpuBackend(); this.gpuCheckedBackend = backend;
      const result = await probeGpu(backend);
      if (epoch === this.gpuEpoch && this.gpu === backend) {
        this.gpuSupport = { ...result, state: result.available ? "available" : "unavailable" };
        this.supportChanged();
      }
      return result;
    })().catch(error => {
      diagnostics.capture(error, "gpu.probe");
      const result = { available: false, code: "gpu-test" };
      if (epoch === this.gpuEpoch) { this.gpuSupport = { ...result, state: "unavailable" }; this.supportChanged(); }
      return result;
    });
    this.gpuCheck = task; return task;
  }
  checkVela(force = false) {
    if (!force && this.velaCheck) return this.velaCheck;
    this.velaSupport = { state: "checking" }; this.supportChanged();
    const task = (async () => {
      const required = velaRequirements();
      if (!required.available) return required;
      const { latest, cached } = await this.inspectVela();
      const result = await probeVela({ manifest: latest || cached, persist: !!cached && sameModel(latest || cached, cached) });
      if (!result.available && cached && !sameModel(latest, cached)) return probeVela({ manifest: cached, persist: true });
      return result;
    })().catch(error => { diagnostics.capture(error, "vela.probe"); return { available: false, code: "network", uncertain: true }; }).then(result => {
      if (!result.available) diagnostics.record("vela.unavailable", result);
      if (this.velaCheck === task) {
        this.velaSupport = { ...result, state: result.available ? "available" : "unavailable" };
        this.supportChanged();
      }
      return result;
    });
    this.velaCheck = task; return task;
  }
  checkVelaStorage(manifest, signal) { return probeVela({ manifest, storage: true, signal }); }
  inspectVela(signal) { return inspectModels(signal); }
  hasVelaCache() { return hasModelCache(); }
  setVelaCacheAllowed(value) { return rememberCacheChoice(value); }
  async clearVelaCache() {
    diagnostics.record("model.cache.clear");
    try { await clearModelCache(); }
    finally {
      if (!this.velaCacheAllowed)
        for (const info of [this.vela?.info, this.preparedVela?.info, this.restoreVela])
          if (info) Object.assign(info, { cacheSaved: false, cacheFailed: false, cacheIssue: null });
    }
  }
  cancelModelPreparation() {
    this.modelEpoch++;
    this.transferVela?.dispose(); this.transferVela = null;
    this.preparedVela?.dispose(); this.preparedVela = null;
  }
  async loadX36() {
    const [{ CpuBackend }, { GpuBackend }, { evaluate }] = await Promise.all([
      import("../compute/cpu/backend.js"), import("../compute/gpu/backend.js"),
      import("../evaluation/evaluate.js"),
    ]);
    this.x36 = { CpuBackend, GpuBackend, evaluate };
    if (!this.gpu) this.gpu = new GpuBackend();
    return this.x36;
  }
  async prepare({ signal } = {}) {
    const { CpuBackend } = await this.loadX36();
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    if (this.cpu && !this.cpu.disposed) return;
    const cpu = this.cpu = new CpuBackend(this.maxWorkers);
    const cancel = () => cpu.dispose();
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      await cpu.prepare(this.session.state, signal);
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      cpu.setSize(profile({ ...this.settings, engine: "cpu" }).workers);
    } catch (error) {
      cpu.dispose(); if (this.cpu === cpu) this.cpu = null; throw error;
    } finally { signal?.removeEventListener("abort", cancel); }
  }
  async prepareVela(options) {
    if (LOCAL_MODEL) options = { ...options, persist: false, cachedOnly: false };
    this.cancelModelPreparation();
    const epoch = this.modelEpoch;
    const current = () => {
      if (options.signal?.aborted || this.modelEpoch !== epoch) throw new DOMException("Cancelled", "AbortError");
    };
    current();
    diagnostics.record("model.prepare", { id: options.manifest?.id, version: options.manifest?.version, persist: options.persist, cachedOnly: options.cachedOnly });
    const { VelaBackend } = await import("../compute/vela/backend.js");
    current();
    const resident = this.vela?.ready && sameModel(this.vela.info.manifest, options.manifest) ? this.vela : null;
    if (resident) {
      const saved = options.persist && resident.info.cacheSaved && await hasCachedModel(options.manifest);
      current();
      if (!options.persist || saved) {
        if (!options.persist) Object.assign(resident.info, { cacheFailed: false, cacheIssue: null });
        return resident.info;
      }
      resident.info.cacheSaved = false;
    }
    let cacheIssue;
    if (options.persist && !options.cachedOnly && this.vela?.ready) {
      const transfer = this.transferVela = new VelaBackend();
      try {
        const staged = await transfer.prepare({ ...options, stageOnly: true });
        current();
        if (!staged.staged) { cacheIssue = staged.cacheIssue; options = { ...options, persist: false }; }
      } finally { transfer.dispose(); if (this.transferVela === transfer) this.transferVela = null; }
    }
    current();
    if (resident && !options.cachedOnly) {
      Object.assign(resident.info, { cacheSaved: !!options.persist, cacheFailed: !!cacheIssue, cacheIssue: cacheIssue || null });
      return resident.info;
    }
    if (this.vela) {
      if (this.vela.ready && this.settings.model === "vela") this.restoreVela = this.vela.info;
      this.vela.dispose(); this.vela = null;
    }
    this.cpu?.dispose(); this.cpu = null;
    const gpu = this.gpu; this.gpu = null;
    this.gpuEpoch++; this.gpuCheck = null; this.gpuSupport = { state: "unchecked" };
    if (gpu) { gpu.device?.destroy(); gpu.dispose().catch(() => {}); }
    current();
    this.preparedVela?.dispose();
    const candidate = this.preparedVela = new VelaBackend();
    const info = await candidate.prepare(options);
    current();
    if (cacheIssue) Object.assign(info, { cacheFailed: true, cacheIssue });
    return info;
  }
  cancel() {
    if (this.result.status === "running") diagnostics.record("calculation.cancel", { requestId: this.requestId });
    this.requestId++;
    this.controller?.abort();
    this.publish({ status: this.enabled ? "idle" : "disabled", model: this.settings.model, actions: [] });
  }
  async recalculate() {
    this.cancel();
    if (!this.enabled) return;
    const id = this.requestId,
      revision = this.session.revision,
      controller = (this.controller = new AbortController());
    const p = this.settings.model === "vela" ? { model: "vela", engine: "cpu" } : profile(this.settings, {
        noEarlyStop:
          new URLSearchParams(location.search).get("noEarlyStop") === "1",
      }),
      state = this.session.state;
    this.publish({
      status: "running",
      model: this.settings.model,
      actions: state.hand.map(() => null),
      profile: p,
      requestId: id,
    });
    const current = () =>
      id === this.requestId &&
      revision === this.session.revision &&
      !controller.signal.aborted;
    try {
      const seed = this.settings.model === "vela" ? null : freshSeed();
      diagnostics.record("calculation.start", { requestId: id, revision, profile: p, seed, snapshot: state });
      if (this.settings.model === "vela") {
        const { evaluateVela } = await import("../evaluation/vela.js");
        if (!current()) return;
        if (!this.vela?.ready && this.restoreVela) {
          const { VelaBackend } = await import("../compute/vela/backend.js");
          if (!current()) return;
          this.vela ??= new VelaBackend();
          if (!this.vela.preparing) this.notice("이전 모델을 다시 준비하고 있습니다.");
          const saved = this.restoreVela.cacheSaved && cacheAllowed();
          await this.vela.prepare({ manifest: this.restoreVela.manifest, persist: saved, cachedOnly: saved });
          if (!current()) return;
        }
        const result = await evaluateVela({ snapshot: state, backend: this.vela,
          signal: controller.signal, requestId: id, revision });
        if (current()) this.publish(result);
        return;
      }
      const { CpuBackend, evaluate } = await this.loadX36();
      if (!current()) return;
      if (p.engine === "cpu" &&
          (!this.cpu || this.cpu.disposed)) {
        this.cpu?.dispose();
        this.cpu = new CpuBackend(p.workers);
      }
      if (p.engine === "cpu") this.cpu.setSize(p.workers);
      const backend = p.engine === "gpu" ? this.gpu : this.cpu;
      const result = await evaluate({
        snapshot: state,
        profile: p,
        backend,
        signal: controller.signal,
        seed,
        requestId: id,
        revision,
        onProgress: (r) => {
          if (current()) this.publish(r);
        },
      });
      if (current()) this.publish(result);
    } catch (error) {
      if (current() && error.name !== "AbortError") {
        controller.abort();
        diagnostics.capture(error, "calculation", { requestId: id, revision, profile: p, snapshot: state }, true);
        console.error("Evaluation failed", error);
        if (p.engine === "gpu") {
          this.gpuSupport = { state: "unavailable", available: false, code: "gpu-lost" };
          this.settings.engine = "cpu"; this.supportChanged();
          this.notice("GPU 계산을 중단하고 CPU로 전환했습니다.");
          return this.recalculate();
        }
        this.publish({
          status: "error",
          model: this.settings.model,
          message:
            p.engine === "gpu"
              ? "GPU 계산을 완료하지 못했습니다. 계산 설정에서 CPU를 선택하거나 다시 시도해 주세요."
              : "계산을 완료하지 못했습니다. 다시 계산해 주세요.",
          actions: [],
          profile: p,
        });
      }
    }
  }
  async configure(settings) {
    diagnostics.record("model.apply", settings);
    this.cancel();
    const requestId = this.requestId;
    const current = () => requestId === this.requestId;
    this.settings = { ...this.settings, ...settings };
    if (this.settings.model === "x36") { this.vela?.dispose(); this.vela = null; this.cancelModelPreparation(); }
    else {
      if (this.preparedVela?.ready) {
        this.vela?.dispose(); this.vela = this.preparedVela; this.preparedVela = null;
      }
      this.cpu?.dispose(); this.cpu = null;
      const gpu = this.gpu; this.gpu = null;
      this.gpuEpoch++;
      this.gpuCheck = null; this.gpuSupport = { state: "unchecked" };
      gpu?.dispose().catch(error => console.error("GPU cleanup failed", error));
      this.restoreVela = null;
      this.enabled = true;
      if (this.vela?.ready) {
        const backend = this.vela, epoch = this.modelEpoch;
        const active = () => current() && this.vela === backend && epoch === this.modelEpoch;
        try {
          const committed = await backend.commit({ persist: this.velaCacheAllowed && backend.info.cacheSaved });
          if (!active()) return;
          if (committed.cacheIssue) this.notice(compatibilityMessage(committed.cacheIssue).title);
        } catch (error) { if (!active()) return; diagnostics.capture(error, "model.commit"); this.notice("모델은 사용할 수 있지만 저장 상태를 확인하지 못했습니다."); }
      }
    }
    if (!current()) return;
    this.restoreVela = null;
    this.enabled = true;
    return this.recalculate();
  }
  async dispose() {
    this.enabled = false;
    this.cancel();
    this.cpu?.dispose();
    this.cpu = null;
    this.vela?.dispose();
    this.vela = null;
    this.restoreVela = null;
    this.cancelModelPreparation();
    const gpu = this.gpu; this.gpu = null;
    this.gpuEpoch++;
    this.gpuCheck = null; this.gpuSupport = { state: "unchecked" };
    await gpu?.dispose();
  }
}
