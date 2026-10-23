import { dialog, paintChoices, toast, canOpenDialog } from './dialogs.js';
import { preparationConsent, preparationProgress, preparationReady, preparationStage, megabytes, memorySize } from './model-preparation.js';
import { downloadProgress } from './download-progress.js';
import { showSupport } from '../components/support.js';
import { showDiagnostics } from './diagnostics.js';
import { cacheAllowed, rememberCacheChoice, hasSavedPackage } from '../../compute/lyra/package.js';
import { diagnostics } from '../../platform/report.js';
import { LOCAL_MODEL } from '../../compute/lyra/model.js';
import { lyraMemory } from '../../content/models.js';

export function showLyraPreparation(coordinator, { device, usage, initial, persist = cacheAllowed(), onBack, onCancel, onFinish, parent = null }) {
  if (!canOpenDialog(parent)) return;
  persist = !LOCAL_MODEL && persist;
  const resume = coordinator.suspend(), body = document.createElement('div');
  let busy = false;
  const node = dialog('LYRA 준비', body, { className: 'model-dialog lyra-preparation-dialog', parent, closeOnOutside: () => !busy });
  const heading = node.querySelector('h2'), bytes = 31029778;
  const memory = () => {
    const gpu = device === 'gpu' || device === 'auto' && coordinator.lyraGpuSupport.available;
    const budget = lyraMemory[gpu ? 'gpu' : 'cpu'][usage];
    return `RAM 여유 약 ${memorySize(budget.ram)} 이상 권장 · 기기별 차이` + (gpu ? `<br>VRAM 여유 약 ${memorySize(budget.gpu)} 이상 권장 · 기기별 차이` : '');
  };
  let controller, transfer, epoch = 0, handedOff = false, ready = false;
  const focusPrimary = () => body.querySelector('.primary:not(:disabled)')?.focus({ preventScroll: true });
  const stop = () => { epoch++; controller?.abort(); transfer?.dispose(); };
  node.addEventListener('closing', stop);
  const back = () => { handedOff = true; node.addEventListener('close', () => onBack(persist), { once: true }); node.close(); };
  node.addEventListener('close', () => {
    stop(); resume();
    if (!ready) coordinator.cancelModelPreparation();
    if (handedOff) return;
    if (ready) { coordinator.configure({ model: 'lyra', lyraDevice: device, lyraUsage: usage }); onFinish?.(); return; }
    if (onCancel) onCancel();
    else { if (coordinator.enabled) coordinator.recalculate(); onFinish?.(); }
  }, { once: true });
  function consent() {
    busy = false;
    ready = false;
    stop(); coordinator.cancelModelPreparation();
    heading.textContent = 'LYRA 준비';
    const resident = coordinator.lyra?.ready;
    body.innerHTML = preparationConsent({ bytes, resident, local: LOCAL_MODEL, storage: !LOCAL_MODEL, supported: !!globalThis.caches, allowed: persist, storageHint: !LOCAL_MODEL,
      intro: resident ? '모델은 준비되어 있습니다. 다음 접속을 위한 저장 여부를 선택하세요.' : LOCAL_MODEL ? '이 PC의 모델 파일을 불러와 준비합니다.' : '전체 모델을 한 번 내려받아 준비합니다.',
      memory: memory() });
    const packageNote = document.createElement('p'); packageNote.className = 'model-note';
    packageNote.textContent = LOCAL_MODEL ? '모델과 CPU/GPU 엔진을 한 번에 불러옵니다.' : '모델과 CPU/GPU 엔진을 한 번에 내려받습니다.';
    body.querySelector('.model-size').after(packageNote);
    if (!globalThis.caches) showSupport(body.querySelector('.cache-support'), 'storage-unsupported', { target: '모델 저장' });
    persist = !LOCAL_MODEL && body.querySelector('[name=cache]:checked')?.value === 'yes';
    body.onchange = change;
    body.querySelector('.model-back').onclick = back;
    const primary = body.querySelector('.primary'); primary.textContent = '모델 불러오기'; primary.onclick = load;
    paintChoices(body); focusPrimary();
  }
  function change() { const selected = body.querySelector('[name=cache]:checked'); if (selected) persist = selected.value === 'yes'; }
  async function load() {
    busy = true;
    ready = false;
    change(); stop(); controller = new AbortController();
    const current = epoch, signal = controller.signal;
    rememberCacheChoice(persist);
    heading.textContent = 'LYRA 준비';
    body.innerHTML = preparationProgress({ transferLabel: LOCAL_MODEL ? '파일 읽기' : '다운로드', memory: memory() });
    preparationStage(body, '모델 파일 확인 중', 1, 3);
    body.querySelector('.model-back').onclick = consent;
    body.querySelector('.model-cancel').onclick = () => node.close();
    transfer = downloadProgress(body.querySelector('.model-transfer-detail'));
    try {
      const info = await coordinator.prepareLyra({ device, usage, persist, signal, onProgress: data => {
        if (signal.aborted || !node.open || current !== epoch) return;
        transfer.update(data);
        const downloading = data.phase === 'download';
        body.querySelector('.model-loading-title').textContent = downloading && !LOCAL_MODEL ? 'LYRA를 내려받는 중' : 'LYRA를 불러오는 중';
        body.querySelector('.model-loading-detail').textContent = '준비가 끝나면 바로 사용할 수 있습니다.';
        const measured = downloading && Number.isFinite(data.fraction);
        preparationStage(body, measured ? null : data.phase === 'initialize' ? '실행 환경 준비 중' : data.phase === 'warmup' ? '동작 확인 중' : data.phase === 'load' ? '모델 파일 준비 중' : '모델 파일 확인 중', data.phase === 'initialize' ? 2 : data.phase === 'warmup' ? 3 : 1, 3);
        if (measured) {
          body.querySelector('.model-meter span').textContent = LOCAL_MODEL ? '파일 읽기' : '다운로드';
          body.querySelector('.model-download').value = data.fraction ?? 0;
          body.querySelector('.model-transfer').textContent = `${megabytes(data.received ?? bytes)} / ${megabytes(bytes)}`;
        }
      }});
      if (signal.aborted || !node.open || current !== epoch) return;
      transfer.dispose(); heading.textContent = 'LYRA 준비 완료';
      ready = true;
      busy = false;
      body.innerHTML = preparationReady({ ...info, local: LOCAL_MODEL, initial });
      if (info.cacheFailed) {
        showSupport(body.querySelector('.cache-support'), 'storage-failed', { target: '모델 저장' });
        toast('모델을 저장하지 못했습니다. 이번에는 사용할 수 있습니다.');
      }
      body.querySelector('.model-back').onclick = consent;
      body.querySelector('.primary').onclick = () => node.close();
      focusPrimary();
    } catch (error) {
      if (signal.aborted || !node.open || current !== epoch) return;
      transfer.dispose(); diagnostics.capture(error, 'lyra.prepare');
      busy = false;
      heading.textContent = '모델을 준비하지 못했습니다';
      body.innerHTML = `<p class="model-intro">${device === 'gpu' && error.code === 'lyra-runtime' ? 'GPU를 준비하지 못했습니다. 자동 또는 CPU를 선택해 주세요.' : '모델을 준비하지 못했습니다. 다시 시도해 주세요.'}</p><footer><button type="button" class="model-back">이전</button><button type="button" class="diagnostics-button">진단 정보</button><span></span><button type="button" class="primary">다시 시도</button></footer>`;
      body.querySelector('.model-back').onclick = back;
      body.querySelector('.diagnostics-button').onclick = showDiagnostics;
      body.querySelector('.primary').onclick = load;
      focusPrimary();
    }
  }
  async function enter() {
    if (!persist) { consent(); return; }
    busy = true;
    const current = epoch;
    body.innerHTML = preparationProgress({ transferLabel: '파일 읽기', memory: memory() });
    preparationStage(body, '모델 파일 확인 중', 1, 3);
    body.querySelector('.model-back').onclick = consent;
    body.querySelector('.model-cancel').onclick = () => node.close();
    const saved = await hasSavedPackage();
    if (!node.open || current !== epoch) return;
    if (saved) load();
    else consent();
  }
  enter(); return node;
}
