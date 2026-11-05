import UIKit
import WebKit

final class FieldworkViewController:UIViewController,WKNavigationDelegate,WKUIDelegate,WKScriptMessageHandler {
    private let services:FieldworkServices;private let location:LocationCapture
    private var web:WKWebView!;private let root:URL
    init(services:FieldworkServices){self.services=services;location=LocationCapture(vault:services.vault);root=Bundle.main.url(forResource:"fieldwork",withExtension:nil)!;super.init(nibName:nil,bundle:nil)}
    required init?(coder:NSCoder){fatalError("Use service initializer")}
    override func viewDidLoad(){super.viewDidLoad();view.backgroundColor=UIColor(red:0.09,green:0.25,blue:0.21,alpha:1)
        let content=WKUserContentController();content.add(WeakFieldworkHandler(self),name:"fieldwork")
        if let script=try? String(contentsOf:Bundle.main.url(forResource:"ios-bridge",withExtension:"js")!,encoding:.utf8){content.addUserScript(WKUserScript(source:script,injectionTime:.atDocumentStart,forMainFrameOnly:true))}
        let config=WKWebViewConfiguration();config.userContentController=content;config.websiteDataStore = .nonPersistent();config.defaultWebpagePreferences.allowsContentJavaScript=true
        web=WKWebView(frame:.zero,configuration:config);web.navigationDelegate=self;web.uiDelegate=self;web.isInspectable=false;web.translatesAutoresizingMaskIntoConstraints=false;web.scrollView.contentInsetAdjustmentBehavior = .never;view.addSubview(web)
        NSLayoutConstraint.activate([web.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor),web.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor),web.leadingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.leadingAnchor),web.trailingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.trailingAnchor)])
        location.onPoint={[weak self] point in self?.emit("native-location",point)};location.onQueued={[weak self] in self?.services.schedule()}
        services.onConnectivity={[weak self] online in self?.emitConnection(online)}
        web.loadFileURL(root.appendingPathComponent("index.html"),allowingReadAccessTo:root)
    }
    deinit{web?.configuration.userContentController.removeScriptMessageHandler(forName:"fieldwork")}
    func setActive(_ value:Bool){location.setActive(value);guard isViewLoaded else{return};if value{services.requestSync();emitConnection(services.online)}else{web.evaluateJavaScript("if(typeof formRecord!=='undefined'&&formRecord)saveRecord()",completionHandler:nil)}}
    private func trusted(_ frame:WKFrameInfo)->Bool{guard frame.isMainFrame,let url=frame.request.url,url.isFileURL else{return false};return url.standardizedFileURL.path.hasPrefix(root.standardizedFileURL.path+"/")}
    func webView(_ webView:WKWebView,decidePolicyFor action:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void){guard let url=action.request.url,url.isFileURL,url.standardizedFileURL.path==root.appendingPathComponent("index.html").standardizedFileURL.path,action.targetFrame?.isMainFrame != false else{decisionHandler(.cancel);return};decisionHandler(.allow)}
    func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){location.setActive(view.window?.windowScene?.activationState == .foregroundActive);emitConnection(services.online)}
    func webView(_ webView:WKWebView,runJavaScriptTextInputPanelWithPrompt prompt:String,defaultText:String?,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping(String?)->Void){
        guard prompt=="__AGRIVAH_NATIVE__",trusted(frame),let text=defaultText,text.utf8.count<=10_500_000,let command=try? parseJSON(text) else{completionHandler(nil);return}
        do{completionHandler(try synchronous(command))}catch{completionHandler("__NATIVE_STORAGE_ERROR__")}
    }
    private func synchronous(_ c:JSON)throws->String{
        let action=c["action"] as? String ?? "",key=c["key"] as? String ?? ""
        switch action {
        case "read":guard key=="identity" || key=="language" || key.hasPrefix("state-") else{throw APIError.invalidRequest};return try services.vault.get(key)
        case "write":guard key=="identity" || key=="language" || key.hasPrefix("state-"),let value=c["value"] as? String,value.utf8.count<=10_000_000 else{throw APIError.invalidRequest};if key.hasPrefix("state-"){try services.api.engine.stageState(key:key,value:value)}else{try services.vault.put(key,value)};services.schedule();return ""
        case "receipts":return try encodeJSON(services.api.engine.receipts())
        case "online":return services.online ? "true":"false"
        case "consent":return location.consent ? "true":"false"
        case "locationConsent":try location.setConsent(c["value"] as? Bool ?? false);return ""
        case "location":let allowed:Set<String>=["login","track","resume","report","answer","manual"];guard let kind=c["kind"] as? String,allowed.contains(kind) else{throw APIError.invalidRequest};guard let point=location.current(kind:kind,record:c["record"] as? String) else{return ""};return try encodeJSON(point)
        case "export":guard let name=c["name"] as? String,let value=c["value"] as? String,name.count<150,!name.contains("/"),value.utf8.count<=10_000_000 else{throw APIError.invalidRequest};let folder=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString,isDirectory:true);try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true,attributes:[.protectionKey:FileProtectionType.complete]);let file=folder.appendingPathComponent(name);try Data(value.utf8).write(to:file,options:.atomic);let share=UIActivityViewController(activityItems:[file],applicationActivities:nil);share.popoverPresentationController?.sourceView=view;share.popoverPresentationController?.sourceRect=CGRect(x:view.bounds.midX,y:view.bounds.midY,width:1,height:1);share.completionWithItemsHandler={_,_,_,_ in try? FileManager.default.removeItem(at:folder)};present(share,animated:true);return ""
        default:throw APIError.invalidRequest
        }
    }
    func userContentController(_ controller:WKUserContentController,didReceive message:WKScriptMessage){
        guard trusted(message.frameInfo),let c=message.body as? JSON,let id=c["id"] as? String,id.count<=40,let path=c["path"] as? String else{return}
        Task{let reply:APIReply;do{if path=="_sync"{reply=APIReply(status:200,data:try await services.api.sync())}else{let bodyText=c["body"] as? String ?? "null";guard bodyText.utf8.count<=524288 else{throw APIError.invalidRequest};let body=bodyText=="null" ? nil:try parseJSON(bodyText);reply=try await services.api.call(path,body:body)}}catch APIError.unauthorized{reply=APIReply(status:401,data:["error":"unauthorized"])}catch APIError.invalidRequest{reply=APIReply(status:422,data:["error":"invalid_request"])}catch{reply=APIReply(status:0,data:["error":"offline"])}
            if path=="login",reply.status==200{location.login()};if path=="bootstrap" || path=="password"{location.refresh()};emit("native-response",["id":id,"status":reply.status,"data":reply.data])
        }
    }
    private func emit(_ name:String,_ data:JSON){guard let encoded=try? encodeJSON(data),let event=try? encodeJSON(name) else{return};web?.evaluateJavaScript("window.dispatchEvent(new CustomEvent(\(event),{detail:\(encoded)}))",completionHandler:nil)}
    private func emitConnection(_ online:Bool){web?.evaluateJavaScript("window.dispatchEvent(new Event('\(online ? "online":"offline")'))",completionHandler:nil)}
}

private final class WeakFieldworkHandler:NSObject,WKScriptMessageHandler {
    weak var target:WKScriptMessageHandler?
    init(_ target:WKScriptMessageHandler){self.target=target}
    func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage){target?.userContentController(userContentController,didReceive:message)}
}
