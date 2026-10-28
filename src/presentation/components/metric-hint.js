import { setLocalizedText } from '../../localization/index.js';

let sequence = 0;
export function bindMetricHints(modal, items) {
  const tip = document.createElement('div');
  tip.className = 'run-tooltip run-metric-tooltip'; tip.role = 'tooltip';
  tip.id = `metric-tip-${++sequence}`; tip.hidden = true; modal.append(tip);
  let active;
  const hide = () => { tip.hidden = true; active?.removeAttribute('aria-describedby'); active = null; };
  const place = () => {
    if (!active) return;
    const r = active.getBoundingClientRect(), box = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(10, Math.min(innerWidth - box.width - 10, r.left + r.width / 2 - box.width / 2))}px`;
    tip.style.top = `${Math.max(10, Math.min(innerHeight - box.height - 10, r.top > box.height + 14 ? r.top - box.height - 8 : r.bottom + 8))}px`;
  };
  const show = ({ button, text }) => {
    hide(); active = button; setLocalizedText(tip, text); tip.hidden = false;
    button.setAttribute('aria-describedby', tip.id);
    place();
  };
  for (const item of items) {
    item.button.onpointerenter = event => { if (event.pointerType !== 'touch') show(item); };
    item.button.onpointerleave = event => { if (event.pointerType !== 'touch' && document.activeElement !== item.button) hide(); };
    item.button.onfocus = () => show(item);
    item.button.onblur = hide;
    item.button.onclick = () => show(item);
  }
  const outside = event => { if (!items.some(({ button }) => button.contains(event.target))) hide(); };
  const cancel = event => { if (active) { hide(); event.preventDefault(); } };
  document.addEventListener('pointerdown', outside, true);
  modal.addEventListener('cancel', cancel);
  const scroll = () => { if (active && document.activeElement === active) place(); else hide(); };
  addEventListener('resize', hide); addEventListener('scroll', scroll, true);
  addEventListener('adventurelanguagechange', hide);
  modal.addEventListener('closing', hide);
  modal.addEventListener('close', () => {
    hide(); document.removeEventListener('pointerdown', outside, true);
    modal.removeEventListener('cancel', cancel);
    removeEventListener('resize', hide); removeEventListener('scroll', scroll, true);
    removeEventListener('adventurelanguagechange', hide);
  }, { once: true });
  return { hide };
}
