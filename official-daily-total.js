/* Server-verified completions for the current 22:00 UTC-reset Daily only.
 * No guest plays, owner Test Runs, or older unverified records are included. */
(() => {
 'use strict';
 const counter=document.getElementById('criloOfficialDailyToday');
 const label=document.getElementById('criloOfficialDailyLabel');
 if(!counter||!label||typeof criloDB==='undefined')return;
 let fetching=false,retry=false,lastPeriod='',lastRead=0;
 const periodNow=()=>window.Crilo?.dailyPeriod?.()||new Date(Date.now()-22*3600000).toISOString().slice(0,10);
 async function refresh(){
  if(fetching){retry=true;return}
  fetching=true;
  try{
   const {data,error}=await criloDB.rpc('crilo_public_daily_completion_counts');
   if(error)throw error;
   const today=Number(data?.today),period=String(data?.period||'');
   if(!Number.isSafeInteger(today)||today<0||!/^\d{4}-\d{2}-\d{2}$/.test(period))throw Error('Invalid Daily count');
   // A stale server period is not an in-flight refresh request.
   // Retrying here recursively would create an unbounded microtask/RPC
   // loop, freeze the page and overwhelm the read endpoint.
   // Leave the counter neutral and let the 15-second poll retry later.
   if(period!==periodNow()){
    counter.textContent='—';
    label.textContent='DAILIES COMPLETED TODAY';
    return;
   }
   counter.textContent=today.toLocaleString();
   label.textContent=today===1?'DAILY COMPLETED TODAY':'DAILIES COMPLETED TODAY';
   counter.title=today+' official '+(today===1?'Daily':'Dailies')+' completed this Daily period';
   lastPeriod=period;lastRead=Date.now();
  }catch(e){
   if(!lastRead)counter.textContent='—';
   console.warn('Daily completion total unavailable:',e?.message||e);
  }finally{
   fetching=false;
   if(retry){retry=false;refresh()}
  }
 }
 const message=document.getElementById('message');
 if(message){
  let observed=false;
  new MutationObserver(()=>{
   const saved=message.textContent?.startsWith('Official Daily saved.');
   if(saved&&!observed)refresh();
   observed=!!saved;
  }).observe(message,{childList:true,subtree:true,characterData:true});
 }
 function check(){
  if(document.hidden)return;
  if(lastPeriod&&periodNow()!==lastPeriod){
   counter.textContent='—';
   label.textContent='DAILIES COMPLETED TODAY';
   lastRead=0;refresh();
  }else if(Date.now()-lastRead>5*60*1000)refresh();
 }
 document.addEventListener('visibilitychange',check);
 setInterval(check,15000);
 refresh();
})();
