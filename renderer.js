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

function startThirtySecondLoop() {
  // Person A/B replace this stub with:
  // 1) desktop screenshot capture (resized 256x256)
  // 2) describeScreen(image) using Gemini
  // 3) getCatResponse(description, memory) using GPT/Claude
  // 4) showSpeech(response) when response is non-empty
  const demoLines = ["", "", "Still that little blue place, hm.", "", ""];

  setInterval(() => {
    const line = demoLines[Math.floor(Math.random() * demoLines.length)];
    if (line) showSpeech(line);
  }, 30000);
}

setupDrag();
startThirtySecondLoop();
