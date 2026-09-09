(function () {
  var script = document.currentScript || document.scripts[document.scripts.length - 1];
  var base = script.src.slice(0, script.src.lastIndexOf("/") + 1);
  var link = document.getElementById("legacy-link");
  link.href = link.href + location.search + location.hash;
  var timer, failed = false;
  window.adventureBoot = {
    ready: function () { clearTimeout(timer); if (!failed && window.adventureDiagnostics) window.adventureDiagnostics.record("boot.ready"); },
    fail: function (message) {
      failed = true;
      clearTimeout(timer);
      document.getElementById("loading-status").textContent = "화면을 준비하지 못했습니다.";
      document.getElementById("loading-detail").textContent = message || "브라우저를 업데이트하거나 이전 버전을 이용해 주세요.";
      document.getElementById("loading-progress").removeAttribute("value");
      document.getElementById("loading-percent").textContent = "";
      document.getElementById("boot-retry").hidden = false;
      if (window.adventureDiagnostics) {
        window.adventureDiagnostics.capture(new Error(message || "Boot failed"), "boot.failure");
        document.getElementById("boot-diagnostics").hidden = false;
      }
    }
  };
  document.getElementById("boot-retry").onclick = function () { location.reload(); };
  document.getElementById("boot-diagnostics").onclick = function () {
    if (window.adventureDiagnostics && !window.adventureDiagnostics.download())
      document.getElementById("loading-detail").textContent = "파일을 저장하지 못했습니다. 브라우저의 다운로드 설정을 확인해 주세요.";
  };
  if (!("noModule" in document.createElement("script")) || !window.Promise || !window.fetch || !window.AbortController || !window.Worker) {
    window.adventureBoot.fail("이 브라우저에서는 이전 버전을 이용할 수 있습니다.");
    return;
  }
  var entry = document.createElement("script");
  entry.type = "module";
  entry.src = base + "start.js";
  entry.onerror = function () { window.adventureBoot.fail(); };
  timer = setTimeout(function () { window.adventureBoot.fail("연결을 확인하고 다시 시도하거나 이전 버전을 이용해 주세요."); }, 20000);
  document.body.appendChild(entry);
}());
