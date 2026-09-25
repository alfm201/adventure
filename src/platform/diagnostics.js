(function (scope) {
  "use strict";
  if (scope.adventureDiagnostics) return;
  var events = [], errors = [], providers = {}, listeners = [], startedAt = new Date().toISOString();
  var eventLimit = 160, errorLimit = 24, dropped = 0, sequence = 0;
  function cleanText(value) {
    return String(value).replace(/https?:\/\/[^\s<>"')]+/gi, function (url) {
      return url.replace(/[?#].*$/, "").replace(/(https?:\/\/)[^/@]+:[^/@]+@/, "$1");
    }).replace(/file:\/\/[^\s<>"')]+/gi, "[local file]")
      .replace(/\b[A-Z]:[\\/][^\r\n<>"']+/gi, "[local path]").slice(0, 6000);
  }
  function safe(value, depth, seen) {
    if (value === null || value === undefined) return value === undefined ? null : value;
    if (typeof value === "string") return cleanText(value);
    if (typeof value === "number") return isFinite(value) ? value : String(value);
    if (typeof value === "boolean") return value;
    if (typeof value !== "object") return "[unsupported]";
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value) || (typeof ImageData !== "undefined" && value instanceof ImageData) || (typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) || (typeof HTMLCanvasElement !== "undefined" && value instanceof HTMLCanvasElement) || (typeof HTMLVideoElement !== "undefined" && value instanceof HTMLVideoElement) || (typeof MediaStream !== "undefined" && value instanceof MediaStream) || (typeof MediaStreamTrack !== "undefined" && value instanceof MediaStreamTrack) || (typeof OffscreenCanvas !== "undefined" && value instanceof OffscreenCanvas)) return "[binary/media omitted]";
    if (depth > 7) return "[depth limit]";
    if (seen.indexOf(value) >= 0) return "[circular]";
    seen.push(value);
    var output = Array.isArray(value) ? [] : {}, keys = Object.keys(value).slice(0, Array.isArray(value) ? eventLimit : 64);
    if (value instanceof Error || Object.prototype.toString.call(value) === "[object Error]") keys = ["name", "message", "stack", "code"];
    keys.forEach(function (key) {
      if (/^(cookie|password|token|authorization|localStorage|sessionStorage|search|hash)$/i.test(key)) return;
      try { output[key] = safe(value[key], depth + 1, seen); } catch (_) { output[key] = "[unavailable]"; }
    });
    seen.pop(); return output;
  }
  function copy(value) { try { return safe(value, 0, []); } catch (_) { return "[unavailable]"; } }
  function record(kind, data) {
    try {
      events.push({ id: ++sequence, at: new Date().toISOString(), kind: cleanText(kind), data: copy(data) });
      if (events.length > eventLimit) { events.shift(); dropped++; }
    } catch (_) {}
  }
  function capture(error, source, context, notify) {
    try {
      if (error && error.name === "AbortError") return;
      var detail = { name: cleanText(error && error.name || "Error"), message: cleanText(error && error.message || error || "Unknown error"),
        stack: cleanText(error && error.stack || ""), code: copy(error && error.code) };
      var previous = errors[errors.length - 1], now = new Date().toISOString();
      if (previous && previous.source === source && previous.error.message === detail.message && previous.error.stack === detail.stack) {
        previous.count++; previous.lastAt = now; return;
      }
      errors.push({ at: now, lastAt: now, source: cleanText(source || "unknown"), error: detail, context: copy(context), count: 1 });
      if (errors.length > errorLimit) errors.shift();
      record("error", { source: source, error: detail, context: context });
      if (notify) listeners.slice().forEach(function (listener) { try { listener(); } catch (_) {} });
    } catch (_) {}
  }
  function report() {
    var nav = scope.navigator || {}, location = scope.location || {}, perf = scope.performance || {}, snapshots = {};
    Object.keys(providers).forEach(function (name) {
      try { snapshots[name] = copy(providers[name]()); }
      catch (error) { snapshots[name] = { unavailable: true, error: copy(error) }; }
    });
    return copy({ schemaVersion: 2, app: "Adventure v2", build: "2026.09.24.5", startedAt: startedAt,
      exportedAt: new Date().toISOString(), page: { path: location.pathname || "", secureContext: !!scope.isSecureContext },
      browser: { userAgent: nav.userAgent, language: nav.language, online: nav.onLine, hardwareConcurrency: nav.hardwareConcurrency,
        deviceMemoryEstimateGiB: nav.deviceMemory, deviceMemorySource: "navigator.deviceMemory",
        viewport: { width: scope.innerWidth, height: scope.innerHeight, pixelRatio: scope.devicePixelRatio },
        capabilities: { worker: !!scope.Worker, webAssembly: !!scope.WebAssembly, webGPU: !!nav.gpu,
          storage: !!(nav.storage && nav.storage.getDirectory), decompression: !!scope.DecompressionStream },
        memory: perf.memory ? { usedBytes: perf.memory.usedJSHeapSize, totalBytes: perf.memory.totalJSHeapSize, limitBytes: perf.memory.jsHeapSizeLimit } : null },
      snapshots: snapshots, errors: errors, events: events, retention: { eventLimit: eventLimit, errorLimit: errorLimit, droppedEvents: dropped } });
  }
  function download() {
    var doc = scope.document, url, anchor;
    try {
      var blob = new Blob([JSON.stringify(report(), null, 2)], { type: "application/json;charset=utf-8" });
      var name = "adventure-debug-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
      if (scope.navigator && scope.navigator.msSaveOrOpenBlob) { scope.navigator.msSaveOrOpenBlob(blob, name); return true; }
      url = scope.URL.createObjectURL(blob); anchor = doc.createElement("a"); anchor.href = url; anchor.download = name;
      var dialogs = doc.querySelectorAll("dialog[open]");
      (dialogs[dialogs.length - 1] || doc.body).appendChild(anchor); anchor.click(); anchor.parentNode.removeChild(anchor);
      setTimeout(function () { scope.URL.revokeObjectURL(url); }, 60000);
      return true;
    } catch (error) {
      if (anchor && anchor.parentNode) anchor.parentNode.removeChild(anchor);
      if (url) scope.URL.revokeObjectURL(url);
      capture(error, "diagnostics.download"); return false;
    }
  }
  scope.adventureDiagnostics = {
    record: record, capture: capture, report: report, download: download,
    provide: function (name, provider) { providers[name] = provider; },
    subscribe: function (listener) { listeners.push(listener); return function () { var index = listeners.indexOf(listener); if (index >= 0) listeners.splice(index, 1); }; }
  };
  if (scope.addEventListener && scope.document) {
    scope.addEventListener("error", function (event) {
      var target = event.target;
      if (target && target !== scope && (target.src || target.href)) {
        capture(new Error("Resource failed"), "resource", { tag: target.tagName, url: target.src || target.href });
      } else capture(event.error || new Error(event.message || "Script error"), "window.error", { file: event.filename, line: event.lineno, column: event.colno }, true);
    }, true);
    scope.addEventListener("unhandledrejection", function (event) { capture(event.reason, "unhandledrejection", null, true); });
  }
  record("boot.start");
}(typeof window !== "undefined" ? window : globalThis));
