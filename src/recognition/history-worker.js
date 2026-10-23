import { GameRecognizer } from "./vision.js";
import { FrameHistory } from "./frame-history.js";
import { NumberRecovery } from "./number-recovery.js";

const history = new FrameHistory();
const source = new OffscreenCanvas(1, 1), screen = new OffscreenCanvas(1234, 694);
const input = source.getContext("2d"), output = screen.getContext("2d", { willReadFrequently: true });
let recognizer, numberRecovery, regionKey, historyRegion;
self.onmessage = async ({ data }) => {
  if (data.type === "replay") {
    try {
      const result = recognizer && JSON.stringify(data.region) === JSON.stringify(historyRegion)
        ? history.replay(recognizer, data.after, data.before) : { rows: [], reread: 0 };
      self.postMessage({ type: "replay", token: data.token, region: data.region, after: data.after, ...result });
    } catch { self.postMessage({ type: "replay", token: data.token, region: data.region, after: data.after, rows: [], reread: 0 }); }
    return;
  }
  if (data.type === "init") {
    try {
      const response = await fetch(new URL("../../public/recognition/game.json", import.meta.url));
      if (!response.ok) throw Error("History templates unavailable");
      recognizer = new GameRecognizer(await response.json());
      numberRecovery = new NumberRecovery(recognizer, {tiles:true});
      self.postMessage({ type: "ready" });
    } catch { self.postMessage({ type: "disabled" }); }
    return;
  }
  const { bitmap, region, at, id, sourceFrame } = data;
  if (!bitmap) return;
  try {
    const key = JSON.stringify([bitmap.width, bitmap.height, region]);
    if (key !== regionKey) { history.clear(); numberRecovery.reset(); regionKey = key; historyRegion = region; }
    if (source.width !== bitmap.width || source.height !== bitmap.height) { source.width = bitmap.width; source.height = bitmap.height; }
    input.drawImage(bitmap, 0, 0);
    output.drawImage(source, region.x, region.y, region.width, region.height, 0, 0, 1234, 694);
    const image = output.getImageData(0, 0, 1234, 694);
    let observation = recognizer.readCore(image, { allowOverlay: true });
    // Share the main reader's conservative number gates. Original pixels
    // still have to pass visibility; retained values never come from the future.
    recognizer.data = image.data;
    try { observation = numberRecovery.update(source, region, observation, sourceFrame); }
    catch { numberRecovery.reset(); }
    if (observation.visible) history.add(image, at, observation);
    else history.prune(at);
    self.postMessage({ type: "frame", id, at, region, observation, history: history.stats });
  } catch { self.postMessage({ type: "frame", id, at, region, observation: { visible: false }, history: history.stats }); }
  finally { bitmap.close(); }
};
