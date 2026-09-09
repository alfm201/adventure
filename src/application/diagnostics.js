import { diagnostics } from "../platform/report.js";
import { RULES_VERSION } from "../rules/index.js";
import { POLICY_VERSION } from "../policies/versions.js";

const modelInfo = info => info ? {
  id: info.manifest?.id, version: info.manifest?.version, sha256: info.manifest?.sha256,
  runtime: info.manifest?.runtime, fromCache: info.fromCache, cacheSaved: info.cacheSaved,
  cacheIssue: info.cacheIssue, memoryBytes: info.memoryBytes,
} : null;
export function attachDiagnostics(session, coordinator, assets) {
  diagnostics.provide("game", () => session.view);
  diagnostics.provide("calculation", () => ({
    rulesVersion: RULES_VERSION, policyVersion: POLICY_VERSION,
    settings: coordinator.settings, enabled: coordinator.enabled, requestId: coordinator.requestId,
    result: coordinator.result, gpuSupport: coordinator.gpuSupport, velaSupport: coordinator.velaSupport,
    model: modelInfo(coordinator.vela?.info), preparedModel: modelInfo(coordinator.preparedVela?.info), restoreModel: modelInfo(coordinator.restoreVela),
    workers: { cpu: coordinator.cpu?.slots.length || 0, vela: !!coordinator.vela?.worker,
      preparing: !!coordinator.preparedVela?.worker, downloading: !!coordinator.transferVela?.worker },
    cacheAllowed: coordinator.velaCacheAllowed,
  }));
  diagnostics.provide("assets", () => [...assets.records].filter(([, record]) => record.state !== "loaded")
    .map(([id, record]) => ({ id, state: record.state, attempts: record.attempts })));
  diagnostics.provide("page", () => {
    const params = new URLSearchParams(location.search);
    return { loading: !document.querySelector("#loading").hidden, visibility: document.visibilityState,
      ctrlProfile: params.get("CtrlYn")?.toUpperCase() === "Y", noEarlyStop: params.get("noEarlyStop") === "1",
      dialogs: [...document.querySelectorAll("dialog[open]")].map(node => node.className) };
  });
  document.addEventListener("click", event => {
    const control = event.target.closest?.("button,a,input[type=radio]");
    if (!control) return;
    diagnostics.record("ui.click", { control: control.id || control.className,
      action: control.dataset.nav || control.dataset.cardAction,
      choice: ["model", "engine", "usage", "workers", "cache"].includes(control.name) ? { name: control.name, value: control.value } : null });
  }, true);
  diagnostics.record("game.ready", { rulesVersion: RULES_VERSION, policyVersion: POLICY_VERSION, state: session.state });
}
