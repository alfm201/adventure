const remainingTime = seconds => {
  const value = Math.max(1, Math.ceil(seconds));
  if (value < 60) return `${value}초`;
  if (value < 3600) return `${Math.floor(value / 60)}분 ${value % 60}초`;
  const minutes = Math.ceil(value / 60);
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
};

export function downloadProgress(element) {
  let samples = [], received = 0, total = 0, changedAt = 0, timer;
  const stop = () => { clearInterval(timer); timer = undefined; };
  const reset = () => {
    stop(); samples = []; received = 0; total = 0;
    element.hidden = true; element.textContent = "";
  };
  const render = () => {
    if (!samples.length) return;
    element.hidden = false;
    if (total > 0 && received >= total) {
      element.textContent = "다운로드 완료"; stop(); return;
    }
    const now = performance.now();
    while (samples.length > 1 && samples[1].time <= now - 5000) samples.shift();
    const elapsed = now - samples[0].time;
    const speed = elapsed > 0 ? (received - samples[0].bytes) * 1000 / elapsed : 0;
    if (now - changedAt >= 5000) element.textContent = "응답 대기 중";
    else if (elapsed < 1000 || speed <= 0) element.textContent = "속도 확인 중";
    else {
      const rate = speed >= 1e6 ? `${(speed / 1e6).toFixed(1)} MB/s` : `${Math.max(1, Math.round(speed / 1000))} KB/s`;
      element.textContent = rate + (total > received ? ` · 약 ${remainingTime((total - received) / speed)} 남음` : "");
    }
  };
  return {
    update(data) {
      if (data.phase === "retry" || data.phase === "engine") { reset(); return; }
      if (data.phase === "prepare" && samples.length) {
        received = total; render(); return;
      }
      if (data.phase !== "download") return;
      if (!Number.isFinite(data.received) || data.received < 0) return;
      if (data.received < received) reset();
      const now = performance.now();
      if (!samples.length || data.received > received) changedAt = now;
      received = data.received;
      total = Number.isFinite(data.total) && data.total > 0 ? data.total : 0;
      if (!samples.length || now - samples[samples.length - 1].time >= 250) samples.push({ time: now, bytes: received });
      if (!timer) timer = setInterval(render, 500);
      render();
    },
    dispose: stop,
  };
}
