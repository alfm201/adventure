import { inspectBrowserStorage, deleteStoredItem } from '../../platform/storage.js';
import { confirmAction, toast } from './dialogs.js';
import { diagnostics } from '../../platform/report.js';
import { modelKey } from '../../compute/vela/model.js';
import { setLocalizedText } from '../../localization/index.js';

const size = bytes => bytes < 1000 ? `${bytes} B` : bytes < 1e6 ? `${(bytes / 1000).toFixed(1)} KB` : `${(bytes / 1e6).toFixed(1)} MB`;
const names = { ko: '한국어', en: '영어', ja: '일본어', zh: '중국어' };
export function bindStorageSettings(body, node, { coordinator, voice }) {
  const target = body.querySelector('[data-storage-items]'), status = body.querySelector('[data-storage-status]');
  const refreshButton = body.querySelector('[data-storage-refresh]');
  let epoch = 0, busy = false;
  node.addEventListener('close', () => epoch++, { once: true });
  async function refresh() {
    if (busy) return;
    const current = ++epoch;
    refreshButton.disabled = true;
    status.textContent = '저장된 파일을 확인하고 있습니다.';
    try {
      const result = await inspectBrowserStorage();
      if (!node.open || current !== epoch) return;
      body.querySelector('[data-storage-total]').textContent = size(result.bytes);
      status.textContent = result.unavailable.length ? '일부 저장 공간을 확인할 수 없습니다. 브라우저의 사이트 저장 설정을 확인해 주세요.' : !result.items.length ? '저장된 파일이 없습니다.' : '';
      target.replaceChildren();
      for (const [group, kinds] of [['모델', ['lyra', 'vela']], ['이미지', ['images']], ['음성', ['voice']]]) {
        const items = result.items.filter(item => kinds.includes(item.kind));
        const section = document.createElement('section'); section.className = 'settings-storage-group';
        const title = document.createElement('h4'); title.textContent = group; section.append(title);
        if (!items.length) { const empty = document.createElement('p'); empty.className = 'settings-storage-empty'; empty.textContent = '저장된 파일 없음'; section.append(empty); }
        for (const item of items) {
          const row = document.createElement('div'); row.className = 'settings-storage-item';
          const copy = document.createElement('div'), name = document.createElement('strong'), detail = document.createElement('small');
          name.textContent = item.kind === 'voice' && item.language ? `${names[item.language]} · ${item.voice === 'F' ? '여성' : '남성'}` : item.name;
          setLocalizedText(detail, '{0} · {1} 파일', size(item.bytes), item.files);
          // Names are DOM text; cached metadata and URLs are never trusted HTML.
          if (item.kind === 'voice') name.dataset.voicePack = `${item.language}-${item.voice}`;
          copy.append(name, detail);
          const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '삭제';
          remove.setAttribute('aria-label', `${name.textContent} 삭제`);
          remove.onclick = async () => {
            if (busy) return;
            busy = true; refreshButton.disabled = true;
            target.querySelectorAll('button').forEach(button => button.disabled = true);
            try {
              if (!await confirmAction('저장된 파일 삭제', '선택한 저장 데이터를 삭제할까요? 다음에 필요하면 다시 다운로드합니다. 현재 사용 중인 데이터는 유지됩니다.', { confirmLabel: '삭제' }) || !node.open) return;
              await deleteStoredItem(item);
              if (item.kind === 'lyra') for (const backend of [coordinator?.lyra, coordinator?.preparedLyra]) {
                if (backend?.info) Object.assign(backend.info, { cacheSaved: false, cacheFailed: false, fromCache: false });
              }
              if (item.kind === 'vela') for (const info of [coordinator?.vela?.info, coordinator?.preparedVela?.info, coordinator?.restoreVela]) {
                if (info?.manifest && modelKey(info.manifest) === item.key) Object.assign(info, { cacheSaved: false, cacheFailed: false, cacheIssue: null });
              }
              if (item.kind === 'voice' && voice) {
                if (item.language === voice.settings.language && item.voice === voice.settings.voice) { voice.settings.persist = false; voice.save(); }
                await voice.inspect();
              }
              diagnostics.record('storage.delete', { kind: item.kind, bytes: item.bytes });
              if (node.open) toast('저장된 파일을 삭제했습니다.');
            } catch (error) {
              diagnostics.capture(error, 'storage.delete');
              if (node.open) toast('파일을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.');
            } finally {
              busy = false;
              if (node.open) { target.querySelectorAll('button').forEach(button => button.disabled = false); refreshButton.disabled = false; await refresh(); }
            }
          };
          row.append(copy, remove); section.append(row);
        }
        target.append(section);
      }
    } catch (error) {
      diagnostics.capture(error, 'storage.inspect');
      if (node.open && current === epoch) status.textContent = '저장 공간을 확인하지 못했습니다. 다시 시도해 주세요.';
    } finally { if (node.open && current === epoch) refreshButton.disabled = false; }
  }
  refreshButton.onclick = refresh;
  return { refresh };
}
