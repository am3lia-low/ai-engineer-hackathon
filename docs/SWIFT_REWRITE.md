# Swift Migration Plan — DesktopCat

Comprehensive plan for porting the Electron+JavaScript desktop cat to a native
macOS Swift app in `swift-cat/`. The Electron version stays shippable
throughout the migration; we cut over only when the Swift port reaches feature
parity (end of Phase 4).

> Companion docs
> - `swift-cat/README.md` — build & run quick start
> - `docs/execution.md` — original product/execution notes for the cat
> - `docs/demo-script.md` — 2-minute demo shot list (Electron, still valid)

---

## 0. TL;DR

| Phase | Status | Scope |
|---|---|---|
| 1 — Foundation | done | Transparent always-on-top window, sprite stack, drag, breath, click crossfade |
| 2 — System integrations | done | FrontmostWatcher, MailReader, ScreenCapture, CursorMonitor, Permissions, Settings + Memory stores, `.app` bundling |
| **3 — AI brain** | **next** | `Brain` dispatcher (OpenAI + Gemini), prompts ported verbatim, ElevenLabs TTS, AVSpeechSynthesizer fallback, `SFSpeechRecognizer` + Whisper |
| 4 — UI polish | later | Speech bubble, active panel (PDF/email tabs), settings overlay, per-profile color + animation, walking & playing cycles, mic button |
| 5 — Packaging & cutover | later | Code-sign, notarize, DMG, Sparkle updater, deprecate Electron entry points |

The Electron app today is ~3 KLOC of JS across `brain.js` (481), `renderer.js`
(1001), `main.js` (461), `preload.js` (32) plus `cat_prompt.txt` (85) and
prompt-string constants embedded in `brain.js`. The Swift port today is
~1 KLOC across the files listed in §3. Phase 3 + 4 will add roughly another
1.5 KLOC; the finished Swift app should land near 2.5 KLOC — smaller because
all the IPC plumbing and DOM wiring goes away.

---

## 1. Why Swift, not Tauri or "stay on Electron"

- **Speech recognition.** `webkitSpeechRecognition` does not work in WKWebView
  (the engine Tauri ships). The cat's "talk to me" feature would have to route
  every utterance through paid Whisper. `SFSpeechRecognizer` is on-device,
  free, and offline for short prompts.
- **Always-on animation budget.** Core Animation drives sprite work on the GPU
  with much lower idle cost than CSS keyframes in a Chromium renderer. The cat
  is meant to live there all day; the Electron version's idle footprint is
  ~150 MB RAM and noticeable battery drain on a MacBook Air.
- **macOS-native everything.** `ScreenCaptureKit`, `NSAppleScript`,
  `NSEvent.addGlobalMonitorForEvents`, TCC permission flows,
  `NSWorkspace.frontmostApplication`, menu bar items, Spaces follow,
  dark-mode follow, sleep/wake — all first-class instead of shimmed via
  `child_process.execFile("osascript", …)`.
- **Distribution.** Code-signed DMG in the 5–10 MB range vs the current
  ~150 MB Electron bundle.

Trade-off explicitly accepted: macOS-only forever. No Windows or Linux path.
The cat is a macOS object now.

---

## 2. What we keep, what we replace, what we discard

### Keep (shared between Electron and Swift during coexistence)

- `cat_prompt.txt` — the system prompt for the autonomous observation loop.
  Swift reads the same file the same way `brain.js` does.
- `assets/cat_*.png` — every sprite. The Swift port copies them into
  `Sources/DesktopCat/Resources/` per phase as new states are wired.
- `memory.json` shape — same `{ observations: [...], session_count: N }`
  schema, same field names. Electron writes to repo root; Swift writes to
  `~/Library/Application Support/DesktopCat/memory.json`. Phase 3 keeps the
  shape compatible so we can bridge them if needed.
- `settings.json` shape — same fields (`voiceEnabled`, `voiceProfile`,
  `autoVoiceByContext`, `mouseQuestionsEnabled`).

### Replace (rewritten in Swift)

| Electron file | Replaced by |
|---|---|
| `main.js` — Electron main process, IPC handlers | `AppDelegate.swift` + `CatCoordinator.swift` + `System/*.swift` |
| `renderer.js` — DOM/sprite/audio/STT/UI logic | `CatView.swift` + `UI/*.swift` (Phase 4) + `Voice.swift` + `Listener.swift` (Phase 3) |
| `preload.js` — IPC bridge | gone; direct Swift calls |
| `brain.js` — provider dispatcher, prompts, voice picker | `Brain/*.swift` — `Brain.swift`, `Prompts.swift`, `Voice.swift` (Phase 3) |
| `index.html` + `styles.css` | gone; sprite layers + SwiftUI panels |
| `package.json`, `node_modules/` | gone; SwiftPM `Package.swift` |
| `screencapture` shell-outs | `ScreenCaptureKit` (with `screencapture` retained as Phase 2 fallback already in place) |
| `osascript` shell-outs | `NSAppleScript` direct invocation |

### Discard

- Electron, Chromium, Node runtime — replaced by AppKit + Foundation.
- Browser APIs: DOM, `requestAnimationFrame`, `MediaRecorder`,
  `webkitSpeechRecognition`, `speechSynthesis`.
- `getCatResponse` periodic loop in `renderer.js` (every ~20s) — replaced
  by a coordinator-driven `Brain.observeAndMaybeSpeak()` in Phase 3.
- Manual JSON disk I/O sprinkled across `main.js` — centralized in
  `Storage/*.swift` (already done in Phase 2).

---

## 3. Repo layout (current + target end-state)

```
ai-engineer-hackathon/
├── README.md                         (Electron, unchanged through cutover)
├── package.json                      (Electron, deprecated at Phase 5)
├── main.js / renderer.js / brain.js  (Electron, frozen except for bugfixes)
├── cat_prompt.txt                    (shared — Swift reads this same file)
├── assets/cat_*.png                  (shared)
├── memory.json                       (Electron; Swift uses Application Support)
├── settings.json                     (Electron; Swift uses Application Support)
└── swift-cat/
    ├── Package.swift                 (SwiftPM, macOS 13+)
    ├── Makefile                      (build / release / bundle / open-bundle)
    ├── README.md                     (build & run)
    └── Sources/DesktopCat/
        ├── main.swift                ← NSApplication entry, .accessory policy
        ├── AppDelegate.swift         ← boots stores, window, coordinator
        ├── CatCoordinator.swift      ← bridges system events → cat state + brain
        ├── CatWindow.swift           ← borderless transparent NSWindow
        ├── CatView.swift             ← sprite layer stack, drag, click
        ├── CatState.swift            ← sprite enum (puddle/awake/…)
        ├── CatMode.swift             ← idle / pdf / email enum
        ├── System/
        │   ├── FrontmostWatcher.swift
        │   ├── MailReader.swift
        │   ├── ScreenCapture.swift   (protocol + Shell impl; SCK impl in P3/4)
        │   ├── CursorMonitor.swift
        │   └── Permissions.swift
        ├── Storage/
        │   ├── AppSupport.swift
        │   ├── Settings.swift
        │   └── Memory.swift
        ├── Brain/                    (Phase 3 — new)
        │   ├── Brain.swift           ← dispatcher (provider-agnostic)
        │   ├── ChatProvider.swift    ← protocol
        │   ├── OpenAIChat.swift      ← URLSession, chat-completions, vision
        │   ├── GeminiChat.swift      ← URLSession, generateContent
        │   ├── Prompts.swift         ← five prompts as static let strings
        │   └── RateLimiter.swift     ← per-provider 60-min cooldown
        ├── Voice/                    (Phase 3 — new)
        │   ├── TTS.swift             ← protocol
        │   ├── ElevenLabsTTS.swift   ← URLSession + AVAudioPlayer
        │   ├── SystemTTS.swift       ← AVSpeechSynthesizer fallback
        │   └── VoicePicker.swift     ← mode/hour/profile → voiceId
        ├── Listener/                 (Phase 3 — new)
        │   ├── Listener.swift        ← protocol
        │   ├── SpeechListener.swift  ← SFSpeechRecognizer + AVAudioEngine
        │   └── WhisperClient.swift   ← multipart upload fallback
        ├── UI/                       (Phase 4 — new)
        │   ├── SpeechBubble.swift    ← borderless NSPanel + SwiftUI
        │   ├── ActivePanel.swift     ← left-anchored summary / reply / ask
        │   ├── SettingsOverlay.swift ← SwiftUI Form
        │   └── MicButton.swift       ← small overlay view, pulse animation
        └── Resources/
            ├── cat_puddle.png        (P1)
            ├── cat_awake.png         (P1)
            ├── cat_sleep.png         (P4)
            ├── cat_walk1.png         (P4)
            ├── cat_walk2.png         (P4)
            ├── cat_annoyed.png       (P4)
            ├── cat_play.png          (P4)
            └── cat_prompt.txt        (copied at build, or read from repo root in dev)
```

---

## 4. Architecture

### High-level

```
┌─────────────────────────────────────────────────────────────────────┐
│                          AppDelegate                                │
│  boots: SettingsStore, MemoryStore, CatWindow, CatView, Coordinator │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CatCoordinator                               │
│  - subscribes to FrontmostWatcher, CursorMonitor, CatView.onClick   │
│  - drives CatView sprite state                                      │
│  - calls Brain on event (Phase 3); shows UI via Phase 4 modules     │
│  - reads/writes MemoryStore and SettingsStore                       │
└─────────────────────────────────────────────────────────────────────┘
        │              │                │             │
        ▼              ▼                ▼             ▼
 ┌────────────┐ ┌─────────────┐ ┌────────────┐ ┌──────────────┐
 │  System/   │ │   Brain/    │ │  Voice/    │ │  Listener/   │
 │            │ │             │ │            │ │              │
 │ Frontmost  │ │ Brain       │ │ TTS        │ │ Listener     │
 │ Cursor     │ │  ├ OpenAI   │ │  ├ Eleven  │ │  ├ Speech…   │
 │ Capture    │ │  └ Gemini   │ │  └ System  │ │  └ Whisper   │
 │ Mail       │ │ Prompts     │ │ VoicePicker│ │              │
 │ Permission │ │ RateLimiter │ │            │ │              │
 └────────────┘ └─────────────┘ └────────────┘ └──────────────┘
        │              │                │             │
        ▼              ▼                ▼             ▼
   AppKit/AX   URLSession + Codable   AVFoundation   Speech.framework
   NSWorkspace                         AVAudioPlayer  AVAudioEngine
   AppleScript
```

### Threading model

- **`@MainActor`** — `AppDelegate`, `CatCoordinator`, `CatView`, all UI
  classes (Phase 4), and the storage stores. Anything touching AppKit or
  shared mutable state.
- **Background async work** — `URLSession` calls in `Brain/`, `Voice/`, and
  `Listener/WhisperClient` are plain `async`. They return to `@MainActor`
  before mutating coordinator state. `MailReader.readSelected()` (already
  ported) follows the same pattern using `Task.detached` for AppleScript.
- **`AVAudioEngine`** runs on its own real-time thread; we marshal the
  recognized text back to `@MainActor` via a `Task { @MainActor in … }`.
- **No locks.** All shared state lives on `@MainActor`. Per-provider
  `blockedUntil` timestamps in `RateLimiter` are `@MainActor` properties.

### Why this shape

- One coordinator, many small services. Mirrors the way `main.js` is one big
  pile of IPC handlers — but each handler becomes a method on `Coordinator`
  that calls a typed service.
- Protocol per external dependency (`ChatProvider`, `TTS`, `Listener`,
  `ScreenCapturing`). Lets us swap providers without touching the coordinator
  and lets tests inject fakes.
- Network code stays in its module; no `URLSession` calls leak into UI or
  coordinator code.

---

## 5. Data flow per interaction

### 5.1 Idle observation loop (every ~30s — Phase 3)

Equivalent of `setInterval(captureAndDescribe, AUTONOMOUS_MS)` in
`renderer.js`.

```
Timer 30s
   │
   ▼
ScreenCapture.capturePrimary()   ─►  PNG Data
   │
   ▼
Brain.describeScreen(image)      ─►  short caption (vision model)
   │
   ▼
Brain.getCatResponse(caption,    ─►  { response, tag }   (JSON-mode)
                    memory)
   │
   ▼
MemoryStore.append(Observation(  at: now,
                                 description: caption,
                                 tag: tag,
                                 said: response.isEmpty ? nil : response))
   │
   ▼
if response not empty:
   SpeechBubble.show(response)     (Phase 4)
   TTS.speak(response, mode, profile) if settings.voiceEnabled
```

### 5.2 Click → proactive assist (Phase 3)

```
CatView.onClick
   │
   ▼
CatCoordinator.handleCatClick()
   │
   ▼  (Phase 2 today logs capture size; Phase 3 replaces with the below)
ScreenCapture.capturePrimary()
   │
   ▼
Brain.proactiveAssist(image, memory)   ─►  short cat line
   │
   ▼
SpeechBubble.show(line); TTS.speak(line, mode: .auto)
MemoryStore.append(Observation(said: line, tag: "proactive"))
```

### 5.3 Frontmost → PDF mode (Phase 3 + 4)

```
NSWorkspace.didActivateApplicationNotification    ──┐
+ AX focused-window-title 1s poll                  ─┴► FrontmostWatcher
                                                          │ onChange(ctx)
                                                          ▼
                                                  ctx.mode == .pdf?
                                                          │ yes
                                                          ▼
                                          ScreenCapture.capturePrimary()
                                                          │
                                                          ▼
                                          Brain.summarizePdfImage(image)
                                                          │
                                                          ▼
                                          ActivePanel.showPdf(summary)
                                          TTS.speak(firstSentence,
                                                    mode: .pdf)   ─► voice "low"
```

Re-clicking the cat while in PDF mode repeats the summary (matches Electron
behavior — see `renderer.js` "click → reread").

### 5.4 Frontmost → Email mode (Phase 3 + 4)

```
FrontmostWatcher emits .email
            │
            ▼
MailReader.readSelected()  ─►  MailSelection { subject, sender, body }
            │
            ▼
Brain.analyzeEmail(mail)   ─►  { summary, draftReply, clarifyingQuestion }
            │
            ▼
ActivePanel.showEmail(result)            (Phase 4)
   ├─ Summary tab   — shows summary
   ├─ Reply tab     — shows draftReply, Copy button → NSPasteboard
   └─ Ask tab       — shows clarifyingQuestion
TTS.speak(summary, mode: .email)   ─► voice "soft" or "pink" auto-switch
```

### 5.5 Mic → SFSpeechRecognizer → reply (Phase 3 + 4)

```
MicButton tap (Phase 4)        ─►  Listener.start()
                                       │
                                       ▼
                       SFSpeechRecognizer feeds partial text every ~250ms
                                       │
                                       ▼ on user pause / max 8s
                       Listener.finalText(String)
                                       │
                                       ▼
                       SpeechBubble.show("you: \(text)")
                                       │
                                       ▼
                       Brain.replyToUser(text)   ─► short cat reply
                                       │
                                       ▼
                       SpeechBubble.show(reply); TTS.speak(reply, mode: .auto)
                       MemoryStore.append(Observation(said: reply, tag: "reply"))
```

Fallback path: if on-device locale isn't installed, `Listener` switches to
recording to a `.m4a` and shipping bytes through `WhisperClient`.

### 5.6 Mouse dwell / active-motion → mouse question (Phase 3 + 4)

Already wired in Phase 2 (`CursorMonitor.swift`). Phase 3 plugs in the brain:

```
CursorMonitor fires .dwell(at: p) or .activity(at: p)
            │
            ▼
ScreenCapture.captureRegion(at: p - REGION/2, size: REGION)
            │
            ▼
Brain.askMouseQuestion(region)  ─►  one short question or ""
            │
            ▼  if not empty
SpeechBubble.show(question)
TTS.speak(question, mode: .curious)  ─► voice "curious"
```

REGION is 480×320 (matches `main.js:72-73`).

### 5.7 Voice profile auto-switch (Phase 3)

`VoicePicker.swift` mirrors `pickVoiceProfile` in `brain.js`:

```
if !settings.autoVoiceByContext: return settings.voiceProfile

let hour = current local hour
if hour >= 22 or hour < 6: return .whisper

match mode:
  .pdf   -> .low
  .email -> .soft
  .curious (mouse) -> .curious
  .auto  (idle) -> settings.voiceProfile or .soft
```

Voice IDs (kept identical to Electron):

| Profile | ElevenLabs voiceId |
|---|---|
| soft | `21m00Tcm4TlvDq8ikWAM` |
| curious | `AZnzlk1XvdvUeBnXmlld` |
| bright | `MF3mGyEYCl7XYWbV9V6O` |
| low | `EXAVITQu4vr4xnSDxMaL` |
| whisper | `XB0fDUnXU5powFXDhCwa` |

---

## 6. Phase-by-phase deliverables

### Phase 1 — Foundation (done, merged via PR #6)

Goal achieved: a transparent, always-on-top, draggable cat window appears at
the bottom-right of the primary display, breathes, and crossfades sprites on
click.

Files: `Package.swift`, `main.swift`, `AppDelegate.swift`, `CatWindow.swift`,
`CatView.swift`, `CatState.swift`, `Resources/cat_{puddle,awake}.png`.

### Phase 2 — System integrations (done, merged via PR #7)

Goal achieved: every macOS plumbing layer the Electron version shells out for
is native — frontmost app detection, Mail selection via AppleScript, screen
capture (still via `screencapture` CLI for parity), global cursor monitor,
TCC permission pre-flight. Stores for settings and memory wired up. `.app`
bundling so TCC permissions persist between runs.

Files added since Phase 1: `CatMode.swift`, `CatCoordinator.swift`,
`System/{FrontmostWatcher,MailReader,ScreenCapture,CursorMonitor,Permissions}.swift`,
`Storage/{AppSupport,Settings,Memory}.swift`, `Makefile`.

What you see today on `swift run` (per `swift-cat/README.md:27-41`):

```
[cat] permission Screen Recording: not granted (will prompt on first use)
[cat] permission Accessibility:    not granted (will prompt on first use)
[cat] permission Automation:       granted
[cat] coordinator ready — sprite reactions live, brain stubs pending Phase 3
[cat] frontmost mode=pdf   app=Preview      title=paper.pdf
[cat] cursor activity near (1240, 360)
[cat] frontmost mode=email app=Mail         title=Inbox
[cat] mail selection: subject="hello" from=alice@x.com bodyLen=412
[cat] clicked — would trigger proactiveAssist in Phase 3
[cat] captured 245 kb (capture pipeline working)
```

### Phase 3 — AI brain (next)

**Goal.** Feature parity with `brain.js` end-to-end. Click cat with Preview
open → spoken summary in ≤ 3 s. Pull the OpenAI key → Gemini fallback works.
Tap mic → on-device transcription. ElevenLabs audio plays through
`AVAudioPlayer`.

**Files added** (under `Sources/DesktopCat/`):

#### `Brain/ChatProvider.swift`

```swift
struct ChatRequest {
    let system: String?
    let user: String
    let imageData: Data?     // PNG; provider encodes to base64 itself
    let jsonMode: Bool
    let maxTokens: Int
    let temperature: Double  // default 0.85, matches brain.js
}

protocol ChatProvider: Sendable {
    var name: String { get }       // "openai" | "gemini"
    var isAvailable: Bool { get }  // has API key, not rate-limited
    func chat(_ req: ChatRequest) async -> String   // "" on failure
}
```

Provider implementations never throw — they return `""` and log. The
dispatcher decides what to do. This matches the "fail open with empty" pattern
that `brain.js` uses throughout.

#### `Brain/OpenAIChat.swift`

- Wraps `https://api.openai.com/v1/chat/completions`.
- Models from env: `OPENAI_TEXT_MODEL` (default `gpt-4o-mini`),
  `OPENAI_VISION_MODEL` (default `gpt-4o-mini`).
- Vision path: when `imageData != nil`, builds the
  `content: [{type:"text"…},{type:"image_url",image_url:{url:"data:image/png;base64,…"}}]`
  shape from `brain.js:78-87`.
- JSON mode: sets `response_format: { type: "json_object" }`.
- 429 handling: regex `429|quota|rate.?limit` → notifies `RateLimiter`
  to block this provider for 60 min.

#### `Brain/GeminiChat.swift`

- Wraps `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
- Model from env: `GEMINI_MODEL` (default `gemini-2.5-flash`).
- System prompt goes in the top-level `systemInstruction` field, not as a
  message — matches `brain.js:142-146`.
- JSON mode: `generationConfig.responseMimeType = "application/json"`.
- 429 handling: regex `429|quota|rate.?limit|RESOURCE_EXHAUSTED` → blocks
  Gemini for 60 min.

#### `Brain/RateLimiter.swift`

`@MainActor` singleton holding two `Date?` blocked-until timestamps. Methods:
`mark(provider:)`, `isBlocked(provider:) -> Bool`. 60-minute cooldown, same
as `brain.js:16-22`.

#### `Brain/Brain.swift`

Dispatcher. The user-facing API mirrors `brain.js`'s exports 1:1 so the
porting is mechanical:

```swift
@MainActor
final class Brain {
    init(providers: [ChatProvider])   // typically [openai, gemini] in order

    // mirrors brain.js exports
    func describeScreen(_ image: Data) async -> String
    func getCatResponse(description: String,
                        memory: Memory) async -> (response: String, tag: String)
    func summarizePdfImage(_ image: Data) async -> String
    func analyzeEmail(_ mail: MailSelection) async -> EmailResult
    func askMouseQuestion(_ region: Data) async -> String
    func proactiveAssist(_ image: Data, memory: Memory) async -> String
    func replyToUser(_ text: String) async -> String
}
```

Each method:
1. Picks the first available provider.
2. Calls `provider.chat(req)`.
3. If result is `""` and another provider is available, tries it.
4. Returns "" on total failure — never throws.

#### `Brain/Prompts.swift`

Five prompts as `static let` strings, copy-pasted **verbatim** from
`brain.js`:

- `Prompts.pdf` — from `brain.js:249-260`
- `Prompts.email` — from `brain.js:262-271`
- `Prompts.userReply` — from `brain.js:308-320`
- `Prompts.mouseQuestion` — from `brain.js:333-344`
- `Prompts.proactive` — from `brain.js:358-376`
- `Prompts.systemFromFile()` — reads `cat_prompt.txt` from the bundle (or
  repo root in dev), with the same fallback string `brain.js:215-217` uses
  when the file is missing.

These must not drift from the Electron prompts or the cat's voice changes.

#### `Voice/TTS.swift`

```swift
protocol TTS: Sendable {
    func speak(_ text: String,
               profile: VoiceProfile,
               onDone: (@MainActor () -> Void)?) async
    func stop()
    var isSpeaking: Bool { get }
}
```

#### `Voice/ElevenLabsTTS.swift`

- Reads `ELEVENLABS_API_KEY` from env.
- POSTs to `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`.
- Body: `{ text, model_id: "eleven_flash_v2_5", voice_settings: { stability: 0.55, similarity_boost: 0.75 } }` (matches `main.js:365-369`).
- Plays returned `audio/mpeg` via `AVAudioPlayer`.
- Fires `onDone` on completion so the Phase 4 talking-animation can stop.

#### `Voice/SystemTTS.swift`

`AVSpeechSynthesizer` fallback used when `ELEVENLABS_API_KEY` is unset or
ElevenLabs returns an error. Picks `AVSpeechSynthesisVoice` based on profile
(rough mapping — soft maps to `en-US`, low to a deeper variant). Volume + rate
tuned by ear to feel close to the ElevenLabs voices.

#### `Voice/VoicePicker.swift`

Pure function. Ports `pickVoiceProfile` from `brain.js:462-468` exactly.

#### `Listener/Listener.swift`

```swift
protocol Listener: AnyObject {
    var onPartial: (@MainActor (String) -> Void)? { get set }
    var onFinal:   (@MainActor (String) -> Void)? { get set }
    func start() throws
    func stop()
    var isListening: Bool { get }
}
```

#### `Listener/SpeechListener.swift`

- `SFSpeechRecognizer(locale: .current)` + `AVAudioEngine` for the mic tap.
- Authorization request on first use (`SFSpeechRecognizer.requestAuthorization`,
  `AVCaptureDevice.requestAccess(for: .audio)`).
- Auto-stops after 8 s or 1.5 s of trailing silence (matches the
  `MediaRecorder` cutoff in `renderer.js`).
- If `SFSpeechRecognizer.isAvailable` is false (locale not installed), falls
  through to `WhisperClient`.

#### `Listener/WhisperClient.swift`

- Records 16 kHz mono PCM to a temp `.wav` (or pipes from AVAudioEngine
  directly to `Data`).
- Multipart POST to `https://api.openai.com/v1/audio/transcriptions` with
  `model=whisper-1, language=en, temperature=0` (mirrors `brain.js:411-444`).
- Returns the transcribed text or empty on failure.

#### Coordinator changes for Phase 3

`CatCoordinator.swift` gains:

```swift
private let brain: Brain
private let tts: TTS
private let memory: MemoryStore
private let settings: SettingsStore
private var observationTimer: Timer?
```

- `start()` schedules `observationTimer` at 30s for §5.1.
- `handleCatClick()` becomes §5.2 (replacing the current
  "would trigger proactiveAssist in Phase 3" log).
- `handleFrontmost(.pdf)` becomes §5.3.
- `handleFrontmost(.email)` becomes §5.4.
- `handleCursor(...)` becomes §5.6.
- A new `handleMicTap()` (UI added in Phase 4) becomes §5.5.

#### Error semantics (port the Electron pattern)

`brain.js` is deliberately silent: every failure path returns "" or
`{ response: "" }`. The renderer treats "" as "say nothing", so failures
look like the cat just chose not to speak. The Swift port keeps that
philosophy:

- Provider calls never throw — `""` means "couldn't help".
- `Brain.*` never throws — `""` or empty struct means "couldn't help".
- The coordinator never surfaces a failure to the user UI. We log to
  console only.

The one exception: TCC denials surface a one-time friendly prompt via
`Permissions.swift` (already in Phase 2).

#### Phase 3 acceptance criteria

| # | Test | Pass |
|---|---|---|
| 3.1 | `swift run` with valid `OPENAI_API_KEY`. Click cat with Preview showing a PDF. | Within 3 s, the cat's voice plays a 2–4 sentence summary; bubble shows the text. |
| 3.2 | Unset `OPENAI_API_KEY`. Set `GEMINI_API_KEY`. Repeat 3.1. | Same outcome. Log shows `[brain] openai unavailable → gemini`. |
| 3.3 | Unset both. Click cat. | Cat sprite still reacts; no crash; log says "no providers available". No bubble. |
| 3.4 | With `ELEVENLABS_API_KEY` set, trigger any speak. | Audio plays through AVAudioPlayer; `tts.isSpeaking` toggles correctly. |
| 3.5 | Unset `ELEVENLABS_API_KEY`. Trigger any speak. | `SystemTTS` (AVSpeechSynthesizer) plays the line. |
| 3.6 | Tap a stub mic trigger (or call `coordinator.handleMicTap()` from a temp menu item). Speak one sentence. | Partial text logs within 500 ms; final text within ~1 s of pausing; cat replies via Brain.replyToUser. |
| 3.7 | Profile change in settings JSON → next utterance uses the new voiceId. | True. |
| 3.8 | 429 from OpenAI → next 6 calls all route to Gemini. After 60 min, OpenAI is tried again. | True (verify by injecting a fake 429 in dev). |
| 3.9 | Idle observation loop runs every 30 s; `memory.json` accumulates new observations. | True. |

### Phase 4 — UI polish

**Goal.** Visual + interaction parity with the Electron renderer. Speech
bubble, active panel for PDF/email mode, settings overlay, profile color
tinting, talking animation tied to audio, walking & playing cycles, mic
button. After Phase 4 the Swift app should be visually indistinguishable
from the Electron one to a casual user.

**Files added** (under `Sources/DesktopCat/UI/`):

- `SpeechBubble.swift` — borderless `NSPanel` floating above the cat,
  SwiftUI content, rounded corners, opacity fade in/out (~280 ms), tail
  pointing at cat. Auto-hides after 7.5 s (matches `renderer.js:187-197`).
- `ActivePanel.swift` — left-anchored SwiftUI view pinned to the cat
  window's left edge. PDF mode shows a single scrollable body. Email mode
  shows three tabs (Summary / Reply / Ask) with a Copy button on Reply.
  Header color shifts by mode (blue for PDF, pink for email — matches the
  Electron styling).
- `SettingsOverlay.swift` — SwiftUI `Form` with toggles for `voiceEnabled`,
  `autoVoiceByContext`, `mouseQuestionsEnabled`, and a picker for
  `voiceProfile`. Writes through `SettingsStore`.
- `MicButton.swift` — small `NSView` overlay on the cat window. Pulses red
  while `Listener.isListening`. Hidden until cursor hovers near the cat,
  same as the gear button (matches the Electron behavior in `renderer.js`).

**Sprite expansions:**

- `CatState` enum gains `.sleep`, `.walk1`, `.walk2`, `.annoyed`, `.play`
  (Electron has seven sprites total — `renderer.js:29-37`).
- Sprite tinting per profile via `CIColorMatrix` filter on the sprite
  `CALayer` (replaces the CSS `--aura` halo).
- Per-profile breath via `CAKeyframeAnimation` — five curves matching the
  CSS `breathe-soft/curious/bright/low/whisper` keyframes.
- Talking animation: `CABasicAnimation` group bound to `AVAudioPlayer`'s
  start/stop callbacks (`onDone` in the TTS protocol).
- Walking cycle: `CALayer.contents` alternates `cat_walk1` / `cat_walk2`
  every 250 ms for 4.5 s on a random 6–12 min interval (matches
  `renderer.js:128-142`).
- Sleep state: triggered when the cat has been puddle for >90 s and the
  hour is between 22:00 and 06:00 (matches `renderer.js:156-184`).

**Phase 4 acceptance criteria:**

| # | Test | Pass |
|---|---|---|
| 4.1 | Side-by-side screenshot vs Electron, same scenario. | < 10 % perceptual diff per profile. |
| 4.2 | Open PDF, click cat. | Active panel slides in on left; summary inside; first sentence spoken. |
| 4.3 | Open Mail, select message. | Active panel shows three tabs; switching tabs is instant; Copy on Reply puts text on the clipboard. |
| 4.4 | Idle 30 min. | Walking cycle has triggered at least once. |
| 4.5 | Idle RAM (Activity Monitor). | < 50 MB resident. (Electron: ~150 MB.) |
| 4.6 | Cold start (window first visible). | < 300 ms on M1. |
| 4.7 | Switch profile in settings overlay. | Sprite tint and breath animation update immediately. |

### Phase 5 — Packaging, signing, cutover

- Replace local `make bundle` with a notarized `.app` shipped in a DMG.
  Sign with an Apple Developer ID; staple a notarization ticket.
- `Info.plist` additions: `NSMicrophoneUsageDescription`,
  `NSSpeechRecognitionUsageDescription`, the existing
  `NSAppleEventsUsageDescription`.
- Add a Sparkle-based updater so installed cats can self-update without
  going through Homebrew or the App Store.
- Mark `package.json` scripts deprecated; add a `README.md` block pointing
  users to the DMG.
- Keep the Electron source in-tree for one more release cycle as a rollback,
  then delete after the Swift app has been live with no critical issues for
  ~2 weeks.

---

## 7. Contracts

### 7.1 `memory.json`

Same shape on both runtimes so the same file is readable by either:

```jsonc
{
  "session_count": 42,
  "observations": [
    {
      "at": "2026-05-17T15:43:12.000Z",  // ISO-8601
      "description": "code editor with python file open",
      "tag": "code-focus",
      "said": "the screen has not changed in a while."
    }
  ]
}
```

Swift codec lives in `Storage/Memory.swift`. Dates encoded with `.iso8601`.
Trailing `said: null` is normal when the cat chose silence.

Bound: last 100 observations (Electron didn't bound this — the Swift port
does to keep the file small).

### 7.2 `settings.json`

```jsonc
{
  "voiceEnabled": true,
  "voiceProfile": "soft",        // soft | curious | bright | low | whisper
  "autoVoiceByContext": true,
  "mouseQuestionsEnabled": true
}
```

Defaults defined in `Storage/Settings.swift` (and `main.js:23-28`).

### 7.3 `MailSelection`

```swift
struct MailSelection: Sendable {
    let subject: String
    let sender: String
    let body: String   // capped at 6000 chars to match brain.js
}
```

Produced by `MailReader.readSelected()`.

### 7.4 `EmailResult` (from `Brain.analyzeEmail`)

```swift
struct EmailResult: Sendable {
    let summary: String
    let draftReply: String
    let clarifyingQuestion: String
}
```

Parsed from JSON returned by the model. Any field missing → `""` (never
crash on malformed model output).

### 7.5 Provider request/response

See §6 — `ChatRequest` and `chat(_ req:) async -> String`. The single string
return covers every prompt; JSON-mode prompts return the raw JSON string and
the caller `JSONDecoder`s it (matches the `brain.js:236-246` shape).

---

## 8. External APIs

### 8.1 OpenAI chat completions

- Endpoint: `POST https://api.openai.com/v1/chat/completions`
- Auth: `Authorization: Bearer $OPENAI_API_KEY`
- Models: `gpt-4o-mini` for both text and vision by default; overridable
  via `OPENAI_TEXT_MODEL` and `OPENAI_VISION_MODEL`.
- JSON mode: `response_format: { type: "json_object" }`.
- Vision: inline base64 PNG via `image_url: { url: "data:image/png;base64,…" }`.
- Rate limit: 60-min cooldown after first 429.

### 8.2 OpenAI Whisper (fallback only)

- Endpoint: `POST https://api.openai.com/v1/audio/transcriptions`
- Auth: same key as above.
- Form fields: `file`, `model=whisper-1`, `language=en`, `temperature=0`.
- File: `.webm` or `.m4a` or `.wav`; Swift will use `.wav` 16 kHz mono.

### 8.3 Google Gemini

- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=$GEMINI_API_KEY`
- Model: `gemini-2.5-flash` (env `GEMINI_MODEL`).
- System prompt in top-level `systemInstruction.parts[0].text`.
- Vision: `parts[].inlineData = { mimeType: "image/png", data: base64 }`.
- JSON mode: `generationConfig.responseMimeType = "application/json"`.
- Rate limit: 60-min cooldown after first 429 / `RESOURCE_EXHAUSTED`.

### 8.4 ElevenLabs TTS

- Endpoint: `POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`
- Auth: `xi-api-key: $ELEVENLABS_API_KEY`
- Body: `{ text, model_id: "eleven_flash_v2_5", voice_settings: { stability: 0.55, similarity_boost: 0.75 } }`
- Accept: `audio/mpeg`.

---

## 9. Permissions matrix

| Capability | TCC bucket | Triggered by | Graceful degradation |
|---|---|---|---|
| Screen capture | Screen Recording | `screencapture` CLI (Phase 2) or `SCStream` (Phase 4) | Cat works in idle mode but can't do PDF / proactive — bubble suggests granting in System Settings. |
| Window titles | Accessibility | `AXUIElementCopyAttributeValue` | Title is `nil`; we still classify mode from app name alone. |
| Global cursor monitor | Accessibility | `NSEvent.addGlobalMonitorForEvents` | Falls back to 500 ms `NSEvent.mouseLocation` poll — same accuracy, slightly higher CPU. |
| Mail selection | Automation (Mail) | `NSAppleScript` first run | Email mode disabled; settings overlay shows a one-line status. |
| Frontmost app | Automation (System Events) | AppleScript front-app helper | Already replaced by `NSWorkspace.frontmostApplication` in Swift — no AppleScript needed. |
| Microphone | Microphone | `AVAudioEngine.start()` first run | Mic button hidden if not granted. |
| Speech recognition | Speech Recognition | `SFSpeechRecognizer.requestAuthorization` | Falls back to `WhisperClient`. |

`Permissions.swift` already runs the Screen Recording / Accessibility /
Automation preflight on launch. Phase 3 adds Microphone + Speech Recognition
preflight when the mic button is first tapped (deferred so we don't show 5
dialogs on first launch).

---

## 10. Coexistence (Electron + Swift in parallel)

Both apps can run at the same time on the same machine. Important
boundaries while we're in this phase:

- **No shared `memory.json`.** Electron writes to repo-root `memory.json`;
  Swift writes to `~/Library/Application Support/DesktopCat/memory.json`.
  Running them simultaneously will give each its own short-term memory.
  Acceptable for the migration window; we sync at Phase 5 by copying
  Electron's file into Application Support on first Swift launch.
- **Shared `cat_prompt.txt`.** Both apps read this file. Edits to the
  prompt instantly affect both. Don't move it.
- **Shared `assets/`.** Same.
- **Two windows on screen.** Each app shows its own cat. If you're
  comparing visually, quit one before testing the other to avoid confusion.
- **API quotas.** Both apps hit the same OpenAI key, so during dev keep
  one of them quiet (e.g. lower `AUTONOMOUS_MS` only on the one you're
  actually testing).

---

## 11. Testing & verification

We deliberately keep the test surface small for a hackathon project, but
each phase has a defined verification recipe.

### Unit (XCTest)

- `Tests/StorageTests` — round-trip Memory + Settings JSON, including
  reading an Electron-written file.
- `Tests/PromptsTests` — `Prompts.systemFromFile()` returns the same string
  as reading `cat_prompt.txt` directly.
- `Tests/VoicePickerTests` — table-driven check on the picker (15+ rows
  for mode × hour × autoByContext).
- `Tests/RateLimiterTests` — mark, isBlocked, expiration after fake clock
  advance.
- `Tests/BrainTests` — `Brain` with a stub provider returning canned
  strings; verify dispatcher tries fallback on empty.

### Manual smoke tests (per phase acceptance tables)

Phase 3 and 4 have explicit pass/fail rows in §6. Recommended to walk
through them once per release candidate before merging to `main`.

### Visual regression (Phase 4)

`tests/visual/` — small folder of screenshots taken with `screencapture
-l $(window-id)` on both Electron and Swift. We eyeball the diff; nothing
automated, but it gives us a reference set so a regression jumps out.

---

## 12. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `SFSpeechRecognizer` locale not installed | Medium | Mic stops working silently | Auto-fall through to `WhisperClient`. Show a one-time hint to add the locale in System Settings. |
| `ScreenCaptureKit` denied on first run | High | PDF/proactive features dead until grant | `Permissions.preflight()` already in Phase 2; we keep the `screencapture` CLI path as a fallback so the same TCC grant covers both. |
| AppleScript Automation denied for Mail | Medium | Email mode dead | Cat works without Mail mode; settings overlay surfaces a single-line status. |
| ElevenLabs 5xx during demo | Medium | Cat goes silent at the worst moment | `SystemTTS` (AVSpeechSynthesizer) fallback — voice loses character but cat keeps talking. |
| Network down | Low | No brain calls work | Cat stays silent; UI still responsive (sprite, drag, panel). |
| JSON-mode model returns malformed JSON | Low | `analyzeEmail` returns blanks | Already handled: `try? JSONDecoder().decode` → empty struct fallback. |
| Async/await + AppKit threading bugs | Low | Hangs or crashes | `@MainActor` audit during Phase 3 review; protocol-level `Sendable` markers; no shared mutable state outside `@MainActor`. |
| Sandboxing complications for App Store | Low | n/a — we are not shipping there | Ignore for v1. |
| Cutover regresses on a feature we forgot | Medium | User confusion | Keep Electron source in-tree for one release cycle; document the rollback path. |
| Memory.json schema drift between runtimes | Low | Cat says weird things after switch | Schema is enforced by `Codable` on the Swift side; Electron schema is implicit but stable. We have not changed it. |

---

## 13. Open decisions

These are choices we'll need to make as we go. Listed here so we don't
accidentally make them by default.

1. **`screencapture` CLI vs `ScreenCaptureKit` for primary capture.** Phase 2
   ships the CLI; it works. Phase 3 or 4 should benchmark whether `SCStream`
   is noticeably faster on a cold path. If < 100 ms difference, stay on the
   CLI — fewer moving parts.
2. **Whisper vs SFSpeechRecognizer priority.** Default plan is on-device
   first. Worth confirming Whisper isn't actually higher quality for the
   short utterances the cat hears.
3. **Talking animation source of truth.** Bind to `AVAudioPlayer`'s callback
   or run on a synthetic timer? Callback is more accurate; timer is what
   Electron does. Recommend callback for Swift.
4. **Settings UI location.** Overlay on the cat window (Electron behavior) or
   a separate small `NSWindow`? Overlay keeps the "one window" feel.
5. **Where to ship the prompt file.** Bundled inside `Resources/` (build-time
   freeze) or read live from `../cat_prompt.txt` (lets prompt edits hot-reload
   in dev). Probably ship both: try bundle first, fall back to repo path.
6. **Cleanup of `memory.json` at repo root post-cutover.** Migrate, then
   delete? Or leave for a while as a backup?

---

## 14. Cutover criteria

The Swift app replaces the Electron app the moment **all** of the following
are true:

- [ ] Every row in the Phase 3 and Phase 4 acceptance tables passes.
- [ ] Idle RAM is < 50 MB on M1 with the cat in puddle for 10 min.
- [ ] A code-signed, notarized DMG is downloadable from the project README.
- [ ] At least one full demo (the 2-minute shot list in
      `docs/demo-script.md`) records cleanly on the Swift app with no
      fallbacks to the Electron behaviors.
- [ ] One week of dogfooding with the autonomous + mic flows, no crashes,
      no silent failures the user notices.

Until then: Electron stays the recommended way to run the cat. The Swift
build is for development and dogfooding.

---

## Appendix A — module-by-module port checklist

A flat checklist mirroring the Electron source files, useful for tracking
porting progress during Phase 3.

### From `brain.js`

- [ ] `openaiChat` dispatcher → `Brain.swift` (dispatcher), `OpenAIChat.swift`, `GeminiChat.swift`
- [ ] `_openaiChat` body shape → `OpenAIChat.chat`
- [ ] `_geminiChat` body shape → `GeminiChat.chat`
- [ ] `noteOpenaiRateLimit` / `noteGeminiRateLimit` → `RateLimiter`
- [ ] `describeScreen` → `Brain.describeScreen`
- [ ] `getCatResponse` → `Brain.getCatResponse`
- [ ] `summarizePdfImage` → `Brain.summarizePdfImage`
- [ ] `analyzeEmail` → `Brain.analyzeEmail`
- [ ] `askMouseQuestion` → `Brain.askMouseQuestion`
- [ ] `proactiveAssist` → `Brain.proactiveAssist`
- [ ] `replyToUser` → `Brain.replyToUser`
- [ ] `transcribeAudio` → `Listener/WhisperClient.transcribe`
- [ ] `pickVoiceProfile` → `Voice/VoicePicker.pick`
- [ ] `VOICE_LIBRARY` map → static dictionary in `VoicePicker`
- [ ] Five inlined prompts → `Brain/Prompts.swift` (verbatim)

### From `main.js`

- [x] `createWindow` → `CatWindow.swift` + `AppDelegate.makeWindow` (Phase 1)
- [x] `startMouseDwellWatcher` → `CursorMonitor.swift` (Phase 2)
- [x] `askMouseQuestion(cursor)` capture pipeline → `ScreenCapture.captureRegion` (Phase 2) + `Brain.askMouseQuestion` (Phase 3)
- [x] `capture-screen` IPC → `ScreenCapture.capturePrimary` (Phase 2)
- [x] `cat:getContext` (front app + mail) → `FrontmostWatcher` + `MailReader` (Phase 2)
- [x] `read-memory` / `write-memory` IPC → `MemoryStore` (Phase 2)
- [x] `cat:getSettings` / `cat:setSettings` → `SettingsStore` (Phase 2)
- [ ] `cat:summarizePdf` → coordinator §5.3
- [ ] `cat:analyzeEmail` → coordinator §5.4
- [ ] `cat:speak` → `ElevenLabsTTS.speak`
- [ ] `cat:replyToUser` → `Brain.replyToUser`
- [ ] `cat:transcribe` → `WhisperClient.transcribe`
- [ ] `cat:proactiveAssist` → coordinator §5.2
- [ ] `cat:hasVoiceKey` / `cat:hasTranscriptionKey` → simple env-var checks

### From `renderer.js`

- [x] Sprite state machine → `CatView` + `CatState` (Phases 1 & 4)
- [x] Drag implementation → `CatView.mouseDown/Dragged` (Phase 1)
- [ ] `showBubble` → `SpeechBubble.swift`
- [ ] Active panel (PDF / email tabs) → `ActivePanel.swift`
- [ ] Settings overlay → `SettingsOverlay.swift`
- [ ] Mic button + recording → `MicButton.swift` + `SpeechListener.swift`
- [ ] Sprite tinting via CSS `--aura` → `CIColorMatrix` filter on layer
- [ ] Breath animations → `CAKeyframeAnimation`
- [ ] Walking cycle → `CALayer.contents` swap every 250 ms
- [ ] Talking animation → bound to `AVAudioPlayer` callbacks
- [ ] Sleep state at night → coordinator `maybeSleep()`
- [ ] Autonomous observation loop (`AUTONOMOUS_MS`) → coordinator timer

### From `preload.js`

- [ ] Nothing to port — IPC bridge is unnecessary in a single-process
      AppKit app. The whole file disappears at Phase 5.

### From `cat_prompt.txt`

- No changes. Both runtimes read the file directly.
