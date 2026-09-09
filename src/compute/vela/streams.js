export async function gunzipStream() {
  if (typeof DecompressionStream === "function") {
    try { return new DecompressionStream("gzip"); } catch {}
  }
  const { Gunzip } = await import("../../vendor/fflate/browser.js");
  let decoder;
  return new TransformStream({
    start(controller) { decoder = new Gunzip(bytes => { if (bytes.length) controller.enqueue(bytes); }); },
    transform(bytes) { decoder.push(bytes, false); },
    flush() { decoder.push(new Uint8Array(0), true); },
  });
}

export async function consumeModel(stream, manifest, { writer, write = () => {}, progress = () => {}, cacheError = () => {} } = {}) {
  let received = 0, written = 0, verified = 0, buffered = 0;
  const block = new Uint8Array(manifest.chunkBytes);
  const verify = async () => {
    const digest = await crypto.subtle.digest("SHA-256", block.subarray(0, buffered));
    const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    if (hex !== manifest.chunkHashes[verified / manifest.chunkBytes]) throw Object.assign(Error("모델 파일을 확인하지 못했습니다."), { code: "integrity" });
    verified += buffered; buffered = 0;
  };
  let cacheWritten = !!writer;
  stream = stream.pipeThrough(new TransformStream({ async transform(chunk, controller) {
    received += chunk.byteLength;
    if (received > manifest.bytes) throw Error("Oversized model download");
    if (writer) {
      try { await writer.write(chunk); }
      catch (error) { await writer.abort().catch(() => {}); writer = null; cacheWritten = false; cacheError(error); }
    }
    progress({ received, written, verified });
    controller.enqueue(chunk);
  }})).pipeThrough(await gunzipStream());
  const reader = stream.getReader();
  try {
    while (true) {
      let timer;
      const { done, value } = await Promise.race([
        reader.read(),
        new Promise((_, reject) => timer = setTimeout(() => reject(Object.assign(Error("다운로드 응답이 지연되고 있습니다."), { code: "network" })), 45000)),
      ]).finally(() => clearTimeout(timer));
      if (done) break;
      if (written + value.length > manifest.decodedBytes) throw Error("Oversized model data");
      write(value, written);
      written += value.length;
      for (let offset = 0; offset < value.length;) {
        const size = Math.min(value.length - offset, block.length - buffered);
        block.set(value.subarray(offset, offset + size), buffered); buffered += size; offset += size;
        if (buffered === block.length) await verify();
      }
      progress({ received, written, verified });
    }
    if (written !== manifest.decodedBytes || received !== manifest.bytes) throw Object.assign(Error("모델 다운로드가 완료되지 않았습니다."), { code: "network" });
    if (buffered) await verify();
    if (writer) {
      try { await writer.close(); writer = null; }
      catch (error) { await writer.abort().catch(() => {}); writer = null; cacheWritten = false; cacheError(error); }
    }
    return { cacheWritten, received, written };
  } finally {
    await reader.cancel().catch(() => {}); reader.releaseLock();
    if (writer) await writer.abort().catch(() => {});
  }
}
