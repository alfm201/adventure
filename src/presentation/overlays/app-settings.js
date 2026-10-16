import { diagnostics } from "../../platform/report.js";
import { dialog, canOpenDialog } from './dialogs.js';
import { showModes } from './modes.js';
import { showVoiceSettings } from './voice.js';
import { bindStorageSettings } from './storage-settings.js';
const icons = {
  general: '<path d="m9 3-.6 2.1-1.8 1L4.5 6.5 3 9l1.5 1.5v3L3 15l1.5 2.5 2.1-.6 1.8 1L9 20h3l.6-2.1 1.8-1 2.1.6L18 15l-1.5-1.5v-3L18 9l-1.5-2.5-2.1.6-1.8-1L12 3Z" transform="translate(1.5 .5)"/><circle cx="12" cy="12" r="3"/>',
  storage: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',

  mode: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h4m-2-2v4m6 4h.01m3-3h.01"/>',
  voice: '<path d="m11 5-5 4H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
export function showAppSettings(session, assist, voice, { parent = null, coordinator = voice?.coordinator } = {}) {
  if (!canOpenDialog(parent)) return;
  const body = document.createElement('div');
  body.className = 'app-settings';
  const tabs = [['general','일반'],['game','게임'],['voice','음성'],['storage','저장 공간'],['info','정보']];
  const prefix = 'settings-' + Math.random().toString(36).slice(2);
  body.innerHTML = `<nav class="settings-tabs" role="tablist" aria-label="설정 카테고리">${tabs.map(([id,label],i) => `<button type="button" role="tab" id="${prefix}-${id}-tab" aria-controls="${prefix}-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-settings-tab="${id}">${icon(id === 'game' ? 'mode' : id)}<span>${label}</span></button>`).join('')}</nav>
  <section class="settings-panel" role="tabpanel" id="${prefix}-general" aria-labelledby="${prefix}-general-tab" data-settings-panel="general"><section class="settings-language">
    <div class="settings-section-heading"><h3 id="page-language-title">페이지 언어</h3></div>
    <fieldset id="page-language" class="settings-languages" aria-labelledby="page-language-title">
      ${[['ko','한국어','KO'],['en','English','EN'],['ja','日本語','JA'],['zh','简体中文','ZH-CN']].map(([id,name,detail]) => `<label class="settings-language-option"><input type="radio" name="page-language" value="${id}"><span lang="${id==='zh'?'zh-Hans':id}" translate="no">${name}</span><small translate="no">${detail}</small><svg class="settings-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg></label>`).join('')}
    </fieldset><p class="settings-persistence" data-language-storage></p>
  </section>
  </section>
  <section class="settings-panel" role="tabpanel" id="${prefix}-game" aria-labelledby="${prefix}-game-tab" data-settings-panel="game" hidden>

    <div class="settings-destinations"><button type="button" class="settings-destination" data-mode-settings><span class="settings-destination-copy"><strong>모드 변경</strong><small data-current-mode></small></span><span class="settings-chevron" aria-hidden="true">›</span></button></div>
  </section>
  <section class="settings-panel" role="tabpanel" id="${prefix}-voice" aria-labelledby="${prefix}-voice-tab" data-settings-panel="voice" hidden>

    <div class="settings-destinations"><button type="button" class="settings-destination" data-voice-settings><span class="settings-destination-copy"><strong>음성 설정</strong><small>안내 언어·목소리·볼륨</small></span><span class="settings-voice-state"></span><span class="settings-chevron" aria-hidden="true">›</span></button></div>
  </section>
  <section class="settings-panel" role="tabpanel" id="${prefix}-storage" aria-labelledby="${prefix}-storage-tab" data-settings-panel="storage" hidden>
    <div class="settings-storage-header"><button type="button" data-storage-refresh>새로고침</button></div>
    <div class="settings-storage-summary"><span>저장된 파일 용량</span><strong data-storage-total translate="no">—</strong></div>
    <p class="settings-storage-status" role="status" data-storage-status></p><div data-storage-items></div>
    <p class="settings-footnote">파일 용량 기준이며 브라우저가 자동 관리하는 임시 캐시는 포함하지 않습니다.</p>
    <p class="settings-footnote">삭제해도 현재 사용 중인 모델·이미지·음성은 유지됩니다. 다음에 필요하면 다시 다운로드합니다.</p>
  </section>
  <section class="settings-panel" role="tabpanel" id="${prefix}-info" aria-labelledby="${prefix}-info-tab" data-settings-panel="info" hidden>
    <div class="settings-about"><span class="settings-about-mark" translate="no">A</span><h3 translate="no">Adventure v2</h3><p>페이지 버전</p><strong data-page-version translate="no"></strong></div>
    <p class="settings-footnote">진단 정보에도 동일한 페이지 버전이 기록됩니다.</p>
  </section>`;
  body.querySelector('[data-page-version]').textContent = diagnostics.build;
  body.querySelector('[data-current-mode]').textContent = `현재 모드: ${{manual:'수동',automatic:'자동',assist:'어시스트'}[session.mode]}`;
  body.querySelector('.settings-voice-state').textContent = voice?.enabled ? '켜짐' : '꺼짐';
  const update = () => {
    for (const input of body.querySelectorAll('[name="page-language"]')) input.checked = input.value === globalThis.adventureI18n.language;
    body.querySelector('[data-language-storage]').textContent = globalThis.adventureI18n.persistent === false
      ? '브라우저 저장이 제한되어 이번 접속에만 적용됩니다.' : '선택한 언어는 이 브라우저에 저장되어 다음 접속에도 유지됩니다.';
  };
  body.querySelector('#page-language').onchange = event => {
    if (event.target.matches('input')) globalThis.adventureI18n.setLanguage(event.target.value);
    update();
  };
  update();
  const node = dialog('설정', body, {className:'app-settings-dialog',parent});
  const storage = bindStorageSettings(body, node, { coordinator, voice });
  function selectTab(id, focus = false) {
    for (const tab of body.querySelectorAll('[role=tab]')) {
      const selected = tab.dataset.settingsTab === id;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus({ preventScroll: true });
      if (selected) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    for (const panel of body.querySelectorAll('[data-settings-panel]')) panel.hidden = panel.dataset.settingsPanel !== id;
    if (id === 'storage') storage.refresh();
  }
  const tabButtons = [...body.querySelectorAll('[role=tab]')];
  const layout = matchMedia('(min-width: 600px)');
  const updateOrientation = () => body.querySelector('[role=tablist]').setAttribute('aria-orientation', layout.matches ? 'vertical' : 'horizontal');
  updateOrientation(); layout.addEventListener('change', updateOrientation);
  node.addEventListener('close', () => layout.removeEventListener('change', updateOrientation), { once: true });
  for (const [i, tab] of tabButtons.entries()) {
    tab.onclick = () => selectTab(tab.dataset.settingsTab);
    tab.onkeydown = event => {
      const nextKey = layout.matches ? 'ArrowDown' : 'ArrowRight', previousKey = layout.matches ? 'ArrowUp' : 'ArrowLeft';
      const next = event.key === nextKey ? (i + 1) % tabs.length : event.key === previousKey ? (i + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
      if (next === null) return;
      event.preventDefault(); selectTab(tabs[next][0], true);
    };
  }
  const restore = () => {
    if (parent?.open) parent.querySelector('.model-settings-entry')?.focus({preventScroll:true});
  };
  const navigate = open => {
    if (!canOpenDialog(node)) return;
    const child = open();
    child?.addEventListener('close', () => {
      if (!node.open) return;
      body.querySelector('[data-current-mode]').textContent = `현재 모드: ${{manual:'수동',automatic:'자동',assist:'어시스트'}[session.mode]}`;
      body.querySelector('.settings-voice-state').textContent = voice?.enabled ? '켜짐' : '꺼짐';
    }, {once:true});
  };
  body.querySelector('[data-mode-settings]').onclick = () => navigate(() => showModes(session, assist, {voice,parent:node}));
  body.querySelector('[data-voice-settings]').onclick = () => navigate(() => showVoiceSettings(voice,{parent:node}));
  node.addEventListener('close', restore, {once:true});
  return node;
}
