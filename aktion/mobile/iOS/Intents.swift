import AppIntents

struct OpenSavedDoorIntent: AppIntent {
    static var title: LocalizedStringResource = "Otevřít uložená vrata"
    static var description = IntentDescription("Otevře jedny vrata uložené v aplikaci pod nastaveným účtem Aktion.")
    static var openAppWhenRun: Bool = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let message = try await GateService.shared.openSaved(fromCar: false)
        return .result(dialog: IntentDialog(stringLiteral: message))
    }
}

struct OpenDoorFromCarIntent: AppIntent {
    static var title: LocalizedStringResource = "Otevřít vrata z auta"
    static var description = IntentDescription("Vyžaduje výslovné povolení v aplikaci. Lze spustit i při zamčeném iPhonu.")
    static var openAppWhenRun: Bool = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let message = try await GateService.shared.openSaved(fromCar: true)
        return .result(dialog: IntentDialog(stringLiteral: message))
    }
}

struct GateShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: OpenSavedDoorIntent(), phrases: ["Open my gate with \(.applicationName)"],
                    shortTitle: "Otevřít vrata", systemImageName: "door.garage.closed")
        AppShortcut(intent: OpenDoorFromCarIntent(), phrases: ["Open my car gate with \(.applicationName)"],
                    shortTitle: "Vrata z auta", systemImageName: "car")
    }
}
