(() => {
'use strict';
const params=new URLSearchParams(location.search);
if(params.has('new')){
 params.delete('new');params.delete('archive');params.set('climb',crypto.randomUUID());
 history.replaceState(null,'','?'+params.toString());
}
const seed=params.get('climb'),archive=params.get('archive');
const custom=seed!==null, replay=archive!==null, official=!custom&&!replay;
const routeName=custom?'Generated climb':replay?'Archive climb':'Daily climb';
const scope=custom?'practice.'+seed:replay?'archive.'+archive:'daily';
const ticketKey=official?'ascent.climber.v1':'ascent.attempt.'+scope;
const syncKey=official?'ascent.last.v2':'ascent.last.'+scope;
const $=id=>document.getElementById(id);
const scene=document.querySelector('.expedition');
const stageNames=['Trailhead','Lower slabs','The traverse','Upper face','Summit ridge'];
let state=null, mode='loading', pending=false, revealIndex=null, audio=null, sound=false, ticket=null;
let timerEnd=0, waitingForReconnect=false, practiceBest=null, practiceAttempts=0;
let recovery=null,recoveryTimer=null,recoveryDelay=800;
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
function renderReport(clues,links,guess){
 const panel=$('reportConnection'),list=$('reportClues'),status=$('reportStatus');
 const missing=clues.filter(c=>!Object.hasOwn(links||{},c));
 panel.open=false;panel.hidden=!guess||!missing.length;list.replaceChildren();status.textContent='';
 $('reportAnswer').textContent=guess?'Which clue should “'+guess+'” also match?':'';
 if(panel.hidden)return;
 const pitch=revealIndex+1,day=state.day;
 for(const clue of missing){
  const b=document.createElement('button');b.type='button';b.className='secondary report-clue';b.textContent=displayWord(clue);
  b.onclick=async()=>{b.disabled=true;status.textContent='Sending…';try{
   const result=await window.ascentRpc('ascent_report_connection',{p_ticket:ticket,p_day:day,p_round:pitch,p_guess:guess,p_clue:clue,p_archive:archive,p_seed:seed});
   if(!b.isConnected)return;
   if(result.ok){b.textContent=displayWord(clue)+' ✓';status.textContent='Reported for review. Your score is unchanged.';}
   else{b.disabled=false;status.textContent=result.limited?'Report limit reached for today.':'This connection could not be reported.';}
  }catch{if(b.isConnected){b.disabled=false;status.textContent='Could not send. Try again.'}}};
  list.append(b);
 }
}
function connectionList(clues,links,answer){
 const list=document.createElement('ul');list.className='connection-list';
 for(const clue of clues)if(links&&Object.hasOwn(links,clue)&&links[clue]!=null)list.append(connectionRow(clue,links[clue],answer));
 return list;
}
const uuidTicket=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
function getTicket(){
  const saved=localStorage.getItem(ticketKey);
  if(saved && /^[a-f0-9-]{36}$/i.test(saved))return saved;
  // Share an anonymous ticket across new generated climbs so the server can
  // avoid previously seen clues. Existing route tickets and replays stay intact.
  const browserKey='ascent.climber.v1';
  let fresh=custom?localStorage.getItem(browserKey):null;
  if(!fresh||!uuidTicket(fresh))fresh=crypto.randomUUID();
  if(custom&&!uuidTicket(localStorage.getItem(browserKey)))localStorage.setItem(browserKey,fresh);
  localStorage.setItem(ticketKey,fresh);return fresh;
}
function localDay(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(p=>['year','month','day'].includes(p.type)).reduce((o,p)=>(o[p.type]=p.value,o),{});
}
function today(){const d=localDay();return [d.year,d.month,d.day].join('-')}
function putDate(day){if(custom){$('date').textContent='ROUTE '+seed.slice(0,8).toUpperCase();return}$('date').textContent=new Date(day+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).toUpperCase()}
function call(extra={}){
 return official?window.ascentRpc('ascent_pitch',{p_ticket:ticket,...extra}):window.ascentRpc('ascent_circuit',{p_ticket:ticket,p_seed:seed,p_archive:archive,...extra});
}
function toggleSound(){
 sound=!sound;
 try{if(sound){audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{})}}
 catch{sound=false}
 $('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound));
 if(sound)tone(0);
}
function tone(i){if(!sound||!audio)return;const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime;
 osc.type='sine';osc.frequency.value=[330,392,440,494,587,660][i%6];gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.065,t+.018);gain.gain.exponentialRampToValueAtTime(.0001,t+.24);osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+.25)}
function message(s='',retry=false){$('status').textContent=s;$('retry').hidden=!retry}
function cache(){if(state)writeLocal(syncKey,{day:state.day,reveal:revealIndex,len:state.history.length})}
function matchMeter(node,clues,links){
 node.replaceChildren(...clues.map((clue,i)=>{
  const e=document.createElement('span');const hit=Object.hasOwn(links||{},clue);
  e.className='match-segment'+(hit?' matched':'');e.textContent=String(i+1);e.title=displayWord(clue)+(hit?' — matched':' — missed');return e;
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
 if(fresh)writeLocal(key,{score,id});
 $('personalBest').textContent=format(best);
 $('bestNote').textContent=(fresh||old.id===id&&score===best&&best>0)?'Personal best!':score===best?'Tied your best':' '+format(best-score)+' points from your best';
 const summary=$('pitchSummary');summary.replaceChildren(...h.map((p,i)=>{
  const row=document.createElement('div'),label=document.createElement('span'),meter=document.createElement('div'),points=document.createElement('strong');
  row.className='pitch-summary-row';label.textContent='Pitch '+(i+1);meter.className='match-meter';matchMeter(meter,p.clues,p.links);points.textContent=p.points+' pts';row.append(label,meter,points);return row;
 }));
}
function renderHolds(clues,record){
 const board=$('holds');
 const anchor=record?$('links'):$('guessform');
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
   outcome.textContent=matched?'Matched':'Missed';
   hold.append(outcome);
  }
  return hold;
 }));
}
function renderAnswerReview(){
 const review=$('answerReview');
 const key=state.day;
 if(review.dataset.day===key)return;
 review.dataset.day=key;
 review.replaceChildren();
 state.history.forEach((pitch,index)=>{
  const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');
  const title=document.createElement('strong'),detail=document.createElement('small'),score=document.createElement('span');
  title.textContent='Pitch '+(index+1)+' · '+(pitch.guess||'Time expired');
  detail.textContent='Answers by number of matches';
  score.textContent=Object.keys(pitch.links).length+'/6 · '+pitch.points+' pts';
  summary.append(title,score,detail);
  body.className='answer-body';
  details.append(summary,body);review.append(details);
  details.addEventListener('toggle',async()=>{
   if(!details.open||body.dataset.loaded)return;
   body.dataset.loaded='pending';body.textContent='Loading answers…';
   try{
    const answers=await window.ascentRpc('ascent_top_answers',{p_ticket:ticket,p_day:key,p_archive:archive,p_seed:seed,p_pitch:index+1});
    const playedHits=Object.keys(pitch.links||{}).length;
    // A dynamically inferred answer may not be in the precomputed answer bank.
    if(playedHits&&pitch.guess&&!answers.some(a=>a.word.toLowerCase()===pitch.guess.toLowerCase()&&a.hits===playedHits))answers.unshift({word:pitch.guess,hits:playedHits,points:pitch.points,links:pitch.links});
    if(!answers.length)throw new Error('Unavailable');
    const groups=document.createElement('div');groups.className='answer-groups';
    for(let hits=6;hits>=1;hits--){
     const matching=answers.filter(a=>a.hits===hits&&!isDisplayedClue(a.word,pitch.clues));if(!matching.length)continue;
     const tier=document.createElement('section'),head=document.createElement('h3');
     head.className='answer-tier-heading';head.textContent=hits+'/6 matches';tier.append(head);
     for(const answer of matching){
      const row=document.createElement('details'),summary=document.createElement('summary'),title=document.createElement('strong'),score=document.createElement('span');
      row.className='answer-entry';title.textContent=displayWord(answer.word);score.textContent=answer.points+' pts';summary.append(title,score);
      row.append(summary,connectionList(pitch.clues,answer.links,answer.word));tier.append(row);
     }
     groups.append(tier);
    }
    body.replaceChildren(groups);body.dataset.loaded='yes';
   }catch{delete body.dataset.loaded;body.textContent='Couldn’t load answers. Close and reopen this pitch to retry.'}
  });
 });
}
function render(){
 const h=state.history,finished=!!state.results&&revealIndex===null,shown=revealIndex!==null?h[revealIndex]:null;
 const idx=shown?revealIndex:Math.min(h.length,4);
 mode=finished?'results':shown?'reveal':state.deadline?'play':'ready';
 scene.dataset.phase=mode;
 document.querySelector('.expedition .card').inert=false;
 $('readyRule').textContent=state.semantic?'Connect six clues with a word or phrase. The first pitch gives you 20 seconds.':'This climb uses the original word-pair rules. You have 20 seconds once you start.';
 $('themeTry').hidden=state.semantic;
 $('generate').textContent='Practice climb ↗';
 $('intro').textContent=state.semantic?'Find the idea that connects the clues. A related word or phrase can earn partial credit.':'Find one word that forms a familiar word or phrase with as many clues as possible. Try it on either side.';
 $('guideRule').textContent=state.semantic?'Find the idea behind the six clues. For example, aperture, shutter and portrait all point to photography. Use one idea, even if it takes several words. A related guess earns credit for the clues it fits.':'Find one word that forms a familiar phrase with as many clues as possible, in either order.';
 $('sol').querySelector('summary').textContent=state.semantic?'Explore the full connection':'See a six-clue answer';
 $('ready').hidden=mode!=='ready';$('start').disabled=false;putDate(state.day);message();
 $('play').hidden=mode!=='play';$('reveal').hidden=mode!=='reveal';$('results').hidden=!finished;
 $('roundCount').textContent=String(idx+1).padStart(2,'0')+' / 05';
 $('stage').textContent=finished?'Expedition complete':'Pitch '+(idx+1)+' · '+stageNames[idx];
 if(mode==='play'&&state.contexts)$('stage').textContent+=' · '+state.contexts+(state.contexts===1?' context':' contexts');
 $('mapnote').textContent=finished?'EXPEDITION VIEW':'ROUTE VIEW';
 $('progress').replaceChildren(...Array.from({length:5},(_,i)=>{const e=document.createElement('i');e.className=i<h.length?'done':i===idx?'current':'';return e}));
 $('footerStatus').textContent=h.length+' of 5 pitches complete';
 if(finished){renderClimbStats();renderAnswerReview();$('holds').replaceChildren();mountain.finish(state.results.score,state.results.average);$('again').hidden=!replay;$('total').textContent=format(state.results.score);$('average').parentElement.hidden=custom||!state.results.players;$('average').textContent=state.results.average==null?'—':format(state.results.average);
 $('finishers').textContent=custom?'Practice score':replay?(state.results.players?format(state.results.players)+' original daily finishers':'No recorded finishers on the original day.'):state.results.players===1?'You’re today’s first finisher.':format(state.results.players)+' completed climbs';
 return}
 const clues=shown?shown.clues:(state.clues||[]);renderHolds(clues,shown);mountain.set(sum(h));
 if(shown){practiceBest={guess:shown.guess,points:shown.points,links:shown.links};practiceAttempts=0;matchMeter($('revealMeter'),clues,shown.links);$('revealPoints').textContent='+'+shown.points+' pts';$('runningTotal').textContent=format(sum(h))+' pts';$('links').open=false;$('links').hidden=!Object.keys(shown.links).length;let count=Object.keys(shown.links).length;$('hitTitle').textContent=shown.timedOut?'Time’s up.':count===6?'Perfect pitch.':count===5?'One away!':count===4?'Strong connection.':count+' of 6 matched.'; $('reveal').dataset.hits=String(count);
 $('hitCopy').textContent=shown.timedOut?'The clock ran out. This pitch earns zero points.':count?'“'+shown.guess+'” earned '+shown.points+' points.'+(shown.autoSubmitted?' Automatically submitted when time ran out.':''):shown.autoSubmitted?'“'+shown.guess+'” was automatically submitted. No recognized connections this round.':'No recorded links for “'+shown.guess.toUpperCase()+'” on this pitch.';
 $('phrases').replaceChildren(...connectionList(clues,shown.links,shown.guess).children);
 renderReport(clues,shown.links,shown.guess);
 $('practicePitch').hidden=count===6;
 $('practicePitch').open=false;
 $('retryGuess').value='';$('retryOutcome').textContent='';$('retryConnections').replaceChildren();$('practiceBest').hidden=true;$('retryCheck').disabled=false;
 $('retryPrompt').textContent=(count?'Can you beat '+count+' of 6 matches? ':'Take another look at the six clues. ')+'Explore another meaning. Your original score stays unchanged.';
 $('sol').open=false;const target=document.createElement('strong');target.className='solution-word';target.textContent=displayWord(shown.target);$('solution').replaceChildren(target,connectionList(clues,shown.solution,shown.target));
 const decoy=$('decoyReview');decoy.replaceChildren();decoy.hidden=!shown.decoy||!shown.decoyLinks;
 if(!decoy.hidden){const title=document.createElement('strong'),copy=document.createElement('p'),meter=document.createElement('div');title.textContent='The tempting connection: '+displayWord(shown.decoy);const hits=Object.keys(shown.decoyLinks).length;copy.textContent=hits+' of 6 clues fit this idea. The remaining clues point beyond that interpretation.';meter.className='match-meter';matchMeter(meter,clues,shown.decoyLinks);decoy.append(title,copy,meter,connectionList(clues,shown.decoyLinks,shown.decoy));}
 $('next').textContent=idx===4?'See my climb ↗':'Next pitch ↗';
 }else if(mode==='play'){$('guess').disabled=false;$('guess').readOnly=false;$('lock').disabled=false;paintClock()}
}
function paintClock(){
 if(mode!=='play')return;
 const ms=Math.max(0,timerEnd-performance.now()), sec=Math.ceil(ms/1000);
 $('seconds').textContent=sec+'s';$('clockbar').max=state.pitchSeconds||20;$('clockbar').value=ms/1000;$('clock').classList.toggle('urgent',sec<=5);
 if(ms===0&&!pending&&!waitingForReconnect)finishAtDeadline();
}
setInterval(paintClock,100);
function displayResponse(next,previous,action){
 const sameDay=previous?.day===next.day;
 const advanced=!!previous&&sameDay&&next.history.length>previous.history.length;
 const estimatedEnd=next.deadline?performance.now()+Math.max(0,Date.parse(next.deadline)-Date.parse(next.serverTime)):0;
 timerEnd=next.deadline && next.deadline===previous?.deadline ? Math.min(timerEnd,estimatedEnd) : estimatedEnd;
 state=next;waitingForReconnect=false;
 if(next.deadline){revealIndex=null}
 else if(advanced){revealIndex=next.history.length-1}
 else if(next.results){revealIndex=null}
 else {revealIndex=next.history.length?next.history.length-1:null}
 if(!sameDay||advanced||action==='start'){$('guess').value='';$('guess').removeAttribute('aria-invalid')}
 if(advanced && !next.deadline && !next.history[revealIndex].timedOut && mode==='play' && (action==='guess'||action==='auto_guess') && Object.keys(next.history[revealIndex].links).length>0){
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
   tone(index);
  };
  mountain.climb(sum(previous.history),sum(next.history),count,end,onGrip);
  setTimeout(end,1400);
 }else{
  render();
  if(next.rejected){rejectGuess('No recognized connection. Try another word or phrase.')}
  else if(mode==='play' && action==='start')$('guess').focus({preventScroll:true});
 }
}
function scheduleRecovery(){
 clearTimeout(recoveryTimer);
 recoveryTimer=setTimeout(()=>{if(!pending&&mode!=='animating'&&recovery)requestPitch(recovery.action,recovery.guess,true)},recoveryDelay);
 recoveryDelay=Math.min(15000,recoveryDelay*2);
}
async function requestPitch(action='read',guess=null,retrying=false){
 if(pending||mode==='animating')return;
 if(recovery&&!retrying)return connect();
 const prev=state;
 const args=retrying&&recovery?recovery.args:{p_action:action,p_day:prev?.day||null,p_round:prev?prev.history.length+1:null,p_guess:guess};
 pending=true;clearTimeout(recoveryTimer);$('start').disabled=true;$('next').disabled=true;$('lock').disabled=true;$('guess').readOnly=true;
 try{
  ticket??=getTicket();
  const next=await call(args);
  recovery=null;recoveryDelay=800;waitingForReconnect=false;
  displayResponse(next,prev,action);
  if(action!=='read'&&(!prev||next.history.length!==prev.history.length||next.deadline!==prev.deadline)){try{cache()}catch{}}
 }catch(error){
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
 if(pending)return;
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
 message('Checking your answer…');requestPitch('guess',g);
}
$('retryForm').onsubmit=async e=>{
 e.preventDefault();
 if(mode!=='reveal'||$('retryCheck').disabled)return;
 const pitchIndex=revealIndex,day=state.day,record=state.history[pitchIndex];
 const guess=clean($('retryGuess').value);
 if(!guess)return;
 if(isDisplayedClue(guess,record.clues)){$('retryOutcome').textContent='That word is already in a clue. Try a different connection.';return}
 if(!validGuess(guess)){$('retryOutcome').textContent='Enter one idea, up to 120 characters, rather than a list.';return}
 const stillHere=()=>mode==='reveal'&&revealIndex===pitchIndex&&state.day===day;
 $('retryCheck').disabled=true;$('retryOutcome').textContent='Checking…';
 try{
  const result=await call({p_action:'retry_pitch',p_day:day,p_round:pitchIndex+1,p_guess:guess});
  if(!stillHere())return;
  const matches=record.clues.filter(c=>Object.hasOwn(result.links,c));
  const gain=result.points-record.points;practiceAttempts++;
  $('retryOutcome').textContent=result.rejected?'No recognized connection. Try another word or phrase.':
    '“'+guess+'” · '+matches.length+'/6 · '+result.points+' points'+(gain>0?' (+'+gain+')':'')+'. Matched '+matches.join(', ')+'.';
  $('retryConnections').replaceChildren();
  renderReport(record.clues,result.links,guess);
  if(!result.rejected){
   $('retryConnections').append(connectionList(record.clues,result.links,guess));
   if(result.points>practiceBest.points){practiceBest={guess,points:result.points,links:result.links};tone(5)}
   const bestHits=Object.keys(practiceBest.links).length;
   $('practiceBest').hidden=false;$('practiceBestText').textContent='Best: '+bestHits+'/6 · '+practiceBest.points+' pts'+(practiceBest.points>record.points?' · +'+(practiceBest.points-record.points)+' improvement':'')+' · '+practiceAttempts+' '+(practiceAttempts===1?'try':'tries');
   matchMeter($('practiceMeter'),record.clues,practiceBest.links);
   $('retryGuess').focus();$('retryGuess').select();
  }
  if(result.rejected){$('retryGuess').focus();$('retryGuess').select();$('retryGuess').classList.remove('guess-rejected');void $('retryGuess').offsetWidth;$('retryGuess').classList.add('guess-rejected')}
 }catch{if(stillHere())$('retryOutcome').textContent='Couldn’t check that guess. Try again.'}
 finally{if(stillHere())$('retryCheck').disabled=false}
};
for(const [inputId,formId] of [['guess','guessform'],['retryGuess','retryForm']]){
 $(inputId).addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$(formId).requestSubmit()}});
}
$('guide').onclick=()=>$('manual').showModal();$('close').onclick=$('understood').onclick=()=>$('manual').close();
$('manual').addEventListener('click',e=>{if(e.target===$('manual')){const r=$('manual').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('manual').close()}});
$('routeLink').addEventListener('click',()=>document.querySelector('.route-menu').open=false);
document.addEventListener('click',e=>{if(!e.target.closest('.route-menu'))document.querySelector('.route-menu').open=false});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('.route-menu').open=false});
$('sound').onclick=toggleSound;$('guessform').onsubmit=submit;$('retry').onclick=connect;
$('start').onclick=()=>requestPitch('start');
$('next').onclick=()=>{if(state.results){revealIndex=null;render()}else requestPitch('start')};
$('share').onclick=async()=>{const h=state.history;const result='Ascent · '+(custom?'Custom '+seed.slice(0,8):replay?'Archive '+archive:state.day)+'\n'+format(state.results.score)+' pts\n'+h.map(r=>Object.keys(r.links).length+'/6').join(' · ');try{await navigator.clipboard.writeText(result);message('Result copied.')}catch{message(result)}};
function refresh(){if(document.hidden||pending||mode==='animating')return;if(recovery){connect();return;}if((official&&state?.day!==today())||mode==='results'||mode==='play')connect()}
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
$('again').onclick=()=>{if(custom){location.assign('?new=1');return}localStorage.setItem(ticketKey,crypto.randomUUID());location.reload()};
$('routeLink').hidden=!custom;
$('routeLink').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);message('Climb link copied.')}catch{message(location.href)}};
putDate(archive||today());mountain.init($('view'));connect();
})();