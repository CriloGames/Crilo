/* Public site total: server-verified official Dailies only, never guest or test.
 * One small, read-only RPC per page visit and on successful official saves.
 * No raw runs, drawings, account IDs or profile information are downloaded. */
(() => {
 'use strict';
 const output=document.getElementById('criloOfficialDailyTotal');
 if(!output||typeof criloDB==='undefined')return;
 let pending=false,lastLoaded=0,ready=false;
 async function refresh(){
  if(pending)return;
  pending=true;
  try{
   const {data,error}=await criloDB.rpc('crilo_public_official_daily_total');
   if(error)throw error;
   const count=Number(data);
   if(!Number.isSafeInteger(count)||count<0)throw new Error('Invalid total');
   output.textContent=count.toLocaleString();
   output.title=count.toLocaleString()+' server-verified Dailies completed';
   ready=true;
   lastLoaded=Date.now();
  }catch(e){
   // Unknown is better than displaying a fabricated number, including zero.
   if(!ready)output.textContent='—';
   console.warn('Crilo Daily total unavailable:',e?.message||e);
  }finally{pending=false}
 }
 const message=document.getElementById('message');
 let saveAlreadyObserved=false;
 if(message){
  const observer=new MutationObserver(()=>{
   const saved=message.textContent?.startsWith('Official Daily saved.');
   if(saved&&!saveAlreadyObserved)refresh();
   saveAlreadyObserved=!!saved;
  });
  observer.observe(message,{childList:true,subtree:true,characterData:true});
 }
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&Date.now()-lastLoaded>10*60*1000)refresh();
 });
 refresh();
})();
