/* Only bundled top-level content can call these native handlers. */
(()=>{
 if(!window.webkit?.messageHandlers.fieldwork)return;
 const call=command=>{const result=prompt('__AGRIVAH_NATIVE__',JSON.stringify(command));if(result==='__NATIVE_STORAGE_ERROR__'||result===null)throw new Error('Encrypted storage is unavailable. Keep the app installed and contact your coordinator.');return result;};
 if(!crypto.randomUUID)Object.defineProperty(crypto,'randomUUID',{value:()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;return [...b].map((x,i)=>([4,6,8,10].includes(i)?'-':'')+x.toString(16).padStart(2,'0')).join('');}});
 window.NativeFieldwork={
  read:key=>call({action:'read',key}),write:(key,value)=>call({action:'write',key,value}),
  receipts:()=>call({action:'receipts'}),online:()=>call({action:'online'})==='true',consent:()=>call({action:'consent'})==='true',
  locationConsent:value=>call({action:'locationConsent',value}),location:(kind,record)=>call({action:'location',kind,record}),
  request:(id,path,body)=>window.webkit.messageHandlers.fieldwork.postMessage({id,path,body}),
  exportFile:(name,value,type)=>call({action:'export',name,value,type})
 };
 try{const saved=NativeFieldwork.read('language');if(saved)localStorage.setItem('agrivah-fieldwork-language',saved);const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){original.call(this,key,value);if(key==='agrivah-fieldwork-language')NativeFieldwork.write('language',value);};}catch{}
})();
