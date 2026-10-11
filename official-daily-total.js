/* Server-authoritative aggregate: current Daily period and all-time Dailies.
 * 22:00 UTC Daily reset is enforced by the database. No individual scores,
 * drawings, profiles, player identifiers, or run histories are transferred. */
(() => {
 'use strict';
 const current=document.getElementById('criloOfficialDailyToday');
 const lifetime=document.getElementById('criloOfficialDailyTotal');
 if(!current||!lifetime||typeof criloDB==='undefined')return;
 let pending=false,lastLoaded=0,ready=false,lastPeriod='';
 async function refresh(){
  if(pending)return;
  pending=true;
  try{
   const {data,error}=await criloDB.rpc('crilo_public_daily_completion_counts');
   if(error)throw error;
   const today=Number(data?.today),allTime=Number(data?.all_time),period=String(data?.period||'');
   if(!Number.isSafeInteger(today)||today<0||
      !Number.isSafeInteger(allTime)||allTime<today||
      !/^\d{4}-\d{2}-\d{2}$/.test(period))throw new Error('Invalid Daily totals');
   current.textContent=today.toLocaleString();
   lifetime.textContent=allTime.toLocaleString();
   current.title=today.toLocaleString()+' completed official runs in the current Daily';
   lifetime.title=allTime.toLocaleString()+' completed official runs across all Daily periods';
   lastPeriod=period;
   lastLoaded=Date.now();
   ready=true;
  }catch(e){
   // Leave prior valid data rather than show an incorrect zero.
   if(!ready){current.textContent='—';lifetime.textContent='—'}
   console.warn('Crilo verified Daily count unavailable:',e?.message||e);
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
  if(!document.hidden&&(
    Date.now()-lastLoaded>10*60*1000||
    (window.Crilo?.dailyPeriod?.() && window.Crilo.dailyPeriod()!==lastPeriod)
   ))refresh();
 });
 // A player leaving the homepage open through reset must not see
 // yesterday's completions labeled TODAY.
 setInterval(()=>{
  if(!document.hidden&&window.Crilo?.dailyPeriod?.()&&
     window.Crilo.dailyPeriod()!==lastPeriod)refresh();
 },60000);
 refresh();
})();
