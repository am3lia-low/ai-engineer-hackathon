# DesktopCat (Swift)

Native macOS rewrite of the Electron cat. See [`../docs/SWIFT_REWRITE.md`](../docs/SWIFT_REWRITE.md) for the full 4-phase plan.

## Status

| Phase | Status | What it covers |
|---|---|---|
| 1 — Foundation | ✅ shipped | Window, sprite stack, drag, breath, crossfade |
| 2 — System integrations | ✅ this branch | FrontmostWatcher, MailReader, ScreenCapture, CursorMonitor, Permissions, Settings + Memory stores, .app bundling |
| 3 — AI brain | ⏳ next | OpenAI + Gemini dispatcher, ElevenLabs, Whisper, SFSpeechRecognizer |
| 4 — UI polish | ⏳ later | Speech bubble, active panel, settings overlay, per-profile color + animation, walking cycle |

## Build & run

```bash
cd swift-cat
swift run               # debug build + launch
make release            # release build
make bundle             # wrap into build/DesktopCat.app (stable bundle id for TCC)
make open-bundle        # run the bundled .app — needed for persistent permissions
```

Quit with **Cmd+Q**.

## Phase 2 — what works now

When you `swift run`, the terminal logs everything the cat sees:

```
[cat] permission Screen Recording: not granted (will prompt on first use)
[cat] permission Accessibility:   not granted (will prompt on first use)
[cat] permission Automation:      granted
[cat] coordinator ready — sprite reactions live, brain stubs pending Phase 3
[cat] frontmost mode=pdf   app=Preview      title=paper.pdf
[cat] cursor activity near (1240, 360)
[cat] frontmost mode=email app=Mail         title=Inbox
[cat] mail selection: subject="hello" from=alice@x.com bodyLen=412
[cat] clicked — would trigger proactiveAssist in Phase 3
[cat] captured 245 kb (capture pipeline working)
```

The cat sprite physically reacts:
- Opens a PDF in Preview → cat crossfades to **awake**
- Selects a Mail message → reads it via AppleScript, logs subject/sender/body length
- Wave the cursor around → cat wakes
- Cursor sits still ≥ 1.2 s anywhere new → dwell trigger
- Cursor covers ≥ 1500 px in 8 s → active-motion trigger
- ~22 s of no activity → cat settles back to puddle

Click the cat → runs the capture pipeline end-to-end (prints capture byte size) so you can confirm `screencapture` is granted before Phase 3 lands.

## Permissions (first run)

For full functionality, grant in System Settings → Privacy & Security:

- **Screen Recording** — for screen capture (Phase 3 vision calls).
- **Accessibility** — for the global cursor monitor (the timer-based fallback works without it, just less responsive).
- **Automation → Mail / System Events** — granted on first AppleScript use.

The bundled `.app` (from `make bundle`) is the path TCC remembers; `swift run` rebuilds the binary at a new path each time, so re-grants get awkward. Once you need stable permissions, use the bundle.

## Project layout

```
swift-cat/
├── Package.swift
├── Makefile                 ← build / release / bundle / open-bundle / clean
├── README.md
└── Sources/DesktopCat/
    ├── main.swift           ← NSApplication entry, .accessory policy
    ├── AppDelegate.swift    ← boots stores, window, coordinator
    ├── CatWindow.swift      ← borderless transparent NSWindow
    ├── CatView.swift        ← sprite layer stack, drag + onClick callback
    ├── CatState.swift       ← sprite enum
    ├── CatMode.swift        ← idle / pdf / email
    ├── CatCoordinator.swift ← bridges system events → cat state
    ├── System/
    │   ├── FrontmostWatcher.swift
    │   ├── MailReader.swift
    │   ├── ScreenCapture.swift
    │   ├── CursorMonitor.swift
    │   └── Permissions.swift
    ├── Storage/
    │   ├── AppSupport.swift
    │   ├── Settings.swift
    │   └── Memory.swift
    └── Resources/
        ├── cat_puddle.png
        └── cat_awake.png
```

The Electron app at the repo root continues to work; this is purely additive until Phase 4 cutover.
