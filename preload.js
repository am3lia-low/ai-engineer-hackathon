const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopCat", {
  dragWindow: (delta) => ipcRenderer.send("drag-window", delta),

  captureScreen: () => ipcRenderer.invoke("capture-screen"),
  describeScreen: (imageBuffer) =>
    ipcRenderer.invoke("describe-screen", imageBuffer),
  getCatResponse: (description, memory) =>
    ipcRenderer.invoke("get-cat-response", description, memory),
  readMemory: () => ipcRenderer.invoke("read-memory"),
  writeMemory: (memory) => ipcRenderer.invoke("write-memory", memory),

  getContext: () => ipcRenderer.invoke("cat:getContext"),
  capturePrimary: () => ipcRenderer.invoke("cat:capturePrimary"),
  summarizePdf: (b64) => ipcRenderer.invoke("cat:summarizePdf", b64),
  analyzeEmail: (mail) => ipcRenderer.invoke("cat:analyzeEmail", mail),

  speak: (payload) => ipcRenderer.invoke("cat:speak", payload),
  hasVoiceKey: () => ipcRenderer.invoke("cat:hasVoiceKey"),

  getSettings: () => ipcRenderer.invoke("cat:getSettings"),
  setSettings: (partial) => ipcRenderer.invoke("cat:setSettings", partial),
});
