require("dotenv").config();

const { app, BrowserWindow, ipcMain, screen, desktopCapturer } = require("electron");
const path = require("path");
const fs = require("fs/promises");

const { describeScreen, getCatResponse } = require("./brain");

const MEMORY_PATH = path.join(__dirname, "memory.json");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 260,
    height: 260,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;
  mainWindow.setPosition(Math.max(width - 320, 0), 120);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();
});

ipcMain.on("drag-window", (_event, delta) => {
  if (!mainWindow || !delta) return;
  const [x, y] = mainWindow.getPosition();
  mainWindow.setPosition(Math.round(x + delta.x), Math.round(y + delta.y));
});

ipcMain.handle("capture-screen", async () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width, height },
  });
  const source = sources[0];
  if (!source) return null;
  return source.thumbnail.toPNG();
});

ipcMain.handle("describe-screen", async (_event, imageBuffer) => {
  const buffer = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);
  return describeScreen(buffer);
});

ipcMain.handle("get-cat-response", async (_event, description, memory) => {
  return getCatResponse(description, memory);
});

ipcMain.handle("read-memory", async () => {
  try {
    const raw = await fs.readFile(MEMORY_PATH, "utf8");
    return JSON.parse(raw);
  } catch (_error) {
    return { observations: [], session_count: 0 };
  }
});

ipcMain.handle("write-memory", async (_event, memory) => {
  await fs.writeFile(MEMORY_PATH, JSON.stringify(memory, null, 2), "utf8");
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
