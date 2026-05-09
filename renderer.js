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

const POLL_MS = 4000;

const state = {
  mode: "idle",
  fingerprint: "",
  emailResult: null,
  pdfResult: "",
  activeTab: "summary",
  inFlight: false,
  dismissed: false,
};

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
  else $content.textContent = "the cat is watching.";
}

async function handleEmail(ctx) {
  setMode("email", ctx.mail.subject || "(no subject)");
  setSpinner(true);
  try {
    const r = await cat.analyzeEmail(ctx.mail);
    state.emailResult = r;
    state.activeTab = "summary";
    $tabButtons.forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === "summary")
    );
    renderEmail();
  } catch (e) {
    $content.textContent = "the cat couldn't read that one. " + (e.message || "");
  } finally {
    setSpinner(false);
  }
}

async function handlePdf(ctx) {
  setMode("pdf", ctx.title || ctx.appName);
  setSpinner(true);
  try {
    const b64 = await cat.capturePrimary();
    const summary = await cat.summarizePdf(b64);
    state.pdfResult = summary;
    renderPdf();
  } catch (e) {
    $content.textContent = "the cat tried to read but slipped. " + (e.message || "");
  } finally {
    setSpinner(false);
  }
}

async function tick(force) {
  if (state.inFlight) return;
  let ctx;
  try {
    ctx = await cat.getContext();
  } catch {
    return;
  }
  const fp = fingerprint(ctx);
  if (!force && fp === state.fingerprint) return;
  state.fingerprint = fp;

  if (ctx.mode === "idle") {
    setMode("idle", "");
    if (!state.dismissed) {
      $content.textContent = "the cat is watching.";
      showPanel();
    }
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
  if (wasClick) tick(true);
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

setInterval(() => tick(false), POLL_MS);
tick(true);
