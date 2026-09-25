import { dialog, confirmAction } from "./dialogs.js";
import { showDiagnostics } from "./diagnostics.js";
function helpSteps() {
  const alternate = new URLSearchParams(location.search).get("CtrlYn")?.toUpperCase() === "Y";
  const vela = document.querySelector("#settings-button").dataset.model === "vela";
  const keys = alternate ? ["1", "2", "3"] : ["Ctrl+Q", "Ctrl+E", "Ctrl+G"];
  return [
    ["플레이 모드", "#mode-button",
      "<strong>어시스트</strong>는 연결한 게임 화면에서 위치·주사위·카드를 읽어 추천에 반영합니다. 실제 게임은 직접 조작하세요.",
      "<strong>수동</strong>은 실제 게임의 위치·주사위·카드를 직접 입력하는 모드입니다.",
      "<strong>자동</strong>은 실제 게임 규칙으로 직접 플레이합니다. 실제 게임을 대신 조작하지 않습니다.",
      "중간부터 연결하면 실제 게임의 <strong>카드 획득 이력</strong>을 열고 위부터 아래까지 천천히 스크롤하세요. 새 게임은 바로 시작하며, 덱 초기화나 놓친 행동이 있으면 다시 확인을 요청합니다.",
      "읽기 어려운 값은 <strong>상단 안내의 직접 입력</strong>으로 보완할 수 있습니다. 확인 중에는 추천을 잠시 멈춥니다.",
      "추천 모델을 선택한 뒤 상단 <strong>음성</strong>에서 음성 안내를 켤 수 있습니다. 한국어·영어·일본어·중국어와 여성·남성 목소리 중에서 골라 사용할 수 있습니다. 음성을 받기 전에 용량을 확인할 수 있고, 브라우저 저장과 삭제도 가능합니다.",
      "<strong>모드변경</strong>으로 전환해도 마지막으로 확인한 상태는 유지됩니다. 어시스트의 화면 연결을 끝내려면 연결을 해제하거나 다른 모드로 전환하세요."],
    ["위치와 스테이지 이동", "#position-button",
      `현재 <strong>칸 번호</strong>를 누르면 위치를 입력할 수 있습니다. 수동 모드 단축키는 <kbd>${keys[0]}</kbd>입니다.`,
      `수동 모드에서는 <strong>캐릭터를 끌어</strong> 위치를 바꿀 수 있습니다. <strong>스테이지 화살표</strong>${alternate ? "" : "·방향키 ←/→"}는 수동·자동 모드에서 위치를 바꿉니다.`],
    ["주사위와 더블", "#roll-button",
      "<strong>수동</strong>에서는 주사위 버튼으로 더블 여부를 바꾸고, <strong>+2~+12</strong>로 나온 눈의 합을 입력합니다.",
      "<strong>자동</strong>에서는 주사위 버튼으로 두 개를 굴립니다. 더블이면 다음 주사위는 횟수를 소모하지 않습니다.",
      `<strong>주사위 사용 횟수</strong>를 눌러 수정할 수 있습니다. 수동 모드 단축키는 <kbd>${keys[1]}</kbd>입니다.`],
    ...(vela ? [["행동별 평가와 추천", "#estimates",
      "<strong>평가값이 높을수록 유리한 선택</strong>입니다. 추천은 가장 높은 값을 가진 선택이며 최종 점수 예측은 아닙니다.",
      "목록에 마우스를 올리면 행동별 값을 비교합니다. 클릭 또는 <kbd>Ctrl+R</kbd>로 다시 계산합니다.",
      "작은 화면에서는 <strong>비교</strong> 버튼을 누르세요. 터치에서는 목록을 길게 눌러도 열립니다.",
      "<strong>모델 선택</strong>을 누르면 모델을 바꿀 수 있습니다."]] : [["행동별 점수와 추천", "#estimates",
      "각 선택 이후를 시뮬레이션한 <strong>최종 점수의 평균</strong>입니다. ‘추천’은 평균이 가장 높은 선택, ‘근접’은 추천과 차이가 뚜렷하지 않은 선택입니다.",
      "행동별 점수는 선택을 비교하는 값으로, G3 추천을 매번 다시 계산하며 따를 때의 예상 최종 점수와는 다릅니다.",
      "점수 목록에 마우스를 올리면 전체 비교 표가 열립니다. 목록을 누르거나 <kbd>Ctrl+R</kbd>로 다시 계산합니다.",
      "작은 화면에서는 <strong>비교</strong> 버튼을 누르세요. 터치에서는 목록을 길게 눌러도 열립니다.",
      "<strong>모델 선택</strong>을 누르면 모델·계산 방식을 바꿀 수 있습니다.",
      { label: "통계 읽는 법", html: '<dl class="help-reference"><dt>표본 수</dt><dd>해당 선택을 시뮬레이션한 횟수</dd><dt>평균 / 중앙값</dt><dd>평균은 모든 결과의 평균, 중앙값은 결과를 정렬했을 때 가운데 값입니다. 비교 표의 대표값은 GPU 평균·CPU 중앙값이며 추천은 둘 다 평균 기준입니다.</dd><dt>범위</dt><dd>시뮬레이션에서 나온 최저~최고 점수</dd><dt>95% 신뢰구간</dt><dd>평균 추정의 불확실성을 나타냅니다. 한 판의 점수가 이 안에 나온다는 뜻은 아닙니다.</dd></dl>' }]]),
    ["예상 최종 점수", "#score-forecast",
      `현재 상태에서 <strong>${vela ? "VELA" : "G3-R100K"} 추천을 계속 따를 때</strong>의 최종 점수 예측입니다. 실제 결과를 보장하지 않으며 행동별 평가와 별도로 계산합니다.`,
      "괄호는 직전 상태 대비 변화입니다. 위치·카드 등을 직접 수정해도 변하므로 한 번의 행동 효과만 뜻하지는 않습니다.",
      "게임이 끝나면 실제 최종 점수를 표시합니다. 예측할 수 없으면 <strong>—</strong>로 표시합니다."],
    ["카드 사용과 추가", "#hand",
      "<strong>카드를 누르면 사용</strong>합니다. <kbd>Ctrl+1~5</kbd>로 해당 슬롯을 선택할 수도 있습니다.",
      "<strong>우클릭하면 이동 없이 바로 버립니다.</strong> 터치에서는 길게 누른 뒤 ‘버리기’를 선택하세요.",
      "수동 모드에서 <strong>배수 카드는 실제 주사위 눈의 합(2~12)</strong>을 선택해 사용합니다. 숫자 버튼을 누르거나 입력 후 <kbd>Enter</kbd>로 적용하며, <kbd>Esc</kbd> 또는 취소로 돌아갑니다.",
      `수동 모드에서 <strong>빈 슬롯</strong>이나 <kbd>${keys[2]}</kbd>로 카드를 검색해 추가합니다. 자동 모드에서는 카드 획득 칸에서 뽑습니다.`,
      { label: "카드 검색 예시", html: '<dl class="help-reference"><dt>이름 일부</dt><dd>카드 이름에 포함된 글자로 검색</dd><dt>+10 또는 10</dt><dd>앞으로 10칸</dd><dt>-5</dt><dd>뒤로 5칸</dd><dt>*2</dt><dd>주사위 2배</dd><dt>&gt;</dt><dd>다음 스테이지</dd></dl>' }],
    ["도착 미리보기", "#roll-button",
      "보드에는 <strong>도착 위치별 확률</strong>이 표시됩니다. 여러 주사위 결과가 같은 위치에 도착하면 확률을 합칩니다.",
      "주사위나 카드에 마우스를 올리면 카드칸·점프칸·멈춤칸 확률을 볼 수 있습니다. 현재 스테이지의 도착 위치는 보드 위에 표시됩니다.",
      "터치에서는 주사위를 길게 누르거나, 카드를 길게 누른 뒤 <strong>도착 예측</strong>을 선택하세요."],
    ["전체 카드와 획득 표시", "#card-info-button",
      "<strong>?</strong> 버튼으로 전체 카드 목록을 열고 닫습니다.",
      "수동 모드에서는 목록의 카드를 눌러 획득 표시를 바꾸고, 우클릭하거나 길게 누르면 손패에 추가할 수 있습니다.",
      "획득 표시만 바꿔도 손패는 바뀌지 않습니다. 손패에 추가하면 획득 표시도 함께 바뀝니다. 자동 모드에서는 획득 표시 해제만 가능합니다."],
    ["다시 시작", "#reset-button",
      "<strong>재시작</strong>을 누르고 확인하면 위치·주사위·카드가 초기화됩니다. 이 페이지를 열어 둔 동안의 최고 기록은 유지됩니다.",
      "조작이 헷갈리면 <strong>도움말</strong>에서 다시 확인하세요."],
  ].map(([title, target, ...content]) => ({
    title, target,
    paragraphs: content.filter((item) => typeof item === "string"),
    detail: content.find((item) => typeof item === "object"),
  }));
}
export function showHelp() {
  const steps = helpSteps();
  if (document.querySelector("dialog")) return;
  let index = 0,
    drag = null,
    confirming = false;
  const body = document.createElement("div");
  body.innerHTML =
    '<div class="help-spotlight" aria-hidden="true"></div><section class="help-bubble"><div class="help-arrow" aria-hidden="true"></div><header class="help-title"><span class="help-progress"></span><h3></h3></header><div class="help-content"><div class="help-copy"></div><button type="button" data-nav="detail" class="help-more" aria-controls="help-extra" aria-expanded="false" hidden>자세히</button><div id="help-extra" class="help-extra" hidden></div></div><footer><button data-nav="close" class="help-skip">건너뛰기</button><span></span><button data-nav="back" aria-label="이전 안내">이전</button><button data-nav="next" class="primary">다음</button></footer><div class="help-support"><span>문제가 있나요?</span><button type="button" class="help-diagnostics">진단 정보 저장</button></div></section>';
  const node = dialog("Adventure 사용 안내", body, { className: "help-tour" }),
    bubble = body.querySelector(".help-bubble"),
    spot = body.querySelector(".help-spotlight"),
    extra = body.querySelector(".help-extra"),
    arrow = body.querySelector(".help-arrow");
  body.querySelector(".help-diagnostics").onclick = showDiagnostics;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function place() {
    const target = document.querySelector(steps[index].target),
      r = target?.getBoundingClientRect(),
      w = bubble.offsetWidth,
      h = bubble.offsetHeight;
    spot.hidden = !r;
    if (r)
      Object.assign(spot.style, {
        left: r.left - 5 + "px",
        top: r.top - 5 + "px",
        width: r.width + 10 + "px",
        height: r.height + 10 + "px",
      });
    let x = (innerWidth - w) / 2,
      y = (innerHeight - h) / 2,
      side = "none";
    if (r) {
      if (r.right + 22 + w <= innerWidth - 12) {
        x = r.right + 22;
        y = r.top;
        side = "left";
      } else if (r.left - 22 - w >= 12) {
        x = r.left - 22 - w;
        y = r.top;
        side = "right";
      } else {
        x = r.left + (r.width - w) / 2;
        y = r.top - h - 22;
        side = "bottom";
        if (y < 12) {
          y = r.bottom + 22;
          side = "top";
        }
      }
    }
    x = clamp(x, 12, innerWidth - w - 12);
    y = clamp(y, 12, innerHeight - h - 12);
    Object.assign(bubble.style, { left: x + "px", top: y + "px" });
    arrow.dataset.side = side;
    if (r) {
      arrow.style.setProperty(
        "--arrow-x",
        clamp(r.left + r.width / 2 - x, 20, w - 20) + "px",
      );
      arrow.style.setProperty(
        "--arrow-y",
        clamp(r.top + r.height / 2 - y, 20, h - 20) + "px",
      );
    }
  }
  function render() {
    const { title, paragraphs, detail } = steps[index];
    bubble.querySelector("h3").textContent = title;
    bubble.querySelector(".help-copy").innerHTML = paragraphs.map((line) => `<p>${line}</p>`).join("");
    bubble.querySelector(".help-progress").textContent = `${index + 1} / ${steps.length}`;
    extra.innerHTML = detail?.html ?? "";
    extra.hidden = true;
    bubble.querySelector(".help-content").scrollTop = 0;
    const more = bubble.querySelector("[data-nav=detail]");
    more.hidden = !detail;
    more.textContent = detail?.label ?? "";
    more.setAttribute("aria-expanded", "false");
    bubble.querySelector("[data-nav=back]").disabled = index === 0;
    bubble.querySelector("[data-nav=next]").textContent =
      index === steps.length - 1 ? "완료" : "다음";
    place();
  }
  async function exit() {
    if (confirming) return;
    confirming = true;
    const close = await confirmAction(
      "도움말 종료",
      "도움말을 종료할까요? 도움말 버튼으로 언제든 다시 열 수 있습니다.",
    );
    confirming = false;
    if (close) node.close();
  }
  node.addEventListener("cancel", (e) => {
    e.preventDefault();
    exit();
  });
  body.onclick = (e) => {
    const nav = e.target.closest("[data-nav]")?.dataset.nav;
    if (nav === "close") exit();
    else if (nav === "detail") {
      extra.hidden = !extra.hidden;
      e.target.setAttribute("aria-expanded", String(!extra.hidden));
      e.target.textContent = extra.hidden ? steps[index].detail.label : "설명 접기";
      place();
    } else if (nav === "next") {
      if (index === steps.length - 1) node.close();
      else {
        index++;
        render();
      }
    } else if (nav === "back" && index) {
      index--;
      render();
    }
  };
  const heading = body.querySelector(".help-title");
  heading.onpointerdown = (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    const r = bubble.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
    heading.setPointerCapture(e.pointerId);
  };
  heading.onpointermove = (e) => {
    if (!drag) return;
    arrow.dataset.side = "none";
    bubble.style.left =
      clamp(
        drag.left + e.clientX - drag.x,
        12,
        innerWidth - bubble.offsetWidth - 12,
      ) + "px";
    bubble.style.top =
      clamp(
        drag.top + e.clientY - drag.y,
        12,
        innerHeight - bubble.offsetHeight - 12,
      ) + "px";
  };
  heading.onpointerup = heading.onpointercancel = () => (drag = null);
  window.addEventListener("resize", place);
  node.addEventListener(
    "close",
    () => window.removeEventListener("resize", place),
    { once: true },
  );
  render();
  bubble.querySelector("[data-nav=next]").focus({ preventScroll: true });
  return node;
}
