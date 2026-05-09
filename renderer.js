const cat = window.desktopCat;

/* ---------- DOM ---------- */
const $panel = document.getElementById("panel");
const $mode = document.getElementById("panel-mode");
const $title = document.getElementById("panel-title");
const $panelClose = document.getElementById("panel-close");
const $tabs = document.getElementById("panel-tabs");
const $tabButtons = $tabs.querySelectorAll(".tab");
const $spinner = document.getElementById("panel-spinner");
const $content = document.getElementById("panel-content");
const $actions = document.getElementById("panel-actions");
const $copy = document.getElementById("copy-btn");

const $bubble = document.getElementById("bubble");

const $catWrapper = document.getElementById("cat-wrapper");
const $catStack = document.getElementById("cat-stack");
const $settingsBtn = document.getElementById("settings-btn");

const $settingsOverlay = document.getElementById("settings-overlay");
const $settingsClose = document.getElementById("settings-close");
const $voiceToggle = document.getElementById("voice-toggle");
const $voiceProfile = document.getElementById("voice-profile");
const $autoVoice = document.getElementById("auto-voice");
const $voiceStatus = document.getElementById("voice-status");

const SPRITES = {
  puddle: document.getElementById("s-puddle"),
  awake: document.getElementById("s-awake"),
  sleep: document.getElementById("s-sleep"),
  walk1: document.getElementById("s-walk1"),
  walk2: document.getElementById("s-walk2"),
  annoyed: document.getElementById("s-annoyed"),
  play: document.getElementById("s-play"),
};

/* ---------- timing constants ---------- */
const AUTONOMOUS_MS = 30000;
const ACTIVE_MS = 4000;
const SLEEP_AFTER_PUDDLE_MS = 90000;
const PUDDLE_AFTER_AWAKE_MS = 22000;
const ANNOYED_DURATION_MS = 2800;
const PLAY_DURATION_MS = 5500;
const WALK_FRAME_MS = 250;
const WALK_DURATION_MS = 4500;

/* ---------- state ---------- */
const state = {
  sprite: "puddle",
  mode: "idle",
  activeFp: "",
  activeBusy: false,
  emailResult: null,
  pdfResult: "",
  activeTab: "summary",
  panelDismissed: false,
  lastActiveAt: 0,
  speakingUntil: 0,
  walking: false,
  playing: false,
  annoyed: false,
  settings: {
    voiceEnabled: false,
    voiceProfile: "soft",
    autoVoiceByContext: true,
  },
  hasVoiceKey: false,
  currentAudio: null,
};

/* ---------- sprite manager ---------- */
function setSprite(name) {
  if (!SPRITES[name] || state.sprite === name) return;
  Object.keys(SPRITES).forEach((k) => SPRITES[k].classList.remove("active"));
  SPRITES[name].classList.add("active");
  state.sprite = name;
}

function pokeAwake() {
  state.lastActiveAt = Date.now();
  if (
    state.sprite !== "annoyed" &&
    state.sprite !== "walk1" &&
    state.sprite !== "walk2" &&
    state.sprite !== "play"
  ) {
    setSprite("awake");
  }
}

function playOnce(cls, dur = 1000) {
  $catStack.classList.remove(cls);
  void $catStack.offsetWidth;
  $catStack.classList.add(cls);
  setTimeout(() => $catStack.classList.remove(cls), dur);
}

function perk() {
  playOnce("perk", 700);
}

function shake() {
  $catWrapper.classList.remove("shake");
  void $catWrapper.offsetWidth;
  $catWrapper.classList.add("shake");
  setTimeout(() => $catWrapper.classList.remove("shake"), 400);
}

function tiltSometimes() {
  if (state.sprite !== "awake") return;
  if (Math.random() < 0.5) playOnce("tilt-left", 900);
  else playOnce("tilt-right", 900);
}

function flashAnnoyed() {
  if (state.walking || state.playing) return;
  state.annoyed = true;
  setSprite("annoyed");
  shake();
  setTimeout(() => {
    state.annoyed = false;
    setSprite("puddle");
  }, ANNOYED_DURATION_MS);
}

function startWalkCycle() {
  if (state.walking || state.playing || state.activeBusy || state.annoyed) return;
  state.walking = true;
  let frame = 0;
  setSprite("walk1");
  const id = setInterval(() => {
    frame++;
    setSprite(frame % 2 === 0 ? "walk1" : "walk2");
  }, WALK_FRAME_MS);
  setTimeout(() => {
    clearInterval(id);
    state.walking = false;
    setSprite("puddle");
  }, WALK_DURATION_MS);
}

function startPlay() {
  if (state.walking || state.playing || state.activeBusy || state.annoyed) return;
  state.playing = true;
  setSprite("play");
  $catStack.classList.add("bounce");
  setTimeout(() => {
    $catStack.classList.remove("bounce");
    state.playing = false;
    setSprite("puddle");
  }, PLAY_DURATION_MS);
}

function maybeSleep() {
  if (
    state.activeBusy ||
    state.walking ||
    state.playing ||
    state.annoyed ||
    Date.now() < state.speakingUntil
  ) {
    return;
  }
  const sinceActive = Date.now() - state.lastActiveAt;
  const hour = new Date().getHours();
  const isNight = hour >= 22 || hour < 6;

  if (
    state.sprite !== "sleep" &&
    sinceActive > SLEEP_AFTER_PUDDLE_MS &&
    isNight
  ) {
    setSprite("sleep");
    return;
  }
  if (
    (state.sprite === "awake" || state.sprite === "annoyed") &&
    sinceActive > PUDDLE_AFTER_AWAKE_MS
  ) {
    setSprite("puddle");
  }
}

/* ---------- speech (bubble + voice) ---------- */
function showBubble(text, durationMs = 7500) {
  if (!text || !text.trim()) return;
  $bubble.textContent = text;
  $bubble.classList.remove("hidden");
  requestAnimationFrame(() => $bubble.classList.add("visible"));
  clearTimeout(showBubble._timer);
  showBubble._timer = setTimeout(() => {
    $bubble.classList.remove("visible");
    setTimeout(() => $bubble.classList.add("hidden"), 280);
  }, durationMs);
}

function stopAudio() {
  if (state.currentAudio) {
    try {
      state.currentAudio.pause();
    } catch {}
    state.currentAudio = null;
  }
  $bubble.classList.remove("speaking");
}

async function speakAndShow(text, { mode } = {}) {
  if (!text || !text.trim()) return;
  showBubble(text);
  pokeAwake();
  state.speakingUntil = Date.now() + Math.min(text.length * 70, 12000);

  if (!state.settings.voiceEnabled || !state.hasVoiceKey) return;

  try {
    const res = await cat.speak({
      text,
      mode,
      profile: state.settings.voiceProfile,
    });
    if (!res || !res.ok || !res.audio) return;

    stopAudio();
    const audio = new Audio(`data:audio/mpeg;base64,${res.audio}`);
    audio.volume = 0.75;
    state.currentAudio = audio;
    $bubble.classList.add("speaking");
    audio.onended = () => {
      $bubble.classList.remove("speaking");
      if (state.currentAudio === audio) state.currentAudio = null;
    };
    await audio.play().catch(() => {});
  } catch (e) {
    console.warn("[cat] voice failed:", e);
  }
}

/* ---------- active panel (pdf / email) ---------- */
function showPanel() {
  state.panelDismissed = false;
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
  if (state.activeTab === "summary") $content.textContent = r.summary || "(no summary)";
  else if (state.activeTab === "reply") $content.textContent = r.draftReply || "(no draft)";
  else if (state.activeTab === "ask")
    $content.textContent = r.clarifyingQuestion || "nothing to ask. it reads clear.";
}

function renderPdf() {
  $content.textContent = state.pdfResult || "";
}

function renderForMode() {
  if (state.mode === "email") renderEmail();
  else if (state.mode === "pdf") renderPdf();
}

const THINKING_LINES = ["...let me peek", "...one moment", "...reading", "hm, hold on", "...looking"];
function pickThinking() {
  return THINKING_LINES[Math.floor(Math.random() * THINKING_LINES.length)];
}

function fingerprint(ctx) {
  if (!ctx) return "";
  if (ctx.mode === "email" && ctx.mail) {
    return `mail:${ctx.mail.subject}|${ctx.mail.sender}|${ctx.mail.body.length}`;
  }
  if (ctx.mode === "pdf") return `pdf:${ctx.appName}|${ctx.title}`;
  return "idle";
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
    if (r.summary) speakAndShow(r.summary, { mode: "email" });
  } catch (e) {
    console.error("[cat] email failed:", e);
    $content.textContent = "the cat couldn't read that one. " + (e.message || "");
    flashAnnoyed();
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
    if (summary) speakAndShow(summary, { mode: "pdf" });
  } catch (e) {
    console.error("[cat] pdf failed:", e);
    $content.textContent = "the cat tried to read but slipped. " + (e.message || "");
    flashAnnoyed();
  } finally {
    setSpinner(false);
  }
}

async function activeTick(force) {
  if (state.activeBusy) return;
  let ctx;
  try {
    ctx = await cat.getContext();
  } catch (e) {
    console.warn("[cat] getContext failed:", e);
    return;
  }
  const fp = fingerprint(ctx);
  if (!force && fp === state.activeFp) return;
  state.activeFp = fp;

  if (ctx.mode === "idle") {
    setMode("idle", "");
    hidePanel();
    return;
  }
  if (state.panelDismissed && !force) return;

  showPanel();
  state.activeBusy = true;
  try {
    if (ctx.mode === "email" && ctx.mail) await handleEmail(ctx);
    else if (ctx.mode === "pdf") await handlePdf(ctx);
  } finally {
    state.activeBusy = false;
  }
}

/* ---------- autonomous tick (memory + screen + cat-response) ---------- */
async function autonomousTick() {
  if (state.activeBusy || state.walking || state.playing || state.annoyed) return;
  try {
    const memory = (await cat.readMemory()) || { observations: [], session_count: 0 };
    const image = await cat.captureScreen();
    if (!image) return;
    const description = await cat.describeScreen(image);
    const { response, tag } = await cat.getCatResponse(description, memory);

    memory.session_count = (memory.session_count || 0) + 1;
    memory.observations = memory.observations || [];
    memory.observations.push({
      at: new Date().toISOString(),
      description,
      tag: tag || "",
      said: response || "",
    });
    if (memory.observations.length > 100) {
      memory.observations = memory.observations.slice(-100);
    }
    await cat.writeMemory(memory);

    if (response && response.trim()) {
      pokeAwake();
      perk();
      speakAndShow(response, { mode: "auto", tag });
    }
  } catch (e) {
    console.warn("[cat] autonomous tick failed:", e);
  }
}

/* ---------- mouse / drag / click ---------- */
let lastMouse = null;
let dragMoved = false;

$catWrapper.addEventListener("mousedown", (e) => {
  if (e.target === $settingsBtn) return;
  lastMouse = { x: e.screenX, y: e.screenY };
  dragMoved = false;
});

window.addEventListener("mouseup", () => {
  const wasClick = lastMouse && !dragMoved;
  lastMouse = null;
  if (wasClick) {
    pokeAwake();
    perk();
    activeTick(true);
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

$catWrapper.addEventListener("mouseenter", () => {
  if (state.sprite === "sleep" || state.sprite === "puddle") {
    pokeAwake();
  }
});

/* ---------- panel interactions ---------- */
$tabButtons.forEach((b) =>
  b.addEventListener("click", () => {
    state.activeTab = b.dataset.tab;
    $tabButtons.forEach((x) => x.classList.toggle("active", x === b));
    renderForMode();
  })
);

$panelClose.addEventListener("click", () => {
  state.panelDismissed = true;
  hidePanel();
  stopAudio();
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

/* ---------- settings ---------- */
async function loadSettings() {
  try {
    const s = await cat.getSettings();
    if (s) state.settings = { ...state.settings, ...s };
  } catch {}
  try {
    state.hasVoiceKey = await cat.hasVoiceKey();
  } catch {
    state.hasVoiceKey = false;
  }
  reflectSettingsToUI();
}

function reflectSettingsToUI() {
  $voiceToggle.checked = !!state.settings.voiceEnabled;
  $voiceProfile.value = state.settings.voiceProfile || "soft";
  $autoVoice.checked = !!state.settings.autoVoiceByContext;

  if (!state.hasVoiceKey) {
    $voiceStatus.textContent = "no ELEVENLABS_API_KEY in .env — voice is disabled";
    $voiceStatus.classList.add("warn");
    $voiceToggle.disabled = true;
  } else {
    $voiceStatus.textContent = state.settings.voiceEnabled
      ? "voice on. she will speak when she has something to say."
      : "voice off. text only.";
    $voiceStatus.classList.remove("warn");
    $voiceToggle.disabled = false;
  }
}

$settingsBtn.addEventListener("click", () => {
  $settingsOverlay.classList.remove("hidden");
});

$settingsClose.addEventListener("click", () => {
  $settingsOverlay.classList.add("hidden");
});

$voiceToggle.addEventListener("change", async (e) => {
  state.settings.voiceEnabled = e.target.checked;
  if (!e.target.checked) stopAudio();
  await cat.setSettings({ voiceEnabled: e.target.checked });
  reflectSettingsToUI();
});

$voiceProfile.addEventListener("change", async (e) => {
  state.settings.voiceProfile = e.target.value;
  await cat.setSettings({ voiceProfile: e.target.value });
});

$autoVoice.addEventListener("change", async (e) => {
  state.settings.autoVoiceByContext = e.target.checked;
  await cat.setSettings({ autoVoiceByContext: e.target.checked });
});

/* ---------- random schedulers ---------- */
function scheduleNextWalk() {
  const next = (6 + Math.random() * 6) * 60 * 1000;
  setTimeout(() => {
    startWalkCycle();
    scheduleNextWalk();
  }, next);
}

function scheduleNextPlay() {
  const next = (15 + Math.random() * 10) * 60 * 1000;
  setTimeout(() => {
    startPlay();
    scheduleNextPlay();
  }, next);
}

/* ---------- init ---------- */
async function init() {
  await loadSettings();
  state.lastActiveAt = Date.now() - PUDDLE_AFTER_AWAKE_MS;
  setSprite("puddle");

  setInterval(maybeSleep, 4000);
  setInterval(tiltSometimes, 8500);
  setInterval(() => activeTick(false), ACTIVE_MS);
  setInterval(autonomousTick, AUTONOMOUS_MS);
  scheduleNextWalk();
  scheduleNextPlay();

  activeTick(true);
  setTimeout(autonomousTick, 2000);
}

init();
