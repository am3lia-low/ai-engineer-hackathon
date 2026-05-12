# DesktopCat (Swift)

Native macOS rewrite of the Electron cat. See [`../docs/SWIFT_REWRITE.md`](../docs/SWIFT_REWRITE.md) for the full 4-phase plan.

## Phase 1 status — foundation
Implemented:
- Borderless transparent always-on-top window, anchored bottom-right
- Two sprite layers (`puddle`, `awake`) with crossfade
- Looping breath animation (`CABasicAnimation`)
- Drag-to-move via `mouseDown` / `mouseDragged`
- Click-without-drag toggles sprite (temporary affordance to prove the state-swap pipeline)
- Cmd+Q exits cleanly via a hidden menu

Not yet (later phases):
- System integrations (frontmost app, Mail, screen capture, cursor monitor) — Phase 2
- AI brain (OpenAI, Gemini, ElevenLabs, SFSpeechRecognizer) — Phase 3
- UI polish (speech bubble, active panel, settings overlay, per-profile color/animation, walking cycle) — Phase 4

## Build & run

```bash
cd swift-cat
swift run
```

First build is ~10–20 s; incremental builds are < 1 s.

Quit with **Cmd+Q**.

## Requirements

- macOS 13 Ventura or newer (deployment target in `Package.swift`)
- Swift 5.9+ toolchain (bundled with Xcode 15+ or `swift.org` toolchain)

## Project layout

```
swift-cat/
├── Package.swift
├── README.md
└── Sources/DesktopCat/
    ├── main.swift          ← NSApplication entry, .accessory activation policy
    ├── AppDelegate.swift   ← window construction + Cmd+Q menu
    ├── CatWindow.swift     ← borderless transparent NSWindow
    ├── CatView.swift       ← sprite layer stack + drag + click + breathing
    ├── CatState.swift      ← sprite state enum (full set; only puddle+awake used in Phase 1)
    └── Resources/
        ├── cat_puddle.png
        └── cat_awake.png
```

The Electron app at the repo root continues to work — the two implementations coexist until Phase 4 cutover.
