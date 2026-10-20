import { diagnostics } from "./report.js";
import { FrameRecorder } from "./frame-recorder.js";
import { CaptureFrames } from "./capture-frames.js";

export const frameDelay = (elapsed, fast, urgent = false) => urgent ? 0 : Math.max(fast ? 10 : 20, (fast ? 120 : 250) - elapsed);

export class ScreenReader {
  constructor(stream, receive, fail, context = () => null, history = () => {}) {
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = stream;
    this.receive = receive;
    this.fail = fail;
    this.context = context;
    this.id = 0;
    this.lastFrame = performance.now();
    this.frames = new CaptureFrames(stream);
    this.visibilityChanged = () => {
      if (!document.hidden) { this.visibleAt = performance.now(); this.requestFrame(this.visibleAt); }
    };
    document.addEventListener?.("visibilitychange", this.visibilityChanged);
    if (this.video.requestVideoFrameCallback) {
      const next = (_, metadata) => {
        if (this.stopped) return;
        this.sourceFrame = metadata.presentedFrames;
        this.sourceFrameAt = performance.now();
        this.videoCallback = this.video.requestVideoFrameCallback(next);
      };
      this.videoCallback = this.video.requestVideoFrameCallback(next);
    }
    try { this.recorder = new FrameRecorder(this.video, history, () => this.region, () => this.frameNumber(), () => this.bitmap(), () => this.frameTime()); }
    catch (error) { diagnostics.capture(error, "recognition.history.init"); }
    this.worker = new Worker(new URL("../recognition/worker.js", import.meta.url), { type: "module" });
    this.worker.onmessage = ({ data }) => {
      if (this.stopped) return;
      if (data.type === "ready") { this.ready = true; this.schedule(0); }
      else if (data.type === "error") { if (data.error) diagnostics.capture(new Error(data.error.message || "Recognition worker error"), "recognition.worker.init", { stack: data.error.stack }); this.failed("worker-init"); }
      else if (data.type === "frame" && data.id === this.id) {
        this.busy = false;
        if (data.error) diagnostics.capture(new Error(data.error.message || "Recognition frame error"), "recognition.worker.frame", { stack: data.error.stack });
        if (performance.now() - this.sentAt > 3000) {
          this.fail(document.hidden ? "background" : "stale"); this.schedule(0); return;
        }
        this.lastFrame = performance.now();
        this.region = data.region;
        if (this.sentAt >= this.requestedAfter) this.urgent = false;
        this.receive({ ...data, sourceFrame: this.capturedSourceFrame, captureStartedAt: this.sentAt, receivedAt: this.lastFrame });
        const fast = data.observation?.visible && (data.observation.deck?.open || data.observation.issue === "settling");
        this.schedule(frameDelay(performance.now() - this.sentAt, fast, this.urgent));
      }
    };
    this.worker.onerror = event => { event.preventDefault(); diagnostics.capture(new Error(event.message || "Recognition worker error"), "recognition.worker.runtime", { filename: event.filename, lineno: event.lineno }); this.failed("worker-error"); };
    this.worker.onmessageerror = () => { diagnostics.capture(new Error("Recognition worker deserialization error"), "recognition.worker.message"); this.failed("worker-message"); };
    this.worker.postMessage({ type: "init" });
    this.video.play().catch(error => { if (!this.stopped) { diagnostics.capture(error, "screen.video.play"); this.failed("video-play"); } });
    this.schedule(250);
  }
  schedule(delay = 250) {
    if (this.stopped) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.tick(), delay);
  }
  requestFrame(after = performance.now()) {
    if (this.stopped) return;
    // An in-flight frame captured after the calculation began can satisfy the
    // request. Do not force another capture that races audio startup.
    if (this.busy && this.sentAt >= after) return;
    this.requestedAfter = Math.max(this.requestedAfter ?? -Infinity, after);
    this.urgent = true;
    if (!this.busy) this.schedule(0);
  }
  replayHistory(after, before) { return this.recorder?.replay(after, before) ?? false; }
  frameNumber() { return this.frames.active ? "capture:" + this.frames.sequence : this.sourceFrame ?? null; }
  frameTime() { return this.frames.active ? this.frames.at : this.sourceFrameAt; }
  bitmap() { return this.frames.active ? this.frames.bitmap() : createImageBitmap(this.video); }
  failed(reason = "reader") { if (!this.stopped) { diagnostics.record("screen.reader.fail", { reason }); this.stop(); this.fail("reader"); } }
  async tick() {
    if (this.stopped) return;
    const now = performance.now();
    const since = Math.max(this.lastFrame, this.visibleAt ?? -Infinity);
    if (now - since > 3500) this.fail(document.hidden ? "background" : "stale");
    if (!document.hidden && (this.busy && now - Math.max(this.sentAt, this.visibleAt ?? -Infinity) > 12000 || !this.ready && now - since > 12000)) return this.failed();
    if (!this.ready || this.busy || (this.frames.active ? !this.frames.frame : this.video.readyState < 2)) {
      return this.schedule(100);
    }
    const sourceFrame = this.frameNumber();
    if (sourceFrame != null && sourceFrame === this.capturedSourceFrame) return this.schedule(20);
    this.urgent = false;
    this.busy = true; this.sentAt = Math.min(now, this.frameTime() ?? now); this.capturedSourceFrame = sourceFrame;
    this.schedule(100);
    try {
      const bitmap = await this.bitmap();
      if (!bitmap) { this.busy = false; this.schedule(20); return; }
      if (this.stopped) { bitmap.close(); return; }
      try { this.worker.postMessage({ type: "frame", id: ++this.id, sourceFrame, bitmap, context: this.context() }, [bitmap]); }
      catch (error) { bitmap.close(); throw error; }
    } catch { this.failed(); }
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.worker?.terminate();
    this.recorder?.stop();
    this.frames.stop();
    document.removeEventListener?.("visibilitychange", this.visibilityChanged);
    if (this.videoCallback != null) this.video.cancelVideoFrameCallback?.(this.videoCallback);
    this.video.pause(); this.video.srcObject = null;
  }
}
