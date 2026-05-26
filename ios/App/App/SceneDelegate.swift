import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene,
               willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }

        // Forward launch URLs and universal links when app is launched into a scene.
        if let url = connectionOptions.urlContexts.first?.url {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
        }

        if let userActivity = connectionOptions.userActivities.first {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
        }
        
        // Set window for keyboard handling and UI customization
        self.window = windowScene.windows.first
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }

    func sceneDidDisconnect(_ scene: UIScene) {}

    func sceneDidBecomeActive(_ scene: UIScene) {
        // Enable elastic/rubber-band scroll bounce in the WKWebView.
        // Without this, the Capacitor WKWebView feels stiff compared to Safari.
        if let vc = window?.rootViewController as? CAPBridgeViewController {
            vc.webView?.scrollView.alwaysBounceVertical = true
            
            // Enable native iOS back swipe gesture for web navigation
            vc.webView?.allowsBackForwardNavigationGestures = true
            
            // Ensure safe area layout is respected
            vc.webView?.scrollView.insetsLayoutMarginsFromSafeArea = true
        }
        
        // Register for keyboard notifications to adjust UI
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardWillShow),
            name: UIResponder.keyboardWillShowNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardWillHide),
            name: UIResponder.keyboardWillHideNotification,
            object: nil
        )
    }

    @objc func keyboardWillShow(notification: NSNotification) {
        // Notify the web app that the keyboard is showing
        if let vc = window?.rootViewController as? CAPBridgeViewController {
            vc.webView?.evaluateJavaScript(
                "window.dispatchEvent(new Event('nativeKeyboardShow'))",
                completionHandler: nil
            )
        }
    }
    
    @objc func keyboardWillHide(notification: NSNotification) {
        // Notify the web app that the keyboard is hiding
        if let vc = window?.rootViewController as? CAPBridgeViewController {
            vc.webView?.evaluateJavaScript(
                "window.dispatchEvent(new Event('nativeKeyboardHide'))",
                completionHandler: nil
            )
        }
    }

    func sceneWillResignActive(_ scene: UIScene) {
        NotificationCenter.default.removeObserver(self)
    }

    func sceneWillEnterForeground(_ scene: UIScene) {}

    func sceneDidEnterBackground(_ scene: UIScene) {
        NotificationCenter.default.removeObserver(self)
    }
}
