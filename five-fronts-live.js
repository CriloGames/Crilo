/* Five Fronts live: the Edge server owns all game state and validates actions. */
(()=>{
 'use strict';
 const E=window.FiveFrontsEngine,$=id=>document.getElementById(id);
 if(!E||!$('ffGame'))return;
 const gate=$('ffGate'),game=$('ffGame'),setup=$('ffSetup'),
  matchPanel=$('ffMatch'),svg=$('ffMap'),guidance=$('ffGuidance'),
  countriesSelect=$('ffCountries'),speedSelect=$('ffSpeed'),
  council=$('ffCouncilModal'),endModal=$('ffEndModal');
 let uid=null,room=null,match=null,meSeat=0,selectedId=null,choosingTarget=false;
 let channel=null,busy=false,syncing=false,snapAt=Date.now(),authCount=0;
 let lastSelectorKey='',lastLogKey='',modalKind='',returnedFocus=null;
 let showRoom=false,outcomeViewed=false,autoJoinDone=false;
 const money=x=>Math.floor(Math.max(0,Number(x)||0));
 const formatSeconds=x=>{
  const s=Math.max(0,Math.floor(x));
  return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
 };
 const put=(id,val)=>{$(id).textContent=String(val)};
 const setStatus=text=>{guidance.textContent=String(text)};
 function say(text,isError=false){
  $('ffLobbyMessage').textContent=String(text||'');
  $('ffLobbyMessage').classList.toggle('is-error',isError);
 }
 function node(tag,text='',klass=''){
  const el=document.createElement(tag);el.textContent=text;
  if(klass)el.className=klass;
  return el;
 }
 function normalizeError(err){return String(err?.message||'Try again.').slice(0,180)}
 async function call(payload){
  if(typeof criloDB==='undefined')throw Error('Crilo sign-in service is unavailable.');
  const {data,error}=await criloDB.functions.invoke('five-fronts-live',{body:payload});
  if(error){
   let message=error.message||'Game server unavailable.';
   try{if(error.context?.json)message=(await error.context.json())?.error||message}catch(_){}
   throw Error(message);
  }
  if(!data?.ok)throw Error(data?.error||'Game server unavailable.');
  return data.data;
 }
 const storageKey=()=> 'crilo-ff-live-room:'+(uid||'');
 function remember(id){
  if(!uid)return;
  try{if(id)localStorage.setItem(storageKey(),id);
   else localStorage.removeItem(storageKey())}catch(_){}
 }
 function remembered(){
  try{return localStorage.getItem(storageKey())||null}catch{return null}
 }
 function inviteLink(){
  const link=new URL('five-fronts-live.html',location.href);
  link.searchParams.set('join',room.code);return link.href;
 }
 function subscribe(id){
  if(channel){void criloDB.removeChannel(channel);channel=null}
  channel=criloDB.channel('ff-live:'+id)
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'ff_live_rooms',
    filter:'id=eq.'+id},()=>{void refresh()})
   .subscribe();
 }
 function drawLobby(){
  setup.hidden=false;matchPanel.hidden=true;
  $('ffLiveChoices').hidden=!!room;
  $('ffLiveRoom').hidden=!room;
  if(!room)return;
  put('ffInviteCode',room.code);
  const running=room.status==='playing'||room.status==='finished';
  $('ffStartLive').hidden=!room.isHost||room.status!=='waiting';
  $('ffStartLive').disabled=room.players.length!==room.capacity||busy;
  $('ffReturnBattle').hidden=!running;
  $('ffLeaveLobby').textContent=room.status==='waiting'?'LEAVE ROOM':'EXIT (CAN REJOIN)';
  put('ffRoomDetail',room.status==='waiting'?
   room.players.length+'/'+room.capacity+' joined. '+(room.players.length===room.capacity?
    'Everyone is ready to play!':'Share your room code to fill the remaining seats.'):
    room.status==='playing'?'Match in progress · '+(room.fast?'6':'30')+' minute battle':
    room.status==='finished'?'This campaign has ended.':'This room was cancelled.');
  const list=$('ffSeats');list.replaceChildren();
  const seats=new Map(room.players.map(p=>[p.seat,p]));
  for(let i=0;i<room.capacity;i++){
   const p=seats.get(i),li=node('li');
   const dot=node('i');dot.style.background=E.COLORS[i];
   li.append(dot,node('strong',E.NAMES[i]),
    node('span',p?' · '+p.name:' · Waiting…'),
    node('em',p?(p.connected?'● ONLINE':'○ OFFLINE'):'OPEN'));
   list.append(li);
  }
 }
 function renderPlayers(){
  const bar=$('ffLivePlayers');bar.replaceChildren();
  if(!match)return;
  const people=new Map(room.players.map(p=>[p.seat,p]));
  for(const c of match.countries){
   const p=people.get(c.id),lands=E.ownedCount(match,c.id);
   const tile=node('div','', 'ff-live-player'+(c.id===meSeat?' is-me':'')+
    (!p?.connected?' is-offline':'')+(!lands?' is-eliminated':''));
   const dot=node('i','', 'ff-color-dot');dot.style.background=c.color;
   tile.append(dot,node('span',c.name+' · '+(p?.name||'Player '+(c.id+1))),
    node('small',lands+' states'+(c.id===meSeat?' · YOU':'')));
   bar.append(tile);
  }
 }
 function switchViews(){
  const live=!!(room&&(room.status==='playing'||room.status==='finished')&&!showRoom);
  setup.hidden=live;matchPanel.hidden=!live;
  if(!live)drawLobby();
  else{
   put('ffMapSeed',(match?.seed||0).toString(16).slice(0,7).toUpperCase());
   render();renderPlayers();checkInterruptions();
  }
 }
 function accept(data){
  if(!data?.id||!Array.isArray(data.players))return;
  if(room?.id===data.id&&data.revision<room.revision)return;
  const newRoom=room?.id!==data.id;
  room=data;match=data.game||null;meSeat=data.meSeat;snapAt=Date.now();
  remember(data.id);
  if(newRoom){
   selectedId=null;choosingTarget=false;lastSelectorKey='';lastLogKey='';
   showRoom=false;outcomeViewed=false;modalKind='';
   council.hidden=true;endModal.hidden=true;subscribe(room.id);
  }
  if(match&&!E.getState(match,selectedId))
   selectedId=match.states.find(s=>s.owner===meSeat&&s.capital)?.id??
    match.states.find(s=>s.owner===meSeat)?.id??null;
  if(room.status==='waiting'||room.status==='cancelled')showRoom=true;
  switchViews();
 }
 async function refresh(){
  if(!uid||!room||syncing||busy||document.hidden)return;
  const id=room.id;syncing=true;
  try{
   const data=await call({operation:'sync',roomId:id});
   if(room?.id===id){accept(data);say('')}
  }catch(err){if(room?.id===id)say('Reconnecting to live match…',true)}
  finally{syncing=false}
 }
 async function issue(type,args){
  if(!room||room.status!=='playing'||!match||busy)return null;
  busy=true;
  try{
   const result=await call({operation:'command',roomId:room.id,
    command:type,args,requestId:crypto.randomUUID()});
   accept(result.snapshot);say('');return result.result;
  }catch(err){const message=normalizeError(err);setStatus(message);say(message,true);return null}
  finally{busy=false;if(match&&!matchPanel.hidden)renderSelected()}
 }
 async function createRoom(){
  if(busy||!uid)return;busy=true;
  try{
   const data=await call({operation:'create',capacity:Number(countriesSelect.value),
    fast:speedSelect.value==='fast'});
   accept(data);say('Private room created. Invite your friends.');
  }catch(err){say(normalizeError(err),true)}
  finally{busy=false}
 }
 async function joinRoom(code){
  if(busy||!uid)return;busy=true;
  try{
   const data=await call({operation:'join',code:String(code||'').trim().toUpperCase()});
   accept(data);say('Joined room '+data.code+'.');
  }catch(err){say(normalizeError(err),true)}
  finally{busy=false}
 }
 async function startRoom(){
  if(busy||!room?.isHost)return;busy=true;
  try{
   const data=await call({operation:'start',roomId:room.id});
   showRoom=false;accept(data);say('Live battle started.');
  }catch(err){say(normalizeError(err),true)}
  finally{busy=false}
 }
 async function leaveRoom(){
  if(!room||busy)return;busy=true;
  try{
   await call({operation:'leave',roomId:room.id});
   if(channel){void criloDB.removeChannel(channel);channel=null}
   room=null;match=null;selectedId=null;showRoom=true;
   council.hidden=true;endModal.hidden=true;remember(null);
   switchViews();say('You can rejoin an active match with its invite code.');
  }catch(err){say(normalizeError(err),true)}
  finally{busy=false}
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
   const c=match.countries[s.owner],p=position(s),mine=s.owner===meSeat;
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
// A small phone may scale 30 hexes to targets under 25px. The selector
 // gives the same gameplay actions without changing map size or combat rules.
 function renderStatePicker(){
  const picker=$('ffStatePicker');
  const source=E.getState(match,selectedId);
  const choices=choosingTarget&&source
   ?source.neighbors.map(id=>E.getState(match,id))
   :match.states.slice().sort((a,b)=>(a.owner===meSeat?0:1)-(b.owner===meSeat?0:1)||a.id-b.id);
  const signature=(choosingTarget?'targets:':'all:')+
   (choosingTarget?selectedId+':':'')+
   choices.map(s=>s.id+':'+s.owner).join(',');
  if(signature!==lastSelectorKey){
   lastSelectorKey=signature;
   picker.replaceChildren();
   const hint=document.createElement('option');
   hint.value='';
   hint.textContent=choosingTarget?'Choose an adjacent destination…':'Choose a state…';
   picker.appendChild(hint);
   for(const s of choices){
    const opt=document.createElement('option');
    opt.value=String(s.id);
    const nation=match.countries[s.owner].name;
    opt.textContent='State '+(s.id+1)+' · '+nation+
     (s.owner===meSeat?' (YOU)':'')+(s.capital?' · Capital':'')+
     ' · '+s.terrain;
    picker.appendChild(opt);
   }
  }
  picker.disabled=match.ended;
  picker.value=choosingTarget?'':String(selectedId??'');
 }
 function renderLegend(){
  $('ffLegend').innerHTML=match.countries.map(c=>{
   const count=E.ownedCount(match,c.id);
   return '<span class="'+(count?'':'is-eliminated')+'"><i class="ff-color-dot" style="background:'+c.color+'"></i>'+
    c.name+(c.id===meSeat?' (YOU)':'')+' · '+count+'</span>';
  }).join('');
 }
 function renderResources(){
  const res=match.countries[meSeat].resources,p=E.production(match,meSeat);
  const labels=[['food','FOOD','◈'],['metal','METAL','▣'],['oil','OIL','◆'],['knowledge','RESEARCH','✦'],['people','POPULATION','●']];
  $('ffResources').innerHTML=labels.map(([k,name,icon])=>
   '<div class="ff-resource"><div>'+icon+' '+name+'</div><strong>'+money(res[k])+'</strong><small>+'+p[k].toFixed(1)+'/min</small></div>'
  ).join('');
 }
 function renderCounters(){
  const c=match.countries[meSeat],score=E.scoreCountry(match,c);
  put('ffClock',formatSeconds(match.time));
  put('ffClockType','OF '+formatSeconds(match.limit)+(match.speed>1?' · 5× TEST':''));
  put('ffLand',score.states+' / 5 initially');
  put('ffArmy',score.troops+' troops');
  put('ffRivals',Math.max(0,E.aliveCountries(match).length-(score.states?1:0)));
  put('ffPolicy',c.policyUntil>match.time?
   E.STRATEGIES[c.policy]?.label||'None':'Not assigned');
  // Every player shares the same non-pausable war clock.
 }
 function renderSelected(){
  const state=E.getState(match,selectedId),mine=state?.owner===meSeat;
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
  const r=match.countries[meSeat].resources,blocked=!!match.pendingStrategies?.[meSeat]||match.ended||busy;
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
  const orders=match.transits.filter(t=>t.owner===meSeat);
  $('ffTransits').textContent=orders.length?
   orders.map(o=>o.troops+' troops → State '+(o.to+1)+' ('+Math.ceil(Math.max(0,o.arrival-match.time))+'s)').join('  ·  '):
   'No friendly armies on the move. Orders between adjacent states arrive after a short travel time.';
 }
 function render(){
  if(!match||matchPanel.hidden)return;
  renderCounters();renderResources();renderMap();renderStatePicker();renderLegend();renderSelected();
  renderTransits();renderLog();
 }


 function selectState(id){
  if(!match||match.ended)return;
  const state=E.getState(match,id);
  if(!state)return;
  if(choosingTarget){
   const from=E.getState(match,selectedId);
   if(!from||!from.neighbors.includes(state.id)){
    setStatus('That state is not adjacent. Choose a highlighted tile.');return;
   }
   const troops=Math.floor(Math.max(0,from.troops-5)*Number($('ffMarchAmount').value)/100);
   choosingTarget=false;lastSelectorKey='';
   setStatus('Sending '+troops+' troops to State '+(state.id+1)+'…');
   render();
   void issue('march',{from:from.id,to:state.id,troops}).then(result=>{
    if(result)setStatus('March accepted. The troops are now traveling.');
   });
   return;
  }
  selectedId=state.id;lastSelectorKey='';
  setStatus(state.owner===meSeat?'State '+(state.id+1)+' selected. Give your orders.':
   match.countries[state.owner].name+' controls this state. Invade from an adjacent state you own.');
  render();
 }
 function checkInterruptions(){
  if(!match||matchPanel.hidden)return;
  if(match.ended){
   council.hidden=true;
   if(!outcomeViewed)showOutcome();
   return;
  }
  const offered=match.pendingStrategies?.[meSeat];
  if(offered&&council.hidden)openCouncil(offered);
  if(!offered&&!council.hidden)council.hidden=true;
 }
 function openCouncil(offered){
  modalKind='council';returnedFocus=document.activeElement;
  const root=$('ffPolicyOptions');root.replaceChildren();
  for(const key of offered.options||[]){
   const policy=E.STRATEGIES[key];if(!policy)continue;
   const b=node('button');b.type='button';
   b.append(node('strong',policy.label),node('span',policy.detail));
   b.addEventListener('click',async()=>{
    b.disabled=true;
    const result=await issue('policy',{policy:key});
    if(result){
     council.hidden=true;modalKind='';
     setStatus('National directive adopted: '+policy.label+'.');
     returnedFocus?.focus?.();
     render();
    }else b.disabled=false;
   });
   root.append(b);
  }
  council.hidden=false;
  root.querySelector('button')?.focus();
 }
 function showOutcome(){
  if(!match||!match.ended)return;
  outcomeViewed=true;modalKind='finished';
  const winner=match.countries[match.winner];
  put('ffEndTitle',match.winner===meSeat?'Victory! Your nation prevailed.':
   'Campaign complete. '+(winner?.name||'No country')+' wins.');
  put('ffEndDescription',match.winner===meSeat?
   'Your planning, troop movements, and economy secured victory.':
   'One victor is decided by captured territory, surviving troops, and research.');
  const rankings=match.countries.map(c=>({c,score:E.scoreCountry(match,c)}))
   .sort((a,b)=>b.score.total-a.score.total||a.c.id-b.c.id);
  const root=$('ffFinalStandings');root.replaceChildren();
  for(let i=0;i<rankings.length;i++){
   const {c,score}=rankings[i],row=node('div');
   row.append(node('span',(i+1)+'. '+c.name+(c.id===meSeat?' (YOU)':'')),
    node('b',score.states+' states · '+score.troops+' troops'));
   root.append(row);
  }
  endModal.hidden=false;$('ffEndNew').focus();
 }
 function animateClock(){
  if(!match||matchPanel.hidden)return;
  const seconds=room?.status==='playing'&&!match.ended?
   Math.min(match.limit,match.time+Math.max(0,(Date.now()-snapAt)/1000)*match.speed):
   match.time;
  put('ffClock',formatSeconds(seconds));
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
 $('ffStatePicker').addEventListener('change',e=>{
  if(e.target.value!=='')selectState(Number(e.target.value));
 });
 $('ffCreateRoom').addEventListener('click',()=>{void createRoom()});
 $('ffJoinRoom').addEventListener('click',()=>{void joinRoom($('ffRoomCode').value)});
 $('ffRoomCode').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();void joinRoom($('ffRoomCode').value)}
 });
 $('ffStartLive').addEventListener('click',()=>{void startRoom()});
 $('ffLeaveLobby').addEventListener('click',()=>{void leaveRoom()});
 $('ffBackToRoom').addEventListener('click',()=>{showRoom=true;switchViews()});
 $('ffReturnBattle').addEventListener('click',()=>{showRoom=false;switchViews()});
 $('ffCopyInvite').addEventListener('click',async()=>{
  if(!room)return;
  try{
   await navigator.clipboard.writeText(inviteLink());
   say('Invite link copied. Send it to your friends.');
  }catch{say('Invite code: '+room.code)}
 });
 $('ffTrain').addEventListener('click',()=>{
  if(selectedId!==null)void issue('train',{stateId:selectedId}).then(result=>{
   if(result)setStatus('Recruited '+result.amount+' troops.');
  });
 });
 $('ffFortify').addEventListener('click',()=>{
  if(selectedId!==null)void issue('fortify',{stateId:selectedId}).then(result=>{
   if(result)setStatus('Fortifications improved.');
  });
 });
 $('ffMarchAmount').addEventListener('input',()=>{if(match)renderSelected()});
 $('ffMarch').addEventListener('click',()=>{
  if(!match||match.ended||busy||selectedId===null)return;
  choosingTarget=true;lastSelectorKey='';
  setStatus('Choose one adjacent highlighted state, or use the State Selector.');
  render();
 });
 $('ffCancelMarch').addEventListener('click',()=>{
  choosingTarget=false;lastSelectorKey='';
  setStatus('Move canceled.');render();
 });
 $('ffEndNew').addEventListener('click',()=>{
  endModal.hidden=true;showRoom=true;switchViews();
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});
 window.addEventListener('pagehide',()=>{
  if(channel){void criloDB.removeChannel(channel);channel=null}
 });
 function deny(message){
  uid=null;room=null;match=null;
  game.hidden=true;game.inert=true;gate.hidden=false;
  gate.textContent=message;gate.classList.add('is-denied');
  council.hidden=true;endModal.hidden=true;
 }
 async function verify(){
  const attempt=++authCount;
  if(typeof criloDB==='undefined'||!criloDB.auth?.getUser){
   deny('Crilo sign-in is unavailable. Refresh this page.');return;
  }
  try{
   const {data,error}=await criloDB.auth.getUser();
   if(attempt!==authCount)return;
   if(error||!data?.user?.id){
    deny('Sign in with a Crilo account to host or join a multiplayer room. Use the SIGN IN menu above.');
    return;
   }
   if(uid&&uid!==data.user.id){
    if(channel){void criloDB.removeChannel(channel);channel=null}
    room=null;match=null;autoJoinDone=false;
   }
   uid=data.user.id;gate.hidden=true;game.hidden=false;game.inert=false;
   gate.classList.remove('is-denied');
   switchViews();
   if(!autoJoinDone){
    autoJoinDone=true;
    const invite=new URLSearchParams(location.search).get('join');
    if(invite){$('ffRoomCode').value=invite;void joinRoom(invite)}
    else{
     const last=remembered();
     if(last){
      try{accept(await call({operation:'sync',roomId:last}))}
      catch(_){remember(null)}
     }
    }
   }
  }catch{
   if(attempt===authCount)deny('Could not verify your sign-in. Check your connection.');
  }
 }
 window.addEventListener('crilo-auth-ready',()=>{void verify()});
 if(window.Crilo?.authResolved)void verify();
 setInterval(()=>{void refresh()},3000);
 setInterval(animateClock,250);
})();
