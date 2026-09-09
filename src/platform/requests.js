export const abortError = (signal) => signal?.reason || new DOMException("Cancelled", "AbortError");

export function deadline(signal, milliseconds = 8000) {
  const controller = new AbortController();
  const cancel = () => controller.abort(abortError(signal));
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), milliseconds);
  return {
    signal: controller.signal,
    dispose() { clearTimeout(timer); signal?.removeEventListener("abort", cancel); },
  };
}

export async function fetchJson(url, { signal, timeout = 8000 } = {}) {
  const request = deadline(signal, timeout);
  try {
    const response = await fetch(url, { cache: "no-store", signal: request.signal });
    if (!response.ok) throw Error("파일을 불러오지 못했습니다.");
    return await response.json();
  } finally { request.dispose(); }
}
