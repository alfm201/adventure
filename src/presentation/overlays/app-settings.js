import { dialog } from './dialogs.js';
import { showModes } from './modes.js';
import { showVoiceSettings } from './voice.js';
const icons = {
  language: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18M12 3c-5 5-5 13 0 18"/>',
  mode: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h4m-2-2v4m6 4h.01m3-3h.01"/>',
  voice: '<path d="m11 5-5 4H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
export function showAppSettings(session, assist, voice, { parent = null } = {}) {
  if ([...document.querySelectorAll('dialog[open]')].some(node => node !== parent)) return;
  const body = document.createElement('div');
  body.className = 'app-settings';
  body.innerHTML = `<section class="settings-language">
    <div class="settings-section-heading"><span class="settings-symbol">${icon('language')}</span><div><h3 id="page-language-title">페이지 언어</h3><p>화면에 표시할 언어를 선택하세요.</p></div></div>
    <fieldset id="page-language" class="settings-languages" aria-labelledby="page-language-title">
      ${[['ko','한국어','KO'],['en','English','EN'],['ja','日本語','JA'],['zh','简体中文','ZH-CN']].map(([id,name,detail]) => `<label class="settings-language-option"><input type="radio" name="page-language" value="${id}"><span lang="${id==='zh'?'zh-Hans':id}" translate="no">${name}</span><small translate="no">${detail}</small><svg class="settings-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg></label>`).join('')}
    </fieldset><p class="settings-persistence" data-language-storage></p>
  </section>
  <div class="settings-destinations">
    <button type="button" class="settings-destination" data-mode-settings><span class="settings-symbol">${icon('mode')}</span><span class="settings-destination-copy"><strong>모드 변경</strong><small data-current-mode></small></span><span class="settings-chevron" aria-hidden="true">›</span></button>
    <button type="button" class="settings-destination" data-voice-settings><span class="settings-symbol">${icon('voice')}</span><span class="settings-destination-copy"><strong>음성 설정</strong><small>안내 언어·목소리·볼륨</small></span><span class="settings-voice-state"></span><span class="settings-chevron" aria-hidden="true">›</span></button>
  </div><p class="settings-footnote">페이지 언어를 바꿔도 게임 상태와 화면 연결은 유지됩니다.</p>`;
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
  const node = dialog('설정', body, {className:'app-settings-dialog'});
  const restore = () => {
    if (parent?.open) parent.querySelector('.model-settings-entry')?.focus({preventScroll:true});
  };
  const navigate = open => {
    node.addEventListener('close', () => {
      const child = open();
      child?.addEventListener('close', restore, {once:true});
    }, {once:true});
    node.close();
  };
  body.querySelector('[data-mode-settings]').onclick = () => navigate(() => showModes(session, assist, {voice,parent}));
  body.querySelector('[data-voice-settings]').onclick = () => navigate(() => showVoiceSettings(voice,{parent}));
  node.addEventListener('close', restore, {once:true});
  return node;
}
