/* Personal Daily history: one row per saved official Daily, not one row
 * per wheel outcome or badge. Public historical Dailies are retained;
 * private owner Test Runs are excluded. Read only. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  if(!$('spinHistoryList'))return;
  const FIRST_PAGE=3, PAGE=5, RUN_BATCH=8;
  const list=$('spinHistoryList'), counter=$('spinHistoryCount'), spinCounter=$('spinHistorySpinCount'), progress=$('spinHistoryProgress'), endingLabel=$('spinHistoryEndLabel');
  const pager=$('spinHistoryPager'), button=$('spinHistoryMore'), ending=$('spinHistoryEnd');
  const profileId=new URLSearchParams(location.search).get('id');
  const esc=value=>Crilo.esc(String(value??''));
  const fmt=value=>Number.isFinite(Number(value))?Number(value).toLocaleString('en-US'):'—';
  let currentId='',requestId=0,runOffset=0,runExhausted=false,queue=[],shown=0,busy=false,lifetimeSpins=null,totalDailies=null;

  function scoreTier(value){
    const score=Number(value),bands=window.CriloRarity?.scoreBands;
    const tier=Array.isArray(bands)&&bands.find(b=>score<=b.max);
    return tier?.key||'common';
  }
  function dayLabel(row){
    const date=String(row.daily_period||row.run_date||row.created_at||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return 'Previous Daily';
    const parsed=new Date(date+'T12:00:00Z');
    return Number.isFinite(parsed.getTime())?new Intl.DateTimeFormat('en-US',
      {month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(parsed):'Previous Daily';
  }
  // A missing drawing means the player left the drawing canvas empty.
  // Never substitute colorful wheel artwork that they did not make.
  function artwork(drawing){
    return typeof drawing==='string'&&/^data:image\/(?:png|webp);base64,[a-zA-Z0-9+/=]+$/.test(drawing)
      ?drawing:'blank-wheel.svg';
  }
  function stat(value,singular,plural){
    const n=Math.max(0,Math.floor(Number(value)||0));
    return fmt(n)+' '+(n===1?singular:plural);
  }
  function rowHTML(run){
    const date=dayLabel(run),tier=scoreTier(run.score),src=artwork(run.drawing);
    const blank=src==='blank-wheel.svg';
    const details=[
      stat(run.spins,'spin','spins'),
      stat(run.upgrades,'upgrade','upgrades'),
      stat(run.doubles,'double','doubles'),
      stat(run.ducks,'duck','ducks')
    ].join(' · ');
    return '<article class="spin-history-item" data-rarity="'+tier+'">'+
      '<div class="spin-history-detail"><div class="spin-history-event">'+esc(date)+'</div>'+
      '<div class="spin-history-meta">'+esc(details)+'</div></div>'+
      '<div class="spin-history-side"><strong>'+esc(fmt(run.score))+
      ' <small>PTS</small></strong></div>'+
      '<button type="button" class="spin-history-wheel" title="Spin this Daily wheel" aria-label="Spin wheel for '+esc(date)+'">'+
      '<img src="'+src+'" alt="'+(blank?'Blank drawing':'Saved wheel drawing')+'"></button></article>';
  }
  async function fetchRuns(id){
    if(runExhausted)return;
    const {data,error}=await criloDB.from('daily_runs')
      .select('id,created_at,run_date,daily_period,score,spins,upgrades,doubles,ducks,drawing')
      .eq('user_id',id).eq('is_test',false)
      .order('daily_period',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false})
      .range(runOffset,runOffset+RUN_BATCH-1);
    if(error)throw error;
    const rows=data||[];
    runOffset+=rows.length;
    if(rows.length<RUN_BATCH)runExhausted=true;
    queue.push(...rows);
  }
  async function ensureQueue(id,count){
    while(queue.length<count&&!runExhausted)await fetchRuns(id);
  }
  // Count completed official Dailies separately from the spins inside them.
  // Historical Daily runs count; private owner Test Runs do not.
  async function loadSummary(id,token){
    let sum=0,count=0,offset=0;
    try{
      for(;;){
        const {data,error}=await criloDB.from('daily_runs').select('spins,daily_period')
          .eq('user_id',id).eq('is_test',false)
          .order('daily_period',{ascending:false}).order('id',{ascending:false})
          .range(offset,offset+499);
        if(error)throw error;
        if(token!==requestId)return;
        const rows=data||[];
        count+=rows.length;
        for(const row of rows){
          const n=Number(row.spins);
          if(Number.isFinite(n)&&n>0)sum+=Math.floor(n);
        }
        if(rows.length<500)break;
        offset+=rows.length;
      }
      if(token!==requestId)return;
      lifetimeSpins=sum;
      totalDailies=count;
      updateCount();
      updatePager();
    }catch(error){
      if(token!==requestId)return;
      counter.textContent='Daily count unavailable';
      spinCounter.textContent='Official Dailies only · Test Runs excluded';
      console.warn('Could not count lifetime Daily spins',error);
    }
  }
  function updateCount(){
    if(totalDailies===null){
      counter.textContent='Counting Dailies…';
      spinCounter.textContent='Official Dailies only · Test Runs excluded';
      return;
    }
    const dailyLabel=fmt(totalDailies)+' Dail'+(totalDailies===1?'y':'ies')+' completed';
    counter.textContent=dailyLabel;
    counter.setAttribute('aria-label',dailyLabel);
    spinCounter.textContent=fmt(lifetimeSpins)+' wheel spin'+(lifetimeSpins===1?'':'s')+' in Dailies · Test Runs excluded';
  }
  function updatePager(){
    if(totalDailies!==null){
      const remaining=Math.max(0,totalDailies-shown);
      const next=Math.min(PAGE,remaining);
      if(!busy&&remaining>0){
        button.innerHTML='SHOW '+fmt(next)+' OLDER DAIL'+(next===1?'Y':'IES')+' <span aria-hidden="true">↓</span>';
      }
      if(progress){
        const fraction=totalDailies?Math.max(0,Math.min(1,shown/totalDailies)):0;
        progress.style.transform='scaleX('+fraction+')';
      }
      if(endingLabel)endingLabel.textContent='All '+fmt(totalDailies)+' saved Dail'+(totalDailies===1?'y':'ies')+' shown. Test Runs are separate.';
    }else if(!busy){
      button.innerHTML='SHOW OLDER DAILIES <span aria-hidden="true">↓</span>';
    }
  }
  async function showNext(id,token){
    if(busy||token!==requestId)return;
    busy=true;button.disabled=true;
    pager.classList.add('is-loading');button.textContent='LOADING DAILIES…';
    try{
      await ensureQueue(id,shown===0?FIRST_PAGE:PAGE);
      if(token!==requestId)return;
      const next=queue.splice(0,shown===0?FIRST_PAGE:PAGE);
      if(shown===0)list.textContent='';
      for(const run of next)list.insertAdjacentHTML('beforeend',rowHTML(run));
      shown+=next.length;
      updateCount();
      await ensureQueue(id,1);
      if(token!==requestId)return;
      const more=queue.length>0;
      pager.hidden=!more;
      ending.hidden=more||shown===0;
      if(!shown)list.innerHTML='<p class="spin-history-message">No completed Dailies yet. Your first Daily will appear here.</p>';
      updatePager();
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
    currentId=id;runOffset=0;runExhausted=false;queue=[];shown=0;busy=false;lifetimeSpins=null;totalDailies=null;
    pager.hidden=true;ending.hidden=true;
    counter.textContent='Loading…';
    spinCounter.textContent='Official Dailies only · Test Runs excluded';
    list.innerHTML='<p class="spin-history-message">Fetching completed Dailies…</p>';
    if(!id){
      list.innerHTML='<p class="spin-history-message">Sign in to see your Daily spin history.</p>';
      counter.textContent='Sign in to view';
      spinCounter.textContent='';
      return;
    }
    loadSummary(id,token);
    showNext(id,token);
  }
  list.addEventListener?.('click',event=>{
    const wheel=event.target.closest?.('.spin-history-wheel');
    const image=wheel?.querySelector('img');
    if(image)image.animate([{transform:'rotate(0deg)'},{transform:'rotate(1440deg)'}],
      {duration:2300,easing:'cubic-bezier(.1,.65,.2,1)'});
  });
  button.addEventListener('click',()=>showNext(currentId,requestId));
  window.addEventListener('crilo-auth-ready',begin);
  if(profileId||Crilo.user?.id)begin();
})();
