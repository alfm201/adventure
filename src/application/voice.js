import { VoiceAudio } from "../speech/audio.js";
import { VOICES, LANGUAGES } from "../speech/manifest.js";
import { inspectVoiceCache, clearVoiceCache, loadVoicePack } from "../speech/storage.js";
import { recommendationId, requestCue } from "../speech/messages.js";
import { diagnostics } from "../platform/report.js";

import { cueCategory, normalizeCues } from "../speech/cues.js";
export { DEFAULT_CUES, cueCategory } from "../speech/cues.js";

const PREFERENCES = "adventure.voice.settings.v2";
// Test-server ceiling: at most two normal capture intervals. Device QA may
// revise this; slow recognition must not make arbitrarily old frames eligible.
const MAX_ACTION_FRAME_AGE_MS = 500;
function readPreferences() { try { return JSON.parse(localStorage.getItem(PREFERENCES)) || {}; } catch { return {}; } }
function settings(value) {
  return { language: LANGUAGES.some(lang => lang.id === value.language) ? value.language : "ko",
    voice: VOICES.includes(value.voice) ? value.voice : typeof value.voice === "string" && value.voice.startsWith("M") ? "M" : "F",
    volume: Number.isFinite(value.volume) ? Math.min(1, Math.max(0, value.volume)) : .25, persist: value.persist === true,
    cues: normalizeCues(value.cues) };
}
export class AssistVoice extends EventTarget {
  constructor(session, coordinator, assist, { load = loadVoicePack, audio = new VoiceAudio() } = {}) {
    super(); Object.assign(this, { session, coordinator, assist, load, audio });
    const saved = readPreferences();
    this.settings = settings(saved);
    // Preserve legacy saved languages; new volume/cue-only preferences do not
    // count as completing the initial voice-language setup.
    this.languageConfigured = saved.languageConfigured === true ||
      saved.languageConfigured !== false && LANGUAGES.some(lang => lang.id === saved.language);
    this.status = "off"; this.enabled = false; this.holds = 0; this.epoch = 0; this.inspectEpoch = 0;
    this.cache = { available: !!globalThis.caches, bytes: 0, files: {}, freeBytes: null };
    this.lastAvailable = this.available;
    this.recentRequests = new Map();
    this.update = () => {
      this.sync();
      if (this.lastAvailable !== this.available) { this.lastAvailable = this.available; this.publish(); }
    };
    for (const target of [session, coordinator, assist]) target.addEventListener("change", this.update);
    globalThis.document?.addEventListener?.("visibilitychange", this.update);
  }
  get available() { return this.coordinator.enabled; }
  get preparing() { return this.status === "loading"; }
  get snapshot() { return { status: this.status, enabled: this.enabled, ...this.settings, pack: this.pack?.descriptor.id,
    version: this.pack?.descriptor.version, audioBytes: this.pack?.bytes?.byteLength || 0, cachedBytes: this.cache.bytes,
    speaking: this.speaking, starting: !!this.starting, speakingNotice: !!this.speakingNotice,
    desired: this.desired?.clip || null, delivered: this.delivered || null, audio: this.audio?.snapshot || null }; }
  publish() { this.dispatchEvent(new Event("change")); }
  notice(message) { this.dispatchEvent(new CustomEvent("notice", { detail: message })); }
  save() { try { localStorage.setItem(PREFERENCES, JSON.stringify({ ...this.settings, languageConfigured: this.languageConfigured })); } catch {} }
  async inspect() {
    const epoch = ++this.inspectEpoch, cache = await inspectVoiceCache();
    if (epoch === this.inspectEpoch && !this.disposed) { this.cache = cache; this.publish(); }
    return cache;
  }
  async apply(pack, { persist = false, download = false } = {}) {
    if (this.disposed || this.preparing || !this.available || !pack) return false;
    this.stop();
    const epoch = ++this.epoch, controller = this.preparation = new AbortController();
    this.status = "loading"; this.error = null; this.progress = { loaded: 0, total: pack.bytes }; this.publish();
    const current = () => { if (epoch !== this.epoch || controller.signal.aborted || !this.available) throw new DOMException("Cancelled", "AbortError"); };
    let candidate;
    try {
      await this.audio.unlock(this.settings.volume); current();
      const result = await this.load(pack, { persist, download, signal: controller.signal, progress: value => { if (epoch === this.epoch) { this.progress = value; this.publish(); } } });
      candidate = result.library; current();
      this.pack?.dispose(); this.pack = candidate; candidate = null;
      this.settings = settings({ ...this.settings, language: pack.language, voice: pack.voice, persist });
      this.languageConfigured = true; this.save();
      this.enabled = true; this.status = "ready"; this.preparation = null; this.delivered = null; this.unblock(); this.publish();
      if (result.cacheFailed) this.notice("음성은 사용할 수 있지만, 브라우저에 저장하지 못했습니다.");
      this.inspect(); this.sync(); return true;
    } catch (error) {
      candidate?.dispose();
      if (epoch !== this.epoch) return false;
      this.preparation = null; this.status = this.enabled ? "ready" : "off";
      this.error = error.name === "AbortError" ? null : error.message;
      if (error.name !== "AbortError") diagnostics.capture(error, "voice.prepare");
      if (!this.enabled) this.audio.dispose();
      this.inspect(); this.publish(); this.sync(); return false;
    }
  }
  isCueEnabled(clip) {
    const category = cueCategory(clip);
    return this.settings.cues?.[category] !== false;
  }
  change(values) {
    this.settings = settings({
      ...this.settings,
      volume: values.volume ?? this.settings.volume,
      cues: values.cues ? { ...this.settings.cues, ...values.cues } : this.settings.cues,
    });
    this.save();
    if (values.volume !== undefined) this.audio.volume(this.settings.volume);
    this.publish();
    this.sync();
  }
  stop() {
    clearTimeout(this.timer); this.timer = null;
    this.playback?.abort(); this.playback = null;
    if (this.speaking) diagnostics.record("voice.stop");
    this.audio.stop(); this.speaking = false; this.starting = false; this.cueStarted = false; this.desired = null; this.previewing = false; this.speakingNotice = false;
  }
  cancelPreparation() {
    this.epoch++; this.preparation?.abort(); this.preparation = null;
    this.status = this.enabled ? "ready" : "off"; this.progress = null;
    if (!this.enabled) this.audio.dispose();
    this.publish(); this.sync();
  }
  disable() {
    this.epoch++; this.preparation?.abort(); this.preparation = null; this.stop();
    this.pack?.dispose(); this.pack = null; this.audio.dispose();
    this.enabled = false; this.status = "off"; this.error = null; this.delivered = null; this.unblock(); this.publish();
  }
  hold() {
    this.holds++; this.stop(); this.publish();
    let active = true;
    return () => { if (active) { active = false; this.holds--; this.stop(); this.sync(); this.publish(); } };
  }
  cue() {
    if (this.session.mode !== "assist" || this.assist.status === "requesting") return null;
    const context = this.assist.epoch + ":" + JSON.stringify(this.session.state);
    const request = requestCue(this.assist);
    if (request) {
      if (request.key.startsWith("deck-")) this.deckVerifying = true;
      if (!this.isCueEnabled(request.key)) return null;
      return { key: "request:" + context + ":" + request.key, clip: request.key, delay: request.delay };
    }
    if (!this.assist.reading.ready || !this.session.canRecommend || this.session.view.terminal) return null;
    const result = this.coordinator.result;
    if (result.status === "complete" && result.revision === this.session.revision && result.requestId === this.coordinator.requestId) {
      const action = result.best;
      if (Number.isInteger(action) && result.recommended?.includes(action)) {
        const clip = recommendationId(action, this.session.state.hand);
        const key = "action:" + context + ":" + result.model + ":" + action;
        if (clip && this.isCueEnabled(clip) && !(this.deckVerifying && key === this.delivered)) {
          return { key, clip, delay: 0,
            revision: result.revision, requestId: result.requestId, after: result.startedAt };
        }
      }
    }
    if (this.deckVerifying) {
      if (this.isCueEnabled("deck-ready")) return { key: "deck-ready:" + context, clip: "deck-ready", delay: 100 };
      this.deckVerifying = false;
    }
    if (result.status === "running") {
      if (!this.isCueEnabled("calculating")) return null;
      return { key: "calculating:" + context, clip: "calculating", delay: 900 };
    }
    return null;
  }
  freshAction(cue) {
    const frame = this.assist.frame, now = performance.now();
    // Use the normal reader cadence plus this frame's measured processing time,
    // rather than accepting an arbitrarily old result received recently.
    return this.session.mode === "assist" && this.assist.status !== "paused" && !!this.assist.stream &&
      this.assist.reading.ready && this.session.canRecommend && !this.assist.reader?.busy &&
      cue.revision === this.session.revision && cue.requestId === this.coordinator.requestId &&
      this.coordinator.result.status === "complete" && this.cue()?.key === cue.key &&
      Number.isFinite(cue.after) && Number.isFinite(frame?.captureStartedAt) && Number.isFinite(frame?.receivedAt) &&
      frame.captureStartedAt >= cue.after && frame.receivedAt >= frame.captureStartedAt &&
      now >= frame.receivedAt && now - frame.captureStartedAt <= Math.min(MAX_ACTION_FRAME_AGE_MS, 250 + frame.latencyMs);
  }
  requestActionFrame(cue) {
    // A persistently slow reader should keep its normal cadence, rather than
    // being driven continuously by failed speech confirmation attempts.
    if (this.assist.frame?.latencyMs > MAX_ACTION_FRAME_AGE_MS) return;
    this.assist.requestFrame(cue.after);
  }
  queueCue(cue) {
    this.desired = cue;
    if (!cue || cue.key === this.delivered) return;
    if (cue.key.startsWith("action:") && !this.freshAction(cue)) {
      this.requestActionFrame(cue);
      // Keep acknowledgement pending until a recommendation actually starts.
      if (this.deckVerifying && this.isCueEnabled("deck-ready")) {
        const acknowledgement = { key: "deck-ready:" + this.assist.epoch + ":" + JSON.stringify(this.session.state),
          clip: "deck-ready", delay: 100 };
        if (acknowledgement.key !== this.delivered) {
          this.desired = acknowledgement;
          this.timer = setTimeout(() => { this.timer = null; this.speak(acknowledgement); }, acknowledgement.delay);
        }
      }
      return;
    }
    diagnostics.record("voice.queued", { clip: cue.clip, delay: cue.delay, key: cue.key,
      requestId: cue.requestId, revision: cue.revision, frame: this.assist.frame });
    this.timer = setTimeout(() => { this.timer = null; this.speak(cue); }, cue.delay);
  }
  sync() {
    if (this.connectionEpoch !== this.assist.epoch || this.session.mode !== "assist") {
      this.connectionEpoch = this.assist.epoch; this.deckVerifying = false; this.recentRequests.clear();
    }
    if (!this.available) { if (this.enabled || this.preparing) this.disable(); else this.publish(); return; }
    if (!this.enabled || this.preparing || this.holds || this.previewing || this.playbackBlocked) return;
    if (this.desired?.clip === "stale" && globalThis.document?.hidden && this.assist.status !== "paused") this.stop();
    const result = this.coordinator.result;
    if (this.isCueEnabled("roll") && this.session.mode === "assist" && this.assist.reading.ready && result.status === "running" &&
        this.confirmRequest !== result.requestId) {
      this.confirmRequest = result.requestId;
      this.assist.requestFrame(result.startedAt);
    }
    if (this.playback && this.speakingNotice) {
      if (this.session.mode !== "assist") { this.stop(); return; }
      const cue = this.cue();
      if (cue?.clip === "disconnected") {
        this.stop(); this.desired = cue;
        if (cue.key !== this.delivered) this.timer = setTimeout(() => this.speak(cue), cue.delay);
        return;
      }
      if (this.speakingNotice === "deck-ingame") {
        const issue = this.assist.status === "paused" ? "stale" : this.assist.reading?.issue;
        if (this.assist.reading.ready || issue && issue !== "deck-open" && issue !== "deck-reopen") {
          this.stop();
        } else {
          return;
        }
      } else {
        return;
      }
    }
    const cue = this.cue();
    // A queued/buffering acknowledgement can be replaced by a recommendation.
    // Once audible, finish the whole acknowledgement; recompute the latest
    // cue on completion instead of retaining a potentially obsolete action.
    if (this.playback && this.cueStarted && this.desired?.clip === "deck-ready" &&
        this.session.mode === "assist" && this.assist.stream &&
        this.desired.key.startsWith("deck-ready:" + this.assist.epoch + ":") &&
        this.isCueEnabled("deck-ready") && cue?.clip !== "disconnected") {
      if (cue?.key.startsWith("action:") && !this.freshAction(cue)) this.requestActionFrame(cue);
      return;
    }
    if (this.desired?.clip === "deck-ready" && cue?.key.startsWith("action:") && !this.freshAction(cue)) {
      this.requestActionFrame(cue);
      return;
    }
    if (cue?.key === this.desired?.key) {
      if (cue?.key.startsWith("action:")) {
        if (this.starting && !this.freshAction(this.desired)) {
          this.stop(); this.queueCue(cue);
        } else if (!this.playback && !this.timer) this.queueCue(cue);
      }
      return;
    }

    if (this.speaking) {
      const recoveredFrame = this.assist.frame?.captureStartedAt;
      const recovered = this.assist.reading.ready && this.assist.status !== "paused" &&
        Number.isFinite(recoveredFrame) && performance.now() - recoveredFrame >= 0 &&
        performance.now() - recoveredFrame <= MAX_ACTION_FRAME_AGE_MS;
      if (this.desired?.clip === "stale" && this.session.mode === "assist" && this.assist.stream &&
          this.desired.key.startsWith("request:" + this.assist.epoch + ":") &&
          this.isCueEnabled(this.desired.clip) && !recovered && cue?.clip !== "disconnected") {
        if (cue?.key.startsWith("action:")) this.requestActionFrame(cue);
        return;
      }
      if (this.desired?.key?.startsWith("request:") && this.session.mode === "assist" &&
          this.desired.key.startsWith("request:" + this.assist.epoch + ":") &&
          this.assist.stream && !this.assist.reading.ready && this.isCueEnabled(this.desired.clip) &&
          cue?.clip === this.desired.clip) return;
      if (this.desired?.key?.startsWith("action:")) {
        if (this.session.mode !== "assist" || cue?.clip === "disconnected") {
          this.stop(); this.queueCue(cue);
          return;
        }
        const currentContext = this.assist.epoch + ":" + JSON.stringify(this.session.state);
        if (!this.desired.key.includes(currentContext)) {
          this.stop(); this.queueCue(cue);
          return;
        }
        return;
      }
    }

    this.stop(); this.desired = cue;
    if (!cue || cue.key === this.delivered) return;
    if (performance.now() - (this.recentRequests.get(cue.clip) ?? -Infinity) < 15000) return;
    this.queueCue(cue);
  }
  async speak(cue) {
    if (!this.enabled || this.desired !== cue) return;
    if (cue.clip === "stale" && globalThis.document?.hidden && this.assist.status !== "paused") { this.stop(); return; }
    const action = cue.key.startsWith("action:");
    if (action && !this.freshAction(cue)) { this.requestActionFrame(cue); return; }
    const controller = this.playback = new AbortController();
    try {
      this.cueStarted = false;
      this.starting = action; this.speaking = !action; this.publish();
      diagnostics.record("voice.speak", { clip: cue.clip, delay: cue.delay, key: cue.key,
        requestId: cue.requestId, revision: cue.revision, frame: this.assist.frame });
      await this.audio.play(this.pack.url(cue.clip), { onStarted: () => {
        if (this.playback !== controller || controller.signal.aborted) return;
        if (action && !this.freshAction(cue)) { this.stop(); this.sync(); return; }
        // Once the popup notice is audible, repeat the recommendation when
        // the game is validated again, even if this notice is interrupted.
        // A notice cancelled before playback must not reset action deduplication.
        if (cue.clip === "covered" && this.delivered?.startsWith("action:")) this.delivered = null;
        if (action) this.deckVerifying = false;
        this.cueStarted = true;
        this.starting = false; this.speaking = true; this.publish();
        diagnostics.record("voice.started", { clip: cue.clip, key: cue.key, requestId: cue.requestId,
          revision: cue.revision, frame: this.assist.frame });
      } }); controller.signal.throwIfAborted();
      if (this.desired === cue) this.delivered = cue.key;
      if (cue.clip === "deck-ready") this.deckVerifying = false;
      if (["window", "small", "covered", "score", "dice", "hand", "bonus", "stale"].includes(cue.clip))
        this.recentRequests.set(cue.clip, performance.now());
      diagnostics.record("voice.complete", { clip: cue.clip });
    } catch (error) {
      if (error.name !== "AbortError" && !controller.signal.aborted) {
        diagnostics.record("voice.failed", { clip: cue.clip, error: error.message });
        this.failed(error);
      } else {
        diagnostics.record("voice.aborted", { clip: cue.clip });
      }
    }
    finally { if (this.playback === controller) { this.playback = null; this.speaking = false; this.starting = false; this.cueStarted = false; this.publish(); this.sync(); } }
  }
  async preview() {
    if (!this.enabled || !this.available || this.preparing) return;
    this.stop(); this.previewing = true; this.publish();
    const controller = this.playback = new AbortController();
    try {
      await this.audio.unlock(this.settings.volume); controller.signal.throwIfAborted(); this.unblock();
      this.speaking = true; this.publish();
      await this.audio.play(this.pack.url("preview")); controller.signal.throwIfAborted();
    } catch (error) { if (error.name !== "AbortError" && !controller.signal.aborted) this.failed(error); }
    finally { if (this.playback === controller) { this.playback = null; this.speaking = false; this.previewing = false; this.publish(); this.sync(); } }
  }
  stopPreview() { this.stop(); this.publish(); this.sync(); }
  async speakNotice(clip) {
    if (!this.enabled || !this.available || this.preparing || !this.pack || !this.isCueEnabled(clip)) return;
    this.stop();
    this.speakingNotice = clip;
    const controller = this.playback = new AbortController();
    try {
      await this.audio.unlock(this.settings.volume); controller.signal.throwIfAborted(); this.unblock();
      this.speaking = true; this.publish();
      diagnostics.record("voice.notice", { clip });
      await this.audio.play(this.pack.url(clip)); controller.signal.throwIfAborted();
    } catch (error) { if (error.name !== "AbortError" && !controller.signal.aborted) this.failed(error); }
    finally {
      if (this.playback === controller) {
        this.playback = null; this.speaking = false; this.speakingNotice = false; this.publish(); this.sync();
      }
    }
  }
  failed(error) {
    diagnostics.capture(error, "voice.play"); this.error = error.message;
    this.notice("음성을 재생하지 못했습니다. 음성 설정에서 미리 듣기를 눌러주세요.");
    this.stop(); this.audio.unlocked = false;
    this.playbackBlocked = true; this.publish();
  }
  unblock() { this.playbackBlocked = false; this.error = null; }
  async clearCache() {
    if (this.preparing) this.cancelPreparation();
    try { await clearVoiceCache(); this.settings.persist = false; this.save(); await this.inspect(); this.notice("저장된 음성 데이터를 삭제했습니다."); }
    catch (error) { diagnostics.capture(error, "voice.cache.clear"); this.notice("음성 데이터를 삭제하지 못했습니다. 브라우저의 사이트 저장소를 확인해 주세요."); }
  }
  dispose() {
    this.disposed = true;
    for (const target of [this.session, this.coordinator, this.assist]) target.removeEventListener("change", this.update);
    globalThis.document?.removeEventListener?.("visibilitychange", this.update);
    this.disable();
  }
}
