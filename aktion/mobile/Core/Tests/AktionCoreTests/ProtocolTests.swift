import XCTest
import Foundation
import Security
@testable import AktionCore

final class ProtocolTests: XCTestCase {
    func testAESMatchesExistingNodeAndCryptoJSProtocol() throws {
        let password = "0123456789abcdef0123456789abcdef"
        let salt = Data([0x02, 0x19, 0x4d, 0xa9, 0x6c, 0x51, 0xeb, 0xac])
        let expected = "U2FsdGVkX18CGU2pbFHrrKVWM5Gy8ir3YKqHWyfwamk="
        XCTAssertEqual(try AktionCrypto.encrypt(Data("{}".utf8), password: password, salt: salt), expected)
        XCTAssertEqual(try AktionCrypto.decrypt(expected, password: password), Data("{}".utf8))
        let unicode = Data("Příliš žluťoučký kůň 🔑".utf8)
        XCTAssertEqual(try AktionCrypto.decrypt(AktionCrypto.encrypt(unicode, password: password), password: password), unicode)
        XCTAssertThrowsError(try AktionCrypto.decrypt("invalid", password: password))
        XCTAssertThrowsError(try AktionCrypto.decrypt(expected, password: "wrong"))
    }

    func testHandshakeIdentityAndOriginalDoorID() async throws {
        let mock = try MockAktion()
        let client = try makeClient(mock)
        try await client.connect()
        let doors = try await client.list()
        XCTAssertEqual(doors.count, 1)
        try await client.open("101")
        XCTAssertEqual(mock.openCount, 1)
        XCTAssertEqual(mock.commands, [1, 2, 3, 4, 5])
        XCTAssertEqual(mock.lastOpenID as? Int, 101)
        XCTAssertEqual(mock.lastUsername, "demo")
        XCTAssertEqual(mock.hwID, "registered-device")
    }

    func testLostOpenResponseIsNeverRetried() async throws {
        let mock = try MockAktion(); mock.loseOpenResponse = true
        let client = try makeClient(mock)
        try await client.connect(); try await client.list()
        do { try await client.open("101"); XCTFail("Expected transport failure") }
        catch { XCTAssertTrue(error.localizedDescription.contains("Příkaz už mohl být proveden")) }
        XCTAssertEqual(mock.openCount, 1)
    }

    func testFalseAndNumericOpenAcknowledgementsAreRejected() async throws {
        for acknowledgement in [false, 1, "OK"] as [Any] {
            let mock = try MockAktion(); mock.openResult = acknowledgement
            let client = try makeClient(mock)
            try await client.connect(); try await client.list()
            do { try await client.open("101"); XCTFail("Invalid acknowledgement accepted") } catch {}
            XCTAssertEqual(mock.openCount, 1)
        }
    }

    func testUnknownDoorNeverSendsCommand() async throws {
        let mock = try MockAktion(), client = try makeClient(mock)
        try await client.connect(); try await client.list()
        do { try await client.open("999"); XCTFail("Unknown door accepted") } catch {}
        XCTAssertEqual(mock.openCount, 0)
    }

    func testSessionRenewInvalidatesConnection() async throws {
        let mock = try MockAktion(), client = try makeClient(mock)
        try await client.connect(); mock.expired = true
        do { try await client.list(); XCTFail("Expired session accepted") } catch {}
        XCTAssertFalse(client.ready)
    }

    private func makeClient(_ mock: MockAktion) throws -> AktionClient {
        try AktionClient(Credentials(endpoint: "https://mock.invalid", username: "demo", password: "demo", hwId: "registered-device"),
                         transport: { try await mock.send($0) })
    }
}

// In-memory protocol peer. It cannot contact the network or physical gates.
private final class MockAktion {
    let privateKey: SecKey
    let modulus: Data
    let exponent: Data
    var key = "", sessionID = "", commands = [Int](), openCount = 0
    var lastOpenID: Any?, lastUsername = "", hwID = ""
    var loseOpenResponse = false, expired = false
    var openResult: Any = true

    init() throws {
        var error: Unmanaged<CFError>?
        guard let privateKey = SecKeyCreateRandomKey([kSecAttrKeyType: kSecAttrKeyTypeRSA, kSecAttrKeySizeInBits: 2048] as CFDictionary, &error),
              let publicKey = SecKeyCopyPublicKey(privateKey),
              let data = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? else { throw AktionError("Mock RSA generation failed") }
        self.privateKey = privateKey
        var cursor = 0
        func read(_ input: Data, _ cursor: inout Int) -> Data {
            cursor += 1 // tag
            var count = Int(input[cursor]); cursor += 1
            if count & 128 != 0 {
                let bytes = count & 127; count = 0
                for _ in 0..<bytes { count = (count << 8) | Int(input[cursor]); cursor += 1 }
            }
            let result = input.subdata(in: cursor..<(cursor + count)); cursor += count
            return result
        }
        let sequence = read(data, &cursor); cursor = 0
        modulus = read(sequence, &cursor); exponent = read(sequence, &cursor)
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let outer = try JSONSerialization.jsonObject(with: request.httpBody!) as! [String: String]
        let wire = outer["data"]!
        let envelope: [String: Any]
        if wire.hasPrefix("{") { envelope = try JSONSerialization.jsonObject(with: Data(wire.utf8)) as! [String: Any] }
        else {
            if expired { return try response("sessionRenew", request) }
            XCTAssertTrue(wire.hasPrefix(sessionID))
            envelope = try JSONSerialization.jsonObject(with: AktionCrypto.decrypt(String(wire.dropFirst(32)), password: key)) as! [String: Any]
        }
        commands.append(envelope["CommandId"] as! Int)
        let method = envelope["MethodType"] as! Int
        if method == -1 {
            return try response(["Modulus": modulus.base64EncodedString(), "Exponent": exponent.base64EncodedString()], request)
        }
        var result: Any = [String: String]()
        if method == -2 {
            let exchange = try JSONSerialization.jsonObject(with: Data((envelope["MethodData"] as! String).utf8)) as! [String: String]
            var error: Unmanaged<CFError>?
            let decrypted = SecKeyCreateDecryptedData(privateKey, .rsaEncryptionPKCS1, Data(base64Encoded: exchange["AesKey"]!)! as CFData, &error)
            guard let decrypted else { throw AktionError("Mock RSA decrypt failed") }
            key = String(decoding: decrypted as Data, as: UTF8.self); sessionID = exchange["SessionId"]!
            result = "OK"
        } else {
            XCTAssertEqual(envelope["LoginName"] as? String, "demo")
            XCTAssertEqual(envelope["Password"] as? String, "demo")
            lastUsername = envelope["LoginName"] as! String
            if method == 0 { hwID = envelope["HwId"] as! String }
            if method == 1 { result = [["Id": 101, "Name": "Vrata", "IsRele": false]] }
            if method == 2 {
                openCount += 1; lastOpenID = envelope["MethodData"]
                if loseOpenResponse { throw URLError(.timedOut) }
                result = openResult
            }
        }
        let payload = try JSONSerialization.data(withJSONObject: result, options: .fragmentsAllowed)
        return try response(AktionCrypto.encrypt(payload, password: key), request)
    }
    private func response(_ value: Any, _ request: URLRequest) throws -> (Data, HTTPURLResponse) {
        (try JSONSerialization.data(withJSONObject: value, options: .fragmentsAllowed),
         HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
    }
}
