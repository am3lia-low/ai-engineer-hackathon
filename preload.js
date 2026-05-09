const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopCat", {
  dragWindow: (delta) => ipcRenderer.send("drag-window", delta),
  getContext: () => ipcRenderer.invoke("cat:getContext"),
  capturePrimary: () => ipcRenderer.invoke("cat:capturePrimary"),
  summarizePdf: (b64) => ipcRenderer.invoke("cat:summarizePdf", b64),
  analyzeEmail: (mail) => ipcRenderer.invoke("cat:analyzeEmail", mail),
});
