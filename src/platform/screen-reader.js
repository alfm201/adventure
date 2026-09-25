import { diagnostics } from "./report.js";

export class ScreenReader {
  constructor(stream, receive, fail) {
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = stream;
    this.receive = receive;
    this.fail = fail;
    this.id = 0;
    this.lastFrame = performance.now();
    this.worker = new Worker(new URL("../recognition/worker.js", import.meta.url), { type: "module" });
    this.worker.onmessage = ({ data }) => {
      if (this.stopped) return;
      if (data.type === "ready") { this.ready = true; this.schedule(0); }
      else if (data.type === "error") { if (data.error) diagnostics.capture(new Error(data.error.message || "Recognition worker error"), "recognition.worker.init", { stack: data.error.stack }); this.failed("worker-init"); }
      else if (data.type === "frame" && data.id === this.id) {
        this.busy = false;
        if (data.error) diagnostics.capture(new Error(data.error.message || "Recognition frame error"), "recognition.worker.frame", { stack: data.error.stack });
        if (performance.now() - this.sentAt > 3000) return this.fail("stale");
        this.lastFrame = performance.now();
        this.receive(data);
        const fast = data.observation?.visible && (data.observation.deck?.open || data.observation.issue === "settling");
        this.schedule(fast ? 120 : 250);
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
  failed(reason = "reader") { if (!this.stopped) { diagnostics.record("screen.reader.fail", { reason }); this.stop(); this.fail("reader"); } }
  async tick() {
    if (this.stopped) return;
    const now = performance.now();
    if (now - this.lastFrame > 3500) this.fail("stale");
    if (this.busy && now - this.sentAt > 12000 || !this.ready && now - this.lastFrame > 12000) return this.failed();
    if (!this.ready || this.busy || this.video.readyState < 2) {
      return this.schedule(100);
    }
    this.busy = true; this.sentAt = now;
    try {
      const bitmap = await createImageBitmap(this.video);
      if (this.stopped) { bitmap.close(); return; }
      try { this.worker.postMessage({ type: "frame", id: ++this.id, bitmap }, [bitmap]); }
      catch (error) { bitmap.close(); throw error; }
    } catch { this.failed(); }
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.worker?.terminate();
    this.video.pause(); this.video.srcObject = null;
  }
}
