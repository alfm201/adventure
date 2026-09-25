import { dialog, confirmAction } from "./dialogs.js";
import { showModelSelection } from "./models.js";
import { LANGUAGES, loadVoiceCatalog } from "../../speech/manifest.js";
import { isPackCached } from "../../speech/storage.js";
import { bindVolumeSlider } from "../input/volume.js";

const megabytes = bytes => (bytes / 1e6).toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + " MB";
function showVoiceInfo() {
  const body = document.createElement("div"); body.className = "voice-license";
  body.innerHTML = `<p>이 안내 음성은 Google Gemini 3.8 Flash TTS (gemini-3.8-flash-tts) 모델을 사용하여 미리 생성된 AI 음성입니다.</p>
    <p>문장 단위 고품질 음성 합성 및 자연스러운 호흡을 위한 무음 최적화 처리가 적용되었습니다.</p>`;
  dialog("음성 정보", body, { className: "voice-license-dialog" });
}

export function showVoiceSettings(voice) {
  if (document.querySelector("dialog")) return;
  const release = voice.hold(), body = document.createElement("div"); body.className = "voice-settings";
  body.innerHTML = `<div class="voice-intro"><p>화면 확인 요청과 추천 행동을 음성으로 안내합니다.</p><span class="voice-state"></span></div>
    <div class="voice-model-needed" hidden><span>행동을 추천할 모델을 먼저 선택해 주세요.</span><button type="button" data-model>모델 선택</button></div>
    <fieldset class="voice-controls"><div class="voice-selects"><label>언어<select name="language" aria-label="안내 언어"></select></label><label>목소리<select name="voice" aria-label="음성 목소리"></select></label></div>
      <label class="voice-slider"><span>볼륨 <output data-volume></output></span><input name="volume" aria-label="볼륨" type="range" min="0" max="100" step="1"></label>
      <details class="voice-advanced">
        <summary>안내 항목 선택 (고급)</summary>
        <div class="voice-cues-list">
          <label class="voice-check"><input type="checkbox" name="cue_recommendation"><span>추천 행동 안내<small>주사위 굴리기 및 추천 카드 안내</small></span></label>
          <label class="voice-check"><input type="checkbox" name="cue_calculating"><span>추천 계산 중 알림<small>"추천 행동을 계산하고 있습니다"</small></span></label>
          <label class="voice-check"><input type="checkbox" name="cue_obstruction"><span>화면 가림 및 팝업 닫기 요청<small>"팝업을 닫아주세요", 창 크기 조정 등</small></span></label>
          <label class="voice-check"><input type="checkbox" name="cue_deck"><span>카드 이력 확인 및 스크롤 안내<small>물음표 이력 열기 및 위/아래 스크롤 안내</small></span></label>
          <label class="voice-check"><input type="checkbox" name="cue_connection"><span>화면 연결 상태 알림<small>화면 공유 종료 및 인식 재연결 안내</small></span></label>
        </div>
      </details>
    </fieldset>
    <section class="voice-data"><div class="voice-data-heading"><strong data-pack-title>음성 데이터</strong><span data-pack-size></span></div>
      <p data-pack-note>음성 목록을 확인하고 있습니다.</p>
      <label class="voice-check" data-persist-row><input type="checkbox" name="persist"><span>이 브라우저에 저장<small>다음에도 저장된 음성을 사용합니다.</small></span></label>
      <small class="voice-storage-note" hidden></small><div class="voice-cache-total" hidden><span></span><button type="button" data-clear>저장 삭제</button></div>
    </section>
    <div class="voice-consent"><p>Gemini 3.8 Flash TTS로 미리 생성한 AI 음성입니다.</p><button type="button" data-license>음성 정보</button></div>
    <div class="voice-progress" role="status" hidden><div><span data-stage></span><output data-percent></output></div><progress max="100" value="0" aria-label="음성 다운로드 진행률"></progress><small data-detail></small></div>
    <p class="voice-error" role="alert" hidden></p>
    <footer><button type="button" class="primary" data-apply>다운로드하고 켜기</button><button type="button" data-preview>미리 듣기</button><button type="button" data-off hidden>음성 끄기</button><button type="button" data-stop hidden>취소</button><button type="button" data-retry hidden>다시 확인</button></footer>`;
  const el = selector => body.querySelector(selector), input = name => el(`[name="${name}"]`);
  const CUE_KEYS = ["recommendation", "calculating", "obstruction", "deck", "connection"];
  for (const lang of LANGUAGES) input("language").add(new Option(lang.name, lang.id));
  for (const [id, name] of [["F", "여성"], ["M", "남성"]]) input("voice").add(new Option(name, id));
  input("language").value = voice.settings.language; input("voice").value = voice.settings.voice;
  input("volume").value = Math.round(voice.settings.volume * 100); input("persist").checked = voice.settings.persist;
  for (const key of CUE_KEYS) input("cue_" + key).checked = voice.settings.cues?.[key] !== false;
  let catalog = [], catalogError = null, reading = true, deleting = false, closed = false;
  const selection = () => catalog.find(pack => pack.language === input("language").value && pack.voice === input("voice").value);
  const isCurrent = pack => voice.enabled && pack && voice.pack?.descriptor.sha256 === pack.sha256;
  function update() {
    const pack = selection(), current = isCurrent(pack), saved = isPackCached(voice.cache, pack), busy = voice.preparing;
    el(".voice-state").textContent = busy ? "준비 중" : voice.playbackBlocked ? "재생 확인" : voice.enabled ? "켜짐" : "꺼짐"; el(".voice-state").dataset.ready = String(voice.enabled && !voice.playbackBlocked);
    el(".voice-model-needed").hidden = voice.available; el(".voice-controls").disabled = busy || !voice.available;
    el("[data-volume]").textContent = Math.round(voice.settings.volume * 100) + "%";
    el("[data-pack-title]").textContent = current ? "사용 중인 음성" : saved ? "저장된 음성" : "다운로드할 음성";
    el("[data-pack-size]").textContent = pack ? megabytes(pack.bytes) : "";
    el("[data-pack-note]").textContent = reading ? "음성 목록을 확인하고 있습니다." : !pack ? "선택한 음성이 아직 준비되지 않았습니다." : current || saved ? "선택한 음성을 바로 사용할 수 있습니다." : "선택한 음성을 받습니다.";
    const space = !pack || voice.cache.freeBytes === null || voice.cache.freeBytes >= pack.bytes * 1.1;
    el("[data-persist-row]").hidden = current || saved;
    input("persist").disabled = busy || !voice.available || !voice.cache.available || !space;
    if (!voice.cache.available || !space) input("persist").checked = false;
    el(".voice-storage-note").hidden = current || saved || voice.cache.available && space;
    el(".voice-storage-note").textContent = !space ? "저장 공간이 부족합니다. 저장하지 않고 사용할 수 있습니다." : "이 브라우저에서는 저장할 수 없습니다. 이번 접속에서만 사용할 수 있습니다.";
    el(".voice-cache-total").hidden = !voice.cache.bytes;
    el(".voice-cache-total > span").textContent = "브라우저에 총 " + megabytes(voice.cache.bytes) + " 저장됨";
    el("[data-clear]").disabled = busy || deleting; el("[data-clear]").textContent = deleting ? "삭제 중…" : "저장 삭제";
    el(".voice-progress").hidden = !busy;
    if (busy) {
      const progress = voice.progress || {}, percent = Math.min(100, Math.round((progress.loaded || 0) / (progress.total || 1) * 100));
      el("[data-stage]").textContent = progress.phase === "verify" ? "음성을 확인하고 있습니다" : "음성을 불러오고 있습니다";
      el("[data-percent]").textContent = percent + "%"; el("progress").value = percent;
      el("[data-detail]").textContent = `${megabytes(progress.loaded || 0)} / ${megabytes(progress.total || 0)}`;
    }
    el(".voice-error").hidden = !(voice.error || catalogError); el(".voice-error").textContent = voice.error || catalogError || "";
    el("[data-apply]").hidden = current && !busy;
    el("[data-apply]").disabled = busy || reading || deleting || !voice.available || !pack;
    el("[data-apply]").textContent = busy ? "준비 중…" : saved ? voice.enabled ? "음성 적용" : "음성 켜기" : voice.enabled ? "다운로드하고 적용" : "다운로드하고 켜기";
    el("[data-preview]").disabled = !current || busy || !voice.available;
    el("[data-preview]").textContent = voice.previewing ? "재생 중지" : "미리 듣기";
    for (const key of CUE_KEYS) {
      input("cue_" + key).checked = voice.settings.cues?.[key] !== false;
      input("cue_" + key).disabled = busy || !voice.available;
    }
    el("[data-off]").hidden = !voice.enabled || busy; el("[data-stop]").hidden = !busy;
    el("[data-retry]").hidden = !catalogError; el("[data-retry]").disabled = reading;
  }
  async function refresh() {
    reading = true; catalogError = null; update();
    try { catalog = await loadVoiceCatalog(); await voice.inspect(); }
    catch (error) { catalogError = error.message; }
    finally { if (!closed) { reading = false; update(); } }
  }
  for (const name of ["language", "voice"]) input(name).onchange = () => { voice.stopPreview(); update(); };
  input("volume").oninput = () => voice.change({ volume: Number(input("volume").value) / 100 });
  bindVolumeSlider(input("volume"));
  for (const key of CUE_KEYS) {
    input("cue_" + key).onchange = () => {
      voice.change({ cues: { [key]: input("cue_" + key).checked } });
    };
  }
  el("[data-apply]").onclick = () => {
    const pack = selection(); if (!pack) return;
    voice.apply(pack, { persist: !input("persist").disabled && input("persist").checked, download: !isPackCached(voice.cache, pack) });
  };
  el("[data-preview]").onclick = () => voice.previewing ? voice.stopPreview() : voice.preview();
  el("[data-off]").onclick = () => voice.disable();
  el("[data-stop]").onclick = () => voice.cancelPreparation();
  el("[data-license]").onclick = showVoiceInfo; el("[data-retry]").onclick = refresh;
  el("[data-clear]").onclick = async () => {
    if (!await confirmAction("저장된 음성 삭제", "다음 접속에서는 필요한 음성을 다시 받습니다. 지금 사용 중인 음성은 계속 들을 수 있습니다.", { confirmLabel: "삭제" })) return;
    deleting = true; update(); await voice.clearCache(); deleting = false; input("persist").checked = false; if (!closed) update();
  };
  update();
  const node = dialog("음성 안내", body, { className: "voice-dialog" });
  el("[data-model]").onclick = () => {
    node.addEventListener("close", () => showModelSelection(voice.coordinator), { once: true });
    node.close();
  };
  voice.addEventListener("change", update);
  node.addEventListener("close", () => {
    closed = true; voice.removeEventListener("change", update);
    if (voice.preparing) voice.cancelPreparation();
    release();
  }, { once: true });
  refresh(); return node;
}
