import Foundation
import Security
import AktionCore

struct SavedProfile: Codable {
    var credentials: Credentials
    var doorID: String
    var doorName: String
    var allowLocked: Bool
}

enum ProfileStore {
    private static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: (Bundle.main.bundleIdentifier ?? "Aktion") + ".shortcut",
         kSecAttrAccount as String: "selected-door"]
    }
    static func load() throws -> SavedProfile? {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else {
            throw AktionError("Klíčenka není dostupná. Odemkni iPhone a zkus to znovu.")
        }
        return try JSONDecoder().decode(SavedProfile.self, from: data)
    }
    static func save(_ profile: SavedProfile) throws {
        let attributes: [String: Any] = [
            kSecValueData as String: try JSONEncoder().encode(profile),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            attributes.forEach { item[$0.key] = $0.value }
            guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw AktionError("Údaje nelze uložit do Klíčenky.") }
        } else if status != errSecSuccess { throw AktionError("Údaje nelze aktualizovat v Klíčence.") }
    }
    static func delete() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw AktionError("Uložené údaje nelze smazat.") }
    }
}
