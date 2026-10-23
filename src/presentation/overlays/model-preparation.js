import { setLocalizedText } from '../../localization/index.js';
// Shared presentation for model preparation; storage and engines stay model-specific.
export const megabytes = bytes => `${Math.round(bytes / 1e6).toLocaleString()} MB`;
export const memorySize = bytes => bytes >= 1e9 ? `${(bytes / 1e9).toLocaleString()} GB` : megabytes(bytes);
export const memoryText = manifest => manifest.recommendedMemoryBytes
  ? `메모리 여유 약 ${memorySize(manifest.recommendedMemoryBytes)} 이상 권장 · 기기별 차이`
  : '메모리 사용량은 기기와 게임 상태에 따라 달라집니다.';
const preparationNavigation = () => '<footer><button type="button" class="model-back">이전</button><span></span><button type="button" class="primary">다음</button></footer>';

export function preparationConsent({ bytes, intro, memory = '', local = false, resident = false, supported = true, allowed = false, storage = true, storageHint = false, saveHint = '' }) {
  return `<p class="model-intro">${intro}</p>
    <div class="model-size"><strong>${megabytes(bytes)} <span>${resident || local ? '모델 파일' : '다운로드'}</span></strong>${saveHint ? `<span>${saveHint}</span>` : ''}</div>
    ${memory ? `<p class="model-memory">${memory}</p>` : ''}
    ${storage ? `<p class="model-question">${local ? '모델을 브라우저에도 저장할까요?' : '다음에도 다운로드 없이 사용할까요?'}</p>
    <div class="cache-options" role="radiogroup" aria-label="모델 저장 동의">
      <label><input type="radio" name="cache" value="yes" ${supported ? '' : 'disabled'} ${supported && allowed ? 'checked' : ''}><span><strong>이 브라우저에 저장</strong><small>저장 공간과 사용 가능 여부를 확인합니다.</small></span></label>
      <label><input type="radio" name="cache" value="no" ${supported && allowed ? '' : 'checked'}><span><strong>이번에만 사용</strong><small>${local ? '다음 접속 때 이 PC의 파일을 다시 읽습니다.' : '다음 접속 때 다시 다운로드합니다.'}</small></span></label>
    </div><div class="model-support cache-support"></div>
    ${storageHint ? '<p class="model-note">저장된 모델은 설정의 저장 공간에서 삭제할 수 있습니다.</p>' : ''}
    <p class="model-note">${local ? '브라우저 저장 공간을 별도로 사용합니다.' : '브라우저 데이터 정리나 저장 공간 부족 시 다시 다운로드할 수 있습니다.'}</p>` : ''}
    ${preparationNavigation()}`;
}

export function preparationProgress({ transferLabel = '다운로드', memory = '' } = {}) {
  return `<div class="model-loading" aria-live="polite"><p class="model-loading-title">준비하고 있습니다.</p><p class="model-loading-detail">잠시만 기다려 주세요.</p>
    <div class="model-meter"><span>${transferLabel}</span><strong class="model-transfer">준비 중</strong></div><progress class="model-download" max="1" value="0" aria-label="${transferLabel === '파일 읽기' ? '모델 파일 읽기' : '모델 다운로드'}"></progress>
    <p class="model-transfer-detail" aria-live="off" hidden></p>
    <div class="model-meter"><span>모델 준비</span><strong class="model-prepared">대기 중</strong></div><progress class="model-prepare" max="1" value="0" aria-label="모델 준비"></progress>
    <div class="model-working" role="status" hidden><span class="model-working-icon" aria-hidden="true"></span><span class="model-working-stage"></span></div>
    </div>${memory ? `<p class="model-memory">${memory}</p>` : ''}<footer><button type="button" class="model-back">이전</button><span></span><button type="button" class="model-cancel">취소</button></footer>`;
}

// Unknown-duration work has no percentage. Only measured transfers use a bar.
export function preparationStage(body, stage, step, total) {
  const working = body.querySelector('.model-working');
  working.hidden = !stage;
  const label = working.querySelector('.model-working-stage');
  label.replaceChildren();
  if (stage) {
    // Translate the full message independently of the numbered step suffix.
    const message = document.createElement('span');
    setLocalizedText(message, stage);
    label.append(message);
    if (step && total) label.append(` (${step}/${total})`);
  }
  body.querySelector('.model-prepare').hidden = true;
  body.querySelector('.model-prepared').closest('.model-meter').hidden = true;
  body.querySelector('.model-download').hidden = !!stage;
  body.querySelector('.model-transfer').closest('.model-meter').hidden = !!stage;
  if (stage) body.querySelector('.model-transfer-detail').hidden = true;
}

export function preparationReady({ cacheSaved, cacheFailed, local = false, initial = false }) {
  return `<div class="model-ready"><span class="model-ready-mark" aria-hidden="true">✓</span><strong>이제 다음 선택을 비교할 수 있습니다.</strong><p>${cacheSaved ? '이 브라우저에 저장된 모델을 다음에도 사용합니다.' : '이번 접속 동안 모델을 사용할 수 있습니다.'}</p></div>${cacheFailed ? `<p class="model-cache-warning">모델을 저장하지 못했습니다. ${local ? '다음 접속 때 이 PC의 파일을 다시 읽습니다.' : '다음 접속 때 다시 다운로드할 수 있습니다.'}</p><div class="model-support cache-support"></div>` : ''}<footer><button type="button" class="model-back">이전</button><span></span><button type="button" class="primary">${initial ? '시작' : '적용'}</button></footer>`;
}
