(() => {
'use strict';
const params=new URLSearchParams(location.search);
if(params.has('new')){
 // Reuse a fully prepared, unplayed route across normal page navigation.
 let prepared=null;
 try{
  const player=localStorage.getItem('ascent.climber.v1');
  for(const key of ['ascent.next-practice.v1','ascent.next-practice.fast.v1']){
   const entry=JSON.parse(sessionStorage.getItem(key));
   if(entry?.ready&&entry.ticket===player&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(entry.seed)){
    localStorage.setItem('ascent.attempt.practice.'+entry.seed,entry.ticket);
    sessionStorage.removeItem(key);prepared=entry.seed;break;
   }
  }
 }catch{}
 params.delete('new');params.delete('archive');params.set('climb',prepared||crypto.randomUUID());
 history.replaceState(null,'','?'+params.toString());
}
const seed=params.get('climb'),archive=params.get('archive');
const custom=seed!==null, replay=archive!==null, official=!custom&&!replay;
const routeName=custom?'Generated climb':replay?'Archive climb':'Daily climb';
const scope=custom?'practice.'+seed:replay?'archive.'+archive:'daily';
const ticketKey=official?'ascent.climber.v1':'ascent.attempt.'+scope;
const syncKey=official?'ascent.last.v2':'ascent.last.'+scope;
const $=id=>document.getElementById(id);
const soundKey='ascent.sound.v1';
const scene=document.querySelector('.expedition');
const stageNames=['Trailhead','Lower slabs','The traverse','Upper face','Summit ridge'];
let state=null, mode='loading', pending=false, revealIndex=null, audio=null, sound=false, ticket=null;
let timerEnd=0, guessClockRemaining=null, waitingForReconnect=false;
let recovery=null,recoveryTimer=null,recoveryDelay=800;
let startupReading=false,startupReadId=0;
const mountain=window.Mountain;
const sum=items=>items.reduce((n,r)=>n+r.points,0);
const format=n=>Number(n).toLocaleString('en-US');
const clean=s=>s.trim().toLowerCase().replace(/[’']/g,'').replace(/[\s‐‑–—-]+/g,' ').replace(/[.!?]+$/,'').trim();
const validGuess=g=>g.length<=120&&/^[a-z0-9]+(?: [a-z0-9]+){0,15}$/.test(g);
const clueInflections=[["airplane","airplanes"],["apple","apples"],["artist","artists"],["banana","bananas"],["banjo","banjos"],["batteries","battery"],["beam","beams"],["bee","bees"],["bell","bells"],["bird","birds"],["board","boards"],["boat","boats"],["bolt","bolts"],["bone","bones"],["book","books"],["bottle","bottles"],["branch","branches"],["bridge","bridges"],["button","buttons"],["cable","cables"],["car","cars"],["card","cards"],["carpenter","carpenters"],["carrot","carrots"],["cell","cells"],["cello","cellos"],["channel","channels"],["cliff","cliffs"],["clock","clocks"],["cloud","clouds"],["clue","clues"],["coil","coils"],["coin","coins"],["computer","computers"],["container","containers"],["cup","cups"],["dentist","dentists"],["device","devices"],["diamond","diamonds"],["doctor","doctors"],["document","documents"],["door","doors"],["drum","drums"],["egg","eggs"],["engine","engines"],["equation","equations"],["fastener","fasteners"],["feather","feathers"],["fence","fences"],["file","files"],["finger","fingers"],["fish","fishes"],["floor","floors"],["flower","flowers"],["fountain","fountains"],["frame","frames"],["frequencies","frequency"],["fruit","fruits"],["garment","garments"],["glove","gloves"],["guitar","guitars"],["hammer","hammers"],["hat","hats"],["helmet","helmets"],["hive","hives"],["insect","insects"],["instrument","instruments"],["jacket","jackets"],["jar","jars"],["key","keys"],["leaf","leaves"],["letter","letters"],["lock","locks"],["magnet","magnets"],["mandolin","mandolins"],["measure","measures"],["meter","meters"],["motor","motors"],["mountain","mountains"],["muscle","muscles"],["musician","musicians"],["needle","needles"],["note","notes"],["number","numbers"],["nut","nuts"],["page","pages"],["painting","paintings"],["phone","phones"],["photograph","photographs"],["piano","pianos"],["picture","pictures"],["pipe","pipes"],["plant","plants"],["plate","plates"],["poem","poems"],["potato","potatoes"],["radish","radishes"],["reptile","reptiles"],["ring","rings"],["river","rivers"],["rock","rocks"],["roof","roofs"],["root","roots"],["rope","ropes"],["screen","screens"],["screw","screws"],["seed","seeds"],["sentence","sentences"],["ship","ships"],["shirt","shirts"],["shoe","shoes"],["shovel","shovels"],["signal","signals"],["sock","socks"],["spring","springs"],["stamp","stamps"],["stone","stones"],["string","strings"],["student","students"],["teacher","teachers"],["thread","threads"],["ticket","tickets"],["toe","toes"],["tomato","tomatoes"],["tool","tools"],["teeth","tooth"],["train","trains"],["tree","trees"],["valve","valves"],["vegetable","vegetables"],["vehicle","vehicles"],["violin","violins"],["wall","walls"],["watch","watches"],["wave","waves"],["wheel","wheels"],["window","windows"],["wing","wings"],["wire","wires"],["word","words"],["wrench","wrenches"],["zipper","zippers"]];
const compoundWords=new Map();
for(const phrase of 'air mail|air plane|air port|ball park|bar bell|bar tender|base ball|blue print|book shop|bulls eye|card board|car pool|check book|check box|check out|court room|court yard|crow bar|cup board|curve ball|data base|dead line|door knob|down load|dug out|dumb bell|ear ring|eye glasses|fast ball|finger tip|fire fighter|fire fly|fish monger|flash light|flower bed|foot ball|foot path|foot prints|gall bladder|green house|ground water|hand print|hand shake|hand writing|hard back|hard cover|honey comb|hour glass|law suit|life guard|light house|mail box|micro controller|mother board|motor way|neck wear|news paper|night life|night time|out laws|pad lock|paint brush|paper back|paper work|pass word|pay load|pea nut|play ground|ply wood|post card|post man|post mark|power house|red wood|sail boat|score board|sea bed|see saw|share holder|shoe lace|soft ball|soft ware|spread sheet|star fish|start up|store room|suit case|sun rise|sun set|surf board|tooth paste|tree top|ultra sound|under growth|upper case|volley ball|wal nut|watch dog|wood chips|work site|wrist watch|back pack|bed roll|fire wood|melt water|ice berg|check mate|end game|tight rope|handle bar|pass port|run way|taxi way|wind sock|water proof|work top|wind ward|down beat|dark room|fire place|head light|moon light|sun light|light bulb|light weight|rain coat|snow ball|water fall|door bell|sea shell|star light|sun flower|news room'.split('|')){
 const parts=phrase.split(' '),word=parts.join('');
 for(const form of [word,word+'s',word+'es'])compoundWords.set(form,parts);
}
function isDisplayedClue(guess,clues){
 const g=clean(guess).replace(/^(a|an|the) +/,'');
 if(!g)return false;
 return clues.some(clue=>{
  const label=clean(clue).replace(/[^a-z0-9]+/g,' ').trim();
  if((' '+label+' ').includes(' '+g+' '))return true;
  const words=label.split(' ').flatMap(w=>[w,...(compoundWords.get(w)||[])]);
  if(words.some(w=>w===g||(w.length>2&&g===w+'s')||(g.length>2&&w===g+'s')))return true;
  return clueInflections.some(group=>group.includes(g)&&group.includes(label.replace(/^(a|an|the) +/,'')));
 });
}
const displayWord=s=>s?s.charAt(0).toUpperCase()+s.slice(1):'';
function connectionRow(clue,raw,answer){
 const item=document.createElement('li'),heading=document.createElement('div'),label=document.createElement('strong'),reason=document.createElement('p');
 item.className='connection-row';heading.className='connection-heading';label.textContent=displayWord(clue);heading.append(label);
 const match=typeof raw==='string'?raw.match(/\s*\((\d+)% (match|similarity)\)$/):null;
 let explanation=typeof raw==='string'?raw.replace(/\s*\(\d+% (?:match|similarity)\)$/,'').trim():'';
 // Internal association weights are not calibrated confidence scores; display the reason instead.
 if(!explanation||/^Related to .+\.$/.test(explanation)||explanation==='Direct reverse association'||explanation.includes(' ↔ ')){
  explanation=answer?displayWord(answer)+' — recognized association.':'Recognized association.';
 }else if(explanation.startsWith('Related through ')){
  explanation='Shared topic: '+explanation.slice('Related through '.length)+'.';
 }
 reason.textContent=explanation;item.append(heading,reason);return item;
}
function connectionList(clues,links,answer){
 const list=document.createElement('ul');list.className='connection-list';
 for(const clue of clues)if(links&&Object.hasOwn(links,clue)&&links[clue]!=null)list.append(connectionRow(clue,links[clue],answer));
 return list;
}
const uuidTicket=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
function getTicket(){
  const saved=localStorage.getItem(ticketKey);
  if(uuidTicket(saved))return saved;
  const browserKey='ascent.climber.v1';
  // Never rotate the official identity on replay or practice navigation.
  let fresh=custom||official?localStorage.getItem(browserKey):null;
  if(!uuidTicket(fresh))fresh=crypto.randomUUID();
  if(custom||official){
   const existing=localStorage.getItem(browserKey);
   if(uuidTicket(existing))fresh=existing;
   else localStorage.setItem(browserKey,fresh);
  }
  localStorage.setItem(ticketKey,fresh);return fresh;
}
// Keep exactly one freshly generated, unplayed practice route for this tab.
// A route is marked ready only after the server confirms that it saved all five pitches.
const nextRouteKey='ascent.next-practice.v1';
let nextRouteMemory=null,nextRouteJob=null,nextRouteAttempts=0,nextRouteRetry=0,openingNext=false;
function nextRouteRead(){
 try{return JSON.parse(sessionStorage.getItem(nextRouteKey))||nextRouteMemory}catch{return nextRouteMemory}
}
function nextRouteWrite(value){
 nextRouteMemory=value;
 try{if(value)sessionStorage.setItem(nextRouteKey,JSON.stringify(value));else sessionStorage.removeItem(nextRouteKey)}catch{}
}
function nextRouteTicket(){
 const key='ascent.climber.v1';
 let id=localStorage.getItem(key);
 if(!uuidTicket(id)){id=ticket||crypto.randomUUID();localStorage.setItem(key,id)}
 return id;
}
async function generateRoute(routeSeed,routeTicket,fast=false){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),fast?22000:85000);
 try{
  const response=await fetch('https://mqozqigwkobnhijvvboy.supabase.co/functions/v1/ascent-generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed:routeSeed,ticket:routeTicket,fast}),signal:controller.signal});
  const data=await response.json();
  if(!response.ok||!data.ok){const e=new Error('Generation unavailable');e.generation=true;e.status=response.status;throw e}
  return data;
 }catch(error){error.generation=true;throw error}finally{clearTimeout(timeout)}
}
// Two unplayed routes at most: the preferred AI route and a fast local
// standby. Both are generated for this player, not taken from a fixed pool.
const standbyKey='ascent.next-practice.fast.v1';
let standbyMemory=null,standbyJob=null,standbyRetry=0,standbyAttempts=0;
function standbyRead(){
 try{return JSON.parse(sessionStorage.getItem(standbyKey))||standbyMemory}catch{return standbyMemory}
}
function standbyWrite(value){
 standbyMemory=value;
 try{if(value)sessionStorage.setItem(standbyKey,JSON.stringify(value));else sessionStorage.removeItem(standbyKey)}catch{}
}
function preparedRoute(){
 const player=nextRouteTicket();
 for(const [entry,slot] of [[nextRouteRead(),'ai'],[standbyRead(),'fast']]){
  if(entry?.ready&&entry.seed!==seed&&uuidTicket(entry.seed)&&entry.ticket===player)return {...entry,slot};
 }
 return null;
}
async function routeAlreadySaved(entry){
 try{
  const status=await window.ascentRpc('ascent_circuit',{p_ticket:entry.ticket,p_seed:entry.seed,p_action:'read'});
  return !!status&&!status.needsGeneration;
 }catch{return false}
}
function prepareStandby(){
 if(standbyJob)return standbyJob;
 const player=nextRouteTicket();
 let next=standbyRead();
 if(next?.seed===seed||!uuidTicket(next?.seed)||next.ticket!==player){
  next={seed:crypto.randomUUID(),ticket:player,ready:false};standbyWrite(next);
 }
 if(next.ready)return Promise.resolve(next);
 if(standbyAttempts>=3)return Promise.resolve(null);
 standbyAttempts++;
 standbyJob=(async()=>{
  if(!await routeAlreadySaved(next))await generateRoute(next.seed,next.ticket,true);
  const ready={...next,ready:true};standbyWrite(ready);return ready;
 })().catch(()=>{
  if(standbyAttempts<3){clearTimeout(standbyRetry);standbyRetry=setTimeout(()=>prepareStandby(),1500*standbyAttempts)}
  return null;
 }).finally(()=>{standbyJob=null});
 return standbyJob;
}
function prepareNextRoute(){
 // A quick standby is always built before a potentially slow model request.
 // The local standby remains available if AI is exhausted or still working.
 if(nextRouteJob)return nextRouteJob;
 let next=nextRouteRead();
 const player=nextRouteTicket();
 if(next?.seed===seed||!uuidTicket(next?.seed)||next.ticket!==player){
  next={seed:crypto.randomUUID(),ticket:player,ready:false};nextRouteWrite(next);
 }
 if(next.ready){void prepareStandby();return Promise.resolve(next)}
 if(nextRouteAttempts>=3){void prepareStandby();return Promise.resolve(null)}
 nextRouteAttempts++;
 nextRouteJob=(async()=>{
  await prepareStandby();
  if(!await routeAlreadySaved(next))await generateRoute(next.seed,next.ticket);
  const ready={...next,ready:true};nextRouteWrite(ready);return ready;
 })().catch(error=>{
  if(error.status!==429&&nextRouteAttempts<3){
   clearTimeout(nextRouteRetry);nextRouteRetry=setTimeout(()=>prepareNextRoute(),1500*nextRouteAttempts);
  }
  return null;
 }).finally(()=>{nextRouteJob=null});
 return nextRouteJob;
}
function openNextRoute(next){
 if(!next?.ready||!uuidTicket(next.seed)||next.seed===seed)return false;
 // Consume only the selected route, keeping the other standby for later.
 localStorage.setItem('ascent.attempt.practice.'+next.seed,next.ticket);
 if(next.slot==='fast')standbyWrite(null);else nextRouteWrite(null);
 clearTimeout(nextRouteRetry);clearTimeout(standbyRetry);
 location.assign('?climb='+encodeURIComponent(next.seed));
 return true;
}
function playAgain(event){
 if(event.button!==undefined&&event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.defaultPrevented)return;
 try{
  const ready=preparedRoute();
  if(ready&&openNextRoute(ready))event.preventDefault();
 }catch{}
 // No waiting on promises. Without a standby, native navigation takes the
 // player straight to a new page, where the fast path bypasses the AI.
}
// Use the same 22:00 UTC reset as Crilo. Keep existing Ascent date labels.
function today(date=new Date()){return new Date(date.getTime()+2*3600000).toISOString().slice(0,10)}
function nextDailyReset(date=new Date()){
 const reset=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),22));
 if(date>=reset)reset.setUTCDate(reset.getUTCDate()+1);
 return reset;
}
function resetClockText(date=new Date()){
 const seconds=Math.max(0,Math.floor((nextDailyReset(date)-date)/1000));
 return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
}
function paintResetClock(){
 $('dailyReset').hidden=!official;
 if(official){const clock=resetClockText();$('resetClock').textContent=clock;$('completeResetClock').textContent=clock;}
}
function putDate(day){if(custom){$('date').textContent='ROUTE '+seed.slice(0,8).toUpperCase();return}$('date').textContent=new Date(day+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).toUpperCase()}
function call(extra={}){
 return official?window.ascentRpc('ascent_pitch',{p_ticket:ticket,...extra}):window.ascentRpc('ascent_circuit',{p_ticket:ticket,p_seed:seed,p_archive:archive,...extra});
}
function showSoundSetting(){
 $('sound').textContent=sound?'Sound on':'Sound off';
 $('sound').setAttribute('aria-pressed',String(sound));
}
function restoreSound(){
 sound=readLocal(soundKey)===true;
 showSoundSetting();
}
function enableAudio(){
 if(!sound||audio?.state==='running')return;
 try{
  audio??=new (window.AudioContext||window.webkitAudioContext)();
  if(audio.state!=='running')audio.resume().catch(()=>{});
 }catch{}
}
function toggleSound(){
 sound=!sound;
 writeLocal(soundKey,sound);
 showSoundSetting();
 if(sound){enableAudio();tone(0)}
}
function tone(i){if(!sound||!audio)return;const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime;
 osc.type='sine';osc.frequency.value=[330,392,440,494,587,660][i%6];gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.065,t+.018);gain.gain.exponentialRampToValueAtTime(.0001,t+.24);osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+.25)}
let climbNoise=null,lastClimbContact=-Infinity;
function climbContact(){
 if(!sound||!audio||audio.state!=='running'||document.hidden)return;
 const t=audio.currentTime;
 if(t-lastClimbContact<.035)return; // Coalesce grips skipped by a slow frame.
 try{
  if(!climbNoise||climbNoise.context!==audio){
   const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*.5),audio.sampleRate);
   const data=buffer.getChannelData(0);
   for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
   climbNoise={context:audio,buffer};
  }
  lastClimbContact=t;
  const variation=.85+Math.random()*.3;
  function grain(delay,duration,frequency,volume,type,q){
   const start=t+delay, src=audio.createBufferSource(), filter=audio.createBiquadFilter(), gain=audio.createGain();
   src.buffer=climbNoise.buffer;filter.type=type;filter.frequency.value=frequency*variation;filter.Q.value=q;
   gain.gain.setValueAtTime(.0001,start);
   gain.gain.exponentialRampToValueAtTime(volume,start+.003);
   gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
   src.connect(filter);filter.connect(gain);gain.connect(audio.destination);
   src.start(start,Math.random()*.28,duration);
   src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect()};
  }
  // Chalky fingers catching rough stone, followed by a rubber shoe settling.
  grain(0,.073,1700,.24,'bandpass',.85);
  grain(.008,.037,3900,.11,'bandpass',.65);
  grain(.042,.085,420,.25,'lowpass',.65);
  grain(.045,.045,950,.10,'bandpass',.8);
 }catch{} // Audio must never interrupt a scored climb.
}
function message(s='',retry=false){$('status').textContent=s;$('retry').hidden=!retry}
// A reload can restore locked pitches immediately. Never restore an active
// timer from an old snapshot; the server remains authoritative for live play.
const viewKey='ascent.view.v1.'+scope;
function rememberView(){
 if(!state||!ticket)return;
 writeLocal(viewKey,!state.deadline&&state.history.length?{ticket,state}:null);
}
// Five locked pitches are a completed climb, even in an older saved view
// that did not include the results object. Never invent crowd statistics.
function completedView(snapshot){
 if(!snapshot||snapshot.deadline||snapshot.history?.length!==5)return snapshot;
 if(snapshot.results&&Number.isFinite(snapshot.results.score))return snapshot;
 return {...snapshot,results:{score:sum(snapshot.history),average:null,players:0},semantic:snapshot.semantic??true};
}
function cachedView(day){
 const saved=readLocal(viewKey),s=saved?.state;
 if(saved?.ticket!==ticket||s?.day!==day||s.deadline||!Array.isArray(s.history)||!s.history.length||s.history.length>5)return null;
 if(s.history.some(p=>!Array.isArray(p.clues)||!p.links||typeof p.points!=='number'))return null;
 if(s.results&&(!Number.isFinite(s.results.score)||s.history.length!==5))return null;
 return completedView(s);
}
function cache(){if(state){writeLocal(syncKey,{day:state.day,reveal:revealIndex,len:state.history.length});rememberView()}}
function matchMeter(node,clues,links,showWords=false){
 node.replaceChildren(...clues.map((clue,i)=>{
  const e=document.createElement('span');const hit=Object.hasOwn(links||{},clue);
  e.className='match-segment'+(hit?' matched':'');
  if(showWords){
   const label=document.createElement('span');label.className='match-word-label';label.textContent=clue;
   // Use the longest word, not the whole phrase, to fit the cell.
   const longest=Math.max(1,...clue.split(/\s+/).map(word=>Array.from(word).length));
   label.style.setProperty('--word-fit',(100/(.66*longest))+'cqi');
   e.append(label);
  }else e.textContent=String(i+1);
  e.title=displayWord(clue)+(hit?' — matched':' — missed');return e;
 }));
 node.setAttribute('aria-label',clues.filter(c=>Object.hasOwn(links||{},c)).length+' of '+clues.length+' matched');
}
function readLocal(key){try{return JSON.parse(localStorage.getItem(key))}catch{return null}}
function writeLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function renderClimbStats(){
 const h=state.history,score=state.results.score;
 const totalMatches=h.reduce((n,p)=>n+Object.keys(p.links).length,0);
 const perfect=h.filter(p=>Object.keys(p.links).length===6).length;
 $('matchTotal').textContent=totalMatches+'/30';$('perfectTotal').textContent=perfect+'/5';
 const key='ascent.best.'+(official?'daily.v2':replay?'archive.v1':'practice.v1');
 const id=official?state.day:replay?archive:seed;
 const old=readLocal(key)||{score:0,id:null};
 const fresh=score>old.score;const best=Math.max(score,old.score);
 if(fresh&&!h.some(p=>p.checkIncomplete))writeLocal(key,{score,id});
 $('personalBest').textContent=format(best);
 $('bestNote').textContent=h.some(p=>p.checkIncomplete)?'Some connections could not be verified yet.':(fresh||old.id===id&&score===best&&best>0)?'Personal best!':score===best?'Tied your best':' '+format(best-score)+' points from your best';
 const summary=$('pitchSummary');summary.replaceChildren(...h.map((p,i)=>{
  const row=document.createElement('div'),label=document.createElement('span'),meter=document.createElement('div'),points=document.createElement('strong');
  row.className='pitch-summary-row';label.textContent='Pitch '+(i+1);meter.className='match-meter';matchMeter(meter,p.clues,p.links,true);points.textContent=p.points+' pts';row.append(label,meter,points);return row;
 }));
}
function renderHolds(clues,record){
 const board=$('holds');
 const anchor=record?$('next'):$('guessform');
 anchor.before(board);
 board.replaceChildren(...clues.map((word,index)=>{
  const hold=document.createElement('span'),number=document.createElement('i'),label=document.createElement('span');
  const matched=record && Object.hasOwn(record.links,word);
  hold.className='hold'+(record?(matched?' hit':' miss'):'');
  number.textContent=String(index+1);
  label.textContent=word;
  hold.append(number,label);
  if(record){
   const outcome=document.createElement('small');
   outcome.textContent=matched?'Matched':record.checkIncomplete?'Unverified':'Missed';
   hold.append(outcome);
  }
  return hold;
 }));
}
// The route is drawn in score order from the trailhead to the summit.
const finishEdge=[[0,146],[90,155],[155,153],[220,166],[290,168],[360,182],[430,180],[500,192],[560,194],[635,208],[700,210],[760,223],[835,224],[900,238],[950,239],[1000,249]];
function renderFinishMap(result){
 const figure=$('finishMap'),bands=result.finishBands;
 figure.hidden=custom||!bands;
 if(figure.hidden)return;
 const counts=Array.from({length:10},(_,i)=>Number(bands[i]||0));
 const peak=Math.max(...counts),total=counts.reduce((a,b)=>a+b,0);
 if(!peak||total<10){figure.hidden=true;return}
 const range=i=>format(i*100)+'–'+format(i===9?1000:i*100+99);
 const leaders=counts.flatMap((count,i)=>count===peak?[range(i)]:[]);
 const summary=leaders.length===1
  ? 'The most common finish was '+leaders[0]+' points ('+peak+' of '+total+' climbers).'
  : leaders.length===10?'All ten score ranges tied at '+peak+' each.'
  : 'Tied for the most finishes: '+leaders.join(', ')+' points ('+peak+' in each range).';
 $('finishCaption').textContent=summary+' Longer bars mean more climbers.';
 $('finishMapDesc').textContent='Your finish: '+format(result.score)+' points. '+counts.map((n,i)=>range(i)+' points: '+n).join('. ');
 const svg=(name,attrs,label)=>{
  const node=document.createElementNS('http://www.w3.org/2000/svg',name);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
  if(label!==undefined)node.textContent=label;
  return node;
 };
 const y=score=>193-score*.168;
 function x(score){
  const i=finishEdge.findIndex(([s])=>s>=score);
  if(i===0)return finishEdge[0][1];
  const [lo,a]=finishEdge[i-1],[hi,b]=finishEdge[i];
  return a+(b-a)*(score-lo)/(hi-lo);
 }
 const ridge=finishEdge.map(([s,px])=>px+' '+y(s)).join(' L');
 $('finishSlope').setAttribute('d','M0 209 L'+ridge+' L263 37 L271 38 L286 58 L301 64 L323 97 L340 105 L360 132 V216 H0Z');
 const bars=$('finishBars');bars.replaceChildren();
 for(let i=0;i<counts.length;i++){
  if(!counts[i])continue;
  const score=i*100+50,px=x(score),py=y(score);
  const length=counts[i]/peak*104;
  bars.append(svg('rect',{x:px-length,y:py-4,width:length,height:8,rx:3,fill:counts[i]===peak?'#f5c363':'#245b55',stroke:'#29473f','stroke-width':.8}));
  bars.append(svg('text',{x:px-length-5,y:py+4,'text-anchor':'end',fill:'#153d35',stroke:'#d2dfd7','stroke-width':2.5,'paint-order':'stroke'},String(counts[i])));
 }
 const score=Math.max(0,Math.min(1000,result.score)),px=x(score),py=y(score);
 $('finishPin').replaceChildren(
  svg('line',{x1:px,y1:py,x2:266,y2:py,stroke:'#382b25','stroke-width':2}),
  svg('circle',{cx:px,cy:py,r:4.5,fill:'#ce503c',stroke:'#fff0d8','stroke-width':2}),
  svg('rect',{x:265,y:py-10,width:86,height:20,rx:10,fill:'#3c312d'}),
  svg('text',{x:308,y:py+4,'text-anchor':'middle',fill:'#fff3d8'},'You · '+format(score))
 );
}
// Verification is the game's responsibility, not the player's. Reconsider
// incomplete original guesses once per completed climb view, without blocking
// the results or changing an answer. The server alone awards any extra points.
const automaticReviewAttempts=new Set();
let automaticReviewJob=null;
function verifyCompletedClimb(){
 if(startupReading||automaticReviewJob||mode!=='results'||!state?.results||document.hidden)return;
 const snapshot=state, day=snapshot.day;
 const candidates=snapshot.history.map((pitch,index)=>({pitch,index,key:[day,scope,index,pitch.guess].join('|')}))
  .filter(x=>x.pitch.checkIncomplete&&x.pitch.guess&&!automaticReviewAttempts.has(x.key));
 if(!candidates.length)return;
 automaticReviewJob=(async()=>{
  let changed=false;
  for(const {pitch,index,key} of candidates){
   if(state!==snapshot||mode!=='results')break;
   automaticReviewAttempts.add(key);
   try{
    const result=await call({p_action:'recheck_pitch',p_day:day,p_round:index+1});
    if(state!==snapshot||mode!=='results')break;
    if(!result?.record||result.record.guess!==pitch.guess||!Number.isFinite(result.total))continue;
    if(JSON.stringify(result.record)!==JSON.stringify(snapshot.history[index])||snapshot.results.score!==result.total){
     snapshot.history[index]=result.record;snapshot.results.score=result.total;changed=true;
    }
   }catch{}
  }
  if(changed&&state===snapshot&&mode==='results'){render();try{cache()}catch{}}
 })().finally(()=>{automaticReviewJob=null});
}
function originalConnections(pitch){
 const section=document.createElement('section'),head=document.createElement('h3');
 section.className='original-connections';head.className='answer-tier-heading';
 head.textContent=pitch.guess?'Your connections · '+displayWord(pitch.guess):'Your connections';
 section.append(head);
 const list=document.createElement('ul');list.className='connection-list';
 for(const clue of pitch.clues){
  if(Object.hasOwn(pitch.links||{},clue)&&pitch.links[clue]!=null){
   const row=connectionRow(clue,pitch.links[clue],pitch.guess);
   row.classList.add('review-matched');list.append(row);
  }else{
   const row=connectionRow(clue,pitch.checkIncomplete&&pitch.guess?'Not yet verified.':'Not matched.',pitch.guess);
   row.classList.add('review-unmatched');list.append(row);
  }
 }
 section.append(list);return section;
}
// Load only locked pitches, while the climb continues. Opening a review
// never starts a request; the original and intended connections are local.
const reviewCatalog=new Map(),reviewRequests=new Map(),reviewFailures=new Map();
function reviewCatalogKey(day,index){return [scope,ticket,day,index].join('|')}
const catalogStore='ascent.answer-catalog.v2.';
function savedReviewCatalog(day,index){
 const key=reviewCatalogKey(day,index);
 if(reviewCatalog.has(key))return reviewCatalog.get(key);
 const saved=readLocal(catalogStore+key);
 if(Array.isArray(saved)&&saved.length&&saved.every(a=>typeof a.word==='string'&&Number.isInteger(a.hits)&&a.hits>=1&&a.hits<=6&&Number.isFinite(a.points))){
  reviewCatalog.set(key,saved);return saved;
 }
 return [];
}
function storeReviewCatalog(day,index,answers){
 const key=reviewCatalogKey(day,index);
 reviewCatalog.set(key,answers);
 // Keep only a small rolling collection of locked-pitch catalogs.
 try{
  const keys=Object.keys(localStorage).filter(k=>k.startsWith(catalogStore));
  while(keys.length>=25){const old=keys.shift();if(old!==catalogStore+key)localStorage.removeItem(old)}
  writeLocal(catalogStore+key,answers);
 }catch{}
}

function primeAnswerReviews(snapshot){
 if(!snapshot?.history?.length||!ticket)return;
 const day=snapshot.day,owner=ticket;
 snapshot.history.forEach((pitch,index)=>{
  const key=reviewCatalogKey(day,index);
  if(savedReviewCatalog(day,index).length||reviewRequests.has(key)||(reviewFailures.get(key)||0)>Date.now())return;
  const job=window.ascentRpc('ascent_top_answers',{p_ticket:owner,p_day:day,p_archive:archive,p_seed:seed,p_pitch:index+1})
   .then(answers=>{
    if(!Array.isArray(answers)||!answers.length)throw Error('Unavailable');
    storeReviewCatalog(day,index,answers);
    if(mode==='results'&&state?.day===day&&ticket===owner){
     const body=$('answerReview').children[index]?.querySelector('.review-alternatives');
     if(body&&state.history[index])renderAlternatives(state.history[index],body,answers);
    }
   }).catch(()=>{reviewFailures.set(key,Date.now()+5000);if(mode==='results'&&state?.day===day&&ticket===owner)setTimeout(()=>{if(mode==='results'&&state?.day===day&&ticket===owner&&!document.hidden)primeAnswerReviews(state)},5100)})
   .finally(()=>reviewRequests.delete(key));
  reviewRequests.set(key,job);
 });
}
function renderAlternatives(pitch,container,answers=[]){
 const groups=document.createElement('div');groups.className='answer-groups';
 const byWord=new Map();
 for(const answer of answers)if(answer?.word)byWord.set(answer.word.toLowerCase(),answer);
 const add=(word,links,points)=>{
  if(!word||!links)return;
  const hits=Object.keys(links).length;if(!hits)return;
  const pairs=[0,1,2].filter(i=>Object.hasOwn(links,pitch.clues[i])&&Object.hasOwn(links,pitch.clues[i+3])).length;
  byWord.set(word.toLowerCase(),{word,hits,points:points??(hits===6?200:10*(hits*(hits+1)/2+pairs)),links});
 };
 add(pitch.target,pitch.solution);
 add(pitch.guess,pitch.links,pitch.points);
 const candidates=[...byWord.values()].sort((x,y)=>y.points-x.points||x.word.localeCompare(y.word));
 const more=document.createElement('details'),moreSummary=document.createElement('summary'),moreTitle=document.createElement('strong'),moreCount=document.createElement('span'),partialGroups=document.createElement('div');
 more.className='more-answer-words';partialGroups.className='answer-groups';moreTitle.textContent='Other possible answers';
 more.open=container.querySelector('.more-answer-words')?.open===true;
 moreSummary.append(moreTitle,moreCount);more.append(moreSummary,partialGroups);
 let partialCount=0;
 for(let hits=6;hits>=1;hits--){
  const matching=candidates.filter(answer=>answer.hits===hits&&!isDisplayedClue(answer.word,pitch.clues));if(!matching.length)continue;
  const tier=document.createElement('section'),head=document.createElement('h3');
  head.className='answer-tier-heading';head.textContent=hits+'/6 matches';tier.append(head);
  for(const answer of matching){
   const row=document.createElement('div'),title=document.createElement('strong'),score=document.createElement('span');
   row.className='answer-entry answer-word-row';row.dataset.word=answer.word.toLowerCase();
   title.textContent=displayWord(answer.word);score.textContent=answer.points+' pts';
   row.append(title,score);tier.append(row);
  }
  if(hits===6)groups.append(tier);
  else{partialGroups.append(tier);partialCount+=matching.length}
 }
 if(partialCount){moreCount.textContent=String(partialCount);groups.append(more)}
 container.replaceChildren();
 if(groups.children.length)container.append(groups);
}
function renderAnswerReview(){
 const review=$('answerReview'),day=state.day;
 const key=JSON.stringify([day,state.history.map(p=>[p.guess,p.points,p.links,p.checkIncomplete,p.solution])]);
 if(review.dataset.key===key)return;
 const open=review.dataset.day===day?new Set([...review.children].map((node,i)=>node.open?i:-1)):new Set();
 review.dataset.day=day;review.dataset.key=key;review.replaceChildren();
 state.history.forEach((pitch,index)=>{
  const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');
  const title=document.createElement('strong'),detail=document.createElement('small'),score=document.createElement('span');
  title.textContent='Pitch '+(index+1)+' · '+(pitch.guess||'Time expired');
  detail.textContent='Answers by number of matches';
  score.textContent=Object.keys(pitch.links||{}).length+'/6 · '+pitch.points+' pts';
  summary.append(title,score,detail);body.className='answer-body';
  const clues=document.createElement('ul');clues.className='answer-matched-words';clues.setAttribute('aria-label','Pitch clue words');
  for(const clue of pitch.clues){
   const word=document.createElement('li');word.textContent=displayWord(clue);clues.append(word);
  }
  const alternatives=document.createElement('div');alternatives.className='review-alternatives';
  renderAlternatives(pitch,alternatives,savedReviewCatalog(day,index));
  body.append(clues,alternatives);
  details.append(summary,body);review.append(details);
  if(open.has(index))details.open=true;
 });
}
function render(){
 const h=state.history,finished=!!state.results&&revealIndex===null,shown=revealIndex!==null?h[revealIndex]:null;
 const idx=shown?revealIndex:Math.min(h.length,4);
 mode=finished?'results':shown?'reveal':state.deadline?'play':'ready';
 scene.dataset.phase=mode;
 document.querySelector('.expedition .card').inert=false;
 $('readyRule').textContent=state.semantic?'Connect six clues with a word or phrase. The first pitch gives you 20 seconds.':'This climb uses the original word-pair rules. You have 20 seconds once you start.';
 if(official)$('readyRule').textContent+=' One official attempt per day.';
 $('themeTry').hidden=state.semantic;
 $('generate').textContent='Practice climb ↗';
 $('intro').textContent=state.semantic?'Find the idea that connects the clues. A related word or phrase can earn partial credit.':'Find one word that forms a familiar word or phrase with as many clues as possible. Try it on either side.';
 $('guideRule').textContent=state.semantic?'Find the idea behind the six clues. For example, aperture, shutter and portrait all point to photography. Use one idea, even if it takes several words. A related guess earns credit for the clues it fits.':'Find one word that forms a familiar phrase with as many clues as possible, in either order.';
 $('ready').hidden=mode!=='ready';$('start').disabled=false;putDate(state.day);message();
 $('play').hidden=mode!=='play';$('reveal').hidden=mode!=='reveal';$('results').hidden=!finished;
 $('roundCount').textContent=String(idx+1).padStart(2,'0')+' / 05';
 $('stage').textContent=finished?'Expedition complete':'Pitch '+(idx+1)+' · '+stageNames[idx];
 if(mode==='play'&&state.contexts)$('stage').textContent+=' · '+state.contexts+(state.contexts===1?' context':' contexts');
 $('mapnote').textContent=finished?'EXPEDITION VIEW':'ROUTE VIEW';
 $('progress').replaceChildren(...Array.from({length:5},(_,i)=>{const e=document.createElement('i');e.className=i<h.length?'done':i===idx?'current':'';return e}));
 $('footerStatus').textContent=h.length+' of 5 pitches complete';
 if(finished){$('completeTitle').textContent=official?'Daily complete.':'Climb complete.';$('dailyCompleteNote').hidden=!official;$('freshClimb').firstChild.textContent=official?'Play a practice climb ': 'Play again ';renderFinishMap(state.results);renderClimbStats();renderAnswerReview();verifyCompletedClimb();$('holds').replaceChildren();mountain.finish(state.results.score,state.results.average);$('again').hidden=!replay;$('total').textContent=format(state.results.score);$('average').parentElement.hidden=custom||!state.results.players;$('average').textContent=state.results.average==null?'—':format(state.results.average);
 $('finishers').textContent=custom?'Practice score':replay?(state.results.players?format(state.results.players)+' original daily finishers':'No recorded finishers on the original day.'):state.results.players===1?'You’re today’s first finisher.':format(state.results.players)+' completed climbs';
 return}
 const clues=shown?shown.clues:(state.clues||[]);renderHolds(clues,shown);mountain.set(sum(h));
 if(shown){matchMeter($('revealMeter'),clues,shown.links);$('revealPoints').textContent='+'+shown.points+' pts';$('runningTotal').textContent=format(sum(h))+' pts';let count=Object.keys(shown.links).length;$('hitTitle').textContent=shown.timedOut?'Time’s up.':count===6?'Perfect pitch.':count===5?'One away!':count===4?'Strong connection.':count+' of 6 matched.'; $('reveal').dataset.hits=String(count);
 $('hitCopy').textContent=shown.timedOut?'The clock ran out. This pitch earns zero points.':count?'“'+shown.guess+'” earned '+shown.points+' points.'+(shown.autoSubmitted?' Automatically submitted when time ran out.':''):shown.autoSubmitted?'“'+shown.guess+'” was automatically submitted. No recognized connections this round.':'No recorded links for “'+shown.guess.toUpperCase()+'” on this pitch.';
 if(shown.checkIncomplete)$('hitCopy').textContent+=' Some connections remain unverified.';
 $('next').textContent=idx===4?'See my climb ↗':'Next pitch ↗';
 }else if(mode==='play'){$('guess').disabled=false;$('guess').readOnly=false;$('lock').disabled=false;paintClock()}
}
function paintClock(){
 if(mode!=='play')return;
 const ms=guessClockRemaining===null?Math.max(0,timerEnd-performance.now()):guessClockRemaining, sec=Math.ceil(ms/1000);
 $('seconds').textContent=sec+'s';$('clockbar').max=state.pitchSeconds||20;$('clockbar').value=ms/1000;$('clock').classList.toggle('urgent',sec<=5);
 if(ms===0&&!pending&&!waitingForReconnect)finishAtDeadline();
}
setInterval(paintClock,100);
paintResetClock();setInterval(paintResetClock,1000);
function displayResponse(next,previous,action){
 next=completedView(next);
 guessClockRemaining=null;
 const sameDay=previous?.day===next.day;
 const advanced=!!previous&&sameDay&&next.history.length>previous.history.length;
 const estimatedEnd=next.deadline?performance.now()+Math.max(0,Date.parse(next.deadline)-Date.parse(next.serverTime)):0;
 timerEnd=next.deadline && next.deadline===previous?.deadline ? Math.min(timerEnd,estimatedEnd) : estimatedEnd;
 const wasPlaying=mode==='play';
 state=next;waitingForReconnect=false;
 // Show the last pitch only when it finishes during this live play session.
 // A read/refresh of an already completed climb must go straight to results.
 if(next.deadline){revealIndex=null}
 else if(next.results&&!(advanced&&wasPlaying)){revealIndex=null}
 else if(advanced){revealIndex=next.history.length-1}
 else if(next.results){revealIndex=null}
 else {revealIndex=next.history.length?next.history.length-1:null}
 rememberView();
 if(!sameDay||advanced||action==='start'){$('guess').value='';$('guess').removeAttribute('aria-invalid')}
 if(advanced && revealIndex!==null && !next.deadline && !next.history[revealIndex].timedOut && mode==='play' && (action==='guess'||action==='auto_guess') && Object.keys(next.history[revealIndex].links).length>0){
  const row=next.history[revealIndex], count=Object.keys(row.links).length;
  mode='animating';scene.dataset.phase=mode;$('guess').blur();
  scene.querySelector('.card').inert=true;message('Climbing…');let complete=false;
  const end=()=>{if(complete)return;complete=true;render();$('next').focus({preventScroll:true})};
  const matched=row.clues.filter(word=>word in row.links);
  $('gripWord').textContent='';$('gripCount').textContent='';
  const onGrip=index=>{
   if(complete || !matched[index])return;
   $('gripCount').textContent='Match '+(index+1)+' of '+count;
   $('gripWord').textContent=matched[index];
   climbContact();
  };
  mountain.climb(sum(previous.history),sum(next.history),count,end,onGrip);
  setTimeout(end,1400);
 }else{
  render();
  if(next.rejected){rejectGuess(next.checkIncomplete?'Couldn’t verify every connection. Try your guess again or try another word.':'No recognized connection. Try another word or phrase.')}
  else if(mode==='play' && action==='start')$('guess').focus({preventScroll:true});
 }
}
function scheduleRecovery(){
 clearTimeout(recoveryTimer);
 recoveryTimer=setTimeout(()=>{if(!pending&&mode!=='animating'&&recovery)requestPitch(recovery.action,recovery.guess,true)},recoveryDelay);
 recoveryDelay=Math.min(15000,recoveryDelay*2);
}
let currentRouteWarm=null;
function warmCurrentPractice(){
 if(currentRouteWarm)return currentRouteWarm;
 currentRouteWarm=generateRoute(seed,ticket,true).then(()=>{
  if(!document.hidden)void prepareNextRoute();
 }).catch(()=>{}).finally(()=>{currentRouteWarm=null});
 return currentRouteWarm;
}
function prepareAfterResponse(next){
 primeAnswerReviews(next);
 if(!document.hidden){
  if(custom&&next.needsGeneration)warmCurrentPractice();
  else void prepareNextRoute();
 }
}
function bootstrap(){
 ticket=getTicket();
 const day=archive||today();
 const saved=cachedView(day);
 // Render synchronously before making any network request. Start is usable
 // even when the initial status request has not returned.
 state=saved||{day,history:[],deadline:null,pitchSeconds:20,semantic:!replay,fullBank:true};
 revealIndex=saved&&!saved.results&&saved.history.length<5?saved.history.length-1:null;
 startupReading=true;
 render();
 const id=++startupReadId;
 void (async()=>{
  try{
   const next=await call({p_action:'read',p_day:null,p_round:null,p_guess:null});
   if(id!==startupReadId||pending)return;
   startupReading=false;
   displayResponse(next,null,'read');
   rememberView();
   prepareAfterResponse(next);
  }catch{
   // A slow/failed status check must not block Begin ascent. A click sends
   // a normal server-authoritative start request, including for existing runs.
   if(id===startupReadId&&!pending){
    startupReading=false;
    if(mode==='ready')message('Connection unavailable. Press Begin ascent to retry.');
   }
  }finally{if(id===startupReadId)startupReading=false}
 })();
}
async function requestPitch(action='read',guess=null,retrying=false){
 if(pending||mode==='animating')return;
 if(recovery&&!retrying)return connect();
 ++startupReadId;startupReading=false; // Ignore any older status response.
 const prev=state;
 const args=retrying&&recovery?recovery.args:{p_action:action,p_day:prev?.day||null,p_round:prev?prev.history.length+1:null,p_guess:guess};
 pending=true;
 if(action==='guess'&&mode==='play'&&prev?.deadline){guessClockRemaining=Math.max(0,timerEnd-performance.now());paintClock()}
 clearTimeout(recoveryTimer);$('start').disabled=true;$('next').disabled=true;$('lock').disabled=true;$('guess').readOnly=true;
 try{
  ticket??=getTicket();
  const next=await call(args);
  recovery=null;recoveryDelay=800;waitingForReconnect=false;
  // A cold route still has a fully usable ready screen. Never await generation
  // on the initial read. Start can create the same seed server-side if necessary.
  displayResponse(next,prev,action);
  rememberView();
  prepareAfterResponse(next);
  if(action!=='read'&&(!prev||next.history.length!==prev.history.length||next.deadline!==prev.deadline)){try{cache()}catch{}}
 }catch(error){
  guessClockRemaining=null;
  waitingForReconnect=true;recovery={action,guess,args};
  
  message(guess?'Reconnecting automatically… Keeping your answer.':'Reconnecting automatically…',true);
  if(!error.status||error.status===408||error.status===429||error.status>=500)scheduleRecovery();else message('Unable to load this climb. Try again.',true);
 }finally{pending=false;$('next').disabled=false}
}
function finishAtDeadline(){
 if(pending||mode!=='play'||waitingForReconnect)return;
 const guess=clean($('guess').value);
 if(guess&&validGuess(guess)&&!isDisplayedClue(guess,state.clues)){message('Time’s up — submitting your answer…');return requestPitch('auto_guess',guess)}
 return requestPitch('read');
}
function connect(){
 if(pending||startupReading)return;
 if(recovery){clearTimeout(recoveryTimer);return requestPitch(recovery.action,recovery.guess,true)}
 return mode==='play'&&performance.now()>=timerEnd?finishAtDeadline():requestPitch('read')
}
window.addEventListener('online',()=>{if(recovery)connect()});
function rejectGuess(reason){
 const input=$('guess');
 message(reason);
 input.setAttribute('aria-invalid','true');
 input.focus({preventScroll:true});
 input.select();
 input.classList.remove('guess-rejected');
 void input.offsetWidth;
 input.classList.add('guess-rejected');
}
$('guess').addEventListener('animationend',()=> $('guess').classList.remove('guess-rejected'));
$('guess').addEventListener('input',()=> $('guess').removeAttribute('aria-invalid'));
function submit(e){
 e.preventDefault();if(pending||mode!=='play'||waitingForReconnect)return;
 if(performance.now()>=timerEnd){finishAtDeadline();return}
 const g=clean($('guess').value);
 if(isDisplayedClue(g,state.clues)){rejectGuess('That word is already in a clue. Try a different connection.');return}
 if(!validGuess(g)){rejectGuess('Enter one idea, up to 120 characters, rather than a list of guesses.');return}
 message();requestPitch('guess',g);
}
$('guess').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('guessform').requestSubmit()}});
$('guide').onclick=()=>$('manual').showModal();$('close').onclick=$('understood').onclick=()=>$('manual').close();
$('manual').addEventListener('click',e=>{if(e.target===$('manual')){const r=$('manual').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('manual').close()}});
$('routeLink').addEventListener('click',()=>document.querySelector('.route-menu').open=false);
document.addEventListener('click',e=>{if(!e.target.closest('.route-menu'))document.querySelector('.route-menu').open=false});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('.route-menu').open=false});
restoreSound();
// Each new document needs a user gesture to unlock its own audio context.
document.addEventListener('click',enableAudio,true);
document.addEventListener('keydown',enableAudio,true);
window.addEventListener('pageshow',e=>{if(e.persisted)restoreSound()});
window.addEventListener('storage',e=>{if(e.key===soundKey||e.key===null)restoreSound()});
$('sound').onclick=toggleSound;$('guessform').onsubmit=submit;$('retry').onclick=connect;
$('start').onclick=()=>requestPitch('start');
$('next').onclick=()=>{if(state.results){revealIndex=null;rememberView();render()}else requestPitch('start')};
$('share').onclick=async()=>{const h=state.history;const result='Ascent · '+(custom?'Custom '+seed.slice(0,8):replay?'Archive '+archive:state.day)+'\n'+format(state.results.score)+' pts\n'+h.map(r=>Object.keys(r.links).length+'/6').join(' · ');try{await navigator.clipboard.writeText(result);message('Result copied.')}catch{message(result)}};
function refresh(){if(document.hidden||pending||startupReading||automaticReviewJob||mode==='animating')return;if(recovery){connect();return;}if((official&&state?.day!==today())||mode==='results'||mode==='play')connect()}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});setInterval(refresh,60000);
window.addEventListener('storage',e=>{if(e.key===syncKey&&!document.hidden&&!pending&&mode!=='animating')connect()});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const valid=!(custom&&replay)&&(!custom||uuid.test(seed))&&(!replay||(/^\d{4}-\d{2}-\d{2}$/.test(archive)&&archive>='2026-11-24'&&archive<today()));
if(!valid){$('start').disabled=true;message('This route is unavailable. Choose Today, Archive, or Generate a climb.');return}
if(!official){
 document.title=routeName+' · Ascent';document.querySelector('.headline h1').textContent=custom?'Practice ascent':'Archive ascent';
 document.querySelector('.headline .eyebrow').textContent=custom?'PRACTICE CIRCUIT':'DAILY ARCHIVE';
 $('avgLabel').textContent='Original daily average';
}else $('dailyLink').setAttribute('aria-current','page');
if(replay)$('archiveLink').setAttribute('aria-current','page');
$('again').onclick=()=>{if(!replay)return;localStorage.setItem(ticketKey,crypto.randomUUID());location.reload()};
$('routeLink').hidden=!custom;
$('routeLink').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);message('Climb link copied.')}catch{message(location.href)}};
// Routes must always navigate immediately. Use a prepared fresh route when one
// exists, but never hold the menu open waiting for an AI request or quota.
function openPracticeFromRoutes(event){playAgain(event)}
$('generate').addEventListener('click',openPracticeFromRoutes);
for(const link of document.querySelectorAll('a[href="?new=1"]:not(#generate)'))link.addEventListener('click',playAgain);
putDate(archive||today());mountain.init($('view'));
// Initial read is non-blocking. Practice prefetch starts after the status or
// first start response, not in competition with the initial daily lookup.
bootstrap();
})();