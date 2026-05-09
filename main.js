const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const brain = require("./brain");

const execFileP = promisify(execFile);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 360,
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
  mainWindow.setPosition(Math.max(width - 480, 0), 120);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadFile("index.html");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.on("drag-window", (_event, delta) => {
  if (!mainWindow || !delta) return;
  const [x, y] = mainWindow.getPosition();
  mainWindow.setPosition(Math.round(x + delta.x), Math.round(y + delta.y));
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

ipcMain.handle("cat:getContext", async () => {
  const front = await osa(FRONT_APP_SCRIPT);
  const [appName = "", title = ""] = front.split("|||SEP|||");
  const mode = classifyMode(appName, title);

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
    const buf = await fs.promises.readFile(tmp);
    return buf.toString("base64");
  } finally {
    fs.promises.unlink(tmp).catch(() => {});
  }
});

ipcMain.handle("cat:summarizePdf", async (_e, base64Image) => {
  return brain.summarizePdfImage(base64Image);
});

ipcMain.handle("cat:analyzeEmail", async (_e, mail) => {
  return brain.analyzeEmail(mail);
});
