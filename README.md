# The Cat - 3 Hour Execution Plan

A small round black cat that lives on your desktop, watches quietly, and only occasionally says something brief and oblique.

## Mission (2pm -> 5pm hard cutoff)
- Ship a working Electron cat with character.
- Submit a public GitHub repo + 2-minute demo video.
- Prioritize execution over features.

## Locked scope (3-hour version)
### Must ship
- Transparent, frameless, always-on-top, draggable Electron window.
- Cat sprite on screen.
- Screenshot loop every 30s.
- Two-stage LLM flow: Gemini Vision -> GPT/Claude response.
- Speech bubble with fade in/out.
- Persistent `memory.json`.
- Eye blink + idle breathing.

### Stretch only if ahead
- Soft sparkles.
- Journal on close (`journal.txt`) or lore drops.

### Explicitly cut
- Voice/audio, webcam, den customization, reminders/notes/music, multiple cats, local privacy model.

## Team roles (decide in 5 minutes)
- **Person A - Builder:** Electron app, rendering, capture loop, animations.
- **Person B - Brain:** Gemini/OpenAI/Claude calls, prompt tuning, memory logic.
- **Person C - Glue:** assets, README, video, submission, track alignment, unblockers.

No overlap. Fastest coder should be Person A.

## Timeline (strict)
### 2:00-2:20 Setup sprint
- Confirm roles and submission format.
- Create public repo immediately.
- A: scaffold Electron shell and cat window.
- B: lock prompt voice + secure API keys.
- C: generate/fetch cat sprite + start README.

### 2:20-3:15 Core pipeline end-to-end
- A: screenshot every 30s + speech bubble UI.
- B: `brain.js`
  - `describeScreen(imageBuffer)` (Gemini vision)
  - `getCatResponse(description, memory)` (GPT/Claude)
- C: `.env.example`, run instructions, backup recording at 3:00.

**Hard checkpoint 3:15:** cat must speak at least once from real screen context.

### 3:15-4:00 Memory + minimal polish
- A: blink + breathing + simple change detection.
- B: memory persistence (`memory.json`, capped observation tags).
- C: draft 2-minute script and stage demo states.

**Hard checkpoint 4:00:** cat is mostly silent, blinks, and remembers after restart.

### 4:00-4:30 Stabilize and freeze
- If stable: add one stretch item.
- If unstable: fix only critical bugs.
- **Code freeze at 4:30.**

### 4:30-4:50 Record demo video
- One clean take (max two attempts).
- If timing fails, trigger one known-safe response for demo.
- Upload unlisted video, copy URL.

### 4:50-5:00 Submit
- Repo public, README complete, video URL included.
- Submit and screenshot confirmation.

## Coordination rules
1. Stuck >10 min -> escalate immediately.
2. One branch flow; Person A merges.
3. 2-minute stand-up every 30 minutes.
4. Idea freeze at 4:00.
5. Code freeze at 4:30, no exceptions.

## Repo checklist
- `.env` ignored.
- `.env.example` committed.
- `node_modules/` ignored.
- `memory.json` and `journal.txt` ignored.
- `npm install && npm start` works.

## Run locally
```bash
npm install
cp .env.example .env
npm start
```

## Current scaffold status
- Electron core window and renderer shell created.
- Draggable mascot window implemented.
- Speech bubble UI and 30s demo loop stub implemented.
- Placeholder `brain.js` added for Gemini + GPT/Claude wiring.

## Context copilot mode (macOS)
The cat now watches what the user is doing and reacts in real time:
- **PDF mode** — when the front app is Preview, Acrobat, or a browser viewing a `.pdf`, the cat captures the screen and asks Gemini Flash to summarize the visible page next to her.
- **Email mode** — when the front app is Mail.app with a message selected, the cat reads it via AppleScript and offers a Summary, a draft Reply, and a clarifying Ask — with a Copy button.
- **Watching** — anywhere else, she just sits.

### Required permissions (first run, macOS)
- **Automation:** allow the app to control "System Events" and "Mail" when prompted.
- **Screen Recording:** grant the terminal/Electron app the right to record the screen (System Settings → Privacy & Security → Screen Recording).
- Set `GEMINI_API_KEY` in `.env` (see `.env.example`).

## Cat system prompt (for Person B)
```text
You are a small black cat who lives on the person's computer screen. You are round, quiet, and still.
You are not an assistant. You are a presence.

How you speak:
- Rarely. Silence is default; empty string most of the time.
- Briefly. One sentence, maybe two.
- Obliquely. Observe; do not instruct.
- Quietly. No exclamation marks, emoji, or internet cadence.

CRITICAL: Return empty string at least 3 out of every 4 times.
When given screen observations plus past notes, respond only if something genuinely catches your attention.
```

## 90-second pitch
```text
This is a small black cat that lives on your desktop. Most of the time, she says nothing.
Under the hood, a cheap vision model describes the screen, and a reasoning model decides whether she has anything to say.
She remembers across sessions, so over time she feels personal.
She's not a productivity assistant. She's a quiet presence.
```
