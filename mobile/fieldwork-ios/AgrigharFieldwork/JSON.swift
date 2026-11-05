import Foundation

typealias JSON = [String:Any]
func parseJSON(_ value:String) throws -> JSON { guard let data = value.data(using:.utf8), let object = try JSONSerialization.jsonObject(with:data) as? JSON else { throw VaultError.corrupt }; return object }
func encodeJSON(_ value:Any) throws -> String { guard let text = String(data:try JSONSerialization.data(withJSONObject:value,options:[.sortedKeys,.fragmentsAllowed]),encoding:.utf8) else { throw VaultError.corrupt }; return text }
func jsonEqual(_ a:Any?,_ b:Any?) -> Bool { guard let a,let b,let left=try? encodeJSON(a),let right=try? encodeJSON(b) else { return false };return left == right }
func dateFromISO(_ text:String) -> Date? { let f=ISO8601DateFormatter();f.formatOptions=[.withInternetDateTime,.withFractionalSeconds];return f.date(from:text) ?? ISO8601DateFormatter().date(from:text) }
func timestamp(_ date:Date=Date()) -> String { let f=ISO8601DateFormatter();f.formatOptions=[.withInternetDateTime,.withFractionalSeconds];return f.string(from:date) }
struct APIReply { let status:Int; let data:JSON }
enum APIError: Error { case unauthorized, offline, invalidRequest, invalidResponse }
actor AsyncGate {
    private var held=false; private var waiters:[CheckedContinuation<Void,Never>] = []
    func acquire() async { if !held { held=true; return }; await withCheckedContinuation { waiters.append($0) } }
    func release() { if waiters.isEmpty { held=false } else { waiters.removeFirst().resume() } }
}
