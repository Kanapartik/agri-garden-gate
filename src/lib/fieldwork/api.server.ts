import { createClient } from '@supabase/supabase-js';
import { fieldworkStatus, normalizeFieldworkLogin, validNewFieldworkPassword } from './identity';
const COOKIE = 'agrivah_fieldwork_session';
const MAX_BODY = 524288;
const allowedGets: Record<string,string> = {session:'session',bootstrap:'bootstrap',records:'records',leadership:'leadership'};
const allowedPosts: Record<string,string> = {logout:'logout',password:'change_password',records:'save_record',review:'review_record',deletion:'deletion',exclusion:'exclusion',location:'location',locations:'locations','location-events':'append_locations'};
function json(body: unknown,status=200,cookie?:string) {
 const headers=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','pragma':'no-cache','x-content-type-options':'nosniff'});
 if(cookie)headers.set('set-cookie',cookie);
 return new Response(JSON.stringify(body),{status,headers});
}
export async function hashFieldworkToken(token:string) {
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function newToken() {const b=crypto.getRandomValues(new Uint8Array(32));return [...b].map(x=>x.toString(16).padStart(2,'0')).join('');}
function getCookie(request:Request){return (request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
function cookie(token:string,secure:boolean,maxAge=43200){return `${COOKIE}=${token}; Path=/fieldwork-api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure?'; Secure':''}`;}
async function readBody(request:Request):Promise<Record<string,unknown>|null>{
 const declared=Number(request.headers.get('content-length')||0);if(declared>MAX_BODY)return null;
 const reader=request.body?.getReader();if(!reader)return{};
 let size=0;const chunks:Uint8Array[]=[];
 for(;;){const {value,done}=await reader.read();if(done)break;if(value){size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();return null;}chunks.push(value);}}
 try{const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}const body=JSON.parse(new TextDecoder().decode(bytes));return body&&typeof body==='object'&&!Array.isArray(body)?body:null;}catch{return null;}
}
function client(){
 const url=process.env['SUPABASE_URL']||process.env['VITE_SUPABASE_URL'];
 const key=process.env['SUPABASE_PUBLISHABLE_KEY']||process.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
 if(!url||!key)throw new Error('fieldwork_unconfigured');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>{const headers=new Headers(init?.headers);if(key.startsWith('sb_publishable_')&&headers.get('authorization')===`Bearer ${key}`)headers.delete('authorization');headers.set('apikey',key);return fetch(input,{...init,headers});}}});
}
export async function handleFieldworkRequest(request:Request):Promise<Response>{
 const url=new URL(request.url),endpoint=url.pathname.split('/').filter(Boolean).at(-1)||'';
 const secure=url.protocol==='https:';
 try{
  if(request.method==='POST'){
   if(request.headers.get('origin')!==url.origin)return json({error:'forbidden'},403);
   if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json({error:'invalid_request'},415);
  }
  const body=request.method==='POST'?await readBody(request):{};
  if(!body)return json({error:'invalid_request'},413);
  const db=client();
  if(endpoint==='login'&&request.method==='POST'){
   const loginId=normalizeFieldworkLogin(body['userId']),password=body['password'];
   if(!loginId||typeof password!=='string'||password.length<1||new TextEncoder().encode(password).byteLength>72)return json({error:'invalid_credentials'},401);
   const token=newToken(),hash=await hashFieldworkToken(token),ipHash=await hashFieldworkToken(request.headers.get('cf-connecting-ip')||'unknown-origin');
   const {data,error}=await db.rpc('fieldwork_login',{p_login_id:loginId,p_password:password,p_token_hash:hash,p_ip_hash:ipHash});
   if(error||!data)return json({error:'service_unavailable'},503);
   if(data.error)return json({error:data.error},fieldworkStatus(data.error));
   return json(data,200,cookie(token,secure));
  }
  const action=request.method==='GET'?allowedGets[endpoint]:request.method==='POST'?allowedPosts[endpoint]:undefined;
  if(!action)return json({error:'invalid_action'},405);
  const token=getCookie(request);if(!/^[a-f0-9]{64}$/.test(token))return json({error:'unauthorized'},401);
  if(action==='change_password'&&!validNewFieldworkPassword(body['password']))return json({error:'password_requirements'},422);
  const {data,error}=await db.rpc('fieldwork_dispatch',{p_token_hash:await hashFieldworkToken(token),p_action:action,p_payload:body});
  if(error||!data)return json({error:'service_unavailable'},503);
  if(data.error)return json({error:data.error},fieldworkStatus(data.error),data.error==='unauthorized'?cookie('',secure,0):undefined);
  return json(data,200,action==='logout'?cookie('',secure,0):action==='change_password'?cookie(token,secure):undefined);
 }catch{
  // No request bodies, user IDs, passwords or tokens are logged.
  return json({error:'service_unavailable'},503);
 }
}
