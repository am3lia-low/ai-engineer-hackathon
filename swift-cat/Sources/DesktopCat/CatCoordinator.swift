import AppKit
import Foundation

/// Bridges system events (frontmost app, cursor, Mail selection) to the cat's
/// visible state. Phase 2's job is just to prove the wiring; Phase 3 plugs
/// the AI brain in here, and Phase 4 adds the UI panel + speech bubble.
@MainActor
final class CatCoordinator {

    // Visible state target.
    private let catView: CatView

    // Storage.
    private let settings: SettingsStore
    private let memory: MemoryStore

    // System integrations.
    private let frontmost = FrontmostWatcher()
    private let cursor = CursorMonitor()
    private let screen: ScreenCapturing = ShellScreenCapture()

    // Idle timing — when nothing's happened for a while, drift back to puddle.
    private var lastActiveAt = Date()
    private var idleTimer: Timer?
    private let puddleAfterSec: TimeInterval = 22

    init(catView: CatView, settings: SettingsStore, memory: MemoryStore) {
        self.catView = catView
        self.settings = settings
        self.memory = memory
    }

    func start() {
        Permissions.preflight()

        catView.onClick = { [weak self] in self?.handleCatClick() }

        frontmost.onChange = { [weak self] ctx in self?.handleFrontmost(ctx) }
        frontmost.start()

        cursor.onTrigger = { [weak self] trigger in self?.handleCursor(trigger) }
        cursor.start()

        idleTimer = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.checkIdle() }
        }

        print("[cat] coordinator ready — sprite reactions live, brain stubs pending Phase 3")
    }

    func stop() {
        frontmost.stop()
        cursor.stop()
        idleTimer?.invalidate()
        idleTimer = nil
    }

    // MARK: - Event handlers

    private func handleFrontmost(_ ctx: FrontmostContext) {
        let trimmed = ctx.title?.prefix(60).description ?? ""
        print("[cat] frontmost mode=\(ctx.mode.rawValue) app=\(ctx.appName) title=\(trimmed)")

        switch ctx.mode {
        case .pdf, .email:
            wakeUp()
            // If we're in email mode, try to actually read the selection so we
            // can see Phase 3's payload shape during dev. Logged for now.
            if ctx.mode == .email {
                Task { [weak self] in
                    if let mail = await MailReader.readSelected() {
                        print("[cat] mail selection: subject=\"\(mail.subject)\" from=\(mail.sender) bodyLen=\(mail.body.count)")
                        self?.memory.append(Observation(
                            at: Date(),
                            description: "Mail: \(mail.subject)",
                            tag: "mail-detected",
                            said: nil
                        ))
                    }
                }
            }
        case .idle:
            break
        }
    }

    private func handleCursor(_ trigger: CursorTrigger) {
        switch trigger {
        case .dwell(let p):
            print("[cat] cursor dwell at (\(Int(p.x)),\(Int(p.y)))")
        case .activity(let p):
            print("[cat] cursor activity near (\(Int(p.x)),\(Int(p.y)))")
        }
        wakeUp()
    }

    private func handleCatClick() {
        print("[cat] clicked — would trigger proactiveAssist in Phase 3")
        wakeUp()
        // Quick way to verify capture during dev — Phase 3 replaces this with
        // a real brain call and removes the disk write.
        Task { [weak self] in
            do {
                let data = try await self?.screen.capturePrimary()
                print("[cat] captured \(((data?.count ?? 0) / 1024)) kb (capture pipeline working)")
            } catch {
                print("[cat] capture failed:", error.localizedDescription)
            }
        }
    }

    // MARK: - Idle / wake helpers

    private func wakeUp() {
        lastActiveAt = Date()
        catView.setState(.awake)
    }

    private func checkIdle() {
        guard Date().timeIntervalSince(lastActiveAt) > puddleAfterSec else { return }
        catView.setState(.puddle)
    }
}
