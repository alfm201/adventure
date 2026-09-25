export const LANGUAGES = [{ id: "ko", name: "한국어" }, { id: "en", name: "English" }, { id: "ja", name: "日本語" }, { id: "zh", name: "中文" }];
export const VOICES = ["F", "M"];
export const CACHE_PREFIX = "adventure-voice-";
export const CACHE_NAME = CACHE_PREFIX + "audio-gemini-v1";
const ROOT = new URL("../../public/voice/", import.meta.url);
export const packUrl = pack => new URL(pack.file, ROOT).href;

export async function loadVoiceCatalog() {
  const response = await fetch(new URL("manifest.json", ROOT), { cache: "no-cache" });
  if (!response.ok) throw Error("음성 목록을 불러오지 못했습니다. 잠시 후 다시 열어주세요.");
  const catalog = await response.json();
  const ids = new Set();
  if (catalog.schema !== 2 || !Array.isArray(catalog.packs) || catalog.packs.length < 1 || catalog.packs.length > LANGUAGES.length * VOICES.length) throw Error("음성 목록을 확인하지 못했습니다.");
  for (const pack of catalog.packs) {
    if (!LANGUAGES.some(lang => lang.id === pack.language) || !VOICES.includes(pack.voice) || pack.id !== `${pack.language}-${pack.voice}` ||
      !/^[a-f0-9]{64}$/.test(pack.sha256) || pack.file !== `${pack.id}-${pack.sha256.slice(0, 12)}.voice` ||
      !/^[a-f0-9]{12}$/.test(pack.version) || !Number.isSafeInteger(pack.bytes) || pack.bytes <= 12 || pack.bytes > 64 * 1024 * 1024 || ids.has(pack.id)) throw Error("음성 목록을 확인하지 못했습니다.");
    ids.add(pack.id); Object.freeze(pack);
  }
  return catalog.packs;
}
