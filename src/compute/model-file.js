export const fileError = code => Object.assign(new Error(code), { code });

export async function readModelFile(file, manifest, signal) {
  signal?.throwIfAborted();
  if (!file || file.size !== manifest.bytes) throw fileError('model-file-size');
  let bytes;
  try { bytes = await file.arrayBuffer(); }
  catch (error) { signal?.throwIfAborted(); throw fileError('model-file-read'); }
  signal?.throwIfAborted();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  signal?.throwIfAborted();
  const hash = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
  if (hash !== manifest.sha256) throw fileError('model-file-integrity');
  return bytes;
}
