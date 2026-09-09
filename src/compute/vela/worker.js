import { modelFileUrl, fetchManifest, validateManifest, sameModel, LOCAL_MODEL } from "./model.js";
import { modelDirectory, writeJson, selectCachedModel, pruneCachedModels, hasCachedModel } from "./storage.js";
import { fileWriter, checkStorage, storageIssue } from "./files.js";
import { consumeModel, gunzipStream } from "./streams.js";
import { responseFor, runtimeFiles, createRuntime, saveRuntime } from "./runtime.js";

let module, ready = false, loadedInfo;
const post = (type, data = {}) => self.postMessage({ type, ...data });
async function cachedBundle(manifest, includeStaged = true) {
  const directory = await modelDirectory(manifest);
  for (const name of includeStaged ? ["complete.json", "staged.json"] : ["complete.json"]) {
    try {
      const meta = JSON.parse(await (await (await directory.getFileHandle(name)).getFile()).text());
      if (!sameModel(validateManifest(meta.manifest), manifest)) continue;
      const file = await (await directory.getFileHandle("model.gz")).getFile();
      if (file.size === manifest.bytes) return { directory, file, staged: name === "staged.json" };
    } catch {}
  }
  return null;
}
function progressReporter(manifest, phase) {
  let last = 0;
  return ({ received, verified }, force = false) => {
    const now = performance.now();
    if (force || now - last > 100) {
      last = now;
      post("progress", { phase, received, total: manifest.bytes, fraction: received / manifest.bytes, prepared: verified / manifest.decodedBytes });
    }
  };
}
async function stage(manifest) {
  let cached = await cachedBundle(manifest).catch(() => null);
  if (cached) return { manifest, staged: true, fromCache: true };
  try {
    const partial = await modelDirectory(manifest);
    for (const name of ["model.gz", "staged.json", "complete.json"])
      await partial.removeEntry(name).catch(error => { if (error.name !== "NotFoundError") throw error; });
  } catch (error) {
    if (error.name !== "NotFoundError") return { manifest, staged: false, cacheIssue: storageIssue(error) };
  }
  const storage = await checkStorage(manifest.bytes);
  if (!storage.available) return { manifest, staged: false, cacheIssue: storage.code };
  const directory = await modelDirectory(manifest, true);
  let writer;
  try {
    const { files } = await runtimeFiles(manifest);
    await saveRuntime(directory, files);
    writer = await fileWriter(directory, "model.gz");
    const response = await responseFor(modelFileUrl(manifest));
    const result = await consumeModel(response.body, manifest, {
      writer, progress: progressReporter(manifest, "download"),
      cacheError(error) { throw Object.assign(error, { code: storageIssue(error) }); },
    });
    writer = null;
    if (!result.cacheWritten) throw Object.assign(Error("Storage failed"), { code: "storage-failed" });
    await writeJson(directory, "staged.json", { manifest, savedAt: Date.now() });
    return { manifest, staged: true, fromCache: false };
  } catch (error) {
    if (writer) await writer.abort().catch(() => {});
    await directory.removeEntry("staged.json").catch(() => {});
    await directory.removeEntry("model.gz").catch(() => {});
    if (error.code?.startsWith("storage-") || ["QuotaExceededError", "NotAllowedError", "SecurityError", "NoModificationAllowedError"].includes(error.name))
      return { manifest, staged: false, cacheIssue: error.code?.startsWith("storage-") ? error.code : storageIssue(error) };
    throw error;
  }
}
async function probe(manifest, persist) {
  const cached = persist ? await cachedBundle(manifest, false).catch(() => null) : null;
  const { files, cacheIssue } = await runtimeFiles(manifest, cached?.directory);
  await gunzipStream();
  await createRuntime(files, manifest);
  const file = globalThis.FileSystemFileHandle?.prototype;
  return { available: true, cacheIssue, storage: !!navigator.storage?.getDirectory && !!(file?.createSyncAccessHandle || file?.createWritable) };
}
async function prepare({ persist, manifest, cachedOnly = false }) {
  post("progress", { phase: "engine", fraction: 0 });
  let cached = persist ? await cachedBundle(manifest).catch(() => null) : null;
  if (cachedOnly && !cached) throw Object.assign(Error("저장된 모델을 읽지 못했습니다."), { code: "cache-missing" });
  let ptr, files, cacheIssue = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const fromCache = !!cached;
    let directory = cached?.directory, writer;
    try {
      if (!module) {
        ({ files, cacheIssue } = await runtimeFiles(manifest, directory));
        module = await createRuntime(files, manifest);
        try { ptr = module._malloc(manifest.decodedBytes); }
        catch (error) { throw Object.assign(error, { code: "memory" }); }
        if (!ptr) throw Object.assign(Error("모델 실행에 필요한 메모리가 부족합니다."), { code: "memory" });
      }
      if (persist && !directory) {
          const storage = await checkStorage(manifest.bytes);
          if (storage.available) {
            try {
              directory = await modelDirectory(manifest, true);
              await saveRuntime(directory, files);
              writer = await fileWriter(directory, "model.gz");
            } catch (error) { cacheIssue = storageIssue(error); }
          } else cacheIssue = storage.code;
      }
      const stream = cached ? cached.file.stream() : (await responseFor(modelFileUrl(manifest))).body;
      if (!stream) throw Object.assign(Error("다운로드를 시작하지 못했습니다."), { code: "network" });
      const result = await consumeModel(stream, manifest, {
        writer, write: (bytes, offset) => module.HEAPU8.set(bytes, ptr + offset),
        progress: progressReporter(manifest, fromCache ? "cache" : "download"),
        cacheError(error) { cacheIssue = storageIssue(error); },
      });
      writer = null;
      post("progress", { phase: "prepare", fraction: 1, prepared: 1 });
      if (!module._init_model(ptr, manifest.decodedBytes)) throw Object.assign(Error(module.UTF8ToString(module._last_error())), { code: "model" });
      let cacheSaved = fromCache && !cached.staged && !cacheIssue;
      if (directory && !cacheIssue && (result.cacheWritten || cached?.staged)) {
        try {
          await writeJson(directory, "staged.json", { manifest, savedAt: Date.now() });
          cacheSaved = true;
        } catch (error) { cacheIssue = storageIssue(error); }
      }
      ready = true;
      loadedInfo = { fromCache, cacheSaved, cacheFailed: !!cacheIssue, cacheIssue, manifest, memoryBytes: module.HEAPU8.byteLength };
      post("ready", loadedInfo);
      return;
    } catch (error) {
      if (writer) await writer.abort().catch(() => {});
      if (directory && error.code !== "memory") {
        await directory.removeEntry("complete.json").catch(() => {});
        await directory.removeEntry("staged.json").catch(() => {});
        await directory.removeEntry("model.gz").catch(() => {});
      }
      if (!fromCache || attempt || cachedOnly || error.code === "memory") throw error;
      cached = null;
      post("progress", { phase: "retry", fraction: 0 });
    }
  }
}
self.onmessage = async ({ data }) => {
  try {
    if (LOCAL_MODEL) data = { ...data, persist: false, cachedOnly: false, stageOnly: false };
    if (["prepare", "probe", "storage"].includes(data.type)) {
      const manifest = data.manifest ? validateManifest(data.manifest) : await fetchManifest();
      if (data.type === "probe") { post("support", await probe(manifest, data.persist)); return; }
      if (data.type === "storage") { post("support", await checkStorage(manifest.bytes)); return; }
      if (data.stageOnly) { post("ready", await stage(manifest)); return; }
      if (!ready) await prepare({ ...data, manifest });
      return;
    }
    if (data.type === "commit") {
      let cacheIssue = null;
      if (data.persist) {
        try {
          if (!await hasCachedModel(loadedInfo.manifest, true)) throw Error("Model cache is missing");
          const directory = await modelDirectory(loadedInfo.manifest);
          await writeJson(directory, "complete.json", { manifest: loadedInfo.manifest, savedAt: Date.now() });
          await selectCachedModel(loadedInfo.manifest);
          await directory.removeEntry("staged.json").catch(() => {});
          await pruneCachedModels(loadedInfo.manifest);
        }
        catch (error) { cacheIssue = storageIssue(error); }
      }
      post("committed", { id: data.id, cacheSaved: !!data.persist && !cacheIssue, cacheIssue }); return;
    }
    if (data.type !== "evaluate" || !ready) throw Error("VELA is not ready");
    const s = data.snapshot, start = performance.now();
    const fields = [s.position, s.diceUsed, +s.bonusRoll, s.hand.length, ...Array.from({ length: 5 }, (_, i) => s.hand[i] || 0), s.deckAvailable];
    module.HEAP32.set(fields, module._state_ptr() / 4);
    const best = module._evaluate_state();
    if (best < 0) throw Error(module.UTF8ToString(module._last_error()));
    const offset = module._values_ptr() / 8;
    post("result", { id: data.id, best, values: Array.from(module.HEAPF64.subarray(offset, offset + s.hand.length + 1)), elapsedMs: performance.now() - start });
  } catch (error) { post("error", { id: data.id, message: error.message, stack: error.stack, code: error.code || (error.name === "CompileError" ? "wasm" : "network") }); }
};
