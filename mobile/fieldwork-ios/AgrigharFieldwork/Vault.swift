import Foundation
import CryptoKit
import Security
import SQLite3

enum VaultError: Error { case keychain(OSStatus), database, corrupt, invalidKey }
final class Vault: @unchecked Sendable {
    private var db: OpaquePointer?
    private let lock = NSRecursiveLock()
    private let key: SymmetricKey
    let directory: URL
    init(directory: URL? = nil, testKey: SymmetricKey? = nil) throws {
        self.directory = try directory ?? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("FieldworkVault", isDirectory: true)
        try FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        var protected = self.directory
        var values = URLResourceValues(); values.isExcludedFromBackup = true; try protected.setResourceValues(values)
        key = try testKey ?? Self.deviceKey()
        let path = self.directory.appendingPathComponent("fieldwork.sqlite").path
        guard sqlite3_open_v2(path, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else { throw VaultError.database }
        guard sqlite3_exec(db, "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS private_values(k TEXT PRIMARY KEY,v BLOB NOT NULL)", nil, nil, nil) == SQLITE_OK else { throw VaultError.database }
    }
    deinit { sqlite3_close(db) }
    private static func deviceKey() throws -> SymmetricKey {
        let query: [String: Any] = [kSecClass as String:kSecClassGenericPassword, kSecAttrService as String:"com.agrivah.fieldwork.vault", kSecAttrAccount as String:"aes-v1", kSecReturnData as String:true]
        var found: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &found)
        if status == errSecSuccess, let data = found as? Data, data.count == 32 { return SymmetricKey(data:data) }
        guard status == errSecItemNotFound else { throw VaultError.keychain(status) }
        var bytes = Data(count:32)
        let random = bytes.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault,32,$0.baseAddress!) }
        guard random == errSecSuccess else { throw VaultError.keychain(random) }
        var add = query; add.removeValue(forKey:kSecReturnData as String)
        add[kSecValueData as String] = bytes; add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let added = SecItemAdd(add as CFDictionary,nil)
        guard added == errSecSuccess else { throw VaultError.keychain(added) }
        return SymmetricKey(data:bytes)
    }
    func get(_ name:String, fallback:String = "") throws -> String {
        lock.lock(); defer { lock.unlock() }
        var stmt: OpaquePointer?; defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db,"SELECT v FROM private_values WHERE k=?",-1,&stmt,nil) == SQLITE_OK else { throw VaultError.database }
        sqlite3_bind_text(stmt,1,(name as NSString).utf8String,-1,nil)
        let step=sqlite3_step(stmt);if step==SQLITE_DONE{return fallback};guard step==SQLITE_ROW else{throw VaultError.database}
        guard let bytes = sqlite3_column_blob(stmt,0) else { throw VaultError.corrupt }
        let sealed = Data(bytes:bytes,count:Int(sqlite3_column_bytes(stmt,0)))
        let plain = try AES.GCM.open(AES.GCM.SealedBox(combined:sealed),using:key,authenticating:Data(name.utf8))
        guard let value = String(data:plain,encoding:.utf8) else { throw VaultError.corrupt }; return value
    }
    func put(_ name:String,_ value:String) throws {
        lock.lock(); defer { lock.unlock() }
        guard let sealed = try AES.GCM.seal(Data(value.utf8),using:key,authenticating:Data(name.utf8)).combined else { throw VaultError.corrupt }
        var stmt:OpaquePointer?; defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db,"INSERT OR REPLACE INTO private_values(k,v) VALUES(?,?)",-1,&stmt,nil) == SQLITE_OK else { throw VaultError.database }
        sqlite3_bind_text(stmt,1,(name as NSString).utf8String,-1,nil)
        let transient = unsafeBitCast(-1,to:sqlite3_destructor_type.self)
        _ = sealed.withUnsafeBytes { sqlite3_bind_blob(stmt,2,$0.baseAddress,Int32(sealed.count),transient) }
        guard sqlite3_step(stmt) == SQLITE_DONE else { throw VaultError.database }
    }
    func remove(_ name:String) throws {
        lock.lock(); defer { lock.unlock() }; var stmt:OpaquePointer?; defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db,"DELETE FROM private_values WHERE k=?",-1,&stmt,nil) == SQLITE_OK else { throw VaultError.database }
        sqlite3_bind_text(stmt,1,(name as NSString).utf8String,-1,nil); guard sqlite3_step(stmt) == SQLITE_DONE else { throw VaultError.database }
    }
    func keys(_ prefix:String) throws -> [String] {
        lock.lock(); defer { lock.unlock() }; var stmt:OpaquePointer?; defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db,"SELECT k FROM private_values ORDER BY k",-1,&stmt,nil) == SQLITE_OK else { throw VaultError.database }
        var result:[String] = []
        while sqlite3_step(stmt) == SQLITE_ROW { let key = String(cString:sqlite3_column_text(stmt,0)); if key.hasPrefix(prefix) { result.append(key) } }
        return result
    }
}
