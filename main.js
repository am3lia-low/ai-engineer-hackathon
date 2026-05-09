const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");

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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
