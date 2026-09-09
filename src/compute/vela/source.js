export const MODEL_ORIGIN = "https://adventure.alfm201.workers.dev";

export function isLocalModelSource(value) {
  const url = new URL(value);
  const hostname = url.hostname;
  return url.protocol === "file:" || hostname === "localhost" ||
    hostname.endsWith(".localhost") || hostname === "[::1]" ||
    /^127\.\d+\.\d+\.\d+$/.test(hostname);
}

export function isHttpsOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value;
  } catch { return false; }
}

export const modelPath = ({ id }) => `/models/${id}/model.bin.gz`;
