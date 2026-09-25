import { GameRecognizer, findGameRegion } from "./vision.js";

let recognizer, region, sourceSize, lastSearch = -Infinity;
const source = new OffscreenCanvas(1, 1), screen = new OffscreenCanvas(1234, 694);
const input = source.getContext("2d", { willReadFrequently: true });
const output = screen.getContext("2d", { willReadFrequently: true });
const anchorCanvas = new OffscreenCanvas(103, 14), anchorOutput = anchorCanvas.getContext("2d", { willReadFrequently: true });

function crop(rect) {
  output.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, 1234, 694);
  return screen.getContext("2d").getImageData(0, 0, 1234, 694);
}
function align(rect) {
  const a = recognizer.anchor;
  let best = null, score = 0;
  for (const dy of [0, -.5, .5, -1, 1]) for (const dx of [0, -.5, .5, -1, 1]) {
    const x = rect.x + dx * rect.scale, y = rect.y + dy * rect.scale;
    anchorOutput.drawImage(source, x + a.x * rect.scale, y + a.y * rect.scale, a.width * rect.scale, a.height * rect.scale, 0, 0, a.width, a.height);
    const match = recognizer.anchorScore(anchorOutput.getImageData(0, 0, a.width, a.height));
    if (match > score) { score = match; best = { ...rect, x, y }; }
  }
  return score > .62 ? best : null;
}

self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try {
      const response = await fetch(new URL("../../public/recognition/game.json", import.meta.url));
      if (!response.ok) throw Error("Recognition templates unavailable");
      recognizer = new GameRecognizer(await response.json());
      self.postMessage({ type: "ready" });
    } catch (error) { self.postMessage({ type: "error", issue: "reader", error: { message: String(error?.message || error), stack: String(error?.stack || "") } }); }
    return;
  }
  const { bitmap, id } = data;
  if (!bitmap) return;
  const started = performance.now();
  try {
    if (!recognizer) throw Error("Reader unavailable");
    const size = bitmap.width + "x" + bitmap.height;
    if (size !== sourceSize) { region = null; lastSearch = -Infinity; sourceSize = size; source.width = bitmap.width; source.height = bitmap.height; }
    input.drawImage(bitmap, 0, 0);
    let observation = region ? recognizer.read(crop(region)) : null;
    if (!observation?.visible && started - lastSearch > 1200) {
      lastSearch = started;
      for (const candidate of findGameRegion(input.getImageData(0, 0, source.width, source.height))) {
        if (candidate.scale < .9) { observation ||= { visible: false, issue: "small" }; continue; }
        const adjusted = align(candidate);
        if (!adjusted) continue;
        const result = recognizer.read(crop(adjusted));
        if (result.visible) { region = adjusted; observation = result; break; }
      }
    }
    self.postMessage({ type: "frame", id, observation: observation || { visible: false, issue: "window" },
      region, width: source.width, height: source.height, elapsed: performance.now() - started });
  } catch (error) { self.postMessage({ type: "frame", id, observation: { visible: false, issue: "reader" }, error: { message: String(error?.message || error), stack: String(error?.stack || "") } }); }
  finally { bitmap.close(); }
};
