export function screenCaptureSupport() {
  if (!globalThis.isSecureContext) return { available: false, issue: "insecure" };
  if (typeof globalThis.navigator?.mediaDevices?.getDisplayMedia !== "function")
    return { available: false, issue: "unsupported" };
  if (typeof Worker !== "function" || typeof OffscreenCanvas !== "function" || typeof createImageBitmap !== "function")
    return { available: false, issue: "recognition-support" };
  return { available: true };
}

export function captureScreen() {
  return navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 30, max: 60 }, cursor: "never" },
    audio: false,
    selfBrowserSurface: "exclude",
  });
}
