import UIKit
import Capacitor
#if canImport(AppIntents)
import AppIntents
#endif

/// Starts a scan in the web app: if SCAN is open it fires the `banger:scan` event,
/// otherwise it opens /home?scan=1 (the page starts listening on load).
/// Retries for a few seconds when the app is still launching (cold start from Siri).
enum BangerScanTrigger {
    static func fire(attempt: Int = 0) {
        DispatchQueue.main.async {
            let js = "if (location.pathname === '/home') { window.dispatchEvent(new CustomEvent('banger:scan')) } else { location.href = '/home?scan=1' }"
            guard
                let vc = (UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController as? CAPBridgeViewController,
                let webView = vc.bridge?.webView,
                webView.url != nil, !webView.isLoading
            else {
                if attempt < 20 {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { fire(attempt: attempt + 1) }
                }
                return
            }
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}

#if canImport(AppIntents)
/// "Scan with BANGER" — available in Siri, Spotlight, the Shortcuts app and the Action button.
@available(iOS 16.0, *)
struct ScanWithBangerIntent: AppIntent {
    static let title: LocalizedStringResource = "Scan with BANGER"
    static let description = IntentDescription("Opens BANGER and identifies the track playing around you.")
    static let openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        BangerScanTrigger.fire()
        return .result()
    }
}

@available(iOS 16.0, *)
struct BangerShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ScanWithBangerIntent(),
            phrases: [
                "Scan with \(.applicationName)",
                "\(.applicationName) scan",
                "Find this ID with \(.applicationName)",
                "What's this track \(.applicationName)"
            ]
        )
    }
}
#endif
