import { captureScreen, screenCaptureSupport } from "../platform/screen-capture.js";
import { diagnostics } from "../platform/report.js";
import { ScreenReader } from "../platform/screen-reader.js";
import { AssistTracker } from "./assist-tracker.js";

const stopTracks = stream => stream?.getTracks().forEach(track => track.stop());

export class Assist extends EventTarget {
  constructor(session, { createReader = (...args) => new ScreenReader(...args) } = {}) {
    super();
    this.session = session;
    this.status = "idle";
    this.issue = null;
    this.stream = null;
    this.epoch = 0;
    this.createReader = createReader;
    this.tracker = new AssistTracker();
    this.reading = { ready: false, issue: "waiting", seen: 0 };
    this.modeChanged = () => {
      if (session.mode !== "assist") this.disconnect();
    };
    session.addEventListener("change", this.modeChanged);
  }

  get support() { return screenCaptureSupport(); }
  get snapshot() {
    return { status: this.status, issue: this.issue, connected: !!this.stream, supported: this.support.available,
      reading: this.reading, observation: this.tracker.lastObservation, region: this.region,
      processingMs: this.processingMs, verifications: this.tracker.verifications, mismatch: this.tracker.lastMismatch };
  }

  publish(status, issue = null) {
    this.status = status;
    this.issue = issue;
    diagnostics.record("assist.connection", this.snapshot);
    this.dispatchEvent(new Event("change"));
  }

  restingStatus() {
    if (this.stream) return this.stream.getVideoTracks()[0]?.muted ? "paused" : "connected";
    return this.session.mode === "assist" ? "disconnected" : "idle";
  }

  release() {
    this.reader?.stop(); this.reader = null;
    this.tracker.reset();
    this.region = null;
    this.reading = { ready: false, issue: "waiting", seen: 0 };
    this.session.observe(null);
    this.unbindStream?.();
    this.unbindStream = null;
    stopTracks(this.stream);
    this.stream = null;
  }
  read(frame) {
    this.region = frame.region;
    this.sourceSize = { width: frame.width, height: frame.height };
    this.processingMs = Math.round(frame.elapsed || 0);
    try {
      this.reading = this.tracker.update(frame.observation, performance.now());
      this.session.observe(this.reading.state, this.reading);
    } catch (error) {
      diagnostics.capture(error, "assist.reading");
      this.reader?.stop();
      this.unreadable("reader");
      return;
    }
    const key = `${this.reading.issue}:${this.reading.seen}:${this.reading.verification}`;
    if (key !== this.readingKey) { diagnostics.record("assist.reading", { ...this.reading, state: undefined }); this.readingKey = key; }
    this.dispatchEvent(new Event("change"));
  }
  unreadable(issue) {
    if (issue === "stale" && this.tracker.state && this.tracker.verified) this.tracker.requireDeck("gap");
    this.tracker.pendingKey = null;
    this.reading = { ...this.reading, ready: false, issue, canCorrect: false, seen: this.tracker.seen, verification: this.tracker.deckReason };
    this.session.observe(null);
    this.dispatchEvent(new Event("change"));
  }
  rescan() {
    if (!this.stream) return;
    this.tracker.requireDeck("manual");
    this.unreadable("deck-open");
  }
  correct(values) {
    if (!this.tracker.correct(values, performance.now())) return false;
    this.session.observe(null);
    return true;
  }

  async connect() {
    if (this.disposed || this.status === "requesting") return false;
    if (!this.support.available) {
      this.publish(this.restingStatus(), this.support.issue);
      return false;
    }
    const epoch = ++this.epoch;
    this.publish("requesting");
    let candidate;
    try {
      candidate = await captureScreen();
      if (this.disposed || epoch !== this.epoch) { stopTracks(candidate); return false; }
      for (const track of candidate.getAudioTracks()) { track.stop(); candidate.removeTrack(track); }
      const track = candidate.getVideoTracks()[0];
      if (!track || track.readyState !== "live" || !candidate.active)
        throw new DOMException("Inactive capture", "NotReadableError");
      this.release();
      this.stream = candidate;
      const ended = () => {
        if (this.stream !== candidate) return;
        this.release();
        this.publish(this.status === "requesting" ? "requesting" : "disconnected");
      };
      const changed = () => {
        if (this.stream === candidate && this.status !== "requesting") {
          if (track.muted) this.unreadable("stale");
          this.publish(this.restingStatus());
        }
      };
      track.addEventListener("ended", ended);
      candidate.addEventListener("inactive", ended);
      track.addEventListener("mute", changed);
      track.addEventListener("unmute", changed);
      this.unbindStream = () => {
        track.removeEventListener("ended", ended);
        candidate.removeEventListener("inactive", ended);
        track.removeEventListener("mute", changed);
        track.removeEventListener("unmute", changed);
      };
      this.session.execute("mode", "assist");
      this.reader = this.createReader(candidate, frame => {
        if (this.stream === candidate && !track.muted && this.session.mode === "assist") this.read(frame);
      }, issue => { if (this.stream === candidate) this.unreadable(issue); });
      this.publish(this.restingStatus());
      return true;
    } catch (error) {
      if (candidate && this.stream === candidate) this.release();
      else stopTracks(candidate);
      if (this.disposed || epoch !== this.epoch) return false;
      const issue = error.name === "NotAllowedError" || error.name === "AbortError" ? "cancelled"
        : error.name === "NotFoundError" ? "missing" : "capture";
      this.publish(this.restingStatus(), issue);
      return false;
    }
  }

  cancelPending() {
    if (this.status !== "requesting") return;
    this.epoch++;
    this.publish(this.restingStatus());
  }

  disconnect() {
    this.epoch++;
    this.release();
    const status = this.restingStatus();
    if (this.status !== status || this.issue) this.publish(status);
  }

  dispose() {
    this.disposed = true;
    this.session.removeEventListener("change", this.modeChanged);
    this.disconnect();
  }
}
