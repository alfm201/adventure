import { diagnostics } from "../platform/report.js";
import { RULES_VERSION } from "../rules/index.js";
import { POLICY_VERSION } from "../policies/versions.js";
import { MODEL_ID } from "../compute/vela/model.js";

const activePolicyVersion = coordinator => !coordinator.enabled ? null
  : coordinator.settings.model === "vela" ? coordinator.vela?.info?.manifest?.id ?? MODEL_ID
  : coordinator.settings.model === "lyra" ? "lyra-v1"
  : POLICY_VERSION;

const modelInfo = info => info ? {
  id: info.manifest?.id, version: info.manifest?.version, sha256: info.manifest?.sha256,
  runtime: info.manifest?.runtime, fromCache: info.fromCache, cacheSaved: info.cacheSaved,
  cacheIssue: info.cacheIssue, memoryBytes: info.memoryBytes,
  researchValue: info.manifest?.researchValue, researchPolicy: info.manifest?.researchPolicy,
  sourceSha256: info.manifest?.sourceSha256, precision: info.manifest?.precision,
  preference: info.preference, engine: info.engine,
  usage: info.usage, batchSize: info.batchSize, runtimeCachePolicy: info.runtimeCachePolicy,
  scorePredictor: info.scorePredictor,
} : null;
export function attachDiagnostics(session, coordinator, assets) {
  diagnostics.provide("game", () => session.view);
  diagnostics.provide("calculation", () => ({
    rulesVersion: RULES_VERSION, policyVersion: activePolicyVersion(coordinator),
    settings: coordinator.settings, enabled: coordinator.enabled, requestId: coordinator.requestId,
    result: coordinator.result, gpuSupport: coordinator.gpuSupport, velaSupport: coordinator.velaSupport,
    lyraGpuSupport: coordinator.lyraGpuSupport, lyra: coordinator.lyra?.info ?? null,
    preparedLyra: coordinator.preparedLyra?.info ?? null,
    model: modelInfo(coordinator.settings.model === 'lyra' ? coordinator.lyra?.info : coordinator.vela?.info),
    preparedModel: modelInfo(coordinator.preparedLyra?.info ?? coordinator.preparedVela?.info), restoreModel: modelInfo(coordinator.restoreVela),
    workers: { cpu: coordinator.cpu?.slots.length || 0, vela: !!coordinator.vela?.worker, lyra: !!coordinator.lyra?.worker,
      preparing: !!(coordinator.preparedVela?.worker || coordinator.preparedLyra?.worker), downloading: !!coordinator.transferVela?.worker },
    cacheAllowed: coordinator.velaCacheAllowed,
  }));
  diagnostics.provide("assets", () => [...assets.records].filter(([, record]) => record.state !== "loaded")
    .map(([id, record]) => ({ id, state: record.state, attempts: record.attempts })));
  diagnostics.provide("page", () => {
    const params = new URLSearchParams(location.search);
    return { loading: !document.querySelector("#loading").hidden, visibility: document.visibilityState,
      language: globalThis.adventureI18n?.language ?? "ko",
      ctrlProfile: params.get("CtrlYn")?.toUpperCase() === "Y", noEarlyStop: params.get("noEarlyStop") === "1",
      dialogs: [...document.querySelectorAll("dialog[open]")].map(node => node.className) };
  });
  document.addEventListener("click", event => {
    const control = event.target.closest?.("button,a,input[type=radio]");
    if (!control) return;
    diagnostics.record("ui.click", { control: control.id || control.className,
      action: control.dataset.nav || control.dataset.cardAction,
      choice: ["model", "engine", "usage", "workers", "cache", "lyra-device"].includes(control.name) ? { name: control.name, value: control.value } : null });
  }, true);
  diagnostics.record("game.ready", { rulesVersion: RULES_VERSION, policyVersion: activePolicyVersion(coordinator), state: session.state });
}
