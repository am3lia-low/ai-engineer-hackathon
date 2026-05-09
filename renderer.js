const bubble = document.getElementById("speech-bubble");

let hideBubbleTimer = null;
let lastMouse = null;

function showSpeech(text) {
  if (!text || !text.trim()) return;
  bubble.textContent = text;
  bubble.classList.remove("hidden");
  bubble.classList.add("visible");

  if (hideBubbleTimer) clearTimeout(hideBubbleTimer);
  hideBubbleTimer = setTimeout(() => {
    bubble.classList.remove("visible");
    bubble.classList.add("hidden");
  }, 8000);
}

function setupDrag() {
  window.addEventListener("mousedown", (event) => {
    lastMouse = { x: event.screenX, y: event.screenY };
  });

  window.addEventListener("mouseup", () => {
    lastMouse = null;
  });

  window.addEventListener("mousemove", (event) => {
    if (!lastMouse) return;
    const delta = {
      x: event.screenX - lastMouse.x,
      y: event.screenY - lastMouse.y,
    };
    if (delta.x !== 0 || delta.y !== 0) {
      window.desktopCat.dragWindow(delta);
      lastMouse = { x: event.screenX, y: event.screenY };
    }
  });
}

async function tick() {
  try {
    const memory = await window.desktopCat.readMemory();
    const image = await window.desktopCat.captureScreen();
    if (!image) return;

    const description = await window.desktopCat.describeScreen(image);
    const { response, tag } = await window.desktopCat.getCatResponse(description, memory);

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
    await window.desktopCat.writeMemory(memory);

    if (response) showSpeech(response);
  } catch (error) {
    console.error("tick failed", error);
  }
}

function startThirtySecondLoop() {
  tick();
  setInterval(tick, 30000);
}

setupDrag();
startThirtySecondLoop();
