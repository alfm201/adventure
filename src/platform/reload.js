// 새 버전 안내에서 쓰는 새로고침.
//
// 일반 새로고침은 브라우저가 아직 유효하다고 보는 파일을 다시 받지 않는다. 정적 호스팅은 파일마다
// 캐시 수명을 주므로(GitHub Pages는 10분), 그 안에 받은 파일은 새로고침한 뒤에도 예전 것으로 뜰 수 있다.
// 그래서 새로고침하기 전에 이 화면이 읽은 파일을 캐시를 건너뛰고 다시 받아, 브라우저가 보관한 예전 파일을
// 새 파일로 바꿔 둔다. worker 안에서만 읽는 파일은 여기서 알 수 없으므로, 새로고침한 뒤 얼마 지나지 않아
// 같은 안내가 다시 필요해지면 새로고침을 되풀이시키지 않고 조금 기다려 달라고 알린다.
import { VERSION_MISMATCH, VERSION_STALE } from "../compute/version.js";

const KEY = "adventure-version-reload";
const RECENT_MS = 15 * 60 * 1000;
const REFRESH_TIMEOUT_MS = 8000;

// 이 화면이 읽은 같은 출처의 문서·스크립트·스타일·설정 파일의 주소.
export function ownFiles() {
  const origin = location.origin + "/";
  const urls = new Set([location.origin + location.pathname]);
  for (const { name } of performance.getEntriesByType("resource")) {
    if (name.startsWith(origin) && /\.(?:m?js|css|json|html)$/.test(new URL(name).pathname)) urls.add(name);
  }
  return [...urls];
}

// 그 파일들을 캐시를 건너뛰고 다시 받는다. 받은 응답은 브라우저의 캐시를 새 파일로 바꾼다.
// 일부가 실패하거나 시간이 걸려도 새로고침은 이어서 한다.
export async function refreshOwnFiles() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
  try {
    await Promise.allSettled(ownFiles().map(async (url) => {
      await (await fetch(url, { cache: "reload", signal: controller.signal })).arrayBuffer();
    }));
  } finally { clearTimeout(timer); }
}

export async function reloadForNewVersion() {
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch {}
  try { await refreshOwnFiles(); } catch {}
  location.reload();
}

export function reloadedForNewVersion() {
  try {
    const at = Number(sessionStorage.getItem(KEY));
    return at > 0 && Date.now() - at < RECENT_MS;
  } catch { return false; }
}

// 새 버전 안내에 쓸 문구의 코드(content/compatibility.js).
// 방금 이 안내로 새로고침했는데 다시 필요해졌다면 기다려 달라는 안내로 바꾼다.
export function versionNoticeCode() {
  return reloadedForNewVersion() ? VERSION_STALE : VERSION_MISMATCH;
}
