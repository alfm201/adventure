// A single bounded capture can be in flight. It does not wait for the full
// recognizer, and it never builds a backlog of shared-screen bitmaps.
export class FrameRecorder {
  constructor(video, receive, region, sourceFrame = () => null, capture = () => createImageBitmap(video), frameTime = () => performance.now()) {
    this.video = video; this.receive = receive; this.region = region; this.sourceFrame = sourceFrame; this.id = 0;
    this.capture = capture; this.frameTime = frameTime;
    this.worker = new Worker(new URL("../recognition/history-worker.js", import.meta.url), { type: "module" });
    this.worker.onmessage = ({ data }) => {
      if (this.stopped) return;
      if (data.type === "ready") { this.ready = true; this.schedule(0); }
      else if (data.type === "disabled") this.stop();
      else if (data.type === "replay") {
        if (data.token === this.replayToken && JSON.stringify(data.region) === JSON.stringify(this.region())) this.receive(data);
      }
      else if (data.type === "frame" && data.id === this.id) {
        clearTimeout(this.watchdog);
        this.busy = false;
        if (JSON.stringify(data.region) === JSON.stringify(this.region())) this.receive(data);
        this.schedule(Math.max(10, 100 - (performance.now() - this.startedAt)));
      }
    };
    this.worker.onerror = event => { event.preventDefault(); this.stop(); };
    this.worker.onmessageerror = () => this.stop();
    this.worker.postMessage({ type: "init" });
  }
  schedule(delay) { clearTimeout(this.timer); if (!this.stopped) this.timer = setTimeout(() => this.tick(), delay); }
  replay(after, before) {
    if (this.stopped || !this.ready) return false;
    this.worker.postMessage({ type: "replay", token: this.replayToken = (this.replayToken || 0) + 1,
      after, before, region: this.region() });
    return true;
  }
  async tick() {
    if (this.stopped || this.busy) return;
    const region = this.region();
    if (!this.ready || !region || this.video.readyState < 2) return this.schedule(100);
    const sourceFrame = this.sourceFrame();
    if (sourceFrame != null && sourceFrame === this.lastSourceFrame) return this.schedule(30);
    this.lastSourceFrame = sourceFrame;
    this.busy = true; this.startedAt = performance.now();
    const id = ++this.id, at = Math.min(this.startedAt, this.frameTime() ?? this.startedAt);
    this.watchdog = setTimeout(() => { if (!document.hidden) this.stop(); }, 4000);
    try {
      const bitmap = await this.capture();
      if (!bitmap) { clearTimeout(this.watchdog); this.busy = false; this.schedule(100); return; }
      if (this.stopped) { bitmap.close(); return; }
      try { this.worker.postMessage({ type: "frame", bitmap, region, at, id, sourceFrame }, [bitmap]); }
      catch (error) { bitmap.close(); throw error; }
    } catch { this.stop(); }
  }
  stop() { this.stopped = true; clearTimeout(this.timer); clearTimeout(this.watchdog); this.worker?.terminate(); }
}
