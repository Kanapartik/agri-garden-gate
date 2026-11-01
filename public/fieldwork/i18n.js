/* Presentation-only localization: persisted answer keys and values stay canonical. */
(()=>{
 const allowed=['en','ha','ff'],key='agrivah-fieldwork-language',sourceNodes=new WeakMap(),sourceAttributes=new WeakMap();
 let language='en',bilingual=false;
 try{const stored=JSON.parse(localStorage.getItem(key)||'{}');if(allowed.includes(stored.language))language=stored.language;bilingual=stored.bilingual===true}catch{}
 const normalize=s=>s.trim().replace(/\s+/g,' ').toLowerCase();
 const dictionaries={};for(const [lang,messages]of Object.entries(window.FIELDWORK_TRANSLATIONS||{}))dictionaries[lang]=new Map(Object.entries(messages).map(([k,v])=>[normalize(k),v]));
 const text=(source,lang=language)=>{
  if(lang==='en')return source;
  const d=dictionaries[lang],raw=String(source),s=raw.trim();if(!s)return source;
  let translated=d?.get(normalize(s));
  if(translated===undefined){
   // Decorative icons, counters and item numbers must not become translated answer codes.
   const decorated=s.match(/^([＋+↓←✓⌖↗○◇♧▦▤⇅◷\d]+\s+)?(.+?)(\s*[→←])?$/u);
   if(decorated){const mid=d?.get(normalize(decorated[2]));if(mid!==undefined)translated=(decorated[1]||'')+mid+(decorated[3]||'')}
  }
  if(translated===undefined){
   const demo=s.match(/^Demonstration workspace · (\d+) sample records in this view\. New records are stored locally; online status does not indicate server sync\.$/);
   if(demo)translated=lang==='ha'?`Filin gwaji · bayanan misali ${demo[1]} a nan. Sabbin bayanai suna a na'ura; intanet ba ya nufin an daidaita da uwar garke.`:`Nokku ƴeewtagol · humpito misal ${demo[1]} ɗoo. Humpito keso ena rese e masiŋel; enternet wonaa jokkondiral e server.`;
   const adapted=s.match(/^(HH|FGD|KII|ENT) · SOURCE-ADAPTED PREVIEW$/i);
   if(adapted)translated=adapted[1]+' · '+(lang==='ha'?'GWAIJIN DA AKA DANGANTA DA TUSHE':'ƳEEWTAGOL IWNGOL E ASLI');
  }
  if(translated===undefined){
   const counted=s.match(/^(Submitted|Returned|Approved|Rejected|All) (\d+)$/);
   if(counted)translated=text(counted[1],lang)+' '+counted[2];
   const surveyDemo=s.match(/^(Household survey|Focus group discussion|Key informant interview) · Demo$/);
   if(surveyDemo)translated=text(surveyDemo[1],lang)+' · '+(lang==='ha'?'Misali':'Misal');
  }
  if(translated===undefined){
   const rules=lang==='ha'?[
    [/^Section (\d+) of (\d+)$/i,(_,n,m)=>`Sashe ${n} cikin ${m}`],
    [/^Section (\d+) of (\d+) Draft$/i,(_,n,m)=>`Sashe ${n} cikin ${m} · Daftari`],
    [/^(\d+) fields need attention\.$/,(_,n)=>`Filaye ${n} suna buƙatar kulawa.`],
    [/^(\d+) records awaiting review$/,(_,n)=>`Bayanai ${n} suna jiran dubawa`],
    [/^(\d+) records without a location fix$/,(_,n)=>`Bayanai ${n} ba su da wuri`],
    [/^Revision (\d+)$/,(_,n)=>`Sigar ${n}`],
    [/^Saved on this device · (.+)$/,(_,n)=>`An adana a wannan na'ura · ${n}`],
    [/^Assigned LGA: (.+)$/,(_,n)=>`Ƙaramar hukuma da aka ware: ${n}`],
    [/^(\d+) guided sections · automatic local save$/,(_,n)=>`Sassa ${n} masu jagora · ajiyar na'ura kai tsaye`],
    [/^(\d+) total$/,(_,n)=>`Jimilla ${n}`],
    [/^Record counts · (.+)$/,(_,n)=>`Adadin bayanai · ${text(n,lang)}`],
    [/^Supervisor note: (.+)$/,(_,n)=>`Bayanin mai kulawa: ${n}`],
   ]:[
    [/^Section (\d+) of (\d+)$/i,(_,n,m)=>`Fannu ${n} e ${m}`],
    [/^(\d+) fields need attention\.$/,(_,n)=>`Geɗe ${n} ena haaji hakkille.`],
    [/^(\d+) records awaiting review$/,(_,n)=>`Humpito ${n} ena fadi ƴeewtagol`],
    [/^(\d+) records without a location fix$/,(_,n)=>`Humpito ${n} alaa nokku`],
    [/^Revision (\d+)$/,(_,n)=>`Fannu ${n}`],
    [/^Saved on this device · (.+)$/,(_,n)=>`Resaama e masiŋel ngal · ${n}`],
    [/^Assigned LGA: (.+)$/,(_,n)=>`LGA cuɓanaaɗo: ${n}`],
    [/^(\d+) guided sections · automatic local save$/,(_,n)=>`Geɗe ${n} e tinndinoore · resugol e masiŋel`],
    [/^(\d+) total$/,(_,n)=>`Fof ${n}`],
    [/^Record counts · (.+)$/,(_,n)=>`Limoore humpito · ${text(n,lang)}`],
    [/^Supervisor note: (.+)$/,(_,n)=>`Binndol ƴeewtoowo: ${n}`],
   ];for(const [pattern,replace]of rules)if(pattern.test(s)){translated=s.replace(pattern,replace);break}
  }
  return translated===undefined?source:raw.slice(0,raw.length-raw.trimStart().length)+translated+raw.slice(raw.trimEnd().length);
 };
 const save=()=>{try{localStorage.setItem(key,JSON.stringify({language,bilingual}))}catch{}};
 function toolbar(){
  let bar=document.getElementById('language-bar');if(!bar){bar=document.createElement('section');bar.id='language-bar';bar.setAttribute('aria-label','Language settings');document.body.prepend(bar)}
  const label={en:'Language',ha:'Harshe',ff:'Ɗemngal'}[language];
  const status={en:'Hausa & Fulfulde: draft translations. English references remain available.',ha:'Hausa da Fulfulde: fassarar daftari. A duba da mai harshen kafin aikin fili.',ff:'Hausa e Fulfulde: firo arano. Ƴeewto e jom ɗemngal hade golle ladde.'}[language];
  bar.innerHTML=`<div class="language-controls"><label for="ui-language">🌐 ${label}</label><select id="ui-language" aria-label="Language / Harshe / Ɗemngal"><option value="en">English</option><option value="ha">Hausa</option><option value="ff">Fulfulde (Fula)</option></select><label class="language-reference"><input id="english-reference" type="checkbox"> ${language==='ha'?'Nuna Turanci':language==='ff'?'Hollu Engeleere':'Show English questions'}</label></div><span class="language-status" role="status">${status}</span>`;
  bar.querySelector('#ui-language').value=language;bar.querySelector('#english-reference').checked=bilingual;
  bar.querySelector('#ui-language').onchange=e=>{language=e.target.value;save();apply();window.dispatchEvent(new CustomEvent('fieldwork-language-change',{detail:{language}}))};
  bar.querySelector('#english-reference').onchange=e=>{bilingual=e.target.checked;save();apply()};
 }
 function apply(){
  document.documentElement.lang=language;document.documentElement.dir='ltr';
  const root=document.getElementById('app');if(!root){toolbar();return}
  root.querySelectorAll('.english-reference-note').forEach(n=>n.remove());
  // Keep option.value independent of its visible, translated label.
  root.querySelectorAll('option').forEach(o=>{if(!o.hasAttribute('value'))o.value=o.textContent});
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let node;
  while((node=walker.nextNode()))nodes.push(node);
  for(const n of nodes){const parent=n.parentElement;if(!parent||parent.closest('script,style,textarea,[data-user-content],.catalog'))continue;
   if(!sourceNodes.has(n))sourceNodes.set(n,n.textContent);const original=sourceNodes.get(n),translated=text(original);n.textContent=translated;
   if(original.trim())parent.setAttribute('lang',translated!==original?language:'en');
  }
  for(const el of root.querySelectorAll('[placeholder],[aria-label]')){
   let originals=sourceAttributes.get(el);if(!originals){originals={};for(const attr of ['placeholder','aria-label'])if(el.hasAttribute(attr))originals[attr]=el.getAttribute(attr);sourceAttributes.set(el,originals)}
   for(const [attr,value]of Object.entries(originals))el.setAttribute(attr,text(value));
  }
  // This is reference text only; it is never submitted or used for validation.
  if(language!=='en'&&bilingual)for(const label of root.querySelectorAll('.field > label')){
   const originals=[...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>sourceNodes.get(n)||n.textContent).join('').trim();
   if(!originals)continue;const hint=document.createElement('span');hint.className='english-reference-note';hint.lang='en';hint.textContent='English: '+originals;label.append(hint);
  }
  // Reference documents and free-form answers deliberately retain their original language.
  root.querySelectorAll('.catalog').forEach(el=>el.setAttribute('lang','en'));
  root.querySelectorAll('[data-user-content]').forEach(el=>el.setAttribute('lang',el.hasAttribute('data-answer-key')?language:'und'));
  toolbar();
 }
 window.fieldworkI18n={get language(){return language},text,apply,version:'2026-11-02.2',supported:allowed};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
})();
