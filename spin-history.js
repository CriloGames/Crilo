/* Official Daily wheel spin history. This is a read-only view:
 * each saved spin-result is a feed entry, newest first, 5 more per click.
 * Owner Test Runs are never queried. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  if(!$('spinHistoryList'))return;
  const PAGE=5, RUN_BATCH=5;
  const list=$('spinHistoryList'),counter=$('spinHistoryCount');
  const pager=$('spinHistoryPager'),button=$('spinHistoryMore'),ending=$('spinHistoryEnd');
  const params=new URLSearchParams(location.search);
  const profileId=params.get('id');
  const esc=value=>Crilo.esc(String(value??''));
  let currentId='',requestId=0,runOffset=0,runExhausted=false,queue=[],shown=0,shownSpins=0,busy=false;

  function scoreTier(score){
    const bands=window.CriloRarity?.scoreBands;
    const match=Array.isArray(bands)&&bands.find(b=>score<=b.max);
    return match?.key||'common';
  }
  const fmt=value=>Number.isFinite(Number(value))?Number(value).toLocaleString('en-US'):'—';
  function dayLabel(row){
    const day=String(row.daily_period||row.run_date||row.created_at||'').slice(0,10);
    if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(day))return 'Previous Daily';
    const date=new Date(day+'T12:00:00Z');
    return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-US',
      {month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(date):'Previous Daily';
  }
  function savedSpins(row){
    const results=Array.isArray(row.results)?row.results:[];
    const date=dayLabel(row),finalScore=Math.max(0,Number(row.score)||0);
    if(!results.length){
      // Older official runs may have a score but no individual spin history.
      // Never fabricate past outcomes to fill the gap.
      return [{legacy:true,score:finalScore,date,spin:null,total:Number(row.spins)||0,
        finalScore,event:'Earlier Daily · individual spins were not saved'}];
    }
    let runningScore=0;
    return results.map((raw,i)=>{
      const event=raw&&typeof raw==='object'?raw:{};
      const kind=String(event.type||'').toLowerCase();
      let label='Wheel spin';
      if(kind==='num'){
        const points=Math.max(0,Number(event.points??event.base)||0);
        runningScore+=points;
        label='Landed '+fmt(points)+' point'+(points===1?'':'s');
      }else if(kind==='double'){
        runningScore*=2;
        label='×2 · Score doubled';
      }else if(kind==='upgrade'){
        label='Upgrade ↑ · Bigger numbers ahead';
      }else if(kind==='spins'){
        label='+2 Spins · Bonus chances';
      }else if(kind==='duck'){
        label='DUCK! · A free spin';
      }
      return {legacy:false,score:runningScore,date,spin:i+1,
        total:results.length,finalScore,event:label};
    }).reverse();
  }
  function rowHTML(entry){
    const tier=scoreTier(entry.score);
    const label=entry.legacy?'Recorded total':'Score after spin';
    const detail=entry.legacy?'Legacy official Daily · '+entry.total+' spins recorded':
      'Official Daily · Spin '+entry.spin+' of '+entry.total;
    return '<article class="spin-history-item'+(entry.legacy?' legacy':'')+
      '" data-rarity="'+tier+'">'+
      '<div class="spin-history-score"><strong>'+esc(fmt(entry.score))+'</strong>'+
      '<small>'+esc(tier)+'</small></div>'+
      '<div class="spin-history-detail"><div class="spin-history-event">'+esc(entry.event)+'</div>'+
      '<div class="spin-history-meta">'+esc(entry.date)+' · '+esc(detail)+'</div></div>'+
      '<div class="spin-history-side"><strong>'+esc(label)+'</strong>'+
      '<span>Daily total '+esc(fmt(entry.finalScore))+'</span></div></article>';
  }
  async function fetchRuns(id){
    if(runExhausted)return;
    const {data,error}=await criloDB.from('daily_runs')
      .select('id,created_at,run_date,daily_period,score,spins,results')
      .eq('user_id',id).eq('is_test',false)
      .order('created_at',{ascending:false}).order('id',{ascending:false})
      .range(runOffset,runOffset+RUN_BATCH-1);
    if(error)throw error;
    const records=data||[];
    runOffset+=records.length;
    if(records.length<RUN_BATCH)runExhausted=true;
    for(const run of records)queue.push(...savedSpins(run));
  }
  async function ensureQueue(id,size){
    while(queue.length<size&&!runExhausted)await fetchRuns(id);
  }
  function updateCount(){
    const maybeLegacy=shown-shownSpins;
    counter.textContent=shownSpins+' spin'+(shownSpins===1?'':'s')+' shown'+
      (maybeLegacy?' · '+maybeLegacy+' older Daily summar'+(maybeLegacy===1?'y':'ies'):'');
  }
  async function showNext(id,token){
    if(busy||token!==requestId)return;
    busy=true;
    button.disabled=true;
    pager.classList.add('is-loading');
    button.innerHTML='LOADING SPINS…';
    try{
      await ensureQueue(id,PAGE);
      if(token!==requestId)return;
      const next=queue.splice(0,PAGE);
      if(shown===0)list.textContent='';
      for(const item of next){
        list.insertAdjacentHTML('beforeend',rowHTML(item));
        if(!item.legacy)shownSpins++;
      }
      shown+=next.length;
      updateCount();
      // Check for the next page so the Load More control never leads
      // to a pointless empty click at the end of the history.
      await ensureQueue(id,1);
      if(token!==requestId)return;
      const hasMore=queue.length>0;
      pager.hidden=!hasMore;
      ending.hidden=hasMore||shownSpins<=5;
      if(shown===0){
        list.innerHTML='<p class="spin-history-message">No official spins yet. Your first Daily will appear here.</p>';
        counter.textContent='No spins yet';
      }
    }catch(error){
      if(token!==requestId)return;
      if(!shown)list.innerHTML='<p class="spin-history-message">Could not load spin history. Try again.</p>';
      button.textContent='RETRY LOADING SPINS ↻';
      pager.hidden=false;
      counter.textContent=shownSpins?'History temporarily unavailable':'Could not load spins';
      console.warn('Crilo spin history unavailable',error);
    }finally{
      if(token===requestId){
        pager.classList.remove('is-loading');
        button.disabled=false;
        if(button.textContent!=='RETRY LOADING SPINS ↻')
          button.innerHTML='LOAD 5 MORE SPINS <span aria-hidden="true">↓</span>';
        busy=false;
      }
    }
  }
  function begin(){
    const id=profileId||Crilo.user?.id||'';
    if(id===currentId)return;
    const token=++requestId;
    currentId=id;runOffset=0;runExhausted=false;queue=[];shown=0;shownSpins=0;busy=false;
    pager.hidden=true;ending.hidden=true;
    counter.textContent='Loading…';
    list.innerHTML='<p class="spin-history-message">Fetching official spins…</p>';
    if(!id){
      list.innerHTML='<p class="spin-history-message">Sign in to see your official spin history.</p>';
      counter.textContent='Sign in to view';
      return;
    }
    showNext(id,token);
  }
  button.addEventListener('click',()=>showNext(currentId,requestId));
  window.addEventListener('crilo-auth-ready',begin);
  if(profileId||Crilo.user?.id)begin();
})();
