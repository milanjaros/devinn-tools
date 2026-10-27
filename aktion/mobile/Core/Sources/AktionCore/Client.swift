import Foundation
import CoreFoundation

public struct Credentials: Codable {
    public var endpoint: String
    public var username: String
    public var password: String
    public var loginType: Int
    public var hwId: String
    public init(endpoint: String, username: String, password: String, loginType: Int = 0, hwId: String) {
        self.endpoint = endpoint; self.username = username; self.password = password
        self.loginType = loginType; self.hwId = hwId
    }
}

public final class AktionClient {
    public typealias Transport = (URLRequest) async throws -> (Data, HTTPURLResponse)
    private let credentials: Credentials
    private let endpoint: URL
    private let transport: Transport
    private var sessionID = "", key = "", command = 0
    public private(set) var ready = false
    public private(set) var doors = [[String: Any]]()

    public init(_ credentials: Credentials, transport: Transport? = nil) throws {
        guard var components = URLComponents(string: credentials.endpoint),
              ["http", "https"].contains(components.scheme?.lowercased() ?? ""),
              components.host != nil, components.user == nil, components.password == nil,
              components.query == nil, components.fragment == nil else { throw AktionError("Zadej HTTP nebo HTTPS adresu bez přihlašovacích údajů.") }
        guard !credentials.username.isEmpty, !credentials.password.isEmpty, [0, 4].contains(credentials.loginType) else {
            throw AktionError("Vyplň účet, heslo a podporovaný typ přihlášení.")
        }
        var path = components.path
        while path.hasSuffix("/") { path.removeLast() }
        if path.lowercased().hasSuffix("/getmobiledata") { path.removeLast("/GetMobileData".count) }
        components.path = path + "/GetMobileData"
        guard let url = components.url else { throw AktionError("Neplatná adresa serveru.") }
        self.endpoint = url; self.credentials = credentials
        self.transport = transport ?? { request in
            let configuration = URLSessionConfiguration.ephemeral
            configuration.timeoutIntervalForRequest = 12
            configuration.timeoutIntervalForResource = 15
            let session = URLSession(configuration: configuration, delegate: NoRedirect(), delegateQueue: nil)
            defer { session.invalidateAndCancel() }
            let (data, response) = try await session.data(for: request)
            guard let response = response as? HTTPURLResponse else { throw AktionError("Neplatná odpověď serveru.") }
            return (data, response)
        }
    }

    private func envelope(_ method: Int, _ data: Any, credentials include: Bool = true) -> [String: Any] {
        command += 1
        var result: [String: Any] = ["LoginName": include ? credentials.username : "", "Password": include ? credentials.password : "",
            "LoginType": include ? credentials.loginType : 0, "MethodType": method, "Version": 3,
            "Language": 0, "CommandId": command, "MethodData": data]
        if method == 0 { result["HwId"] = credentials.hwId }
        return result
    }

    private func json(_ value: Any) throws -> Data { try JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed, .sortedKeys]) }
    private func text(_ value: Any) throws -> String { String(decoding: try json(value), as: UTF8.self) }
    private func post(_ value: String) async throws -> Any {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"; request.timeoutInterval = 12
        request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try json(["data": value])
        let (data, response) = try await transport(request)
        guard (200..<300).contains(response.statusCode) else { throw AktionError("Server vrátil HTTP \(response.statusCode).") }
        guard data.count <= 2_000_000 else { throw AktionError("Odpověď serveru je příliš velká.") }
        let result = try JSONSerialization.jsonObject(with: data, options: .fragmentsAllowed)
        if result as? String == "sessionRenew" { ready = false; throw AktionError("Relace vypršela. Přihlas se znovu.") }
        return result
    }
    private func decode(_ value: Any) throws -> Any {
        guard let encoded = value as? String else { throw AktionError("Server nevrátil šifrovanou odpověď.") }
        return try JSONSerialization.jsonObject(with: AktionCrypto.decrypt(encoded, password: key), options: .fragmentsAllowed)
    }
    private func validate(_ value: Any, login: Bool = false) throws {
        if let object = value as? [String: Any], let error = object["Error"], login || (error as? NSNumber)?.intValue != 0 {
            throw AktionError("\(object["ErrorText"] as? String ?? "Aktion požadavek zamítl.") (kód \(error))")
        }
        guard value is [String: Any] || value is [Any] else { throw AktionError("Server nevrátil očekávanou odpověď.") }
    }
    private func request(_ method: Int, _ data: Any) async throws -> Any {
        let encrypted = try AktionCrypto.encrypt(json(envelope(method, data)), password: key)
        let response = try await post(sessionID + encrypted)
        return try decode(response)
    }

    public func connect() async throws {
        ready = false; doors = []; command = 0
        sessionID = try AktionCrypto.token(); key = try AktionCrypto.token()
        let raw = try await post(text(envelope(-1, sessionID, credentials: false)))
        let rsa: [String: Any]?
        if let string = raw as? String { rsa = try JSONSerialization.jsonObject(with: Data(string.utf8)) as? [String: Any] }
        else { rsa = raw as? [String: Any] }
        guard let modulus = rsa?["Modulus"] as? String, let exponent = rsa?["Exponent"] as? String else { throw AktionError("Server neposkytl RSA klíč.") }
        let encryptedKey = try AktionCrypto.rsaEncrypt(key, modulus: modulus, exponent: exponent)
        let exchangeData = try text(["SessionId": sessionID, "AesKey": encryptedKey])
        let exchangeResponse = try await post(text(envelope(-2, exchangeData, credentials: false)))
        let acknowledgement = try decode(exchangeResponse)
        if let string = acknowledgement as? String, ["OK", "ok", "{}"].contains(string) {} else { try validate(acknowledgement) }
        let login = try await request(0, "")
        try validate(login, login: true)
        ready = true
    }

    @discardableResult public func list() async throws -> [[String: Any]] {
        guard ready else { throw AktionError("Nejdřív se přihlas.") }
        let result = try await request(1, "")
        try validate(result)
        guard let items = result as? [[String: Any]], items.allSatisfy({ Self.validID($0["Id"]) && $0["Name"] is String }) else {
            throw AktionError("Neznámý formát seznamu dveří.")
        }
        doors = items; return items
    }
    public static func validID(_ value: Any?) -> Bool {
        if value is String { return true }
        if let number = value as? NSNumber { return CFGetTypeID(number) != CFBooleanGetTypeID() }
        return false
    }
    public static func id(_ value: Any?) -> String { value.map { String(describing: $0) } ?? "" }

    public func open(_ id: String) async throws {
        guard ready, let door = doors.first(where: { Self.id($0["Id"]) == id }), let originalID = door["Id"] else {
            throw AktionError("Vyber vrata z aktuálního seznamu.")
        }
        do {
            let result = try await request(2, originalID)
            if let number = result as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID(), number.boolValue { return }
            try validate(result)
        } catch {
            // No retries: a missing acknowledgement may still mean the gate moved.
            throw AktionError("\(error.localizedDescription) Příkaz už mohl být proveden. Před dalším pokusem zkontroluj vrata.")
        }
    }
}

private final class NoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
