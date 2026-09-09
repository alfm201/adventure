import { diagnostics } from "../platform/report.js";
const INITIAL_IMAGES = [1, 76, 77, 78, 79, 82];
export class Assets extends EventTarget {
  constructor({ timeout = 8000, delays = [1000, 3000, 7000], imageFactory = () => new Image() } = {}) {
    super();
    this.images = new Map(); this.records = new Map();
    this.timeout = timeout; this.delays = delays; this.imageFactory = imageFactory;
    this.revision = 0; this.disposed = false;
  }
  changed() { this.revision++; this.dispatchEvent(new Event("change")); }
  attempt(id, record) {
    return new Promise((resolve, reject) => {
      const image = this.imageFactory();
      let done = false;
      const finish = (error) => {
        if (done) return; done = true;
        clearTimeout(timer); image.onload = image.onerror = null; record.cancel = null;
        if (error) { image.src = ""; reject(error); } else resolve(image);
      };
      const timer = setTimeout(() => finish(Error("Image timed out")), this.timeout);
      record.cancel = () => finish(new DOMException("Cancelled", "AbortError"));
      image.decoding = "async";
      image.fetchPriority = INITIAL_IMAGES.includes(id) ? "high" : "low";
      image.onload = () => {
        if (typeof image.decode === "function") image.decode().then(() => finish(), finish);
        else finish();
      };
      image.onerror = () => finish(Error("Image unavailable"));
      image.src = new URL(`../../public/assets/${id}.png`, import.meta.url).href;
    });
  }
  load(id) {
    if (this.images.has(id)) return Promise.resolve(this.images.get(id));
    if (this.records.has(id)) return this.records.get(id).promise;
    const record = { state: "loading", attempts: 0 };
    let finishFirst;
    record.firstAttempt = new Promise(resolve => { finishFirst = resolve; });
    this.records.set(id, record);
    record.promise = (async () => {
      for (let n = 0; n <= this.delays.length; n++) {
        if (this.disposed) throw new DOMException("Cancelled", "AbortError");
        record.attempts++;
        try {
          const image = await this.attempt(id, record);
          this.images.set(id, image); record.state = "loaded"; finishFirst(); this.changed(); return image;
        } catch (error) {
          finishFirst();
          if (this.disposed) throw error;
          if (n === this.delays.length) { record.state = "failed"; diagnostics.capture(error, "asset.load", { id, attempts: record.attempts }); this.changed(); throw error; }
          record.state = "retrying"; this.changed();
          await new Promise(resolve => {
            const timer = setTimeout(resolve, this.delays[n]);
            record.cancel = () => { clearTimeout(timer); resolve(); };
          });
          record.cancel = null;
        }
      }
    })().finally(finishFirst);
    record.promise.catch(() => {});
    return record.promise;
  }
  ensure(id) { if (!this.records.has(id) && !this.disposed) this.load(id); }
  get(id) { return this.images.get(id); }
  retryFailed() {
    for (const [id, record] of this.records) if (record.state === "failed") {
      this.records.delete(id); this.ensure(id);
    }
    this.changed();
  }
  get missing() { return [...this.records.values()].filter(r => r.state !== "loaded"); }
  async initial(onProgress = () => {}) {
    let finished = 0;
    const tasks = INITIAL_IMAGES.map(id => {
      this.load(id);
      return this.records.get(id).firstAttempt.then(() => onProgress(++finished, INITIAL_IMAGES.length));
    });
    for (let id = 1; id <= 82; id++) if (!this.records.has(id)) this.load(id);
    await Promise.all(tasks);
  }
  dispose() { this.disposed = true; for (const record of this.records.values()) record.cancel?.(); }
}
