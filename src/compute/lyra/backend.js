import { validateSnapshot } from '../../environment/state.js';
import { loadPackage } from './package.js';
import { usageProfile } from './model.js';
const aborted = () => new DOMException('Calculation cancelled', 'AbortError');
export class LyraBackend extends EventTarget {
  constructor() { super(); this.sequence = 0; this.ready = false; this.configurations = new Map(); }
  prepare({ device = 'auto', usage = 'medium', signal, onProgress = () => {}, persist, deferUsage = false } = {}) {
    if(signal?.aborted)return Promise.reject(aborted());
    if (!['low','medium','high'].includes(usage)) return Promise.reject(Error('Invalid LYRA usage'));
    if(this.ready&&this.info.preference===device)
      return loadPackage({persist,signal,onProgress}).then(async data=>{
        signal?.throwIfAborted(); Object.assign(this.info,data.info);
        // Preparing a settings dialog must not change the running engine yet.
        return deferUsage ? { ...this.info, ...usageProfile(this.info.engine, usage) } : this.setUsage(usage);
      });
    this.dispose();
    const controller=this.loadController=new AbortController();
    const cancel=()=>controller.abort(signal.reason);
    signal?.addEventListener('abort',cancel,{once:true});
    return (async()=>{
      const data=await loadPackage({persist,signal:controller.signal,onProgress});
      controller.signal.throwIfAborted();
      return await this.start({device,usage,signal:controller.signal,onProgress,packageData:data});
    })().finally(()=>{signal?.removeEventListener('abort',cancel);if(this.loadController===controller)this.loadController=null;});
  }
  start({ device, usage, signal, onProgress, packageData }) {
    if (signal?.aborted) return Promise.reject(aborted());
    if (this.ready && this.info.preference === device && this.info.usage === usage) return Promise.resolve(this.info);
    if (this.preparing?.device === device && this.preparing.usage === usage) return this.preparing.promise;
    const worker = this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onerror = event => { event.preventDefault(); if (this.worker === worker) this.dispose(Error(event.message || 'LYRA worker failed')); };
    const promise = new Promise((resolve, reject) => {
      const cancel = () => this.dispose(aborted());
      this.preparing = { device, usage, resolve, reject, onProgress, cleanup: () => signal?.removeEventListener('abort', cancel) };
      signal?.addEventListener('abort', cancel, { once: true });
      worker.onmessage = ({ data }) => {
        if (this.worker !== worker) return;
        if (data.type === 'progress') this.preparing?.onProgress(data);
        else if (data.type === 'ready') {
          const job = this.preparing; this.preparing = null; this.ready = true; this.info = data;
          job?.cleanup(); job?.resolve(data);
        } else if (data.type === 'configured') {
          const job = this.configurations.get(data.id); this.configurations.delete(data.id);
          this.info = { ...this.info, ...data.info }; job?.resolve(this.info); this.dispatch();
        } else if (data.type === 'backend') {
          this.info = data; this.dispatchEvent(new Event('backendchange'));
        } else if (data.type === 'error') {
          this.dispose(Object.assign(Error(data.message), { code: data.code, stack: data.stack }));
        } else if (data.type === 'result' && this.active?.id === data.id) {
          if (data.gpuCache) this.info.gpuCache = data.gpuCache;
          const job = this.active; this.active = null;
          job.cleanup(); if (!job.signal?.aborted) job.resolve(data);
          this.dispatch();
        }
      };
      const bytes=packageData.bytes.slice(0);
      worker.postMessage({ type: 'prepare', device, usage, packageBytes:bytes, packageManifest:packageData.manifest, packageInfo:packageData.info },[bytes]);
    });
    this.preparing.promise = promise;
    return promise;
  }
  setUsage(usage) {
    if (!this.ready || !['low','medium','high'].includes(usage)) return Promise.reject(Error('Invalid LYRA usage change'));
    const id = ++this.sequence, cacheInfo = Object.fromEntries(['cacheSaved','cacheFailed','fromCache'].map(key=>[key,this.info[key]]));
    return new Promise((resolve,reject)=>{
      this.configurations.set(id,{resolve,reject});
      this.worker.postMessage({type:'configure',id,usage,cacheInfo});
    });
  }
  run(snapshot, { signal } = {}) {
    validateSnapshot(snapshot);
    if (!this.ready) return Promise.reject(Error('LYRA is not ready'));
    if (signal?.aborted) return Promise.reject(aborted());
    return new Promise((resolve, reject) => {
      if (this.queued) { this.queued.cleanup(); this.queued.reject(aborted()); }
      const job = { id: ++this.sequence, snapshot, signal, resolve, reject };
      const cancel = () => { if (this.queued === job) this.queued = null; job.cleanup(); reject(aborted()); };
      job.cleanup = () => signal?.removeEventListener('abort', cancel);
      signal?.addEventListener('abort', cancel, { once: true });
      this.queued = job; this.dispatch();
    });
  }
  dispatch() {
    if (this.active || !this.queued || this.configurations.size) return;
    this.active = this.queued; this.queued = null;
    this.worker.postMessage({ type: 'evaluate', id: this.active.id, snapshot: this.active.snapshot });
  }
  dispose(error = aborted()) {
    const loading=this.loadController;this.loadController=null;
    this.worker?.terminate(); this.worker = null; this.ready = false;
    for (const job of [this.preparing, this.active, this.queued]) { job?.cleanup?.(); job?.reject(error); }
    this.preparing = null; this.active = null; this.queued = null;
    for (const job of this.configurations.values()) job.reject(error);
    this.configurations.clear();
    loading?.abort(error);
  }
}
