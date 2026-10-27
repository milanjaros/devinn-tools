import Foundation
import AktionCore

actor GateService {
    static let shared = GateService()
    private var client: AktionClient?
    private var credentials: Credentials?
    private var lastActivity = Date.distantPast
    // Actors are reentrant at await points. Explicitly reject overlapping commands.
    private var busy = false
    private let defaultEndpoint = "http://213.168.177.207:8090"

    func handle(path: String, body: [String: Any]) async throws -> [String: Any] {
        guard !busy else { throw AktionError("Probíhá jiný požadavek. Počkej na výsledek.") }
        busy = true; defer { busy = false }
        if Date().timeIntervalSince(lastActivity) > 1800 { client = nil; credentials = nil }
        lastActivity = Date()
        switch path {
        case "/api/state":
            let saved = try ProfileStore.load()
            var state: [String: Any] = ["csrf": "", "demo": false, "endpoint": saved?.credentials.endpoint ?? defaultEndpoint,
                                        "connected": client?.ready ?? false, "doors": client?.doors ?? []]
            if let saved {
                state["saved"] = ["id": saved.doorID, "name": saved.doorName, "allowLocked": saved.allowLocked,
                                  "username": saved.credentials.username, "hwId": saved.credentials.hwId,
                                  "loginType": saved.credentials.loginType] as [String: Any]
            }
            return state
        case "/api/connect":
            client = nil; credentials = nil
            guard let endpoint = body["endpoint"] as? String, let username = body["username"] as? String,
                  let password = body["password"] as? String else { throw AktionError("Vyplň přihlašovací údaje.") }
            let hwId = body["hwId"] as? String ?? ""
            let deviceID: String
            if hwId.isEmpty { deviceID = try AktionCrypto.token() } else { deviceID = hwId }
            let loginType = Int(String(describing: body["loginType"] ?? "0")) ?? -1
            let input = Credentials(endpoint: endpoint, username: username.trimmingCharacters(in: .whitespacesAndNewlines),
                                    password: password, loginType: loginType, hwId: deviceID)
            let connection = try AktionClient(input)
            try await connection.connect()
            let doors = try await connection.list()
            client = connection; credentials = input
            return ["doors": doors]
        case "/api/doors":
            guard let client else { throw AktionError("Nejdřív se přihlas.") }
            return ["doors": try await client.list()]
        case "/api/open":
            guard let client else { throw AktionError("Nejdřív se přihlas.") }
            try await client.open(AktionClient.id(body["id"]))
            return ["ok": true, "message": "Server přijal příkaz. Pohyb vrat ověř na místě."]
        case "/api/shortcut":
            guard let client, client.ready, let credentials,
                  let door = client.doors.first(where: { AktionClient.id($0["Id"]) == AktionClient.id(body["id"]) }),
                  door["IsRele"] as? Bool != true, let name = door["Name"] as? String else {
                throw AktionError("Přihlas se a vyber vrata z aktuálního seznamu.")
            }
            let id = AktionClient.id(door["Id"])
            try ProfileStore.save(SavedProfile(credentials: credentials, doorID: id, doorName: name, allowLocked: body["allowLocked"] as? Bool ?? false))
            return ["id": id, "name": name]
        case "/api/forget":
            try ProfileStore.delete()
            return ["ok": true]
        case "/api/logout":
            try ProfileStore.delete()
            client = nil; credentials = nil
            return ["ok": true]
        default: throw AktionError("Neznámá akce.")
        }
    }

    func openSaved(fromCar: Bool) async throws -> String {
        guard !busy else { throw AktionError("Probíhá jiný požadavek. Počkej na výsledek.") }
        busy = true; defer { busy = false }
        guard let saved = try ProfileStore.load() else { throw AktionError("Nejdřív v aplikaci ulož účet a vrata pro Zkratky.") }
        guard !fromCar || saved.allowLocked else { throw AktionError("V aplikaci nejdřív povol akci z auta při zamčeném telefonu.") }
        // Fresh handshake for every invocation. No persisted session keys or counters.
        let connection = try AktionClient(saved.credentials)
        try await connection.connect()
        let doors = try await connection.list()
        guard doors.contains(where: { AktionClient.id($0["Id"]) == saved.doorID && $0["IsRele"] as? Bool != true }) else {
            throw AktionError("Uložená vrata již nejsou dostupná pro tento účet.")
        }
        try await connection.open(saved.doorID)
        return "Příkaz pro \(saved.doorName) byl přijat."
    }
}
