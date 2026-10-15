import { profile, workerLimit } from "../evaluation/profile.js";
import { freshSeed } from "../environment/random.js";
import { cacheAllowed, rememberCacheChoice, clearModelCache, inspectModels, hasCachedModel, hasModelCache } from "../compute/vela/storage.js";
import { sameModel, LOCAL_MODEL } from "../compute/vela/model.js";
import { velaRequirements, probeVela } from "../compute/vela/support.js";
import { compatibilityMessage } from "../content/compatibility.js";
import { diagnostics } from "../platform/report.js";
import { Forecast } from "./forecast.js";
import { loadG3Predictor } from "../evaluation/g3-score.js";
export class Coordinator extends EventTarget {
  constructor(session) {
    super();
    this.session = session;
    this.forecast = new Forecast();
    this.settings = {
      model: "x36",
      engine: "gpu",
      usage: "medium",
      workers: null,
      lyraDevice: "auto",
      lyraUsage: "medium",
    };
    this.gpu = null;
    this.requestId = 0;
    this.result = { status: "disabled", actions: [] };
    this.enabled = false;
    this.suspensions = 0;
    this.modelEpoch = 0;
    this.gpuEpoch = 0;
    this.gpuSupport = { state: "unchecked" };
    this.velaSupport = { state: "unchecked" };
    this.lyraGpuSupport = { state: "unchecked" };
    session.addEventListener("change", (event) => {
      if (["reset", "assist-sync", "mode"].includes(event.detail?.type)) this.forecast.clear();
      if (["reset", "mode"].includes(event.detail?.type)) this.completed = null;
      if (this.suspensions) return;
      if (this.enabled) this.recalculate({ reuse: ["assist-state", "assist-sync"].includes(event.detail?.type) });
      else this.cancel();
    });
  }
  publish(result) {
    if (result.requestId === this.requestId) result.startedAt = this.calculationStartedAt;
    result.forecast = !this.session.canRecommend ? {} : this.forecast.update(this.session.state, result);
    this.result = result;
    if (result.status === "complete" || result.status === "error") diagnostics.record("calculation.result", result);
    this.dispatchEvent(new Event("change"));
  }
  get maxWorkers() {
    return workerLimit();
  }
  get calculationBackend() {
    return this.settings.model === "lyra" ? this.lyra : this.settings.model === "vela" ? this.vela : this.settings.engine === "gpu" ? this.gpu : this.cpu;
  }
  checkLyraGpu(force = false) {
    if (!force && this.lyraGpuCheck) return this.lyraGpuCheck;
    this.lyraGpuSupport = { state: "checking" }; this.supportChanged();
    const task = import("../compute/lyra/model.js").then(({ probeLyraGpu }) => probeLyraGpu())
      .catch(() => ({ available: false, code: "gpu-device" })).then(result => {
        if (this.lyraGpuCheck === task) {
          this.lyraGpuSupport = { ...result, state: result.available ? "available" : "unavailable" };
          this.supportChanged();
        }
        return result;
      });
    this.lyraGpuCheck = task; return task;
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
  suspend() {
    this.suspensions++;
    this.cancel();
    let active = true;
    return () => { if (active) { active = false; this.suspensions--; } };
  }
  checkVela(force = false) {
    if (!force && this.velaCheck) return this.velaCheck;
    this.velaSupport = { state: "checking" }; this.supportChanged();
    const task = (async () => {
      const required = velaRequirements();
      if (!required.available) return required;
      const { latest, cached } = await this.inspectVela();
      return probeVela({ manifest: latest, persist: !!cached });
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
    this.preparedLyra?.dispose(); this.preparedLyra = null;
  }
  async prepareLyra(options) {
    this.cancelModelPreparation();
    const epoch = this.modelEpoch;
    const { LyraBackend } = await import("../compute/lyra/backend.js");
    if (options.signal?.aborted || epoch !== this.modelEpoch) throw new DOMException("Cancelled", "AbortError");
    if (this.lyra?.ready && this.lyra.info.preference === options.device) {
      const info = await this.lyra.prepare({ ...options, deferUsage: true });
      if (options.signal?.aborted || epoch !== this.modelEpoch) throw new DOMException("Cancelled", "AbortError");
      diagnostics.record('model.reuse', { id:'lyra-v1', device:options.device, usage:options.usage ?? 'medium' });
      return info;
    }
    const backend = this.preparedLyra = new LyraBackend();
    backend.addEventListener("backendchange", () => {
      diagnostics.record("lyra.backend", backend.info);
      if (this.lyra === backend) {
        this.completed = null;
        if (this.result.model === "lyra" && this.result.status === "running")
          this.publish({ ...this.result, profile: { ...this.result.profile, engine: backend.info.engine } });
        this.supportChanged(); this.notice("GPU 계산을 중단하고 CPU로 전환했습니다.");
      }
    });
    diagnostics.record("model.prepare", { id: "lyra-v1", device: options.device, usage: options.usage ?? 'medium' });
    const info = await backend.prepare(options);
    if (options.signal?.aborted || epoch !== this.modelEpoch) throw new DOMException("Cancelled", "AbortError");
    return info;
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
  async prepare({ signal, onProgress = () => {} } = {}) {
    onProgress({ phase: "engine" });
    const { CpuBackend } = await this.loadX36();
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    void loadG3Predictor();
    if (this.cpu && !this.cpu.disposed) return;
    const cpu = this.cpu = new CpuBackend(this.maxWorkers);
    const cancel = () => cpu.dispose();
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      onProgress({ phase: "warmup" });
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
    this.publish({ status: !this.session.canRecommend ? "paused" : this.enabled ? "idle" : "disabled", model: this.settings.model, actions: [] });
  }
  remember(result, state) {
    if (this.session.mode !== "assist" || result.status !== "complete") return;
    this.completed = { key: JSON.stringify([state, this.settings]), backend: this.calculationBackend,
      result: { ...result } };
  }
  async recalculate({ reuse = false } = {}) {
    this.cancel();
    if (!this.enabled || this.suspensions || !this.session.canRecommend) return;
    const id = this.requestId,
      revision = this.session.revision,
      controller = (this.controller = new AbortController());
    this.calculationStartedAt = performance.now();
    const p = this.settings.model === "lyra" ? { model: "lyra", engine: this.lyra?.info?.engine ?? "cpu", device: this.settings.lyraDevice, usage: this.settings.lyraUsage }
      : this.settings.model === "vela" ? { model: "vela", engine: "cpu" } : profile(this.settings, {
        noEarlyStop:
          new URLSearchParams(location.search).get("noEarlyStop") === "1",
      }),
      state = this.session.state;
    // A temporary occlusion changes readiness, not the game state. Reuse only
    // the last completed assist result with exactly the same state/settings
    // and model instance. Explicit recalculation still starts a fresh request.
    if (reuse && this.session.mode === "assist" && this.completed?.backend === this.calculationBackend &&
        this.completed.key === JSON.stringify([state, this.settings])) {
      diagnostics.record("calculation.reuse", { requestId: id, revision, snapshot: state });
      this.publish({ ...this.completed.result, requestId: id, revision, reused: true });
      return;
    }
    this.publish({
      status: "running",
      model: this.settings.model,
      actions: state.hand.map(() => null),
      profile: p,
      ...(p.model === "lyra" ? { modelName: this.lyra?.info?.manifest?.name ?? "LYRA v1" } : {}),
      requestId: id,
    });
    const current = () =>
      id === this.requestId &&
      revision === this.session.revision &&
      !controller.signal.aborted;
    try {
      const seed = this.settings.model === "x36" ? freshSeed() : null;
      diagnostics.record("calculation.start", { requestId: id, revision, profile: p, seed, snapshot: state });
      if (this.settings.model === "lyra") {
        const { evaluateLyra } = await import("../evaluation/lyra.js");
        if (!current()) return;
        if (!this.lyra?.ready) {
          if (!this.lyra) throw Error("LYRA is not prepared");
          await this.lyra.prepare({ device: this.settings.lyraDevice, usage: this.settings.lyraUsage, signal: controller.signal });
          if (!current()) return;
        }
        const result = await evaluateLyra({ snapshot: state, backend: this.lyra, signal: controller.signal, requestId: id, revision });
        if (current()) { this.remember(result, state); this.publish(result); }
        return;
      }
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
        if (current()) { this.remember(result, state); this.publish(result); }
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
      if (current()) { this.remember(result, state); this.publish(result); }
    } catch (error) {
      if (current() && error.name !== "AbortError") {
        controller.abort();
        diagnostics.capture(error, "calculation", { requestId: id, revision, profile: p, snapshot: state }, true);
        console.error("Evaluation failed", error);
        if (p.engine === "gpu" && this.settings.model === "x36") {
          this.gpuSupport = { state: "unavailable", available: false, code: "gpu-lost" };
          this.settings.engine = "cpu"; this.supportChanged();
          this.notice("GPU 계산을 중단하고 CPU로 전환했습니다.");
          return this.recalculate();
        }
        this.publish({
          status: "error",
          model: this.settings.model,
          message:
            this.settings.model === "lyra" && this.settings.lyraDevice === "gpu"
              ? "GPU 계산을 완료하지 못했습니다. 모델 선택에서 자동 또는 CPU를 선택해 주세요."
            : p.engine === "gpu"
              ? "GPU 계산을 완료하지 못했습니다. 계산 설정에서 CPU를 선택하거나 다시 시도해 주세요."
              : "계산을 완료하지 못했습니다. 다시 계산해 주세요.",
          actions: [],
          profile: p,
        });
      }
    }
  }
  async configure(settings) {
    const resume = this.suspend();
    try {
      this.forecast.clear();
      this.completed = null;
      diagnostics.record("model.apply", settings);
      this.cancel();
      const requestId = this.requestId;
      const current = () => requestId === this.requestId;
      this.settings = { ...this.settings, ...settings };
      if (this.settings.model !== "lyra") { this.lyra?.dispose(); this.lyra = null; }
      if (this.settings.model === "lyra") {
        if (this.preparedLyra?.ready) {
          this.lyra?.dispose(); this.lyra = this.preparedLyra; this.preparedLyra = null;
        }
        this.cancelModelPreparation();
        if (!this.lyra?.ready) throw Error("LYRA is not prepared");
        await this.lyra.setUsage(this.settings.lyraUsage);
        if (!current()) return;
        this.vela?.dispose(); this.vela = null;
        this.cpu?.dispose(); this.cpu = null;
        const gpu = this.gpu; this.gpu = null;
        this.gpuEpoch++; this.gpuCheck = null; this.gpuSupport = { state: "unchecked" };
        await gpu?.dispose();
      }
      else if (this.settings.model === "x36") { this.vela?.dispose(); this.vela = null; this.cancelModelPreparation(); }
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
      resume();
      return this.recalculate();
    } finally { resume(); }
  }
  async dispose() {
    this.enabled = false;
    this.completed = null;
    this.cancel();
    this.cpu?.dispose();
    this.cpu = null;
    this.vela?.dispose();
    this.vela = null;
    this.lyra?.dispose(); this.lyra = null;
    this.restoreVela = null;
    this.cancelModelPreparation();
    const gpu = this.gpu; this.gpu = null;
    this.gpuEpoch++;
    this.gpuCheck = null; this.gpuSupport = { state: "unchecked" };
    await gpu?.dispose();
  }
}
