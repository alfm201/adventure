import { GameRecognizer, findGameRegion } from "./vision.js";
import { RecognitionStatus } from "./status.js";
import { CharacterProbe } from "./character.js";
import { NumberRecovery } from "./number-recovery.js";

let recognizer, region, sourceSize, lastSearch = -Infinity;
let numberRecovery;
let searchIssue = "window";
const status = new RecognitionStatus();
const source = new OffscreenCanvas(1, 1), screen = new OffscreenCanvas(1234, 694);
const input = source.getContext("2d", { willReadFrequently: true });
const output = screen.getContext("2d", { willReadFrequently: true });

function crop(rect) {
  output.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, 1234, 694);
  return screen.getContext("2d").getImageData(0, 0, 1234, 694);
}
function align(rect, image) {
  const a = recognizer.anchor, pixels = image.data, width = image.width;
  let best = null, score = 0;
  for (const dy of [0, -.5, .5, -1, 1]) for (const dx of [0, -.5, .5, -1, 1]) {
    const x = rect.x + dx * rect.scale, y = rect.y + dy * rect.scale;
    // Sample only the structural points from the already captured search
    // image. Avoid 25 canvas crops/readbacks for every candidate window.
    const match = recognizer.structureScore((px, py) => {
      const sx = x + (a.x + px + .5) * rect.scale - .5;
      const sy = y + (a.y + py + .5) * rect.scale - .5;
      const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
      const at = (iy * width + ix) * 4, rgb = [];
      for (let c = 0; c < 3; c++) rgb.push(
        (pixels[at+c]*(1-fx)+pixels[at+4+c]*fx)*(1-fy) +
        (pixels[at+width*4+c]*(1-fx)+pixels[at+width*4+4+c]*fx)*fy);
      return rgb;
    });
    // Prefer the geometric origin over a tiny resampling-score fluctuation.
    if (match > score + .012) { score = match; best = { ...rect, x, y }; }
  }
  return score > .88 ? best : null;
}

self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try {
      // The optional probe must not delay screen recognition or make startup
      // fail when its small template file cannot be fetched.
      const optional = new AbortController(), timeout = setTimeout(() => optional.abort(), 2500);
      const characters = fetch(new URL("../../public/recognition/characters.json", import.meta.url), { signal: optional.signal })
        .then(response => response.ok ? response.json() : null)
        .then(value => value?.characters)
        .catch(() => null)
        .finally(() => clearTimeout(timeout));
      const response = await fetch(new URL("../../public/recognition/game.json", import.meta.url));
      if (!response.ok) throw Error("Recognition templates unavailable");
      const templates = await response.json();
      recognizer = new GameRecognizer(templates);
      numberRecovery = new NumberRecovery(recognizer);
      self.postMessage({ type: "ready" });
      characters.then(value => { if (Array.isArray(value)) recognizer.character = new CharacterProbe(value); });
    } catch (error) { self.postMessage({ type: "error", issue: "reader", error: { message: String(error?.message || error), stack: String(error?.stack || "") } }); }
    return;
  }
  const { bitmap, id, sourceFrame, context } = data;
  if (!bitmap) return;
  const started = performance.now();
  try {
    if (!recognizer) throw Error("Reader unavailable");
    const size = bitmap.width + "x" + bitmap.height;
    if (size !== sourceSize) { region = null; lastSearch = -Infinity; searchIssue = "window"; status.reset(); numberRecovery.reset(); sourceSize = size; source.width = bitmap.width; source.height = bitmap.height; }
    input.drawImage(bitmap, 0, 0);
    let observation = region ? recognizer.read(crop(region), context) : null;
    if (!observation?.visible && started - lastSearch > 1200) {
      lastSearch = started;
      searchIssue = region ? "covered" : "window";
      const searchImage = input.getImageData(0, 0, source.width, source.height);
      for (const candidate of findGameRegion(searchImage)) {
        const adjusted = align(candidate, searchImage);
        if (!adjusted) continue;
        if (candidate.scale < .9) { searchIssue = "small"; continue; }
        const result = recognizer.read(crop(adjusted), context);
        if (result.visible) { region = adjusted; observation = result; break; }
      }
    }
    try { observation = numberRecovery.update(source, region, observation, sourceFrame); }
    catch { numberRecovery.reset(); } // Supplemental sampling cannot invalidate the original read.
    if (observation?.visible) status.reset();
    else observation = { visible: false, issue: status.update(searchIssue, started) };
    self.postMessage({ type: "frame", id, observation,
      region, width: source.width, height: source.height, elapsed: performance.now() - started });
  } catch (error) { self.postMessage({ type: "frame", id, observation: { visible: false, issue: "reader" }, error: { message: String(error?.message || error), stack: String(error?.stack || "") } }); }
  finally { bitmap.close(); }
};
