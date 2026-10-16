/* Crilo Statistics Spin History: one day, highest completed run on top,
 * expandable all Official and badge-unlocked Bonus Runs. Server-paginated.
 * No owner Test Runs or private Bonus artwork can reach this view. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 if(!$('spinHistoryList'))return;
 const FIRST_PAGE=3,PAGE=5;
 const list=$('spinHistoryList'),counter=$('spinHistoryCount'),
  spinCounter=$('spinHistorySpinCount'),progress=$('spinHistoryProgress'),
  endingLabel=$('spinHistoryEndLabel'),pager=$('spinHistoryPager'),
  button=$('spinHistoryMore'),ending=$('spinHistoryEnd');
 const profileId=new URLSearchParams(location.search).get('id');
 const esc=value=>Crilo.esc(String(value??''));
 const fmt=value=>Number.isFinite(Number(value))?Number(value).toLocaleString('en-US'):'—';
 let currentId='',requestId=0,shown=0,busy=false;
 let totalDailies=null,officialSpins=0,bonusSpins=0,officialDailies=0,bonusRuns=0;

 function scoreTier(value){
  const score=Number(value),bands=window.CriloRarity?.scoreBands;
  const tier=Array.isArray(bands)&&bands.find(b=>score<=b.max);
  return tier?.key||'common';
 }
 function dayLabel(day){
  const date=String(day.daily_period||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return 'Previous Daily';
  const parsed=new Date(date+'T12:00:00Z');
  return Number.isFinite(parsed.getTime())?
   new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(parsed):
   'Previous Daily';
 }
 function artwork(drawing){
  return typeof drawing==='string'&&/^data:image\/(?:png|webp);base64,[a-zA-Z0-9+/=]+$/.test(drawing)
   ?drawing:'blank-wheel.svg';
 }
 function stat(value,singular,plural){
  const n=Math.max(0,Math.floor(Number(value)||0));
  return fmt(n)+' '+(n===1?singular:plural);
 }
 function details(run){
  return [
   stat(run.spins,'spin','spins'),
   stat(run.upgrades,'upgrade','upgrades'),
   stat(run.doubles,'double','doubles'),
   stat(run.ducks,'duck','ducks')
  ].join(' · ');
 }
 function runType(run){
  return run.source==='bonus'?'Bonus Run '+Math.max(0,Number(run.slot)||0):'Official Daily';
 }
 function wheel(run,date){
  const src=artwork(run.drawing),blank=src==='blank-wheel.svg';
  return '<button type="button" class="spin-history-wheel" title="Expand wheel drawing" aria-label="Expand wheel drawing for '+esc(date)+' '+esc(runType(run))+'">'+
   '<img src="'+src+'" alt="'+(blank?'Blank drawing':'Saved wheel drawing')+'"></button>';
 }
 function dayHTML(day,index){
  const best=day.best||day.runs?.[0];
  if(!best)return '';
  const all=Array.isArray(day.runs)?day.runs:[best];
  const count=all.length,date=dayLabel(day),tier=scoreTier(best.score);
  const groupId='spin-history-day-'+index;
  const multiple=count>1;
  // Official Daily is the default and needs no visual label. Only Bonus
  // attempts keep a pill, as on the grouped Daily leaderboard.
  const badge=best.source==='bonus'?
   '<span class="spin-history-kind is-bonus">'+esc(runType(best))+'</span>':'';
  const toggle=multiple?'<button type="button" class="spin-history-expand" aria-expanded="false" aria-controls="'+groupId+'" data-count="'+count+'">'+
   '<span class="spin-history-expand-label">View all '+count+' runs</span><span class="spin-history-expand-arrow" aria-hidden="true">⌄</span></button>':'';
  const subrows=multiple?'<div id="'+groupId+'" class="spin-history-runs" hidden>'+
   '<div class="spin-history-runs-heading">All '+count+' runs from '+esc(date)+'</div>'+
   all.map((run,j)=>{
    const isBest=String(best.id)===String(run.id)&&best.source===run.source;
    return '<div class="spin-history-subrun" data-rarity="'+scoreTier(run.score)+'">'+
     '<div class="spin-history-subrun-detail">'+
     (run.source==='bonus'?'<span class="spin-history-kind is-bonus">'+esc(runType(run))+'</span>':'')+
     (isBest?'<span class="spin-history-best-mark">Best</span>':'')+
     '<small>'+esc(details(run))+'</small></div>'+
     '<div class="spin-history-subrun-score">'+esc(fmt(run.score))+' <small>PTS</small></div>'+
     wheel(run,date)+'</div>';
   }).join('')+'</div>':'';
  return '<section class="spin-history-day">'+
   '<article class="spin-history-item" data-rarity="'+tier+'">'+
   '<div class="spin-history-detail"><div class="spin-history-event">'+esc(date)+'</div>'+
   (badge||multiple?'<div class="spin-history-run-type">'+badge+
    (multiple?'<span class="spin-history-best-marker">Best of '+count+'</span>':'')+'</div>':'')+
   '<div class="spin-history-meta">'+esc(details(best))+'</div>'+toggle+'</div>'+
   '<div class="spin-history-side"><strong class="spin-history-score">'+esc(fmt(best.score))+
   '</strong><small class="spin-history-units">PTS</small></div>'+wheel(best,date)+'</article>'+
   subrows+'</section>';
 }
 function updateCount(){
  if(totalDailies===null){
   counter.textContent='Counting Dailies…';
   spinCounter.textContent='Official and Bonus Runs · Test Runs excluded';
   return;
  }
  const title=fmt(totalDailies)+' Dail'+(totalDailies===1?'y':'ies')+' completed';
  counter.textContent=title;counter.setAttribute('aria-label',title);
  spinCounter.textContent=fmt(officialSpins+bonusSpins)+' wheel spin'+((officialSpins+bonusSpins)===1?'':'s')+
   ' across Official and Bonus Runs · '+fmt(bonusRuns)+' Bonus Run'+(bonusRuns===1?'':'s')+
   ' · Test Runs excluded';
 }
 function updatePager(){
  if(totalDailies!==null){
   const remaining=Math.max(0,totalDailies-shown);
   const next=Math.min(PAGE,remaining);
   if(!busy&&remaining>0)
    button.innerHTML='SHOW '+fmt(next)+' OLDER DAIL'+(next===1?'Y':'IES')+' <span aria-hidden="true">↓</span>';
   if(progress){
    const fraction=totalDailies?Math.max(0,Math.min(1,shown/totalDailies)):0;
    progress.style.transform='scaleX('+fraction+')';
   }
   if(endingLabel)endingLabel.textContent='All '+fmt(totalDailies)+' saved Dail'+(totalDailies===1?'y':'ies')+' shown. Test Runs are separate.';
  }
 }
 async function showNext(id,token){
  if(busy||token!==requestId||!id)return;
  busy=true;button.disabled=true;
  pager.classList.add('is-loading');button.textContent='LOADING DAILIES…';
  const wanted=shown===0?FIRST_PAGE:PAGE;
  try{
   const {data,error}=await criloDB.rpc('crilo_grouped_spin_history',{
    p_user:id,p_offset:shown,p_limit:wanted
   });
   if(token!==requestId)return;
   if(error)throw error;
   if(!data||!Array.isArray(data.days))throw Error('Invalid history response');
   totalDailies=Math.max(0,Number(data.total_dailies)||0);
   officialDailies=Math.max(0,Number(data.official_dailies)||0);
   officialSpins=Math.max(0,Number(data.official_spins)||0);
   bonusSpins=Math.max(0,Number(data.bonus_spins)||0);
   bonusRuns=Math.max(0,Number(data.bonus_runs)||0);
   const days=data.days;
   if(shown===0)list.textContent='';
   for(let i=0;i<days.length;i++)list.insertAdjacentHTML('beforeend',dayHTML(days[i],shown+i));
   shown+=days.length;
   updateCount();
   const more=shown<totalDailies;
   pager.hidden=!more;ending.hidden=more||shown===0;
   if(!shown)list.innerHTML='<p class="spin-history-message">No completed Dailies yet. Your first Daily will appear here.</p>';
  }catch(error){
   if(token!==requestId)return;
   if(!shown)list.innerHTML='<p class="spin-history-message">Could not load Daily history. Try again.</p>';
   button.textContent='RETRY LOADING DAILIES ↻';
   pager.hidden=false;
   if(totalDailies===null)counter.textContent='Daily count unavailable';
   console.warn('Crilo Daily spin history unavailable',error);
  }finally{
   if(token===requestId){
    pager.classList.remove('is-loading');
    button.disabled=false;
    const retry=button.textContent==='RETRY LOADING DAILIES ↻';
    busy=false;
    if(!retry)updatePager();
   }
  }
 }
 function begin(){
  const id=profileId||Crilo.user?.id||'';
  if(id===currentId)return;
  const token=++requestId;
  currentId=id;shown=0;busy=false;
  totalDailies=null;officialDailies=0;officialSpins=0;bonusSpins=0;bonusRuns=0;
  pager.hidden=true;ending.hidden=true;
  counter.textContent='Loading…';
  spinCounter.textContent='Official and Bonus Runs · Test Runs excluded';
  list.innerHTML='<p class="spin-history-message">Fetching completed Dailies…</p>';
  if(!id){
   list.innerHTML='<p class="spin-history-message">Sign in to see your Daily spin history.</p>';
   counter.textContent='Sign in to view';spinCounter.textContent='';
   return;
  }
  showNext(id,token);
 }
 list.addEventListener?.('click',event=>{
  const toggle=event.target.closest?.('.spin-history-expand');
  if(toggle){
   const panel=document.getElementById(toggle.getAttribute('aria-controls'));
   if(!panel)return;
   const open=toggle.getAttribute('aria-expanded')==='true';
   toggle.setAttribute('aria-expanded',open?'false':'true');
   panel.hidden=open;
   toggle.querySelector('.spin-history-expand-label').textContent=
    (open?'View all ':'Hide ')+toggle.dataset.count+' runs';
   return;
  }
  const wheel=event.target.closest?.('.spin-history-wheel');
  if(wheel)window.CriloWheelPreview?.openFrom(wheel);
 });
 button.addEventListener('click',()=>showNext(currentId,requestId));
 window.addEventListener('crilo-auth-ready',begin);
 if(profileId||Crilo.user?.id)begin();
})();
