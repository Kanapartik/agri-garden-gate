import XCTest
import CryptoKit
import UIKit
import WebKit
@testable import AgrigharFieldwork

final class FieldworkTests:XCTestCase {
    var folder:URL!;var key:SymmetricKey!;var vault:Vault!;var engine:SyncEngine!
    override func setUpWithError()throws{folder=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString,isDirectory:true);key=SymmetricKey(size:.bits256);vault=try Vault(directory:folder,testKey:key);engine=SyncEngine(vault:vault);try vault.put("account","{\"id\":\"qa\",\"mustChangePassword\":false}")}
    override func tearDownWithError()throws{engine=nil;vault=nil;try? FileManager.default.removeItem(at:folder)}
    func record(version:Int=0)->JSON{["id":"JG-fixture-0001","user":"qa","type":"HH","lga":"Dutse","status":"Draft","answers":["name":"synthetic private interview"],"serverVersion":version]}
    func testEncryptedPersistenceAcrossReopen()throws{try vault.put("private-test","private interview sentinel");vault=nil;let raw=try Data(contentsOf:folder.appendingPathComponent("fieldwork.sqlite"));XCTAssertNil(raw.range(of:Data("private interview sentinel".utf8)));vault=try Vault(directory:folder,testKey:key);XCTAssertEqual(try vault.get("private-test"),"private interview sentinel")}
    func testWrongKeyDoesNotDeleteSavedData()throws{try vault.put("private-test","retained");let wrong=try Vault(directory:folder,testKey:SymmetricKey(size:.bits256));XCTAssertThrowsError(try wrong.get("private-test"));XCTAssertEqual(try vault.get("private-test"),"retained")}
    func testJSONComparisonIgnoresKeyOrder()throws{XCTAssertTrue(jsonEqual(try parseJSON("{\"a\":1,\"b\":[2,3]}"),try parseJSON("{\"b\":[2,3],\"a\":1}")));XCTAssertFalse(jsonEqual(["a":1],["a":2]))}
    func testReceiptClearsOnlyCurrentAccountQueue()async throws{try vault.put("out-qa:record",encodeJSON(record()));try vault.put("out-other:record",encodeJSON(record()));try await engine.drain{path,body in XCTAssertEqual(path,"records");var saved=body!["record"] as! JSON;saved["serverVersion"]=1;return APIReply(status:200,data:["record":saved])};XCTAssertEqual(try vault.get("out-qa:record"),"");XCTAssertFalse(try vault.get("out-other:record").isEmpty);XCTAssertEqual((try parseJSON(vault.get("receipt-JG-fixture-0001"))["record"] as? JSON)?["serverVersion"] as? Int,1)}
    func testInterruptedUploadRetainsPayload()async throws{try vault.put("out-qa:record",encodeJSON(record()));do{try await engine.drain{_,_ in throw APIError.offline};XCTFail("Expected offline failure")}catch{};XCTAssertFalse(try vault.get("out-qa:record").isEmpty)}
    func testExpiredSessionRetainsWork()async throws{try vault.put("out-qa:record",encodeJSON(record()));do{try await engine.drain{_,_ in APIReply(status:401,data:["error":"unauthorized"])};XCTFail("Expected sign-in requirement")}catch APIError.unauthorized{};XCTAssertFalse(try vault.get("out-qa:record").isEmpty)}
    func testConflictRetainsLocalAndServerCopies()async throws{try vault.put("out-qa:record",encodeJSON(record()));try await engine.drain{[self] _,body in body==nil ? APIReply(status:200,data:["records":[record(version:3)]]):APIReply(status:409,data:["error":"conflict"])};XCTAssertFalse(try vault.get("out-qa:record").isEmpty);let issue=try parseJSON(vault.get("issue-JG-fixture-0001"));XCTAssertEqual((issue["serverConflict"] as? JSON)?["serverVersion"] as? Int,3)}
    func testOnlyAcknowledgedLocationEventsAreRemoved()async throws{try vault.put("geo-qa:a","{\"id\":\"a\"}");try vault.put("geo-qa:b","{\"id\":\"b\"}");try await engine.drain{path,body in XCTAssertEqual(path,"location-events");XCTAssertEqual((body?["events"] as? [JSON])?.count,2);return APIReply(status:200,data:["accepted":["a"]])};XCTAssertEqual(try vault.get("geo-qa:a"),"");XCTAssertFalse(try vault.get("geo-qa:b").isEmpty)}
    func testEditsDuringUploadStayQueued()async throws{try vault.put("out-qa:record",encodeJSON(record()));try await engine.drain{[self] _,body in var edited=record();edited["answers"]=["name":"newer edit"];try vault.put("out-qa:record",encodeJSON(edited));var received=body!["record"] as! JSON;received["serverVersion"]=1;return APIReply(status:200,data:["record":received])};XCTAssertEqual((try parseJSON(vault.get("out-qa:record"))["answers"] as? JSON)?["name"] as? String,"newer edit")}
    func testDiscardingLocalConflictRemovesPendingOutbox()throws{try vault.put("out-qa:JG-fixture-0001",encodeJSON(record()));try vault.put("issue-JG-fixture-0001","{\"error\":\"conflict\"}");var accepted=record(version:3);accepted["pendingSync"]=false;try engine.stageState(key:"state-qa",value:encodeJSON(["records":[accepted]]));XCTAssertTrue(try vault.keys("out-qa:").isEmpty);XCTAssertEqual(try vault.get("issue-JG-fixture-0001"),"")}
    func testCachedIdentityNeverContainsSessionCookie()throws{let identity:JSON=["account":["id":"qa"],"offlineUntil":timestamp(Date(timeIntervalSinceNow:604800))];try vault.put("cookie","secret-session-fixture");try vault.put("identity",encodeJSON(identity));XCTAssertFalse(try vault.get("identity").contains("secret-session-fixture"))}
    func testBundledOfflineScreensAndLanguagesExist()throws{let root=try XCTUnwrap(Bundle.main.url(forResource:"fieldwork",withExtension:nil));for name in ["index.html","forms.js","enterprise.js","guided.js","translations.js","location-dashboard.js"]{XCTAssertTrue(FileManager.default.fileExists(atPath:root.appendingPathComponent(name).path),name)};XCTAssertNil(Bundle.main.object(forInfoDictionaryKey:"NSLocationAlwaysAndWhenInUseUsageDescription"));XCTAssertFalse((Bundle.main.object(forInfoDictionaryKey:"UIBackgroundModes") as? [String] ?? []).contains("location"))}
    @MainActor func testBundledLoginAndNativeBridgeRenderInWebKit()async throws{
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.first as? UIWindowScene)
        let controller=try XCTUnwrap(scene.windows.first(where:{$0.isKeyWindow})?.rootViewController)
        let startup=(UIApplication.shared.delegate as? AppDelegate)?.startupFailureCode ?? "unknown"
        let web=try XCTUnwrap(controller.view.subviews.compactMap{$0 as? WKWebView}.first,"Native startup: "+startup)
        var rendered=false
        for _ in 0..<140 {
            if (try? await web.evaluateJavaScript("document.getElementById('auth-user-id')!==null")) as? Bool == true {rendered=true;break}
            try await Task.sleep(nanoseconds:250_000_000)
        }
        XCTAssertTrue(rendered,"Bundled login did not render inside iOS WebKit")
        let native=try await web.evaluateJavaScript("typeof NativeFieldwork.read('identity')") as? String
        XCTAssertEqual(native,"string","Synchronous encrypted native bridge must work for local content")
        let blocked=try await web.evaluateJavaScript("(()=>{try{NativeFieldwork.read('cookie');return false}catch{return true}})()") as? Bool
        XCTAssertEqual(blocked,true,"Session cookies must never be readable through the web bridge")
        let crypto=try await web.evaluateJavaScript("typeof crypto.randomUUID") as? String
        XCTAssertEqual(crypto,"function")
        let html=try await web.evaluateJavaScript("document.body.innerText") as? String ?? ""
        XCTAssertTrue(html.contains("Sign in"))
        let signInVisible=try await web.evaluateJavaScript("document.getElementById('auth-submit').getBoundingClientRect().bottom<=innerHeight") as? Bool
        XCTAssertEqual(signInVisible,true,"The sign-in action should be visible without scrolling on the test iPhone")
        let image:UIImage=try await withCheckedThrowingContinuation{continuation in web.takeSnapshot(with:nil){image,error in if let image{continuation.resume(returning:image)}else{continuation.resume(throwing:error ?? APIError.invalidResponse)}}}
        let attachment=XCTAttachment(image:image);attachment.name="Agrighar-iPhone-login";attachment.lifetime = .keepAlways;add(attachment)
    }

    func testStaleReceiptDoesNotSuppressNewRevision()async throws{
        try vault.put("out-qa:record",encodeJSON(record(version:3)))
        try vault.put("receipt-JG-fixture-0001",encodeJSON(["record":record(version:1)]))
        var calls=0
        try await engine.drain{[self] _,body in calls+=1;XCTAssertEqual((body?["record"] as? JSON)?["serverVersion"] as? Int,3);return APIReply(status:200,data:["record":record(version:4)])}
        XCTAssertEqual(calls,1)
        XCTAssertEqual((try parseJSON(vault.get("receipt-JG-fixture-0001"))["record"] as? JSON)?["serverVersion"] as? Int,4)
    }

}
