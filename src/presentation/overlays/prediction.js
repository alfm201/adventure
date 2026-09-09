import { project } from "../../environment/projection.js";
import { number } from "../components/view.js";
export function placePopover(node, anchor, topAnchor = anchor) {
  const r = anchor.getBoundingClientRect();
  node.style.left =
    Math.max(8, Math.min(innerWidth - node.offsetWidth - 8, r.right + 8)) +
    "px";
  node.style.top =
    Math.max(8, Math.min(innerHeight - node.offsetHeight - 8, topAnchor.getBoundingClientRect().top)) + "px";
}
export class Prediction {
  constructor(session, renderer) {
    this.session = session;
    this.renderer = renderer;
    this.node = document.querySelector("#prediction");
    this.content = document.querySelector("#prediction-content");
  }
  hide() {
    this.node.hidden = true;
    this.renderer.setPreview(null);
  }
  show(action, anchor) {
    if (this.session.view.terminal || document.querySelector("dialog")) return;
    const state = this.session.state;
    if (action > state.hand.length) return;
    const analysis = project(state, action);
    this.renderer.setPreview(analysis);
    this.content.replaceChildren();
    const probabilities = document.createElement("div");
    probabilities.className = "prediction-probabilities";
    for (const [label, value, kind] of [
      ["카드칸", analysis.cardProbability, "card"],
      ["점프칸", analysis.jumpProbability, "jump"],
      ["멈춤칸", analysis.stopProbability, "stop"],
    ]) {
      const cell = document.createElement("div"), labelNode = document.createElement("strong"), valueNode = document.createElement("span");
      cell.className = kind;
      labelNode.textContent = label;
      valueNode.textContent = `${number(value * 100)}%`;
      cell.append(labelNode, valueNode);
      probabilities.append(cell);
    }
    this.content.append(probabilities);
    const r = anchor.getBoundingClientRect();
    this.node.hidden = false;
    const width = this.node.offsetWidth, height = this.node.offsetHeight;
    const left = action ? r.left + (r.width - width) / 2 : r.right + 12;
    const top = action ? r.top - 8 - height : r.top + (r.height - height) / 2;
    this.node.style.left = Math.max(12, Math.min(innerWidth - width - 12, left)) + "px";
    this.node.style.top = Math.max(12, Math.min(innerHeight - height - 12, top)) + "px";
  }
}
