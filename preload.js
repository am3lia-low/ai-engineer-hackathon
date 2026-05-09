const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopCat", {
  dragWindow: (delta) => ipcRenderer.send("drag-window", delta),
});
