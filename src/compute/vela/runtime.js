import { MODEL_URL, LOCAL_MODEL } from "./model.js";
import { writeBytes, storageIssue } from "./files.js";
import { deadline } from "../../platform/requests.js";

const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
export async function responseFor(url, buffered = false) {
  const request = deadline(null, 15000);
  try {
    const response = await fetch(url, { cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", signal: request.signal });
    if (response.status !== 200) throw Object.assign(Error("파일을 불러오지 못했습니다."), {
      code: LOCAL_MODEL && response.status === 404 && new URL(url).pathname === new URL("model.bin.gz", MODEL_URL).pathname ? "local-model-missing" : "network",
    });
    return buffered ? await response.arrayBuffer() : response;
  } finally { request.dispose(); }
}
async function readRuntime(manifest, directory) {
  return Promise.all(["module", "wasm"].map(async name => {
    const record = manifest.runtime[name];
    const buffer = directory
      ? await (await (await directory.getFileHandle(name === "module" ? "module.mjs" : "module.wasm")).getFile()).arrayBuffer()
      : await responseFor(new URL(record.file, MODEL_URL), true);
    if (buffer.byteLength !== record.bytes || hex(await crypto.subtle.digest("SHA-256", buffer)) !== record.sha256)
      throw Object.assign(Error("모델 실행 파일을 확인하지 못했습니다."), { code: "integrity" });
    return buffer;
  }));
}
export async function saveRuntime(directory, files) {
  for (const [index, name] of ["module.mjs", "module.wasm"].entries()) await writeBytes(directory, name, new Uint8Array(files[index]));
}
export async function runtimeFiles(manifest, directory) {
  if (directory) {
    try { return { files: await readRuntime(manifest, directory), cacheIssue: null }; }
    catch {
      const files = await readRuntime(manifest);
      try { await saveRuntime(directory, files); }
      catch (error) { return { files, cacheIssue: storageIssue(error) }; }
      return { files, cacheIssue: null };
    }
  }
  return { files: await readRuntime(manifest), cacheIssue: null };
}
export async function createRuntime(files, manifest) {
  const url = URL.createObjectURL(new Blob([files[0]], { type: "text/javascript" }));
  try {
    const { default: createModule } = await import(url);
    return await createModule({ wasmBinary: files[1], locateFile: () => new URL(manifest.runtime.wasm.file, MODEL_URL).href });
  } finally { URL.revokeObjectURL(url); }
}
