import Foundation
import Security
import CommonCrypto

public struct AktionError: LocalizedError {
    public let message: String
    public var errorDescription: String? { message }
    public init(_ message: String) { self.message = message }
}

public enum AktionCrypto {
    public static func random(_ count: Int) throws -> Data {
        var data = Data(count: count)
        let status = data.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, count, $0.baseAddress!) }
        guard status == errSecSuccess else { throw AktionError("Nelze vytvořit bezpečné náhodné číslo.") }
        return data
    }

    public static func token() throws -> String {
        try random(16).map { String(format: "%02x", $0) }.joined()
    }

    private static func derive(_ password: String, _ salt: Data) -> Data {
        var result = Data(), previous = Data()
        while result.count < 48 {
            let input = previous + Data(password.utf8) + salt
            var digest = [UInt8](repeating: 0, count: Int(CC_MD5_DIGEST_LENGTH))
            input.withUnsafeBytes { _ = CC_MD5($0.baseAddress, CC_LONG(input.count), &digest) }
            previous = Data(digest)
            result.append(previous)
        }
        return result
    }

    private static func crypt(_ input: Data, password: String, salt: Data, operation: CCOperation) throws -> Data {
        let material = derive(password, salt)
        let key = material.prefix(32), iv = material.subdata(in: 32..<48)
        var output = Data(count: input.count + kCCBlockSizeAES128), written = 0
        let capacity = output.count
        let status = output.withUnsafeMutableBytes { destination in
            input.withUnsafeBytes { source in
                key.withUnsafeBytes { keyBytes in
                    iv.withUnsafeBytes { ivBytes in
                        CCCrypt(operation, CCAlgorithm(kCCAlgorithmAES), CCOptions(kCCOptionPKCS7Padding),
                                keyBytes.baseAddress, 32, ivBytes.baseAddress, source.baseAddress,
                                input.count, destination.baseAddress, capacity, &written)
                    }
                }
            }
        }
        guard status == kCCSuccess else { throw AktionError("Šifrování nebo dešifrování zprávy selhalo.") }
        return output.prefix(written)
    }

    public static func encrypt(_ input: Data, password: String, salt: Data? = nil) throws -> String {
        let salt = try salt ?? random(8)
        guard salt.count == 8 else { throw AktionError("Neplatná délka soli.") }
        return try (Data("Salted__".utf8) + salt + crypt(input, password: password, salt: salt, operation: CCOperation(kCCEncrypt))).base64EncodedString()
    }

    public static func decrypt(_ encoded: String, password: String) throws -> Data {
        guard let bytes = Data(base64Encoded: encoded), bytes.count >= 32,
              bytes.prefix(8) == Data("Salted__".utf8), (bytes.count - 16) % 16 == 0 else {
            throw AktionError("Neznámý formát šifrované odpovědi.")
        }
        return try crypt(bytes.subdata(in: 16..<bytes.count), password: password,
                         salt: bytes.subdata(in: 8..<16), operation: CCOperation(kCCDecrypt))
    }

    // SecKey expects a PKCS#1 DER RSAPublicKey sequence of positive integers.
    private static func der(_ tag: UInt8, _ bytes: Data) -> Data {
        var length = Data()
        if bytes.count < 128 { length.append(UInt8(bytes.count)) }
        else {
            var count = bytes.count, parts = [UInt8]()
            while count > 0 { parts.insert(UInt8(count & 255), at: 0); count >>= 8 }
            length.append(0x80 | UInt8(parts.count)); length.append(contentsOf: parts)
        }
        return Data([tag]) + length + bytes
    }

    public static func rsaEncrypt(_ text: String, modulus: String, exponent: String) throws -> String {
        func integer(_ base64: String) throws -> Data {
            guard var value = Data(base64Encoded: base64), !value.isEmpty else { throw AktionError("Neplatný RSA klíč.") }
            while value.count > 1 && value.first == 0 { value.removeFirst() }
            if value.first! & 0x80 != 0 { value.insert(0, at: 0) }
            return der(0x02, value)
        }
        let encoded = try der(0x30, integer(modulus) + integer(exponent))
        let attributes: [String: Any] = [kSecAttrKeyType as String: kSecAttrKeyTypeRSA,
                                        kSecAttrKeyClass as String: kSecAttrKeyClassPublic]
        var error: Unmanaged<CFError>?
        guard let key = SecKeyCreateWithData(encoded as CFData, attributes as CFDictionary, &error),
              let encrypted = SecKeyCreateEncryptedData(key, .rsaEncryptionPKCS1, Data(text.utf8) as CFData, &error) else {
            throw AktionError("RSA výměna klíče selhala.")
        }
        return (encrypted as Data).base64EncodedString()
    }
}
