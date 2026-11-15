import fs from 'node:fs';import vm from 'node:vm';
const context={};context.window=context;vm.createContext(context);for(const file of ['data.js','forms.js','enterprise.js','cassava.js'])vm.runInContext(fs.readFileSync('public/fieldwork/'+file,'utf8'),context);
const types=['CF','CT','CP','CC'],rows=types.map(type=>`('${type}','cassava-2026-11-15-v1',$forms$${JSON.stringify(context.FORMS[type].flatMap(s=>s.fields))}$forms$::jsonb)`);
const baseline=fs.readFileSync('supabase/migrations/20261102010000_fieldwork_phone_accounts.sql','utf8');let validate=baseline.slice(baseline.indexOf('create or replace function public.fieldwork_validate_answers'),baseline.indexOf('create or replace function public.fieldwork_dispatch'));
validate=validate.replace('rules jsonb; skip boolean;', 'rules jsonb; skip boolean; condition jsonb;');
validate=validate.replace('  if skip then continue; end if;',`  if f ? 'showAll' then
   for condition in select value from jsonb_array_elements(f->'showAll') loop
    wanted:=p_answers->(condition->>0);
    if jsonb_typeof(wanted)='array' then skip:=skip or not(coalesce(wanted @> jsonb_build_array(condition->1),false));
    else skip:=skip or wanted is distinct from condition->1; end if;
   end loop;
  end if;
  if skip then continue; end if;`);
const sql=`-- Add four Cassava instruments without changing existing records or their answers.
begin;
alter table public.fieldwork_records drop constraint fieldwork_records_type_check;
alter table public.fieldwork_records add constraint fieldwork_records_type_check check(type in ('HH','FGD','KII','ENT','CF','CT','CP','CC'));
insert into public.fieldwork_form_definitions(type,version,fields) values
${rows.join(',\n')}
on conflict(type) do update set version=excluded.version,fields=excluded.fields;
${validate}
-- Extend the existing account/assignment/version-checked save path, preserving its permissions.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.fieldwork_dispatch_core(text,text,jsonb)'::regprocedure);
 if position('typ not in (''HH'',''FGD'',''KII'',''ENT'')' in definition)=0 then raise exception 'Unexpected dispatcher definition; review before applying';end if;
 definition:=replace(definition,'typ not in (''HH'',''FGD'',''KII'',''ENT'')','typ not in (''HH'',''FGD'',''KII'',''ENT'',''CF'',''CT'',''CP'',''CC'')');
 execute definition;
end $migration$;
-- Study membership is always derived from the instrument, never trusted from clients.
create function public.fieldwork_study_tag() returns trigger language plpgsql set search_path=public as $$
begin new.payload:=new.payload||jsonb_build_object('studyGroup',case when new.type in ('CF','CT','CP','CC') then 'cassava' else 'livelihood' end);return new;end $$;
create trigger fieldwork_study_tag before insert or update on public.fieldwork_records for each row execute function public.fieldwork_study_tag();
revoke all on function public.fieldwork_study_tag() from public,anon,authenticated;
commit;
`;
fs.writeFileSync('supabase/migrations/20261115010000_fieldwork_cassava_surveys.sql',sql);
fs.writeFileSync('public/fieldwork/cassava-schema.json',JSON.stringify(Object.fromEntries(types.map(type=>[type,{name:context.FORM_NAMES[type],group:'cassava',version:context.CASSAVA_VERSION,sections:context.FORMS[type]}])),null,2)+'\n');
console.log(types.map(type=>type+': '+context.FORMS[type].flatMap(s=>s.fields).length+' fields').join('\n'));
