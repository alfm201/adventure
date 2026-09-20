import { askValue, confirmAction, toast, dialog } from "../overlays/dialogs.js";
import { showModelSelection } from "../overlays/models.js";
import { showHelp } from "../overlays/help.js";
import { askMultiplierRoll } from "../overlays/multiplier.js";
import { bindOverview } from "../overlays/overview.js";
import { characterRect, positionAt } from "../board/geometry.js";
import { tiles, cards } from "../../rules/index.js";
import { cardLabels } from "../../content/cards.js";

export function bindInputs(session, coordinator, renderer, prediction) {
  const recalculate = () =>
    coordinator.enabled ? coordinator.recalculate() : showModelSelection(coordinator);
  const $ = (s) => document.querySelector(s),
    execute = (type, value, source) => {
      prediction.hide();
      try {
        return session.execute(type, value, source);
      } catch (error) {
        toast(error.message);
        return false;
      }
    };
  const search = async (source = "pointer") => {
    if (session.mode === "automatic" || session.state.hand.length >= 5) return;
    const value = await askValue(
      "카드 검색",
      { text: true, label: "이름 또는 효과", hint: "+숫자 · -숫자 · *배수 · >", placeholder: "카드 이름이나 효과 입력" },
    );
    if (value !== null) execute("search", value, source);
  };
  const edit = async (type, source = "pointer") => {
    if (source === "keyboard" && session.mode === "automatic") return;
    const position = type === "position",
      value = await askValue(
        position ? "현재 칸 변경" : "주사위 사용 횟수 변경",
        {
          value: session.state[position ? "position" : "diceUsed"],
          label: position ? "이동할 칸" : "사용한 주사위",
          min: position ? 1 : 0,
          max: position ? 2898 : 100,
        },
      );
    if (value !== null) execute(type, value, source);
  };
  const use = async (slot, source = "pointer") => {
    if (document.querySelector("dialog")) return;
    const card = cards[session.state.hand[slot - 1]];
    if (!card) return search(source);
    if (session.view.terminal) return;
    if (session.mode !== "manual" || card.type !== 2) return execute("card", slot, source);
    prediction.hide();
    const revision = session.revision, controller = new AbortController();
    const cancel = () => controller.abort();
    session.addEventListener("change", cancel, { once: true });
    try {
      const sum = await askMultiplierRoll(card.value, $(`#hand [data-slot="${slot}"]`), controller.signal);
      if (sum !== null && revision === session.revision) execute("card", { slot, sum }, source);
    } finally { session.removeEventListener("change", cancel); }
  };
  const discard = (slot) => {
    if (session.state.hand[slot - 1]) execute("discard", slot);
  };
  $("#position-button").onclick = () => edit("position");
  $("#dice-used-button").onclick = () => edit("diceUsed");
  $("#roll-button").onclick = () => execute("roll");
  $("#dice-buttons").onclick = (e) => {
    const button = e.target.closest("[data-sum]");
    if (button) execute("dice", Number(button.dataset.sum));
  };
  $("#settings-button").onclick = () => {
    prediction.hide();
    showModelSelection(coordinator);
  };
  $("#estimates").onclick = recalculate;
  $("#reset-button").onclick = async () => {
    if (await confirmAction("재시작", "현재 게임을 초기화할까요?"))
      execute("reset");
  };
  $("#mode-button").onclick = async () => {
    if (
      await confirmAction(
        "모드변경",
        `${session.mode === "automatic" ? "수동" : "자동"} 모드로 전환할까요? 현재 상태는 유지됩니다.`,
      )
    ) {
      execute("mode");
      toast(session.mode === "automatic" ? "자동 모드" : "수동 모드");
    }
  };
  $("#help-button").onclick = () => {
    prediction.hide();
    showHelp();
  };
  $("#prev-stage").onclick = () => execute("stage", -1);
  $("#next-stage").onclick = () => execute("stage", 1);
  $("#card-info-button").onclick = () => {
    const panel = $("#card-info");
    panel.hidden = !panel.hidden;
    $("#card-info-button").setAttribute("aria-expanded", String(!panel.hidden));
  };
  $("#card-info-list").onclick = (e) => {
    const b = e.target.closest("[data-card]");
    if (b) execute("obtained", Number(b.dataset.card));
  };
  $("#card-info-list").oncontextmenu = (e) => {
    const b = e.target.closest("[data-card]");
    if (b) {
      e.preventDefault();
      execute("acquire", Number(b.dataset.card));
    }
  };
  $("#card-info-list").addEventListener("keydown", (e) => {
    const b = e.target.closest("[data-card]");
    if (b && e.shiftKey && e.key === "Enter") {
      e.preventDefault();
      execute("acquire", Number(b.dataset.card));
    }
  });
  let infoTimer,
    infoPressed = false;
  $("#card-info-list").addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    infoPressed = false;
    const b = e.target.closest("[data-card]");
    if (b)
      infoTimer = setTimeout(() => {
        infoPressed = true;
        execute("acquire", Number(b.dataset.card));
      }, 600);
  });
  for (const event of ["pointerup", "pointercancel", "pointermove"])
    $("#card-info-list").addEventListener(event, () => clearTimeout(infoTimer));
  $("#card-info-list").addEventListener(
    "click",
    (e) => {
      if (infoPressed) {
        infoPressed = false;
        e.stopImmediatePropagation();
      }
    },
    { capture: true },
  );
  const cardMenu = (slot) => {
    const id = session.state.hand[slot - 1];
    if (!id || document.querySelector("dialog")) return;
    const revision = session.revision,
      body = document.createElement("div");
    body.innerHTML =
      '<p>카드 동작을 선택하세요.</p><footer><button data-card-action="preview">도착 예측</button><button data-card-action="discard">버리기</button><button data-card-action="close">닫기</button></footer>';
    const node = dialog(cardLabels[id - 1], body);
    body.onclick = (e) => {
      const action = e.target.dataset.cardAction;
      if (!action) return;
      node.close();
      if (revision !== session.revision) return;
      if (action === "discard") discard(slot);
      if (action === "preview")
        requestAnimationFrame(() =>
          prediction.show(slot, $(`#hand [data-slot="${slot}"]`)),
        );
    };
  };
  let longPress = null,
    suppressClick = false;
  $("#hand").onclick = (e) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const b = e.target.closest("[data-slot]");
    if (b) use(Number(b.dataset.slot));
  };
  $("#hand").oncontextmenu = (e) => {
    const b = e.target.closest("[data-slot]");
    if (b) {
      e.preventDefault();
      prediction.hide();
      discard(Number(b.dataset.slot));
    }
  };
  $("#hand").addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    suppressClick = false;
    const b = e.target.closest("[data-slot]");
    if (b)
      longPress = setTimeout(() => {
        suppressClick = true;
        prediction.hide();
        cardMenu(Number(b.dataset.slot));
      }, 600);
  });
  for (const event of ["pointerup", "pointercancel", "pointermove"])
    $("#hand").addEventListener(event, () => clearTimeout(longPress));
  $("#hand").addEventListener("keydown", (e) => {
    const b = e.target.closest("[data-slot]");
    if (
      b &&
      (e.key === "Delete" ||
        e.key === "ContextMenu" ||
        (e.shiftKey && e.key === "F10"))
    ) {
      e.preventDefault();
      cardMenu(Number(b.dataset.slot));
    }
  });
  let rollTimer,
    rollPreview = false;
  $("#roll-button").addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    rollPreview = false;
    rollTimer = setTimeout(() => {
      rollPreview = true;
      prediction.show(0, $("#roll-button"));
    }, 600);
  });
  for (const event of ["pointerup", "pointercancel", "pointermove"])
    $("#roll-button").addEventListener(event, () => clearTimeout(rollTimer));
  $("#roll-button").addEventListener(
    "click",
    (e) => {
      if (rollPreview) {
        rollPreview = false;
        e.stopImmediatePropagation();
      }
    },
    { capture: true },
  );
  const hover = (element, action) => {
    element.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") prediction.show(action(), element);
    });
    element.addEventListener("pointerleave", () => prediction.hide());
    element.addEventListener("focus", () => prediction.show(action(), element));
    element.addEventListener("blur", () => prediction.hide());
  };
  hover($("#roll-button"), () => 0);
  for (const b of $("#hand").children) hover(b, () => Number(b.dataset.slot));
  bindOverview(coordinator, prediction);
  document.addEventListener("keydown", (e) => {
    if (!$("#loading").hidden) return;
    if (e.key === "Escape") {
      prediction.hide();
      $("#card-info").hidden = true;
      $("#card-info-button").setAttribute("aria-expanded", "false");
      return;
    }
    if (
      document.querySelector("dialog") ||
      e.target.closest("input,textarea,select,[contenteditable=true]") ||
      e.repeat ||
      e.altKey ||
      e.metaKey
    )
      return;
    const alternate =
        new URLSearchParams(location.search).get("CtrlYn")?.toUpperCase() ===
        "Y",
      key = e.key.toLowerCase();
    let task;
    if (e.ctrlKey && key === "r") task = recalculate;
    else if (e.ctrlKey && /^[1-5]$/.test(key))
      task = () => use(Number(key), "keyboard");
    else if (alternate && !e.ctrlKey && ["1", "2", "3"].includes(key))
      task =
        key === "1"
          ? () => edit("position", "keyboard")
          : key === "2"
            ? () => edit("diceUsed", "keyboard")
            : () => search("keyboard");
    else if (!alternate && e.ctrlKey && ["q", "e", "g"].includes(key))
      task =
        key === "q"
          ? () => edit("position", "keyboard")
          : key === "e"
            ? () => edit("diceUsed", "keyboard")
            : () => search("keyboard");
    else if (
      !alternate &&
      !e.ctrlKey &&
      ["ArrowLeft", "ArrowRight"].includes(e.key)
    )
      task = () => execute("stage", e.key === "ArrowLeft" ? -1 : 1, "keyboard");
    if (task) {
      e.preventDefault();
      task();
    }
  });
  const target = $("#character-target"),
    canvas = $("#board-canvas");
  let drag = null;
  const positionTarget = () => {
    const r = characterRect(session.state.position);
    target.style.left = r.x + "px";
    target.style.top = r.y + "px";
    target.disabled = session.mode === "automatic";
  };
  session.addEventListener("change", () => {
    drag = null;
    renderer.setDrag(null);
    positionTarget();
    prediction.hide();
  });
  positionTarget();
  target.addEventListener("pointerdown", (e) => {
    if (session.mode === "automatic" || e.button !== 0) return;
    drag = {
      id: e.pointerId,
      position: session.state.position,
      revision: session.revision,
    };
    target.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  target.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    drag.position = positionAt(
      e.clientX,
      e.clientY,
      canvas,
      tiles[session.state.position - 1].stage,
    );
    renderer.setDrag(drag.position);
  });
  target.addEventListener("pointerup", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const { position, revision } = drag;
    drag = null;
    renderer.setDrag(null);
    if (
      position &&
      revision === session.revision &&
      position !== session.state.position
    )
      execute("drag", position);
  });
  target.addEventListener("pointercancel", () => {
    drag = null;
    renderer.setDrag(null);
  });
  addEventListener("blur", () => {
    drag = null;
    clearTimeout(longPress);
    clearTimeout(infoTimer);
    clearTimeout(rollTimer);
    renderer.setDrag(null);
    prediction.hide();
  });
  target.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      edit("position");
    }
  });
}
