require("dotenv").config();

const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  desktopCapturer,
} = require("electron");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");

const brain = require("./brain");

const execFileP = promisify(execFile);

const MEMORY_PATH = path.join(__dirname, "memory.json");
const SETTINGS_PATH = path.join(__dirname, "settings.json");

const DEFAULT_SETTINGS = {
  voiceEnabled: false,
  voiceProfile: "soft",
  autoVoiceByContext: true,
};

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const { width } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow.setPosition(Math.max(width - 500, 0), 120);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadFile("index.html");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.on("drag-window", (_e, delta) => {
  if (!mainWindow || !delta) return;
  const [x, y] = mainWindow.getPosition();
  mainWindow.setPosition(Math.round(x + delta.x), Math.round(y + delta.y));
});

ipcMain.handle("capture-screen", async () => {
  const { width, height } = screen.getPrimaryDisplay().size;
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width, height },
  });
  const source = sources[0];
  if (!source) return null;
  return source.thumbnail.toPNG();
});

ipcMain.handle("describe-screen", async (_e, imageBuffer) => {
  const buf = Buffer.isBuffer(imageBuffer)
    ? imageBuffer
    : Buffer.from(imageBuffer);
  return brain.describeScreen(buf);
});

ipcMain.handle("get-cat-response", async (_e, description, memory) =>
  brain.getCatResponse(description, memory)
);

ipcMain.handle("read-memory", async () => {
  try {
    const raw = await fs.readFile(MEMORY_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { observations: [], session_count: 0 };
  }
});

ipcMain.handle("write-memory", async (_e, memory) => {
  await fs.writeFile(MEMORY_PATH, JSON.stringify(memory, null, 2), "utf8");
});

const FRONT_APP_SCRIPT = `
tell application "System Events"
  set frontApp to name of first application process whose frontmost is true
  set frontTitle to ""
  try
    tell process frontApp
      if (count of windows) > 0 then
        set frontTitle to name of front window
      end if
    end tell
  end try
  return frontApp & "|||SEP|||" & frontTitle
end tell
`;

const MAIL_SELECTION_SCRIPT = `
tell application "Mail"
  try
    set sel to selection
    if (count of sel) is 0 then return ""
    set msg to item 1 of sel
    set s to subject of msg
    set f to (sender of msg) as string
    set b to content of msg
    return s & "|||SEP|||" & f & "|||SEP|||" & b
  on error
    return ""
  end try
end tell
`;

async function osa(script) {
  try {
    const { stdout } = await execFileP("osascript", ["-e", script], {
      maxBuffer: 4 * 1024 * 1024,
    });
    return stdout.toString().trim();
  } catch {
    return "";
  }
}

function classifyMode(appName, title) {
  const a = (appName || "").toLowerCase();
  const t = (title || "").toLowerCase();
  if (a === "mail") return "email";
  if (a === "preview") return "pdf";
  if (a.includes("acrobat")) return "pdf";
  const browsers = [
    "google chrome",
    "safari",
    "arc",
    "brave browser",
    "microsoft edge",
    "firefox",
  ];
  if (browsers.includes(a) && t.includes(".pdf")) return "pdf";
  return "idle";
}

let lastLoggedMode = null;
function logMode(mode, appName, title) {
  if (mode === lastLoggedMode) return;
  lastLoggedMode = mode;
  console.log(
    `[cat] mode=${mode} app=${appName || "?"} title=${(title || "").slice(0, 60)}`
  );
}

ipcMain.handle("cat:getContext", async () => {
  const front = await osa(FRONT_APP_SCRIPT);
  const [appName = "", title = ""] = front.split("|||SEP|||");
  const mode = classifyMode(appName, title);
  logMode(mode, appName, title);
  if (mode === "email") {
    const sel = await osa(MAIL_SELECTION_SCRIPT);
    if (!sel) return { mode: "idle", appName, title };
    const [subject = "", sender = "", body = ""] = sel.split("|||SEP|||");
    return {
      mode,
      appName,
      title,
      mail: { subject, sender, body: body.slice(0, 6000) },
    };
  }
  return { mode, appName, title };
});

ipcMain.handle("cat:capturePrimary", async () => {
  const tmp = path.join(os.tmpdir(), `cat-cap-${Date.now()}.png`);
  try {
    await execFileP("screencapture", ["-x", "-t", "png", tmp]);
    const buf = await fs.readFile(tmp);
    return buf.toString("base64");
  } finally {
    fs.unlink(tmp).catch(() => {});
  }
});

ipcMain.handle("cat:summarizePdf", async (_e, b64) => {
  try {
    return await brain.summarizePdfImage(b64);
  } catch (e) {
    console.error("[cat] summarizePdf failed:", e.message);
    throw e;
  }
});

ipcMain.handle("cat:analyzeEmail", async (_e, mail) => {
  try {
    return await brain.analyzeEmail(mail);
  } catch (e) {
    console.error("[cat] analyzeEmail failed:", e.message);
    throw e;
  }
});

ipcMain.handle("cat:speak", async (_e, { text, profile, mode }) => {
  if (!process.env.ELEVENLABS_API_KEY) {
    return { ok: false, reason: "no-api-key" };
  }
  if (!text || !text.trim()) return { ok: false, reason: "empty-text" };

  const settings = await readSettings();
  const chosenProfile = brain.pickVoiceProfile({
    mode,
    hour: new Date().getHours(),
    defaultProfile: profile || settings.voiceProfile,
    autoByContext: settings.autoVoiceByContext,
  });
  const voiceId = brain.VOICE_LIBRARY[chosenProfile] || brain.VOICE_LIBRARY.soft;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_flash_v2_5",
          voice_settings: { stability: 0.55, similarity_boost: 0.75 },
        }),
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[cat] elevenlabs failed:", res.status, errText.slice(0, 120));
      return { ok: false, reason: "api-error", status: res.status };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: true, audio: buf.toString("base64"), profile: chosenProfile };
  } catch (e) {
    console.error("[cat] speak fetch failed:", e.message);
    return { ok: false, reason: "network-error" };
  }
});

async function readSettings() {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

ipcMain.handle("cat:getSettings", async () => readSettings());

ipcMain.handle("cat:setSettings", async (_e, partial) => {
  const current = await readSettings();
  const next = { ...current, ...(partial || {}) };
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
});

ipcMain.handle("cat:hasVoiceKey", async () =>
  Boolean(process.env.ELEVENLABS_API_KEY)
);

if (!fsSync.existsSync(SETTINGS_PATH)) {
  fsSync.writeFileSync(
    SETTINGS_PATH,
    JSON.stringify(DEFAULT_SETTINGS, null, 2),
    "utf8"
  );
}
