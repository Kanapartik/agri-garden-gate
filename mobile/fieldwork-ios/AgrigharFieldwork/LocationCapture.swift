import Foundation
import CoreLocation
import UIKit

final class LocationCapture:NSObject,CLLocationManagerDelegate {
    private let manager=CLLocationManager();private let vault:Vault
    private var active=false;private var latest:CLLocation?;private var lastPoint=Date.distantPast;private var nextKind="resume"
    var onPoint:((JSON)->Void)?;var onQueued:(()->Void)?
    init(vault:Vault){self.vault=vault;super.init();manager.delegate=self;manager.desiredAccuracy=kCLLocationAccuracyBest;manager.distanceFilter=10;manager.pausesLocationUpdatesAutomatically=true;manager.allowsBackgroundLocationUpdates=false}
    var consent:Bool{(try? vault.get("location-consent"))=="true"}
    func setConsent(_ value:Bool) throws{try vault.put("location-consent",value ? "true":"false");refresh()}
    func setActive(_ value:Bool){active=value;if value,nextKind != "login"{nextKind="resume"};refresh()}
    func login(){nextKind="login";refresh()}
    func refresh(){
        guard active,consent,enrolled() else{manager.stopUpdatingLocation();return}
        switch manager.authorizationStatus{case .notDetermined:manager.requestWhenInUseAuthorization();case .authorizedAlways,.authorizedWhenInUse:manager.startUpdatingLocation();default:manager.stopUpdatingLocation()}
    }
    private func enrolled()->Bool{
        guard let a=try? parseJSON(vault.get("account",fallback:"{}")),let cached=try? parseJSON(vault.get("identity",fallback:"{}")),let owner=cached["account"] as? JSON,let uid=a["id"] as? String,owner["id"] as? String==uid,a["mustChangePassword"] as? Bool==false,let expiry=(cached["offlineUntil"] ?? cached["expiresAt"]) as? String,let date=dateFromISO(expiry) else{return false};return date>Date()
    }
    func locationManagerDidChangeAuthorization(_ manager:CLLocationManager){refresh()}
    func locationManager(_ manager:CLLocationManager,didUpdateLocations locations:[CLLocation]){
        guard let fix=locations.last,fix.horizontalAccuracy>=0 else{return};latest=fix
        guard active,consent,enrolled(),Date().timeIntervalSince(lastPoint)>=15,abs(fix.timestamp.timeIntervalSinceNow)<60 else{return}
        lastPoint=Date();do{let value=try capture(fix,kind:nextKind,record:nil);nextKind="track";onPoint?(value)}catch{ /* Keep existing stored work; never log coordinates. */ }
    }
    func locationManager(_ manager:CLLocationManager,didFailWithError error:Error){ /* A missing fix requires the survey exception flow. */ }
    func current(kind:String,record:String?)->JSON?{
        guard active,consent,enrolled(),let fix=latest,abs(fix.timestamp.timeIntervalSinceNow)<60,fix.horizontalAccuracy>=0 else{return nil}
        return try? capture(fix,kind:kind,record:record)
    }
    private func capture(_ fix:CLLocation,kind:String,record:String?) throws -> JSON {
        let account=try parseJSON(vault.get("account",fallback:"{}"));guard let uid=account["id"] as? String else{throw APIError.unauthorized}
        var session=try vault.get("tracking-session");if session.isEmpty{session=UUID().uuidString;try vault.put("tracking-session",session)}
        let event:JSON=["id":UUID().uuidString,"sessionId":session,"kind":kind,"recordId":record.map{$0 as Any} ?? NSNull(),"lat":fix.coordinate.latitude,"lng":fix.coordinate.longitude,"accuracy":fix.horizontalAccuracy,"at":timestamp(fix.timestamp),"provider":"core-location","mock":fix.sourceInformation?.isSimulatedBySoftware ?? false]
        try vault.put("geo-\(uid):\(event["id"]!)",encodeJSON(event));onQueued?();return event
    }
}
