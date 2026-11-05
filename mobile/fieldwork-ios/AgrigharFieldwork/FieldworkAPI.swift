import Foundation

final class FieldworkAPI:NSObject,URLSessionTaskDelegate,@unchecked Sendable {
    static let origin=URL(string:"https://agrivah.com")!
    private let paths:Set<String>=["login","password","session","bootstrap","records","review","deletion","exclusion","logout","location","locations","location-events","leadership"]
    let vault:Vault; let engine:SyncEngine; private let gate=AsyncGate()
    private lazy var session:URLSession={let config=URLSessionConfiguration.ephemeral;config.httpShouldSetCookies=false;config.httpCookieStorage=nil;config.urlCache=nil;config.requestCachePolicy = .reloadIgnoringLocalCacheData;config.timeoutIntervalForRequest=30;config.timeoutIntervalForResource=60;return URLSession(configuration:config,delegate:self,delegateQueue:nil)}()
    init(vault:Vault){self.vault=vault;engine=SyncEngine(vault:vault);super.init()}
    func urlSession(_ session:URLSession,task:URLSessionTask,willPerformHTTPRedirection response:HTTPURLResponse,newRequest request:URLRequest,completionHandler:@escaping(URLRequest?)->Void){completionHandler(nil)}
    func call(_ path:String,body:JSON?) async throws -> APIReply {
        await gate.acquire();do{let reply=try await execute(path,body:body);await gate.release();return reply}catch{await gate.release();throw error}
    }
    func sync() async throws -> JSON {
        await gate.acquire();do{try await engine.drain{[self] path,body in try await execute(path,body:body)};let result=try engine.receipts();await gate.release();return result}catch{await gate.release();throw error}
    }
    private func execute(_ path:String,body:JSON?) async throws -> APIReply {
        guard paths.contains(path) else{throw APIError.invalidRequest}
        var request=URLRequest(url:Self.origin.appendingPathComponent("fieldwork-api/"+path));request.setValue("application/json",forHTTPHeaderField:"Accept");request.setValue("no-store",forHTTPHeaderField:"Cache-Control")
        let cookie=try vault.get("cookie");if !cookie.isEmpty{request.setValue(cookie,forHTTPHeaderField:"Cookie")}
        if let body {let bytes=try JSONSerialization.data(withJSONObject:body);guard bytes.count<=524288 else{throw APIError.invalidRequest};request.httpMethod="POST";request.setValue("https://agrivah.com",forHTTPHeaderField:"Origin");request.setValue("application/json",forHTTPHeaderField:"Content-Type");request.httpBody=bytes}
        let (data,response)=try await session.data(for:request);guard let http=response as? HTTPURLResponse,data.count<=10_000_000,let result=try JSONSerialization.jsonObject(with:data) as? JSON else{throw APIError.invalidResponse}
        if let set=http.value(forHTTPHeaderField:"Set-Cookie"),set.hasPrefix("agrivah_fieldwork_session="){if set.contains("Max-Age=0"){try vault.remove("cookie")}else{try vault.put("cookie",String(set.split(separator:";",maxSplits:1)[0]))}}
        if let account=result["account"] as? JSON{try vault.put("account",encodeJSON(account))}
        if path=="logout",http.statusCode==200 || http.statusCode==401{for key in ["cookie","account","identity"]{try vault.remove(key)}}
        if path=="login",http.statusCode==200{try vault.put("tracking-session",UUID().uuidString)}
        return APIReply(status:http.statusCode,data:result)
    }
}
