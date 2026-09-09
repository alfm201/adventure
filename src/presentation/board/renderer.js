import { tiles } from "../../rules/index.js";
import { tileLayout } from "../../content/board-layout.js";
import { project } from "../../environment/projection.js";
import { cellRect, characterRect } from "./geometry.js";
import { roundedRect } from "./path.js";
export class BoardRenderer {
  constructor(canvas, assets, onError = () => {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assets = assets;
    this.onError = onError;
    this.staticCanvas = document.createElement("canvas");
    this.staticCanvas.width = 1024;
    this.staticCanvas.height = 694;
    this.staticKey = null;
    this.frame = 0;
    this.assetChanged = () => { this.staticKey = null; this.draw(); };
    assets.addEventListener("change", this.assetChanged);
    this.preview = null;
    this.dragPosition = null;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.draw();
      else cancelAnimationFrame(this.frame);
    });
  }
  update(view) {
    if (this.view?.revision !== view.revision)
      this.defaultPreview = project(view.state, 0);
    this.view = view;
    this.draw();
  }
  setPreview(analysis) {
    this.preview = analysis;
    this.draw();
  }
  setDrag(position) {
    this.dragPosition = position;
    this.draw();
  }
  drawStatic(ctx, stage) {
    ctx.clearRect(0, 0, 1024, 694);
    const bg = this.assets.get(stage);
    if (bg) ctx.drawImage(bg, 0, 0, 1024, 694, 0, 0, 1024, 694);
    else {
      ctx.fillStyle = "#d9e7dc"; ctx.fillRect(0, 0, 1024, 694);
      for (const tile of tiles) if (tile.stage === stage) {
        const r = cellRect(tile.id);
        ctx.fillStyle = "#f5f8ef"; ctx.fillRect(r.x + 2, r.y + 2, r.width - 4, r.height - 4);
        ctx.fillStyle = "#50685c"; ctx.font = "15px Arial"; ctx.fillText(String(tile.id), r.x + 8, r.y + 22);
      }
    }
    const events = this.assets.get(76);
    for (const t of tiles) {
      if (t.stage !== stage) continue;
      const [sprite] = tileLayout[t.id - 1],
        r = cellRect(t.id);
      if (sprite && events)
        ctx.drawImage(
          events,
          ((sprite - 1) % 11) * 89,
          Math.floor((sprite - 1) / 11) * 89,
          89,
          89,
          r.x,
          r.y - 24,
          89,
          89,
        );
      if (!events && t.event) {
        ctx.fillStyle = "#435c50"; ctx.font = "bold 15px Arial";
        ctx.fillText(({2:"카드",6:"멈춤",9:"멈춤"})[t.event] || "", r.x + 8, r.y + 43);
      }
      if (t.jump) {
        ctx.font = "bold 50px Arial";
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        ctx.fillStyle = "white";
        ctx.strokeStyle = t.jump > 0 ? "blue" : "red";
        const text = (t.jump > 0 ? "+" : "") + t.jump;
        ctx.fillText(text, r.x, r.y + 46);
        ctx.strokeText(text, r.x, r.y + 46);
      }
    }
  }
  draw() {
    cancelAnimationFrame(this.frame);
    if (this.disposed || !this.view || document.hidden) return;
    const s = this.view.state,
      stage = tiles[s.position - 1].stage;
    const rect = this.canvas.getBoundingClientRect(),
      scale = Math.min(
        3,
        Math.max(1, ((globalThis.devicePixelRatio || 1) * rect.width) / 1024),
      ),
      w = Math.round(1024 * scale),
      h = Math.round(694 * scale);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const ctx = this.ctx;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, 1024, 694);
    this.assets.ensure(stage);
    const key = stage + ":" + !!this.assets.get(stage);
    if (this.staticKey !== key) {
      this.drawStatic(this.staticCanvas.getContext("2d"), stage);
      this.staticKey = key;
    }
    ctx.drawImage(this.staticCanvas, 0, 0);
    const sprite = this.assets.get(76);
    if (sprite)
      for (let i = 0; i < 12; i++) {
        const target = s.position + i + 2;
        if (target <= 2898 && tiles[target - 1].stage === stage) {
          const r = cellRect(target);
          ctx.drawImage(
            sprite,
            ((i + 19) % 11) * 89,
            Math.floor((i + 19) / 11) * 89,
            89,
            89,
            r.x,
            r.y,
            89,
            89,
          );
        }
      }
    const character = this.assets.get(77),
      r = characterRect(s.position);
    if (character) ctx.drawImage(character, 90, 0, 90, 120, r.x, r.y, 90, 120);
    else {
      ctx.fillStyle = "#296f70"; ctx.beginPath(); ctx.arc(r.x + 45, r.y + 62, 19, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "white"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center"; ctx.fillText("현재", r.x + 45, r.y + 68);
    }
    if (this.dragPosition && this.dragPosition !== s.position) {
      const r = cellRect(this.dragPosition),
        marker = this.assets.get(79);
      if (marker) ctx.drawImage(marker, 2, 923, 92, 92, r.x, r.y, 92, 92);
    }
    const analysis = this.preview || this.defaultPreview;
    if (!this.view.terminal)
      for (const outcome of analysis.outcomes) {
        if (tiles[outcome.score - 1].stage !== stage) continue;
        this.pulse(ctx, outcome, analysis.random);
      }
    if (!this.reduced.matches && !this.view.terminal)
      this.frame = requestAnimationFrame(() => this.draw());
  }
  pulse(ctx, o, random) {
    const r = cellRect(o.score),
      pulse = this.reduced.matches
        ? 0.5
        : 0.5 + 0.5 * Math.sin((performance.now() / 1200) * Math.PI * 2),
      rgb = random ? "236,72,153" : "250,204,21";
    ctx.save();
    ctx.shadowColor = `rgba(${rgb},${0.34 + pulse * 0.26})`;
    ctx.shadowBlur = 14 + pulse * 16;
    ctx.fillStyle = `rgba(${rgb},${0.08 + pulse * 0.06})`;
    ctx.lineWidth = 4 + pulse * 1.2;
    ctx.strokeStyle = `rgba(${rgb},${0.82 + pulse * 0.14})`;
    ctx.beginPath();
    roundedRect(ctx, r.x + 2.4, r.y + 2.4, r.width - 4.8, r.height - 4.8, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const pct = (o.count / o.denominator) * 100,
      text =
        o.denominator === 1
          ? "확정"
          : pct >= 10
            ? Math.round(pct) + "%"
            : pct.toFixed(1) + "%";
    const color = o.stop
      ? "#dc2626"
      : o.event === 2
        ? "#7c3aed"
        : o.jumpTotal > 0 || o.event === 4
          ? "#f97316"
          : "#475569";
    ctx.save();
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const width = Math.max(58, ctx.measureText(text).width + 20),
      x = r.x + r.width / 2 - width / 2,
      y = r.y + 3;
    ctx.shadowColor = "#000b";
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.97;
    ctx.fillStyle = color;
    ctx.beginPath();
    roundedRect(ctx, x, y, width, 30, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#ffffffe6";
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.strokeStyle = "#000e";
    ctx.lineWidth = 3;
    ctx.strokeText(text, x + width / 2, y + 16);
    ctx.fillText(text, x + width / 2, y + 16);
    ctx.restore();
  }
  dispose() {
    this.disposed = true;
    this.assets.removeEventListener("change", this.assetChanged);
    cancelAnimationFrame(this.frame);
  }
}
