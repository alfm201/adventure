export function storageIssue(error) {
  if (error?.code === "storage-unsupported" || error instanceof TypeError) return "storage-unsupported";
  if (error?.name === "QuotaExceededError") return "storage-full";
  if (["NotAllowedError", "SecurityError"].includes(error?.name)) return "storage-denied";
  if (error?.name === "NoModificationAllowedError") return "storage-busy";
  return "storage-failed";
}
export async function fileWriter(directory, name) {
  const file = await directory.getFileHandle(name, { create: true });
  let access, offset = 0;
  if (typeof file.createSyncAccessHandle === "function") {
    access = await file.createSyncAccessHandle();
    try { await access.truncate(0); } catch (error) { await access.close(); throw error; }
    return {
      async write(bytes) {
        const count = access.write(bytes, { at: offset });
        if (count !== bytes.byteLength) throw Object.assign(Error("Incomplete cache write"), { name: "QuotaExceededError" });
        offset += count;
      },
      async close() { try { await access.flush(); } finally { await access.close(); } },
      async abort() { try { await access.close(); } catch {} },
    };
  }
  if (typeof file.createWritable === "function") {
    access = await file.createWritable();
    return { write: bytes => access.write(bytes), close: () => access.close(), abort: () => access.abort() };
  }
  throw Object.assign(Error("Storage unavailable"), { code: "storage-unsupported" });
}
export async function writeBytes(directory, name, bytes) {
  const writer = await fileWriter(directory, name);
  try { await writer.write(bytes); await writer.close(); }
  catch (error) { await writer.abort().catch(() => {}); throw error; }
}
export async function checkStorage(requiredBytes = 0) {
  if (!navigator.storage?.getDirectory) return { available: false, code: "storage-unsupported" };
  let root, name;
  try {
    root = await navigator.storage.getDirectory();
    name = "vela-check-" + (crypto.randomUUID?.() || Math.random().toString(36).slice(2));
    const bytes = new Uint8Array([86, 69, 76, 65]);
    await writeBytes(root, name, bytes);
    const actual = new Uint8Array(await (await (await root.getFileHandle(name)).getFile()).arrayBuffer());
    if (actual.length !== bytes.length || actual.some((value, index) => value !== bytes[index])) throw Error("Cache read failed");
    const estimate = await navigator.storage.estimate?.().catch(() => null);
    const availableBytes = Number.isFinite(estimate?.quota) && Number.isFinite(estimate?.usage) ? Math.max(0, estimate.quota - estimate.usage) : null;
    if (availableBytes !== null && availableBytes < requiredBytes) return { available: false, code: "storage-full", availableBytes };
    return { available: true, availableBytes };
  } catch (error) { return { available: false, code: storageIssue(error) }; }
  finally { if (root && name) await root.removeEntry(name).catch(() => {}); }
}
