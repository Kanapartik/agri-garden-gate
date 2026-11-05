import Foundation

final class SyncEngine {
    let vault:Vault
    init(vault:Vault){self.vault=vault}
    func stageState(key:String,value:String) throws {
        try vault.put(key,value)
        let account=try parseJSON(vault.get("account",fallback:"{}"));guard let uid=account["id"] as? String,key == "state-"+uid else { return }
        for record in (try parseJSON(value))["records"] as? [JSON] ?? [] {
            guard record["user"] as? String == uid,let id=record["id"] as? String else { continue }; let out="out-\(uid):\(id)"
            if record["pendingSync"] as? Bool == true, !(record["serverConflict"] is JSON),record["demo"] as? Bool != true { try vault.put(out,encodeJSON(record)) }
            else if record["pendingSync"] as? Bool != true { try vault.remove(out);try vault.remove("issue-"+id) }
        }
    }
    func receipts() throws -> JSON {
        let account=try parseJSON(vault.get("account",fallback:"{}"));guard let uid=account["id"] as? String else { return [:] }
        let state=try parseJSON(vault.get("state-"+uid,fallback:"{}"));var result:JSON=[:]
        for record in state["records"] as? [JSON] ?? [] { guard let id=record["id"] as? String else { continue };var entry=try parseJSON(vault.get("receipt-"+id,fallback:"{}"));let issue=try vault.get("issue-"+id);if !issue.isEmpty { entry["issue"]=try parseJSON(issue) };result[id]=entry }
        return result
    }
    func hasPending() throws -> Bool {let a=try parseJSON(vault.get("account",fallback:"{}"));guard let uid=a["id"] as? String else{return false};return try !vault.keys("out-\(uid):").isEmpty || !vault.keys("geo-\(uid):").isEmpty}
    func drain(transport:(String,JSON?) async throws -> APIReply) async throws {
        let account=try parseJSON(vault.get("account",fallback:"{}"));guard let uid=account["id"] as? String, account["mustChangePassword"] as? Bool == false else{return}
        for key in try vault.keys("out-\(uid):").prefix(20) {
            try Task.checkCancellation();let snapshot=try vault.get(key);guard !snapshot.isEmpty else{continue};var record=try parseJSON(snapshot);guard let id=record["id"] as? String else{throw APIError.invalidRequest}
            let prior=try parseJSON(vault.get("receipt-"+id,fallback:"{}"))
            if let remote=prior["record"] as? JSON {let remoteVersion=remote["serverVersion"] as? Int ?? 0,baseVersion=record["serverVersion"] as? Int ?? 0;if remoteVersion==baseVersion+1 {record["serverVersion"]=remoteVersion};if (remoteVersion==baseVersion || remoteVersion==baseVersion+1),jsonEqual(remote["answers"],record["answers"]),remote["status"] as? String == record["status"] as? String {if try vault.get(key)==snapshot{try vault.remove(key)};continue}}
            let reply=try await transport("records",["record":record]);var data=reply.data
            if reply.status==401 || reply.status==428 {throw APIError.unauthorized}
            if reply.status==200,data["record"] is JSON {try vault.put("receipt-"+id,encodeJSON(data));try vault.remove("issue-"+id);if try vault.get(key)==snapshot{try vault.remove(key)}}
            else {if data["error"] as? String == "record_deleted" {try vault.remove(key);try vault.remove("issue-"+id);try vault.remove("receipt-"+id);continue};if reply.status==409 {let all=try await transport("records",nil);if let remote=(all.data["records"] as? [JSON])?.first(where:{$0["id"] as? String == id}){data["serverConflict"]=remote}};try vault.put("issue-"+id,encodeJSON(data));if reply.status>=500{throw APIError.offline}}
        }
        let keys=Array(try vault.keys("geo-\(uid):").prefix(500));for start in stride(from:0,to:keys.count,by:100) {
            try Task.checkCancellation();let batch=Array(keys[start..<min(start+100,keys.count)]);let events=try batch.map{try parseJSON(vault.get($0))};let reply=try await transport("location-events",["events":events])
            if reply.status==401{throw APIError.unauthorized};guard reply.status==200,let accepted=reply.data["accepted"] as? [String] else{throw APIError.invalidResponse};let ids=Set(accepted)
            for (key,event) in zip(batch,events) {if let id=event["id"] as? String,ids.contains(id){try vault.remove(key)}}
        }
    }
}
