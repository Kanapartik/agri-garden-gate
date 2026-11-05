/* Android bridge, durable location outbox, and foreground activity lifecycle. */
const activitySessionId=crypto.randomUUID();let activityWatch=null,activityTimer=null,lastAnswerFix=0,geoBusy=false;
window.activitySessionId=activitySessionId;
if(window.NativeFieldwork){
 Object.defineProperty(navigator,'onLine',{get:()=>NativeFieldwork.online()});
 const requests=new Map();let requestId=0;
 window.nativeRequest=(path,body)=>new Promise((resolve,reject)=>{const id=String(++requestId);const timer=setTimeout(()=>{requests.delete(id);resolve({status:0,data:{error:'offline'}})},90000);requests.set(id,result=>{clearTimeout(timer);resolve(result)});NativeFieldwork.request(id,path,body===undefined?'null':JSON.stringify(body));});
 window.addEventListener('native-response',e=>{const cb=requests.get(e.detail.id);if(cb){requests.delete(e.detail.id);cb(e.detail)}});
 window.addEventListener('native-location',async e=>{if(!session)return;state.points.push({...e.detail,userId:session.userId,name:session.name,zone:session.zone});await persist();});
}
function applyNativeReceipts(){if(!window.NativeFieldwork||!session)return;const receipts=JSON.parse(NativeFieldwork.receipts());for(const r of state.records){const entry=receipts[r.id],issue=entry?.issue;if(issue){r.syncError=issue.error==='conflict'?'A newer server version exists. Your local copy is retained.':'Server validation: '+issue.error;if(issue.serverConflict)r.serverConflict=issue.serverConflict;continue;}const server=entry?.record;if(!server||server.serverVersion<(r.serverVersion||0))continue;if(fieldworkAuth.equal(r.answers,server.answers)&&r.status===server.status)Object.assign(r,server,{pendingSync:false,syncError:null});else if(server.serverVersion===(r.serverVersion||0)+1){r.serverVersion=server.serverVersion;r.pendingSync=true;}}}
window.applyNativeReceipts=applyNativeReceipts;
function locationKind(kind){return /login/.test(kind)?'login':/report|submission/.test(kind)?'report':/answer/.test(kind)?'answer':/track/.test(kind)?'track':/resume/.test(kind)?'resume':'manual'}
async function syncLocationOutbox(){if(geoBusy||!session||!navigator.onLine||window.NativeFieldwork)return;geoBusy=true;const actor=session.userId;try{for(;;){const batch=state.points.filter(p=>p.userId===actor&&p.pendingLocation).slice(0,100);if(!batch.length)break;const res=await fieldworkAuth.request('location-events',{events:batch});if(session?.userId!==actor)return;const accepted=new Set(res.accepted);batch.forEach(p=>{if(accepted.has(p.id))p.pendingLocation=false});await persist();}}catch{}finally{geoBusy=false}}
function startFieldworkActivity(){stopFieldworkActivity();if(!session)return;
 if(window.NativeFieldwork){NativeFieldwork.locationConsent(!!session.locationConsent);}else if(session.locationConsent&&navigator.geolocation){activityWatch=navigator.geolocation.watchPosition(async p=>{if(!session||document.hidden)return;const previous=state.points.at(-1);if(previous&&Date.now()-new Date(previous.at)<15000)return;state.points.push({id:uid(),sessionId:activitySessionId,kind:'track',at:new Date(p.timestamp).toISOString(),lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,userId:session.userId,name:session.name,zone:session.zone,pendingLocation:true});await persist();syncLocationOutbox();},()=>{}, {enableHighAccuracy:true,maximumAge:10000,timeout:20000});}
 activityTimer=setInterval(async()=>{if(!session||document.hidden)return;try{await fieldworkAuth.sync();if(view==='journey'){await loadTeamLocations(false);render()}}catch{}},30000);
}
function stopFieldworkActivity(){if(activityWatch!==null){navigator.geolocation?.clearWatch(activityWatch);activityWatch=null;}clearInterval(activityTimer);activityTimer=null;if(window.NativeFieldwork)NativeFieldwork.locationConsent(false);}
window.startFieldworkActivity=startFieldworkActivity;window.stopFieldworkActivity=stopFieldworkActivity;
function captureAnswerLocation(){if(session?.locationConsent&&Date.now()-lastAnswerFix>30000){lastAnswerFix=Date.now();getLocation('answer',formRecord?.id);}}
window.captureAnswerLocation=captureAnswerLocation;
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(activityWatch!==null)navigator.geolocation?.clearWatch(activityWatch);activityWatch=null;if(formRecord)saveRecord();}else if(session){startFieldworkActivity();getLocation('resume');fieldworkAuth.sync();}});
window.addEventListener('pagehide',()=>{if(formRecord&&window.NativeFieldwork)NativeFieldwork.write('state-'+session.userId,JSON.stringify(state));});
window.fieldworkBack=async()=>{if(formRecord){await saveRecord();formRecord=null;view='collect';render();}else if(drawer){drawer=null;render();}else{view='overview';render();}};
