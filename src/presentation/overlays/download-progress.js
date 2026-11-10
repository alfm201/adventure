import { message, setLocalizedText } from '../../localization/index.js';
const remainingTime = seconds => {
  const value = Math.max(1, Math.ceil(seconds));
  if (value < 60) return message('{0}초', value);
  if (value < 3600) return message('{0}분 {1}초', Math.floor(value / 60), value % 60);
  const minutes = Math.ceil(value / 60);
  return message('{0}시간 {1}분', Math.floor(minutes / 60), minutes % 60);
};

export function downloadProgress(element, onFile) {
  let alternative;
  if (onFile) {
    alternative = document.createElement('div');
    alternative.className = 'model-download-alternative';
    alternative.hidden = true;
    alternative.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="M10 9v5m0-8v.3"/></svg><div><strong>다운로드가 오래 걸리나요?</strong><p>GitHub Releases에서 받은 모델 파일도 사용할 수 있습니다.</p><button type="button" class="model-download-link"><span>로컬 파일에서 불러오기</span><span aria-hidden="true">→</span></button></div>`;
    alternative.querySelector('button').onclick = onFile;
    element.after(alternative);
  }
  let samples = [], received = 0, total = 0, changedAt = 0, slowSince, timer;
  const stop = () => {
    clearInterval(timer);
    timer = undefined;
    slowSince = undefined;
    if (alternative) alternative.hidden = true;
  };
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
    const idle = now - changedAt;
    const remaining = total > received && speed > 0 ? (total - received) / speed : 0;
    if (alternative) {
      if (idle < 5000 && elapsed >= 1000 && remaining >= 300) slowSince ??= now;
      else slowSince = undefined;
      alternative.hidden = !(idle >= 10000 || (slowSince !== undefined && now - slowSince >= 10000));
    }
    if (idle >= 5000) element.textContent = "응답 대기 중";
    else if (elapsed < 1000 || speed <= 0) element.textContent = "속도 확인 중";
    else {
      const rate = speed >= 1e6 ? `${(speed / 1e6).toFixed(1)} MB/s` : `${Math.max(1, Math.round(speed / 1000))} KB/s`;
      if (total > received) setLocalizedText(element, '{0} · 약 {1} 남음', rate, remainingTime(remaining));
      else element.textContent = rate;
    }
  };
  return {
    update(data) {
      if (data.phase === "prepare" && samples.length) {
        received = total; render(); return;
      }
      if (data.phase !== "download") { reset(); return; }
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
