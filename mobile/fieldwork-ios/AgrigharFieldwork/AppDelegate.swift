import UIKit
import Network
import BackgroundTasks

final class FieldworkServices {
    static let backgroundID="com.agrivah.fieldwork.sync"
    let vault:Vault;let api:FieldworkAPI
    private let monitor=NWPathMonitor();private let networkQueue=DispatchQueue(label:"fieldwork-connectivity");private let lock=NSLock();private var connected=false
    var onConnectivity:((Bool)->Void)?
    var online:Bool{lock.lock();defer{lock.unlock()};return connected}
    init()throws{vault=try Vault();api=FieldworkAPI(vault:vault);monitor.pathUpdateHandler={[weak self] path in guard let self else{return};let value=path.status == .satisfied;self.lock.lock();self.connected=value;self.lock.unlock();DispatchQueue.main.async{self.onConnectivity?(value)};if value{self.requestSync()}};monitor.start(queue:networkQueue)}
    func schedule(){let task=BGProcessingTaskRequest(identifier:Self.backgroundID);task.requiresNetworkConnectivity=true;task.requiresExternalPower=false;task.earliestBeginDate=Date(timeIntervalSinceNow:30);try? BGTaskScheduler.shared.submit(task)}
    func requestSync(){schedule();Task{_ = try? await api.sync();if (try? api.engine.hasPending())==true{schedule()}}}
    func performBackground(_ task:BGTask){schedule();let work=Task{do{_ = try await api.sync();task.setTaskCompleted(success:true)}catch{task.setTaskCompleted(success:false)}};task.expirationHandler={work.cancel()}}
}
@main final class AppDelegate:UIResponder,UIApplicationDelegate {
    var services:FieldworkServices?;var startupError=false;var startupFailureCode=""
    func application(_ application:UIApplication,didFinishLaunchingWithOptions launchOptions:[UIApplication.LaunchOptionsKey:Any]?)->Bool{
        do{services=try FieldworkServices()}catch{startupError=true;startupFailureCode=String(describing:error)}
        BGTaskScheduler.shared.register(forTaskWithIdentifier:FieldworkServices.backgroundID,using:nil){[weak self] task in guard let services=self?.services else{task.setTaskCompleted(success:false);return};services.performBackground(task)}
        return true
    }
    func application(_ application:UIApplication,configurationForConnecting session:UISceneSession,options:UIScene.ConnectionOptions)->UISceneConfiguration{let c=UISceneConfiguration(name:"Fieldwork",sessionRole:session.role);c.delegateClass=SceneDelegate.self;return c}
}
final class SceneDelegate:UIResponder,UIWindowSceneDelegate {
    var window:UIWindow?
    func scene(_ scene:UIScene,willConnectTo session:UISceneSession,options connectionOptions:UIScene.ConnectionOptions){guard let scene=scene as? UIWindowScene else{return};let w=UIWindow(windowScene:scene)
        if let services=(UIApplication.shared.delegate as? AppDelegate)?.services{w.rootViewController=FieldworkViewController(services:services)}else{let c=UIViewController();c.view.backgroundColor = .systemBackground;let label=UILabel();label.text="Saved data could not be unlocked. Unlock this iPhone and reopen Agrighar. Do not delete the app; contact your coordinator if this continues.";label.numberOfLines=0;label.translatesAutoresizingMaskIntoConstraints=false;c.view.addSubview(label);NSLayoutConstraint.activate([label.leadingAnchor.constraint(equalTo:c.view.safeAreaLayoutGuide.leadingAnchor,constant:28),label.trailingAnchor.constraint(equalTo:c.view.safeAreaLayoutGuide.trailingAnchor,constant:-28),label.centerYAnchor.constraint(equalTo:c.view.centerYAnchor)]);w.rootViewController=c};window=w;w.makeKeyAndVisible()
    }
    func sceneDidBecomeActive(_ scene:UIScene){(window?.rootViewController as? FieldworkViewController)?.setActive(true)}
    func sceneWillResignActive(_ scene:UIScene){(window?.rootViewController as? FieldworkViewController)?.setActive(false)}
    func sceneDidEnterBackground(_ scene:UIScene){(UIApplication.shared.delegate as? AppDelegate)?.services?.schedule()}
}
