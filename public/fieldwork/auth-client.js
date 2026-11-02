/* Phone-ID authentication uses an HttpOnly server session. No password/token is
   retained in JavaScript storage. Offline metadata permits own-device drafts only. */
(()=>{
 const messages={invalid_credentials:'The login ID or password is incorrect.',unauthorized:'Your session has expired. Sign in again.',forbidden:'Your account does not have access to this area.',password_change_required:'Change your initial password before continuing.',password_requirements:'Choose a different password: 12–72 characters, with uppercase, lowercase, a number and a symbol (maximum 72 UTF-8 bytes).',try_later:'Too many sign-in attempts. Try again in 15 minutes.',incomplete_record:'The server found missing or invalid answers. Review the required fields before resubmitting.',conflict:'A newer server version exists. Refresh and review the record; your local copy is retained.',record_locked:'This record is locked for review. Refresh to retrieve the server decision.',review_note_required:'Add a reason for the review decision or location exception.',service_unavailable:'Sign-in service is unavailable. Reconnect and try again.',invalid_record:'Check the survey, assignment and record status.'};
 let current=null,busy=false;
 const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
 const CACHE='agrivah-fieldwork-offline-identity-v1';
 function error(code){const e=new Error(messages[code]||'The request could not be completed.');e.code=code;return e;}
 async function request(path,body){let response;try{response=await fetch('/fieldwork-api/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}catch{throw error('offline');}let data;try{data=await response.json()}catch{throw error('service_unavailable');}if(!response.ok||data.error)throw error(data.error||'service_unavailable');return data;}
 function cacheIdentity(data){current=data.account;try{localStorage.setItem(CACHE,JSON.stringify({account:data.account,expiresAt:data.expiresAt,roster:data.roster||[]}))}catch{}}
 async function bootstrap(){
  try{const status=await request('session');current=status.account;if(current.mustChangePassword)return status;const data=await request('bootstrap');cacheIdentity(data);return data;}
  catch(e){if(e.code==='offline'){try{const cached=JSON.parse(localStorage.getItem(CACHE)||'null');if(cached&&!cached.account.mustChangePassword&&cached.account.role!=='leadership'&&new Date(cached.expiresAt)>new Date()){current=cached.account;return{...cached,offline:true}}}catch{}}current=null;if(e.code!=='offline')try{localStorage.removeItem(CACHE)}catch{}return{account:null,error:e.code};}
 }
 function profile(a,roster){return{id:a.id,name:a.name,phone:a.loginId,role:a.role,sourceRole:a.role,zone:a.zone,lgas:a.lgas||[],lga:a.lgas?.[0]||'Unassigned',wards:a.wards||[],communities:a.communities||[],supervisorId:a.supervisorId,supervisor:roster.find(x=>x.id===a.supervisorId)?.name||'Programme leadership',firstLoginAt:a.firstLoginAt,lastLoginAt:a.lastLoginAt,lastActivityAt:a.lastActivityAt,initialLocation:a.initialLocation,active:a.active};}
 window.fieldworkAuth={request,bootstrap,profile,equal:(a,b)=>canonical(a)===canonical(b),get current(){return current},set current(v){current=v},locationRequested:false,
  signIn:async(userId,password)=>{const data=await request('login',{userId,password});current=data.account;return data},
  changePassword:async password=>{const data=await request('password',{password});current=data.account;return data},
  logout:async()=>{await request('logout',{});current=null;try{localStorage.removeItem(CACHE)}catch{}},
  records:async()=>current?.role==='leadership'?request('leadership'):request('records'),
  review:async(r,decision,note)=>request('review',{id:r.id,serverVersion:r.serverVersion,decision,note}),
  save:async r=>request('records',{record:r}),
  async sync(){if(busy||!current||current.mustChangePassword||!navigator.onLine||!window.fieldworkSync)return;busy=true;try{await window.fieldworkSync()}finally{busy=false;if(window.fieldworkShouldRetry?.())setTimeout(()=>window.fieldworkAuth.sync(),2000)}}
 };
})();
