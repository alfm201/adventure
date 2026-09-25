export function magneticVolume(percent) {
  const raw = Math.max(0, Math.min(100, percent)), anchor = Math.round(raw / 5) * 5;
  const delta = raw - anchor, distance = Math.abs(delta), radius = 1.5;
  const pull = distance < radius ? .8 * (1 - (distance / radius) ** 2) ** 2 : 0;
  return Math.max(0, Math.min(100, Math.round(raw - delta * pull)));
}

export function bindVolumeSlider(input) {
  let pointer = null;
  const move = event => {
    const bounds = input.getBoundingClientRect(), travel = Math.max(1, bounds.width - 16);
    const next = magneticVolume((event.clientX - bounds.left - 8) / travel * 100);
    if (Number(input.value) === next) return;
    input.value = String(next); input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  input.addEventListener("pointerdown", event => {
    if (input.matches(":disabled") || !event.isPrimary || event.button !== 0) return;
    event.preventDefault(); input.focus({ preventScroll: true });
    pointer = event.pointerId; input.setPointerCapture(pointer); move(event);
  });
  input.addEventListener("pointermove", event => { if (event.pointerId === pointer) { event.preventDefault(); move(event); } });
  for (const type of ["touchstart", "touchmove"])
    input.addEventListener(type, event => { if (pointer !== null) event.preventDefault(); }, { passive: false });
  const end = event => {
    if (event.pointerId !== pointer) return;
    pointer = null;
    if (input.hasPointerCapture(event.pointerId)) input.releasePointerCapture(event.pointerId);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  input.addEventListener("pointerup", end); input.addEventListener("pointercancel", end); input.addEventListener("lostpointercapture", end);
}
