const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
const db=new PGlite();await db.exec('create role anon;create role authenticated;create schema extensions;');
// Run against the real legacy fieldwork schema to catch upgrade compatibility failures.
for(const name of ['20261102010000_fieldwork_phone_accounts.sql','20261105010000_fieldwork_location_history.sql','20261105020000_fieldwork_record_governance.sql','20261115010000_fieldwork_cassava_surveys.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
const names=['Creator','Reviewer','Publisher','Client A','Client B','Collector','Platform'];let u=[];
for(let i=0;i<names.length;i++){let id=(await db.query("insert into fieldwork_accounts(login_id,full_name,role,password_hash,must_change_password) values($1,$2,'enumerator','local-test-only',false) returning id",[String(1000000000+i),names[i]])).rows[0].id;u.push(id);await db.query("insert into fieldwork_sessions(token_hash,account_id,expires_at,revoked_at) values($1,$2,now()+interval '1 day',null)",[String(i).repeat(64),id]);}
for(const [i,name]of ['Muhammad Halliru','Dahiru Baba','BUHARI ALKASIM','Sunkara','Puligilla'].entries())await db.query("insert into fieldwork_accounts(login_id,full_name,role,password_hash) values($1,$2,'leadership','local-test-only')",[String(2000000000+i),name]);
await db.exec(fs.readFileSync('supabase/migrations/20261116010000_survey_studio.sql','utf8'));
assert.equal((await db.query('select count(*)::int as n from studio_roles')).rows[0].n,5);
assert.equal((await db.query('select count(*)::int as n from studio_members')).rows[0].n,5);
for(const [i,c,r,p,a] of [[0,true,false,false,false],[1,false,true,false,false],[2,false,false,true,false],[6,true,true,true,true]])await db.query('insert into studio_roles values($1,$2,$3,$4,$5)',[u[i],c,r,p,a]);
async function call(i,op,p={}){return (await db.query("select survey_studio_dispatch($1,'studio',$2) as data",[String(i).repeat(64),{op,...p}])).rows[0].data;}
let count=0;function ok(v,msg){assert(v,msg);count++;}async function err(i,op,p,e){let r=await call(i,op,p);assert.equal(r.error,e,JSON.stringify(r));count++;}
let d={title:'Jigawa Test Survey',description:'Test only',sections:[{id:'s1',title:'Visit',questions:[{id:'q1',type:'yes_no',label:'Farming?',required:true},{id:'q2',type:'number',label:'Acres',min:0,required:true,conditions:[{questionId:'q1',values:['Yes']}]},{id:'q3',type:'single_choice_grid',label:'Rate',required:true,rows:['Yield','Access'],options:['Good','Poor']}]}]};
let r=await call(0,'create',{definition:d});ok(r.version,JSON.stringify(r));let v=r.version;
async function act(i,op,p={}){let r=await call(i,op,{versionId:v.id,revision:v.revision,...p});ok(!r.error,JSON.stringify(r));if(r.version)v=r.version;return r;}
await act(0,'save',{definition:{...d,title:'Changed survey'}});assert.equal(v.definition.title,'Changed survey');
await err(0,'save',{versionId:v.id,revision:1,definition:d},'conflict');
await act(0,'request_review');await err(0,'review',{versionId:v.id,revision:v.revision,decision:'approve',note:'self'},'forbidden');
await act(1,'review',{decision:'return',note:'Please check'});await act(0,'request_review');await act(1,'review',{decision:'approve',note:'Checked all questions'});await act(2,'publish');let published=v;
await err(0,'save',{versionId:v.id,revision:v.revision,definition:d},'forbidden');
let ca=(await call(6,'create_client',{name:'Client A',adminId:u[3]})).client;let cb=(await call(6,'create_client',{name:'Client B',adminId:u[4]})).client;ok(ca&&cb,'clients');
let draft=(await call(0,'fork',{versionId:v.id})).version;ok(draft&&draft.version===2,'new version');await err(6,'assign',{clientId:ca.id,versionId:draft.id},'not_published');
let as=(await call(6,'assign',{clientId:ca.id,versionId:published.id})).assignmentId;ok(as,'assignment');
await call(3,'member',{clientId:ca.id,loginId:'1000000005',role:'collector'});let camp=(await call(3,'campaign',{clientId:ca.id,assignmentId:as,name:'Pilot'})).campaignId;ok(camp,'campaign');
await err(4,'campaign_form',{campaignId:camp},'forbidden');ok((await call(5,'campaign_form',{campaignId:camp})).version,'collector schema');
const resp='11111111-1111-4111-8111-111111111111',ans={q1:'No',q2:9,q3:{Yield:'Good',Access:'Poor'}};
await err(5,'submit',{campaignId:camp,responseId:resp,answers:{q1:'Yes',q3:ans.q3}},'invalid_answers');
r=await call(5,'submit',{campaignId:camp,responseId:resp,capturedAt:'2026-11-10T09:00:00Z',answers:ans});ok(r.receipt&&!r.answers,'receipt');ok((await call(5,'submit',{campaignId:camp,responseId:resp,answers:ans})).receipt,'idempotency');
for(let i of [0,1,2,4,5,6])await err(i,'results',{clientId:ca.id},'forbidden');
r=await call(3,'results',{clientId:ca.id});ok(r.total===1&&!('q2' in r.responses[0].answers),'hidden answer removed');assert.equal(r.responses[0].captureDate,'2026-11-10');
await err(4,'response',{clientId:cb.id,responseId:resp},'forbidden');
await call(3,'flag_response',{clientId:ca.id,responseId:resp,excluded:true,note:'Quality issue'});ok((await call(3,'results',{clientId:ca.id})).total===0,'exclusion');ok((await call(3,'results',{clientId:ca.id,includeExcluded:true})).total===1,'retained');
await call(3,'member',{clientId:ca.id,loginId:'1000000000',role:'leadership'});ok((await call(0,'results',{clientId:ca.id,includeExcluded:true})).total===1,'creator explicit membership results');
let reuse=await call(3,'fork',{versionId:published.id});ok(reuse.version?.state==='draft'&&reuse.ownerId===u[3],'client reusable copy');
await call(3,'campaign_status',{clientId:ca.id,campaignId:camp,active:false});await err(5,'campaign_form',{campaignId:camp},'forbidden');
let blocked=false;try{await db.query('delete from studio_responses where id=$1',[resp])}catch{blocked=true}ok(blocked,'no response delete');
blocked=false;try{await db.query("update studio_versions set definition='{}' where id=$1",[published.id])}catch{blocked=true}ok(blocked,'published immutable');
await db.exec('set role anon');blocked=false;try{await db.exec('select * from studio_responses')}catch{blocked=true}ok(blocked,'no direct reads');await db.exec('reset role');

// Exercise metadata queries and membership boundaries as well as response reads.
ok((await call(3,'client',{clientId:ca.id})).campaigns.length===1,'client metadata');
ok((await call(3,'bootstrap')).clients[0].canViewResults,'bootstrap membership');
ok((await call(5,'collection_list')).campaigns.length===0,'paused campaign hidden');
await err(5,'client',{clientId:ca.id},'forbidden');
await err(3,'member',{clientId:ca.id,loginId:'1000000003',role:'collector'},'invalid_request');
await call(3,'member',{clientId:ca.id,loginId:'1000000000',role:'leadership',active:false});
await err(0,'results',{clientId:ca.id},'forbidden');
let history=await call(0,'version',{versionId:published.id});ok(history.history.every(x=>x.action!=='response_received'),'response events hidden from creator');
await call(6,'assignment_status',{clientId:ca.id,assignmentId:as,active:false});
await err(3,'campaign',{clientId:ca.id,assignmentId:as,name:'Paused reuse'},'forbidden');
let broken={...d,sections:[{id:'s1',title:'',questions:[]}]};let incomplete=await call(0,'create',{definition:broken});ok(incomplete.version,'incomplete draft saved');await err(0,'request_review',{versionId:incomplete.version.id,revision:1},'invalid_definition');
await err(0,'save',{versionId:incomplete.version.id,revision:1,definition:{...d,sections:'bad'}},'invalid_definition');
for(const [answer,valid] of [[{q1:'Yes',q2:-1,q3:ans.q3},false],[{q1:'No',q3:{Yield:'Other',Access:'Good'}},false],[{q1:'No',q3:ans.q3,evil:1},false],[{q1:'Yes',q2:3,q3:ans.q3},true]]){let rr=(await db.query('select studio_check_answers($1,$2) as r',[d,answer])).rows[0].r;ok(Boolean(rr.answers)===valid,'answer validation');}

console.log(`Survey Studio database: ${count} checks passed`);await db.close();
})().catch(e=>{console.error({message:e.message,position:e.position,where:e.where,internalQuery:e.internalQuery});process.exitCode=1});
