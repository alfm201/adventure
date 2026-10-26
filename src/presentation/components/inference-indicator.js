// Presentation only: no inference polling or per-frame JavaScript updates.
export class InferenceIndicator {
  constructor(host) {
    this.element = document.createElement('span');
    this.element.className = 'estimate-progress';
    this.element.setAttribute('aria-hidden', 'true');
    const segment = document.createElement('span');
    segment.className = 'estimate-progress-segment';
    this.element.append(segment);
    host.append(this.element);
    this.running = false;
    this.timer = null;
  }
  update({ running, key, startedAt }) {
    if (running === this.running && (!running || key === this.key)) return;
    clearTimeout(this.timer);
    this.timer = null;
    this.running = running;
    this.key = key;
    this.element.classList.remove('is-visible');
    if (!running) return;
    const elapsed = Number.isFinite(startedAt) ? Math.max(0, performance.now() - startedAt) : 0;
    const show = () => {
      this.timer = null;
      if (this.running && this.key === key) {
        // A new segment starts its CSS animation at the left edge. Reusing the
        // paused node would resume its previous position. No layout flush is
        // needed, and jobs finishing before the display delay create no node.
        this.element.replaceChildren(this.element.firstElementChild.cloneNode(false));
        this.element.classList.add('is-visible');
      }
    };
    if (elapsed >= 150) show();
    else this.timer = setTimeout(show, 150 - elapsed);
  }
  dispose() {
    clearTimeout(this.timer);
    this.timer = null;
    this.running = false;
    this.element.remove();
  }
}
