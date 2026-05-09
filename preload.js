const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopCat", {
  dragWindow: (delta) => ipcRenderer.send("drag-window", delta),
  captureScreen: () => ipcRenderer.invoke("capture-screen"),
  describeScreen: (imageBuffer) => ipcRenderer.invoke("describe-screen", imageBuffer),
  getCatResponse: (description, memory) =>
    ipcRenderer.invoke("get-cat-response", description, memory),
  readMemory: () => ipcRenderer.invoke("read-memory"),
  writeMemory: (memory) => ipcRenderer.invoke("write-memory", memory),
});
