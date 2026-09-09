let probe, timer;
const checked = new Promise((resolve, reject) => {
  probe = new Worker(new URL("./probe-worker.js", import.meta.url), { type: "module" });
  timer = setTimeout(() => reject(Error("브라우저 응답을 확인하지 못했습니다. 다시 시도해 주세요.")), 6000);
  probe.onmessage = ({ data }) => data === 73 ? resolve() : reject(Error("이 브라우저에서는 이전 버전을 이용해 주세요."));
  probe.onerror = event => { event.preventDefault(); reject(Error("이 브라우저에서는 이전 버전을 이용해 주세요.")); };
});
checked.then(() => import("./main.js"))
  .then(() => window.adventureBoot.ready())
  .catch(error => { window.adventureDiagnostics?.capture(error, "boot.import"); console.error("Game loading failed", error); window.adventureBoot.fail("브라우저와 연결 상태를 확인한 뒤 다시 시도하거나 이전 버전을 이용해 주세요."); })
  .finally(() => { clearTimeout(timer); probe?.terminate(); });
