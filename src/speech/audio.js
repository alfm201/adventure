function silence() {
  const buffer = new ArrayBuffer(44 + 880), view = new DataView(buffer);
  const word = (at, text) => [...text].forEach((letter, i) => view.setUint8(at + i, letter.charCodeAt(0)));
  word(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); word(8, "WAVE"); word(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 22050, true); view.setUint32(28, 44100, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  word(36, "data"); view.setUint32(40, 880, true);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}
export class VoiceAudio {
  initWebAudio() {
    try {
      const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioCtx || this.ctx) return;
      this.ctx = new AudioCtx();
      this.source = this.ctx.createMediaElementSource(this.element);
      this.gainNode = this.ctx.createGain();

      // Transparent peak limiter preventing distortion when boosted > 100%
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.setValueAtTime(-1.0, this.ctx.currentTime);
      this.limiter.knee.setValueAtTime(3.0, this.ctx.currentTime);
      this.limiter.ratio.setValueAtTime(20.0, this.ctx.currentTime);
      this.limiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.limiter.release.setValueAtTime(0.05, this.ctx.currentTime);

      this.source.connect(this.gainNode);
      this.gainNode.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);
    } catch {
      this.gainNode = null;
      this.ctx = null;
    }
  }
  async unlock(volume) {
    if (!this.element) {
      this.element = new Audio(); this.element.preload = "auto"; this.element.setAttribute("playsinline", "");
      this.silent = silence(); this.element.src = this.silent;
      this.initWebAudio();
    }
    this.volume(volume);
    if (this.ctx?.state === "suspended") {
      await this.ctx.resume().catch(() => {});
    }
    if (!this.unlocked) {
      const element = this.element; element.src = this.silent;
      await element.play();
      if (this.element === element) { element.pause(); this.unlocked = true; }
    }
  }
  volume(value) {
    const raw = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.7;
    // Logarithmic perceptual curve for fine low-volume control, up to 150% boost at top slider
    // 0.0 -> 0.0 (mute)
    // 0.7 -> 1.0 (exact native 100% volume at 70% slider position)
    // 1.0 -> 1.5 (+3.5dB safe boost with limiter at 100% slider position)
    const gain = raw <= 0.7 ? (raw / 0.7) ** 2 : 1.0 + ((raw - 0.7) / 0.3) * 0.5;

    if (this.gainNode && this.ctx) {
      this.element.volume = 1.0;
      this.gainNode.gain.setValueAtTime(gain, this.ctx.currentTime);
    } else if (this.element) {
      this.element.volume = Math.min(1.0, gain);
    }
  }
  play(url) {
    this.stop();
    const element = this.element;
    if (!element) throw Error("음성 설정에서 미리 듣기를 눌러주세요.");
    if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => {});
    element.src = url; element.playbackRate = 1;
    return new Promise((resolve, reject) => {
      const finish = error => {
        if (this.finish !== finish) return;
        this.finish = null; element.onended = element.onerror = null;
        if (error) reject(error); else resolve();
      };
      this.finish = finish; element.onended = () => finish();
      element.onerror = () => finish(Error("음성을 재생하지 못했습니다. 음성 설정에서 다시 확인해 주세요."));
      element.play().catch(error => finish(error.name === "NotAllowedError" ? Error("브라우저가 음성을 일시 중지했습니다. 미리 듣기를 눌러주세요.") : error));
    });
  }
  get snapshot() {
    return {
      unlocked: this.unlocked, hasContext: !!this.ctx, ctxState: this.ctx?.state || null,
      sampleRate: this.ctx?.sampleRate || null, hasGain: !!this.gainNode, hasLimiter: !!this.limiter,
      elementVolume: this.element?.volume ?? null, elementPaused: this.element?.paused ?? null,
    };
  }
  stop() { this.element?.pause(); this.finish?.(); }
  dispose() {
    this.stop();
    if (this.ctx) { this.ctx.close().catch(() => {}); this.ctx = null; }
    if (this.element) { this.element.removeAttribute("src"); this.element.load(); }
    if (this.silent) URL.revokeObjectURL(this.silent);
    this.element = null; this.unlocked = false; this.silent = null; this.gainNode = null;
  }
}
