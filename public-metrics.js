/* Privacy-first aggregate counts: no cookies, identifiers, IPs, UA or payloads. */
(() => {
 'use strict';
 const permitted=new Set(['daily_visitor','guest_start','guest_complete','share_result']);
 const period=()=>window.Crilo?.dailyPeriod?.()||new Date(Date.now()-22*3600000).toISOString().slice(0,10);
 function track(event){
  if(!permitted.has(event)||location.hostname!=='crilo.fun'||typeof criloDB==='undefined')return;
  const key='crilo-metric-'+event+'-'+period();
  try{
   if(localStorage.getItem(key))return;
   // Store only a per-day event marker on this device; never transmit its key.
   localStorage.setItem(key,'1');
  }catch{ return }
  Promise.resolve(criloDB.rpc('crilo_track_site_metric',{p_metric:event}))
   .then(({error})=>{if(error)console.debug('Usage count not recorded:',error.message)})
   .catch(()=>{});
 }
 window.CriloMetrics={track};
 // Guest play is a free experiment; count starts/finishes without sign-in.
 document.addEventListener('click',e=>{
  if(e.target.closest?.('#spinButton')&&!window.Crilo?.user?.id)track('guest_start');
 });
 const result=document.getElementById('result');
 if(result){
  const check=()=>{
   if(!result.classList.contains('hidden')&&
      document.getElementById('resultEyebrow')?.textContent==='GUEST RUN COMPLETE')
    track('guest_complete');
  };
  new MutationObserver(check).observe(result,{subtree:true,childList:true,characterData:true,attributes:false});
 }
 track('daily_visitor');
})();
