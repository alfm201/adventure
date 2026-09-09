import { diagnostics } from "../../platform/report.js";
import { dialog, toast } from "./dialogs.js";
import { syncNotifications } from "./notifications.js";

export function showDiagnostics() {
  if (document.querySelector(".diagnostics-dialog")) return;
  const body = document.createElement("div");
  body.innerHTML = '<p>문제 확인에 필요한 게임·브라우저 정보를 저장합니다. 문의할 때 파일을 첨부해 주세요.</p><p class="dialog-hint">자동으로 전송되지 않습니다.</p><footer><button type="button" class="primary">파일 저장</button><button type="button" class="diagnostics-cancel">취소</button></footer>';
  const node = dialog("진단 정보", body, { className: "diagnostics-dialog" });
  body.querySelector(".diagnostics-cancel").onclick = () => node.close();
  body.querySelector(".primary").onclick = () => {
    if (diagnostics.download()) node.close();
    else toast("파일을 저장하지 못했습니다. 브라우저의 다운로드 설정을 확인해 주세요.");
  };
  return node;
}
export function bindDiagnostics() {
  const notice = document.querySelector("#debug-notice");
  let timer;
  notice.querySelector("button").onclick = () => { notice.hidden = true; syncNotifications(); showDiagnostics(); };
  diagnostics.subscribe(() => {
    notice.hidden = false; syncNotifications(); clearTimeout(timer);
    timer = setTimeout(() => { notice.hidden = true; syncNotifications(); }, 8000);
  });
}
