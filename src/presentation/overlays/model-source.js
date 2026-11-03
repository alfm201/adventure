import { setLocalizedText, setLocalizedAttribute } from '../../localization/index.js';
import { readModelFile } from '../../compute/model-file.js';

const icons = {
  online: '<path d="M7 16H5a4 4 0 0 1-.6-8A7 7 0 0 1 18 6a5 5 0 0 1 1 10h-2M12 11v10m-4-4 4 4 4-4"/>',
  file: '<path d="M3 7V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v2M3 7h17a1 1 0 0 1 1 1l-3 12H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/>'
};
const icon = kind => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[kind]}</svg>`;
const navigation = () => '<footer><button type="button" class="model-back">이전</button><span></span><button type="button" class="model-cancel">취소</button></footer>';

export function preparationSource(body, { onOnline, onFile, onBack, onCancel }) {
  body.innerHTML = `<p class="model-intro">모델을 가져올 방법을 선택하세요.</p>
    <div class="model-source-options">
      <button type="button" class="model-source-choice" data-source="online">${icon('online')}<span><strong>온라인 다운로드</strong><small>Cloudflare에서 모델을 내려받습니다.</small></span><span class="model-source-arrow" aria-hidden="true">›</span></button>
      <button type="button" class="model-source-choice" data-source="file">${icon('file')}<span><strong>로컬 파일에서 불러오기</strong><small>GitHub Releases에서 받은 모델 파일을 선택합니다.</small></span><span class="model-source-arrow" aria-hidden="true">›</span></button>
    </div>${navigation()}`;
  body.querySelector('[data-source=online]').onclick = onOnline;
  body.querySelector('[data-source=file]').onclick = onFile;
  body.querySelector('.model-back').onclick = onBack;
  body.querySelector('.model-cancel').onclick = onCancel;
  body.querySelector('[data-source=online]').focus({ preventScroll: true });
}

export function preparationFile(body, { name, filename, releaseUrl, manifest, note, onSelect, onBack, onCancel }) {
  body.innerHTML = `<p class="model-intro model-file-intro" translate="no"></p>
    <ol class="model-file-guide" role="list">
      <li><span class="model-file-step" aria-hidden="true">1</span><div><h3>다운로드 페이지 열기</h3>
        <a class="model-release-link" target="_blank" rel="noopener noreferrer"><span>GitHub Releases 열기</span><span aria-hidden="true">↗</span></a></div></li>
      <li><span class="model-file-step" aria-hidden="true">2</span><div class="model-file-download"><h3>모델 파일 다운로드</h3>
        <p class="model-file-instruction"></p><code class="model-file-expected" translate="no"></code><p class="model-file-caution">압축은 풀지 마세요.</p></div></li>
      <li><span class="model-file-step" aria-hidden="true">3</span><div><h3>다운로드한 파일 불러오기</h3>
        <div class="model-file-drop"><button type="button" class="model-file-browse">${icon('file')}<strong>파일 선택</strong><span>또는 여기에 파일을 끌어다 놓으세요.</span></button><input type="file" accept=".gz,application/gzip,application/x-gzip" hidden></div>
        <p class="model-file-status" role="status" aria-live="polite"></p><p class="model-file-name" translate="no" hidden></p></div></li>
    </ol>
    <p class="model-note">선택한 파일은 서버로 전송하지 않습니다.</p>
    <footer><button type="button" class="model-back">이전</button><span></span><button type="button" class="primary" disabled>다음</button><button type="button" class="model-cancel">취소</button></footer>`;
  body.querySelector('.model-file-intro').textContent = name;
  setLocalizedText(body.querySelector('.model-file-instruction'), 'Assets에서 아래 파일을 다운로드하세요.');
  body.querySelector('.model-file-expected').textContent = filename;
  const link = body.querySelector('.model-release-link'); link.href = releaseUrl;
  setLocalizedAttribute(link, 'title', '새 탭에서 열기');
  if (note) { const hint = document.createElement('p'); setLocalizedText(hint, note); body.querySelector('.model-file-download').append(hint); }
  const input = body.querySelector('input[type=file]'), drop = body.querySelector('.model-file-drop');
  const status = body.querySelector('.model-file-status'), primary = body.querySelector('.primary'), label = body.querySelector('.model-file-name');
  let selected, controller;
  const reset = () => { controller?.abort(); selected = null; primary.disabled = true; label.hidden = true; drop.classList.remove('is-valid', 'is-dragging'); };
  const choose = async files => {
    reset(); controller = new AbortController();
    const signal = controller.signal;
    status.classList.remove('is-error');
    if (files.length !== 1) { status.classList.add('is-error'); setLocalizedText(status, '모델 파일을 하나만 선택해 주세요.'); return; }
    const file = files[0];
    setLocalizedText(status, '모델 파일 확인 중');
    try {
      await readModelFile(file, manifest, signal);
      if (signal.aborted) return;
      selected = file; primary.disabled = false; drop.classList.add('is-valid');
      label.textContent = file.name; label.hidden = false;
      setLocalizedText(status, '파일 확인을 마쳤습니다.');
    } catch (error) {
      if (signal.aborted) return;
      status.classList.add('is-error');
      setLocalizedText(status, ['model-file-size', 'model-file-integrity'].includes(error.code)
        ? '현재 모델의 파일이 아닙니다. 위 릴리스의 파일을 압축을 풀지 않고 선택해 주세요.'
        : '파일을 읽지 못했습니다. 파일을 다시 선택해 주세요.');
    }
  };
  body.querySelector('.model-file-browse').onclick = () => input.click();
  input.onchange = () => { const files = [...input.files]; input.value = ''; if (files.length) choose(files); };
  const drag = event => { event.preventDefault(); if (event.dataTransfer?.types.includes('Files')) event.dataTransfer.dropEffect = 'copy'; };
  const receive = event => { event.preventDefault(); choose([...event.dataTransfer.files]); };
  body.addEventListener('dragover', drag); body.addEventListener('drop', receive);
  drop.ondragenter = event => { event.preventDefault(); drop.classList.add('is-dragging'); };
  drop.ondragleave = event => { if (!drop.contains(event.relatedTarget)) drop.classList.remove('is-dragging'); };
  primary.onclick = () => { if (selected) onSelect(selected); };
  body.querySelector('.model-back').onclick = onBack;
  body.querySelector('.model-cancel').onclick = onCancel;
  link.focus({ preventScroll: true });
  return { dispose() { reset(); body.removeEventListener('dragover', drag); body.removeEventListener('drop', receive); } };
}
