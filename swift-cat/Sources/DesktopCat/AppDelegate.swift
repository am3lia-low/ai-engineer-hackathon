import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var catWindow: CatWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMenuShortcuts()

        let window = CatWindow()
        window.makeKeyAndOrderFront(nil)
        self.catWindow = window

        // Bring the app forward on first launch so the cat appears immediately
        // instead of waiting for a system-driven event to surface it.
        NSApp.activate(ignoringOtherApps: true)
    }

    /// .accessory policy hides the menu bar, but NSApp.mainMenu still resolves
    /// keyEquivalents. We install one item — Quit — so Cmd+Q exits cleanly.
    private func installMenuShortcuts() {
        let mainMenu = NSMenu()
        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)

        let appSubmenu = NSMenu()
        appSubmenu.addItem(
            withTitle: "Quit DesktopCat",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        )
        appItem.submenu = appSubmenu

        NSApp.mainMenu = mainMenu
    }
}
