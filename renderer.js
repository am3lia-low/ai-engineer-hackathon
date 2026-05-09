const cat = window.desktopCat;

const $panel = document.getElementById("panel");
const $mode = document.getElementById("panel-mode");
const $title = document.getElementById("panel-title");
const $close = document.getElementById("panel-close");
const $tabs = document.getElementById("panel-tabs");
const $tabButtons = $tabs.querySelectorAll(".tab");
const $spinner = document.getElementById("panel-spinner");
const $content = document.getElementById("panel-content");
const $actions = document.getElementById("panel-actions");
const $copy = document.getElementById("copy-btn");
const $catWrapper = document.getElementById("cat-wrapper");
const $catStack = document.getElementById("cat-stack");
const $awake = document.getElementById("cat-awake");
const $puddle = document.getElementById("cat-puddle");

const POLL_MS = 4000;
const SLEEP_AFTER_MS = 22000;
const THINKING_LINES = [
  "...let me peek",
  "...one moment",
  "...reading",
  "hm, hold on",
  "...looking",
];

const state = {
  mode: "idle",
  fingerprint: "",
  emailResult: null,
  pdfResult: "",
  activeTab: "summary",
  inFlight: false,
  dismissed: false,
  sprite: "puddle",
  lastActiveAt: 0,
};

function pickThinking() {
  return THINKING_LINES[Math.floor(Math.random() * THINKING_LINES.length)];
}

function fingerprint(ctx) {
  if (!ctx) return "";
  if (ctx.mode === "email" && ctx.mail) {
    return `mail:${ctx.mail.subject}|${ctx.mail.sender}|${ctx.mail.body.length}`;
  }
  if (ctx.mode === "pdf") {
    return `pdf:${ctx.appName}|${ctx.title}`;
  }
  return "idle";
}

function setSprite(name) {
  if (state.sprite === name) return;
  state.sprite = name;
  if (name === "awake") {
    $awake.classList.add("active");
    $puddle.classList.remove("active");
  } else {
    $puddle.classList.add("active");
    $awake.classList.remove("active");
  }
}

function pokeAwake() {
  state.lastActiveAt = Date.now();
  setSprite("awake");
}

function playOnce(cls) {
  $catStack.classList.remove(cls);
  void $catStack.offsetWidth;
  $catStack.classList.add(cls);
  setTimeout(() => $catStack.classList.remove(cls), 1000);
}

function perk() {
  playOnce("perk");
}

function tiltSometimes() {
  if (state.sprite !== "awake") return;
  if (Math.random() < 0.5) playOnce("tilt-left");
  else playOnce("tilt-right");
}

function maybeSleep() {
  if (state.sprite !== "awake") return;
  const panelHidden = $panel.classList.contains("hidden");
  if (panelHidden && Date.now() - state.lastActiveAt > SLEEP_AFTER_MS) {
    setSprite("puddle");
  }
}

function showPanel() {
  state.dismissed = false;
  $panel.classList.remove("hidden");
  requestAnimationFrame(() => $panel.classList.add("visible"));
}

function hidePanel() {
  $panel.classList.remove("visible");
  setTimeout(() => $panel.classList.add("hidden"), 220);
}

function setSpinner(on) {
  $spinner.classList.toggle("hidden", !on);
  $content.classList.toggle("dim", on);
  $catWrapper.classList.toggle("thinking", on);
}

function setMode(mode, titleText) {
  state.mode = mode;
  $mode.dataset.mode = mode;
  $mode.textContent =
    mode === "pdf" ? "reading" : mode === "email" ? "letter" : "watching";
  $title.textContent = titleText || "";
  $tabs.classList.toggle("hidden", mode !== "email");
  $actions.classList.toggle("hidden", mode !== "email");
}

function renderEmail() {
  if (!state.emailResult) {
    $content.textContent = "";
    return;
  }
  const r = state.emailResult;
  if (state.activeTab === "summary") {
    $content.textContent = r.summary || "(no summary)";
  } else if (state.activeTab === "reply") {
    $content.textContent = r.draftReply || "(no draft)";
  } else if (state.activeTab === "ask") {
    $content.textContent =
      r.clarifyingQuestion || "nothing to ask. it reads clear.";
  }
}

function renderPdf() {
  $content.textContent = state.pdfResult || "";
}

function renderForMode() {
  if (state.mode === "email") renderEmail();
  else if (state.mode === "pdf") renderPdf();
}

async function handleEmail(ctx) {
  setMode("email", ctx.mail.subject || "(no subject)");
  pokeAwake();
  $content.textContent = pickThinking();
  setSpinner(true);
  try {
    const r = await cat.analyzeEmail(ctx.mail);
    state.emailResult = r;
    state.activeTab = "summary";
    $tabButtons.forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === "summary")
    );
    renderEmail();
    perk();
  } catch (e) {
    console.error("[cat] email analyze failed:", e);
    $content.textContent =
      "the cat couldn't read that one. " + (e.message || "");
  } finally {
    setSpinner(false);
  }
}

async function handlePdf(ctx) {
  setMode("pdf", ctx.title || ctx.appName);
  pokeAwake();
  $content.textContent = pickThinking();
  setSpinner(true);
  try {
    const b64 = await cat.capturePrimary();
    const summary = await cat.summarizePdf(b64);
    state.pdfResult = summary;
    renderPdf();
    perk();
  } catch (e) {
    console.error("[cat] pdf summarize failed:", e);
    $content.textContent =
      "the cat tried to read but slipped. " + (e.message || "");
  } finally {
    setSpinner(false);
  }
}

async function tick(force) {
  if (state.inFlight) return;
  let ctx;
  try {
    ctx = await cat.getContext();
  } catch (e) {
    console.warn("[cat] getContext failed:", e);
    return;
  }
  const fp = fingerprint(ctx);
  if (!force && fp === state.fingerprint) return;
  state.fingerprint = fp;

  if (ctx.mode === "idle") {
    setMode("idle", "");
    hidePanel();
    return;
  }

  if (state.dismissed && !force) return;
  showPanel();

  state.inFlight = true;
  try {
    if (ctx.mode === "email" && ctx.mail) await handleEmail(ctx);
    else if (ctx.mode === "pdf") await handlePdf(ctx);
  } finally {
    state.inFlight = false;
  }
}

let lastMouse = null;
let dragMoved = false;

$catWrapper.addEventListener("mousedown", (e) => {
  lastMouse = { x: e.screenX, y: e.screenY };
  dragMoved = false;
});

window.addEventListener("mouseup", () => {
  const wasClick = lastMouse && !dragMoved;
  lastMouse = null;
  if (wasClick) {
    pokeAwake();
    perk();
    tick(true);
  }
});

window.addEventListener("mousemove", (e) => {
  if (!lastMouse) return;
  const dx = e.screenX - lastMouse.x;
  const dy = e.screenY - lastMouse.y;
  if (dx || dy) {
    cat.dragWindow({ x: dx, y: dy });
    lastMouse = { x: e.screenX, y: e.screenY };
    if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
  }
});

$tabButtons.forEach((b) =>
  b.addEventListener("click", () => {
    state.activeTab = b.dataset.tab;
    $tabButtons.forEach((x) => x.classList.toggle("active", x === b));
    renderForMode();
  })
);

$close.addEventListener("click", () => {
  state.dismissed = true;
  hidePanel();
});

$copy.addEventListener("click", async () => {
  if (!state.emailResult) return;
  const r = state.emailResult;
  const text =
    state.activeTab === "reply"
      ? r.draftReply
      : state.activeTab === "ask"
        ? r.clarifyingQuestion
        : r.summary;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    $copy.textContent = "copied";
    setTimeout(() => ($copy.textContent = "Copy"), 1200);
  } catch {
    /* noop */
  }
});

setInterval(tiltSometimes, 7000 + Math.random() * 4000);
setInterval(maybeSleep, 4000);
setInterval(() => tick(false), POLL_MS);
tick(true);
