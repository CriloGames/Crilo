/* Five Fronts browser controller — owner-gated, local single-player alpha.
 * AI opponents are simulated locally. Live networking is intentionally not
 * represented as implemented; no Supabase writes or multiplayer endpoints.
 */
(()=>{
 'use strict';
 const E=window.FiveFrontsEngine;
 const $=id=>document.getElementById(id);
 if(!E||!$('ffGame'))return;
 const gate=$('ffGate'),game=$('ffGame'),setup=$('ffSetup'),matchPanel=$('ffMatch');
 const svg=$('ffMap'),guidance=$('ffGuidance'),countriesSelect=$('ffCountries'),speedSelect=$('ffSpeed');
 const council=$('ffCouncilModal'),eventModal=$('ffEventModal'),endModal=$('ffEndModal');
 let ownerId=null,authCounter=0,match=null,selectedId=null,choosingTarget=false;
 let lastFrame=0,raf=0,lastPaint=0,lastSave=0,lastLogKey='',modalKind='';
 let emergencyElapsed=0,emergencyTarget=.5,emergencyNeedle=.5;
 let returnedFocus=null;
 const money=x=>Math.floor(Math.max(0,x));
 const formatSeconds=x=>{
  const s=Math.max(0,Math.floor(x));
  return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
 };
 const saveKey=()=> 'crilo_five_fronts_v1:'+ownerId;
 function setStatus(message){guidance.textContent=message}
 function put(id,text){$(id).textContent=String(text)}
 function save(){
  if(!ownerId||!match)return;
  try{localStorage.setItem(saveKey(),JSON.stringify({game:match,selectedId,savedAt:Date.now()}))}catch{}
 }
 function readSave(){
  if(!ownerId)return null;
  try{
   const data=JSON.parse(localStorage.getItem(saveKey())||'null');
   const g=data?.game;
   if(g?.version!==1||!Array.isArray(g.states)||!Array.isArray(g.countries)||
      g.states.length!==g.countries.length*5||g.countries.length<2||
      g.countries.length>6||!Array.isArray(g.transits))return null;
   return data;
  }catch{return null}
 }
 function clearSave(){try{localStorage.removeItem(saveKey())}catch{}}
 function renderSetup(){
  $('ffResume').hidden=!readSave();
 }
 function beginNew(){
  if(!ownerId)return;
  match=E.createMatch({
   countries:Number(countriesSelect.value),
   fast:speedSelect.value==='fast',
   seed:Math.floor(Math.random()*4294967295)+1
  });
  selectedId=match.states.find(s=>s.owner===0&&s.capital)?.id??match.states.find(s=>s.owner===0)?.id;
  choosingTarget=false;
  setup.hidden=true;matchPanel.hidden=false;
  for(const overlay of [council,eventModal,endModal])overlay.hidden=true;
  modalKind='';lastFrame=0;lastPaint=0;lastSave=0;lastLogKey='';
  put('ffMapSeed',match.seed.toString(16).slice(0,7).toUpperCase());
  setStatus('Select your capital to recruit, fortify, or march into a neighboring state.');
  render();save();schedule();
 }
 function resume(){
  const saved=readSave();
  if(!saved)return;
  match=saved.game;
  selectedId=E.getState(match,saved.selectedId)?.id??match.states.find(s=>s.owner===0)?.id??null;
  choosingTarget=false;
  setup.hidden=true;matchPanel.hidden=false;
  lastFrame=0;lastPaint=0;lastSave=0;lastLogKey='';
  put('ffMapSeed',match.seed.toString(16).slice(0,7).toUpperCase());
  render();checkInterruptions();schedule();
  setStatus('Saved campaign restored. Time does not advance while you are away.');
 }
 function backToSetup(){
  if(match&&!match.ended){
   if(!window.confirm('Discard this campaign and prepare a new one?'))return;
  }
  match=null;selectedId=null;choosingTarget=false;modalKind='';
  clearSave();
  [council,eventModal,endModal].forEach(x=>x.hidden=true);
  matchPanel.hidden=true;setup.hidden=false;
  renderSetup();
 }
 function schedule(){if(!raf&&match&&!match.ended)raf=requestAnimationFrame(frame)}
 function frame(now){
  raf=0;
  const dt=lastFrame?Math.min(.18,Math.max(0,(now-lastFrame)/1000)):0;
  lastFrame=now;
  if(match&&!match.ended){
   if(!match.paused&&!document.hidden&&!match.pendingEvent&&!match.pendingStrategy){
    E.advance(match,dt*match.speed);
   }
   checkInterruptions();
   if(!eventModal.hidden&&!document.hidden)updateEmergency(dt);
   if(now-lastPaint>160){render();lastPaint=now}
   if(now-lastSave>2800){save();lastSave=now}
  }else if(match?.ended&&endModal.hidden){showOutcome();render();save()}
  if(ownerId&&match&&!match.ended)schedule();
 }
 function poly(s,cx,cy,r){
  const points=[];
  for(let k=0;k<6;k++){
   const a=(-90+60*k)*Math.PI/180;
   points.push((cx+Math.cos(a)*r).toFixed(1)+','+(cy+Math.sin(a)*r).toFixed(1));
  }
  return points.join(' ');
 }
 function position(s){
  return {x:87+Math.sqrt(3)*47*(s.q+s.r/2),y:85+70.5*s.r};
 }
 function terrainIcon(terrain){
  return {plains:'·',farms:'≋',forest:'♠',hills:'⌃',river:'≈'}[terrain]||'·';
 }
 function renderMap(){
  const all=match.states;
  const height=Math.max(300,all.reduce((v,s)=>Math.max(v,position(s).y+68),0));
  svg.setAttribute('viewBox','0 0 550 '+height);
  const paths=[];
  paths.push('<title>Five Fronts map: click a country state to view or command it.</title>');
  paths.push('<defs><filter id="ffTileShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#0a1923" flood-opacity=".3"/></filter></defs>');
  for(const s of all){
   const c=match.countries[s.owner],p=position(s),mine=s.owner===0;
   const selected=s.id===selectedId;
   const canTarget=choosingTarget&&selectedId!==null&&E.getState(match,selectedId)?.neighbors.includes(s.id);
   const cls='ff-map-state'+(selected?' is-selected':'')+(canTarget?' is-targetable':'');
   const title='State '+(s.id+1)+'. '+c.name+'. '+s.terrain+
    '. '+Math.floor(s.troops)+' troops. Fort '+s.fort+
    (s.capital?'. Capital.':'');
   // Owner/color and label originate from the fixed, generated ruleset.
   paths.push('<g class="'+cls+'" data-state="'+s.id+'" tabindex="0" role="button" aria-label="'+title+'">');
   paths.push('<polygon points="'+poly(s,p.x,p.y,45)+'" fill="'+c.color+'" filter="url(#ffTileShadow)"/>');
   if(s.capital){
    paths.push('<circle cx="'+p.x+'" cy="'+(p.y-9)+'" r="21" fill="#fbf6df" opacity=".25"/>');
    paths.push('<path d="M'+(p.x-6)+' '+(p.y-21)+' l6 -7 l6 7 z" fill="#193741"/>');
   }
   paths.push('<text x="'+p.x+'" y="'+(p.y+2)+'" class="ff-tile-icon">'+terrainIcon(s.terrain)+'</text>');
   paths.push('<text x="'+p.x+'" y="'+(p.y+20)+'" class="ff-tile-number">'+Math.floor(s.troops)+'</text>');
   if(s.fort)paths.push('<text x="'+(p.x+25)+'" y="'+(p.y-17)+'" style="font-size:10px">▣'+s.fort+'</text>');
   paths.push('<title>'+title+'</title></g>');
  }
  for(const transit of match.transits){
   const a=position(E.getState(match,transit.from)),b=position(E.getState(match,transit.to));
   if(!a||!b)continue;
   const progress=Math.max(0,Math.min(1,(match.time-transit.start)/(transit.arrival-transit.start)));
   paths.push('<line class="ff-move-trail" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"/>');
   paths.push('<circle cx="'+(a.x+(b.x-a.x)*progress).toFixed(1)+'" cy="'+(a.y+(b.y-a.y)*progress).toFixed(1)+'" r="5" fill="'+match.countries[transit.owner].color+'" stroke="#ffe8bd" stroke-width="2"/>');
  }
  svg.innerHTML=paths.join('');
 }
 function renderLegend(){
  $('ffLegend').innerHTML=match.countries.map(c=>{
   const count=E.ownedCount(match,c.id);
   return '<span class="'+(count?'':'is-eliminated')+'"><i class="ff-color-dot" style="background:'+c.color+'"></i>'+
    c.name+(c.id===0?' (YOU)':'')+' · '+count+'</span>';
  }).join('');
 }
 function renderResources(){
  const res=match.countries[0].resources,p=E.production(match,0);
  const labels=[['food','FOOD','◈'],['metal','METAL','▣'],['oil','OIL','◆'],['knowledge','RESEARCH','✦'],['people','POPULATION','●']];
  $('ffResources').innerHTML=labels.map(([k,name,icon])=>
   '<div class="ff-resource"><div>'+icon+' '+name+'</div><strong>'+money(res[k])+'</strong><small>+'+p[k].toFixed(1)+'/min</small></div>'
  ).join('');
 }
 function renderCounters(){
  const c=match.countries[0],score=E.scoreCountry(match,c);
  put('ffClock',formatSeconds(match.time));
  put('ffClockType','OF '+formatSeconds(match.limit)+(match.speed>1?' · 5× TEST':''));
  put('ffLand',score.states+' / 5 initially');
  put('ffArmy',score.troops+' troops');
  put('ffRivals',Math.max(0,E.aliveCountries(match).length-(score.states?1:0)));
  put('ffPolicy',c.policyUntil>match.time?
   E.STRATEGIES[c.policy]?.label||'None':'Not assigned');
  $('ffPause').textContent=match.paused?'RESUME':'PAUSE';
  $('ffPause').disabled=match.ended||!!match.pendingEvent||!!match.pendingStrategy;
  $('ffTestEvent').disabled=match.ended||match.paused||!!match.pendingEvent||
   !!match.pendingStrategy||!E.ownedCount(match,0);
 }
 function renderSelected(){
  const state=E.getState(match,selectedId),mine=state?.owner===0;
  if(!state){
   put('ffSelectedTitle','Select a state');
   put('ffSelectedDescription','Choose one of your states on the map to issue orders.');
   $('ffStateStats').innerHTML='';
   $('ffCommandActions').hidden=true;
   return;
  }
  const owner=match.countries[state.owner],adjacent=state.neighbors.map(id=>E.getState(match,id));
  put('ffSelectedTitle','State '+(state.id+1)+(state.capital?' · Capital':''));
  put('ffSelectedDescription',owner.name+(mine?' · Your territory':' · Rival territory')+
   '. '+state.terrain[0].toUpperCase()+state.terrain.slice(1)+
   ' terrain. '+(mine?'Give military orders from here.':'Capture this state from a neighboring army.'));
  const stats=[['OWNER',owner.name],['ARMY',Math.floor(state.troops)+' troops'],
   ['DEFENSE','Level '+state.fort],['TERRAIN',state.terrain.toUpperCase()],
   ['SUPPLY',E.supply(match,state,state.owner)?'Connected':'Isolated'],['NEIGHBORS',adjacent.length+' states']];
  $('ffStateStats').innerHTML=stats.map(([k,v])=>
   '<div><span>'+k+'</span><strong>'+v+'</strong></div>').join('');
  $('ffCommandActions').hidden=!mine;
  if(!mine)return;
  const r=match.countries[0].resources,blocked=match.paused||!!match.pendingEvent||!!match.pendingStrategy||match.ended;
  $('ffTrain').disabled=blocked||!Object.entries(E.COST.train).every(([k,v])=>r[k]>=v);
  $('ffTrain').title='Cost: 14 metal, 11 food, 3 oil and 8 population.';
  $('ffFortify').title='Cost: 19 metal and 10 food.';
  $('ffFortify').disabled=blocked||state.fort>=3||!Object.entries(E.COST.fortify).every(([k,v])=>r[k]>=v);
  const fraction=Number($('ffMarchAmount').value)/100;
  const count=Math.floor(Math.max(0,state.troops-5)*fraction);
  put('ffMarchLabel',$('ffMarchAmount').value+'% · '+count+' troops');
  const fuel=Math.ceil(count/22);
  $('ffMarch').disabled=blocked||count<12||r.oil<fuel;
  $('ffMarch').title='Uses '+fuel+' oil to transport '+count+' troops to an adjacent state.';
  $('ffMarch').textContent=choosingTarget?'CLICK AN ADJACENT STATE':'ORDER TROOPS TO MOVE';
  $('ffCancelMarch').hidden=!choosingTarget;
 }
 function renderLog(){
  const newest=match.log.slice(0,9);
  const key=newest.map(e=>e.time+':'+e.text).join('|');
  if(key===lastLogKey)return;
  lastLogKey=key;
  $('ffLog').innerHTML=newest.map(e=>
   '<li><time>'+formatSeconds(e.time)+'</time>'+e.text+'</li>').join('');
 }
 function renderTransits(){
  const orders=match.transits.filter(t=>t.owner===0);
  $('ffTransits').textContent=orders.length?
   orders.map(o=>o.troops+' troops → State '+(o.to+1)+' ('+Math.ceil(Math.max(0,o.arrival-match.time))+'s)').join('  ·  '):
   'No friendly armies on the move. Orders between adjacent states arrive after a short travel time.';
 }
 function render(){
  if(!match||matchPanel.hidden)return;
  renderCounters();renderResources();renderMap();renderLegend();renderSelected();
  renderTransits();renderLog();
 }
 function selectState(id){
  if(!match||match.ended||match.pendingEvent||match.pendingStrategy)return;
  const state=E.getState(match,id);
  if(!state)return;
  if(choosingTarget){
   const from=E.getState(match,selectedId);
   if(!from||!from.neighbors.includes(state.id)){
    setStatus('That state is not adjacent. Choose one of the highlighted neighboring tiles.');
    return;
   }
   const count=Math.floor(Math.max(0,from.troops-5)*Number($('ffMarchAmount').value)/100);
   const result=E.march(match,0,from.id,state.id,count);
   choosingTarget=false;
   setStatus(result.ok?'March ordered: '+count+' troops toward State '+(state.id+1)+
    '. They will arrive shortly.':result.error);
   save();render();return;
  }
  selectedId=state.id;
  setStatus(state.owner===0?'State '+(state.id+1)+' selected. Recruit, fortify or order a move.':
   match.countries[state.owner].name+' holds this state. To invade it, first select an adjacent state you own.');
  render();
 }
 function checkInterruptions(){
  if(!match)return;
  if(match.ended){showOutcome();return}
  if(match.pendingStrategy&&council.hidden){
   openCouncil();return;
  }
  if(match.pendingEvent&&eventModal.hidden){
   openEvent();return;
  }
 }
 function openCouncil(){
  if(!match?.pendingStrategy)return;
  modalKind='council';returnedFocus=document.activeElement;
  const root=$('ffPolicyOptions');root.replaceChildren();
  for(const key of match.pendingStrategy.options){
   const data=E.STRATEGIES[key],btn=document.createElement('button');
   btn.type='button';
   const title=document.createElement('strong'),description=document.createElement('span');
   title.textContent=data.label;description.textContent=data.detail;
   btn.append(title,description);
   btn.addEventListener('click',()=>{
    const result=E.applyStrategy(match,0,key);
    if(result.ok){
     council.hidden=true;modalKind='';setStatus('National directive adopted: '+data.label+'.');save();render();
     checkInterruptions();returnedFocus?.focus?.();
    }
   });
   root.append(btn);
  }
  council.hidden=false;
  root.querySelector('button')?.focus();
 }
 function openEvent(){
  if(!match?.pendingEvent)return;
  modalKind='event';returnedFocus=document.activeElement;
  const evt=match.pendingEvent,data=E.EVENTS[evt.type];
  put('ffEventTitle',data.symbol+' '+data.title);
  put('ffEventDescription',data.effect+' Your response can prevent most of the damage.');
  put('ffEventPrompt',data.prompt);
  $('ffEventTry').textContent={water:'CLOSE THE FLOODGATE',fire:'DROP SUPPRESSANT',signals:'LOCK FREQUENCY',storm:'DEPLOY SHELTER'}[data.kind];
  emergencyTarget=.28+Math.random()*.45;
  emergencyElapsed=0;emergencyNeedle=0;
  $('ffGaugeWindow').style.left=(emergencyTarget*100-8)+'%';
  $('ffGaugeWindow').style.width='16%';
  eventModal.hidden=false;
  put('ffEventCountdown','9.0s');
  $('ffEventTry').focus();
 }
 function updateEmergency(dt){
  emergencyElapsed+=dt;
  emergencyNeedle=.5+.5*Math.sin(emergencyElapsed*5.5-1.3);
  $('ffGaugeNeedle').style.left=(emergencyNeedle*100)+'%';
  put('ffEventCountdown',Math.max(0,9-emergencyElapsed).toFixed(1)+'s');
  if(emergencyElapsed>=9)resolveEmergency(false);
 }
 function resolveEmergency(hit){
  if(!match?.pendingEvent)return;
  const success=hit&&Math.abs(emergencyNeedle-emergencyTarget)<=.08;
  const evt=match.pendingEvent,evtName=E.EVENTS[evt.type].title;
  E.resolveEvent(match,evt,success);
  eventModal.hidden=true;modalKind='';
  setStatus(success?'Response successful! '+evtName+' damage was largely prevented.':
   evtName+' hit your country. The response failed; inspect the new losses.');
  save();render();checkInterruptions();returnedFocus?.focus?.();
 }
 function showOutcome(){
  if(!match||!match.ended||!endModal.hidden)return;
  modalKind='finished';save();
  const winner=match.countries[match.winner];
  put('ffEndTitle',match.winner===0?'Victory! Your nation prevailed.':'Defeat. '+winner.name+' takes the map.');
  put('ffEndDescription',match.winner===0?
   'Your planning, troop movements, and economy secured the decisive advantage.':
   'Try another approach: protect your capital, control supply routes, and push only when you have the advantage.');
  const ranks=match.countries.map(c=>({c,score:E.scoreCountry(match,c)})).
   sort((a,b)=>b.score.total-a.score.total||a.c.id-b.c.id);
  $('ffFinalStandings').innerHTML=ranks.map((x,i)=>
   '<div><span>'+(i+1)+'. '+x.c.name+(x.c.id===0?' (YOU)':'')+
    '</span><b>'+x.score.states+' states · '+x.score.troops+' troops</b></div>').join('');
  endModal.hidden=false;$('ffEndNew').focus();
 }
 svg.addEventListener('click',e=>{
  const tile=e.target.closest('[data-state]');
  if(tile)selectState(Number(tile.dataset.state));
 });
 svg.addEventListener('keydown',e=>{
  if(e.key!=='Enter'&&e.key!==' ')return;
  const tile=e.target.closest('[data-state]');
  if(tile){e.preventDefault();selectState(Number(tile.dataset.state))}
 });
 $('ffStart').addEventListener('click',beginNew);
 $('ffResume').addEventListener('click',resume);
 $('ffRestart').addEventListener('click',backToSetup);
 $('ffEndNew').addEventListener('click',()=>{
  endModal.hidden=true;
  match=null;clearSave();matchPanel.hidden=true;setup.hidden=false;
  renderSetup();
 });
 $('ffTestEvent').addEventListener('click',()=>{
  if(!match||match.paused||match.ended||match.pendingEvent||match.pendingStrategy)return;
  if(E.triggerEvent(match,true)){
   checkInterruptions();save();render();
  }
 });
 $('ffPause').addEventListener('click',()=>{
  if(!match||match.ended||match.pendingEvent||match.pendingStrategy)return;
  match.paused=!match.paused;
  setStatus(match.paused?'Campaign paused. No troops or resources will move.':
   'Campaign resumed. Watch your borders and resource reserves.');
  save();render();
 });
 $('ffTrain').addEventListener('click',()=>{
  const r=E.train(match,0,selectedId);setStatus(r.ok?'Recruited '+r.amount+' soldiers.':r.error);save();render();
 });
 $('ffFortify').addEventListener('click',()=>{
  const r=E.fortify(match,0,selectedId);setStatus(r.ok?'Fortifications improved.':r.error);save();render();
 });
 $('ffMarchAmount').addEventListener('input',renderSelected);
 $('ffMarch').addEventListener('click',()=>{
  if(!match||!E.getState(match,selectedId)||match.paused)return;
  choosingTarget=true;
  setStatus('Choose one adjacent highlighted state on the map. Friendly moves reinforce; enemy moves attack.');
  render();
 });
 $('ffCancelMarch').addEventListener('click',()=>{choosingTarget=false;setStatus('Move canceled.');render()});
 $('ffEventTry').addEventListener('click',()=>resolveEmergency(true));
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&match&&!match.paused&&!match.ended){
   match.paused=true;
   if(!eventModal.hidden){eventModal.hidden=true;modalKind='';}
   save();
  }else if(!document.hidden&&match?.pendingEvent&&eventModal.hidden)openEvent();
 });
 window.addEventListener('pagehide',()=>save());
 // Reverify the owner independently; being linked from Test Games is not
 // proof of access. This only protects the in-browser experience on static
 // hosting, not the public source code.
 function deny(message){
  ownerId=null;match=null;game.hidden=true;game.inert=true;
  gate.hidden=false;gate.textContent=message;gate.classList.add('is-denied');
  [council,eventModal,endModal].forEach(x=>x.hidden=true);
 }
 async function verify(){
  const attempt=++authCounter;
  deny('Verifying your owner account…');gate.classList.remove('is-denied');
  if(typeof criloDB==='undefined'||!criloDB?.auth?.getUser){
   deny('Sign-in service unavailable. Refresh the page.');return;
  }
  try{
   const {data,error}=await criloDB.auth.getUser();
   if(attempt!==authCounter)return;
   const uid=data?.user?.id;
   if(error||!uid){deny('Owner-only playtest. Please sign in to the owner account.');return}
   const {data:profile,error:readError}=await criloDB.from('profiles').
     select('id,is_owner').eq('id',uid).maybeSingle();
   if(attempt!==authCounter)return;
   if(readError||profile?.id!==uid||profile.is_owner!==true){
    deny('This playtest is available only to Crilo’s owner account.');return;
   }
   ownerId=uid;gate.hidden=true;game.hidden=false;game.inert=false;
   setup.hidden=false;matchPanel.hidden=true;renderSetup();schedule();
  }catch{
   if(attempt===authCounter)deny('Could not verify access. Check your connection and try again.');
  }
 }
 window.addEventListener('crilo-auth-ready',verify);
 if(window.Crilo?.authResolved)void verify();
})();
