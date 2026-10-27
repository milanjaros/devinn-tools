import SwiftUI
import WebKit

@main
struct AktionApp: App {
    var body: some Scene { WindowGroup { GateWebView() } }
}

struct GateWebView: UIViewRepresentable {
    func makeCoordinator() -> Bridge { Bridge() }
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "aktion")
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.95, green: 0.96, blue: 0.94, alpha: 1)
        guard let root = Bundle.main.url(forResource: "www", withExtension: nil) else { fatalError("Missing bundled web assets") }
        context.coordinator.root = root
        webView.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
        return webView
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    static func dismantleUIView(_ uiView: WKWebView, coordinator: Bridge) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "aktion", contentWorld: .page)
    }

    final class Bridge: NSObject, WKScriptMessageHandlerWithReply, WKNavigationDelegate {
        var root: URL?
        private func trusted(_ url: URL?) -> Bool {
            guard let root, let url, url.isFileURL else { return false }
            return url.standardizedFileURL == root.appendingPathComponent("index.html").standardizedFileURL
        }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                                   replyHandler: @escaping (Any?, String?) -> Void) {
            guard message.frameInfo.isMainFrame, trusted(message.frameInfo.request.url),
                  let request = message.body as? [String: Any], let path = request["path"] as? String,
                  let body = request["body"] as? [String: Any] else {
                replyHandler(nil, "Nepovolený požadavek."); return
            }
            Task { @MainActor in
                do { replyHandler(try await GateService.shared.handle(path: path, body: body), nil) }
                catch { replyHandler(nil, error.localizedDescription) }
            }
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(trusted(navigationAction.request.url) ? .allow : .cancel)
        }
    }
}
