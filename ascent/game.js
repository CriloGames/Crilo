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
const syncKey=official?'ascent.last.v1':'ascent.last.'+scope;
const $=id=>document.getElementById(id);
const scene=document.querySelector('.expedition');
const stageNames=['Trailhead','Lower slabs','The traverse','Upper face','Summit ridge'];
const holdPositions=[[56,20],[78,28],[84,47],[71,68],[48,62],[40,39]];
let state=null, mode='loading', pending=false, revealIndex=null, audio=null, sound=false, ticket=null;
let timerEnd=0, waitingForReconnect=false;
const mountain=window.Mountain;
const sum=items=>items.reduce((n,r)=>n+r.points,0);
const format=n=>Number(n).toLocaleString('en-US');
const clean=s=>s.trim().toLowerCase();
function getTicket(){
  const saved=localStorage.getItem(ticketKey);
  if(saved && /^[a-f0-9-]{36}$/i.test(saved))return saved;
  const fresh=crypto.randomUUID();localStorage.setItem(ticketKey,fresh);return fresh;
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
function cache(){if(state)localStorage.setItem(syncKey,JSON.stringify({day:state.day,reveal:revealIndex,len:state.history.length}))}
function renderHolds(clues,record){
 $('holds').replaceChildren();
 clues.forEach((word,i)=>{const hold=document.createElement('span');hold.className='hold';hold.style.setProperty('--x',holdPositions[i][0]+'%');hold.style.setProperty('--y',holdPositions[i][1]+'%');const num=document.createElement('i');num.textContent=String(i+1);hold.append(num,word.toUpperCase());if(record?.links[word]&&!state.semantic){const phrase=document.createElement('small');phrase.className='hold-phrase';phrase.textContent=record.links[word];hold.append(phrase)}if(record)hold.classList.add(word in record.links?'hit':'miss');$('holds').append(hold)})
}
function renderAnswerReview(){
 const review=$('answerReview');
 const key=state.day;
 if(review.dataset.day===key)return;
 review.dataset.day=key;
 review.replaceChildren();
 state.history.forEach((pitch,index)=>{
  const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');
  summary.textContent='Pitch '+(index+1)+(state.fullBank===false?' · Theme and related answers':' · Top 100 answers');
  body.className='answer-body';
  details.append(summary,body);review.append(details);
  details.addEventListener('toggle',async()=>{
   if(!details.open||body.dataset.loaded)return;
   body.dataset.loaded='pending';body.textContent='Loading answers…';
   try{
    const answers=await window.ascentRpc('ascent_top_answers',{p_ticket:ticket,p_day:key,p_archive:archive,p_seed:seed,p_pitch:index+1});
    if(!answers.length)throw new Error('Unavailable');
    const list=document.createElement('ol');list.className='answer-list';
    for(const answer of answers){
     const row=document.createElement('li'),title=document.createElement('strong'),score=document.createElement('span'),links=document.createElement('small');
     title.textContent=answer.word;score.textContent=answer.hits+'/6 · '+answer.points+' pts';
     links.textContent=pitch.clues.filter(clue=>answer.links[clue]).map(clue=>answer.links[clue]).join(' · ');
     row.append(title,score,links);list.append(row);
    }
    body.replaceChildren(list);body.dataset.loaded='yes';
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
 $('readyRule').textContent=state.semantic?'Read six clues and name their shared theme. You have 20 seconds once you start.':'This climb uses the original word-pair rules. You have 20 seconds once you start.';
 $('themeTry').hidden=state.semantic;
 $('generate').textContent='New themed climb ↗';
 $('intro').textContent=state.semantic?'Find the idea that connects the clues. A related word can earn partial credit.':'Find one word that forms a familiar word or phrase with as many holds as possible. Try it on either side.';
 $('guideRule').textContent=state.semantic?'Find the idea behind the six clues. For example, aperture, shutter and portrait all point to photography. A related guess earns credit for the clues it fits.':'Find one word that forms a familiar phrase with as many clues as possible, in either order.';
 $('sol').querySelector('summary').textContent=state.semantic?'See the theme':'See a six-hold word';
 $('ready').hidden=mode!=='ready';$('start').disabled=false;putDate(state.day);message();
 $('play').hidden=mode!=='play';$('reveal').hidden=mode!=='reveal';$('results').hidden=!finished;
 $('roundCount').textContent=String(idx+1).padStart(2,'0')+' / 05';
 $('stage').textContent=finished?'Expedition complete':'Pitch '+(idx+1)+' · '+stageNames[idx];
 $('mapnote').textContent=finished?'EXPEDITION VIEW':'ROUTE VIEW';
 $('progress').replaceChildren(...Array.from({length:5},(_,i)=>{const e=document.createElement('i');e.className=i<h.length?'done':i===idx?'current':'';return e}));
 $('footerStatus').textContent=h.length+' of 5 pitches complete';
 if(finished){renderAnswerReview();$('holds').replaceChildren();mountain.finish(state.results.score,state.results.average);$('again').hidden=official;$('total').textContent=format(state.results.score);$('average').parentElement.hidden=custom||!state.results.players;$('average').textContent=state.results.average==null?'—':format(state.results.average);
 $('finishers').textContent=custom?'Practice score':replay?(state.results.players?format(state.results.players)+' original daily finishers':'No recorded finishers on the original day.'):state.results.players===1?'You’re today’s first finisher.':format(state.results.players)+' completed climbs';
 $('splits').textContent=h.map((r,i)=>'P'+(i+1)+' · '+Object.keys(r.links).length+'/6').join('   ');return}
 const clues=shown?shown.clues:(state.clues||[]);renderHolds(clues,shown);mountain.set(sum(h));
 if(shown){$('links').open=false;$('links').hidden=!Object.keys(shown.links).length;let count=Object.keys(shown.links).length;$('hitTitle').textContent=shown.timedOut?'Time’s up.':count===6?'A clean send.':count+' of 6 holds.';
 $('hitCopy').textContent=shown.timedOut?'The clock ran out. This pitch earns zero points.':count?'“'+shown.guess.toUpperCase()+'” connected these holds.':'No recorded links for “'+shown.guess.toUpperCase()+'” on this pitch.';
 $('phrases').replaceChildren(...clues.filter(c=>c in shown.links).map(c=>{const li=document.createElement('li');li.textContent=shown.links[c];return li}));
 $('sol').open=false;$('solution').textContent=shown.target.toUpperCase()+' · '+clues.map(c=>state.semantic?c.toUpperCase()+' — '+shown.solution[c]:shown.solution[c]).join(' · ');
 $('next').textContent=idx===4?'See my climb ↗':'Next pitch ↗';
 }else if(mode==='play'){$('guess').disabled=false;$('guess').readOnly=false;$('lock').disabled=false;paintClock()}
}
function paintClock(){
 if(mode!=='play')return;
 const ms=Math.max(0,timerEnd-performance.now()), sec=Math.ceil(ms/1000);
 $('seconds').textContent=sec+'s';$('clockbar').value=ms/1000;$('clock').classList.toggle('urgent',sec<=5);
 if(ms===0&&!pending&&!waitingForReconnect)requestPitch('read');
}
setInterval(paintClock,100);
function displayResponse(next,previous,action){
 const sameDay=previous?.day===next.day;
 const advanced=sameDay && next.history.length>previous.history.length;
 const estimatedEnd=next.deadline?performance.now()+Math.max(0,Date.parse(next.deadline)-Date.parse(next.serverTime)):0;
 timerEnd=next.deadline && next.deadline===previous?.deadline ? Math.min(timerEnd,estimatedEnd) : estimatedEnd;
 state=next;waitingForReconnect=false;
 if(next.deadline){revealIndex=null}
 else if(advanced){revealIndex=next.history.length-1}
 else if(next.results){revealIndex=null}
 else {revealIndex=next.history.length?next.history.length-1:null}
 if(!sameDay||advanced||action==='start')$('guess').value='';
 if(advanced && !next.deadline && !next.history[revealIndex].timedOut && mode==='play' && action==='guess'){
  const row=next.history[revealIndex], count=Object.keys(row.links).length;
  mode='animating';scene.dataset.phase=mode;$('guess').blur();
  scene.querySelector('.card').inert=true;message('Climbing…');let complete=false;
  const end=()=>{if(complete)return;complete=true;render();$('next').focus({preventScroll:true})};
  row.clues.map((c,i)=>c in row.links?i:-1).filter(i=>i>=0).forEach((pos,j)=>setTimeout(()=>{
   if(!complete){$('holds').children[pos]?.classList.add('hit');tone(j)}
  },180+j*305));
  mountain.climb(sum(previous.history),sum(next.history),count,end);setTimeout(end,3900);
 }else{
  render();
  if(next.rejected){message('No listed connection. Try another word.');$('guess').focus();$('guess').select()}
  else if(mode==='play' && action==='start')$('guess').focus({preventScroll:true});
 }
}
async function requestPitch(action='read',guess=null){
 if(pending||mode==='animating')return;
 const prev=state;
 pending=true;$('start').disabled=true;$('next').disabled=true;$('lock').disabled=true;$('guess').readOnly=true;
 try{
  ticket??=getTicket();
  const next=await call({p_action:action,p_day:prev?.day||null,p_round:prev?prev.history.length+1:null,p_guess:guess});
  displayResponse(next,prev,action);
  if(action!=='read'&&(next.history.length!==prev.history.length||next.deadline!==prev.deadline))cache();
 }catch{waitingForReconnect=true;message('Connection interrupted. Reconnect to check your pitch.',true)}
 finally{pending=false;$('next').disabled=false}
}
function connect(){return requestPitch('read')}
function submit(e){
 e.preventDefault();if(pending||mode!=='play'||waitingForReconnect)return;
 if(performance.now()>=timerEnd){connect();return}
 const g=clean($('guess').value);
 if(!/^[a-z]{1,36}$/.test(g)||state.clues.includes(g)){message('Enter one word of your own, using letters only.');$('guess').select();return}
 message('Checking your word…');requestPitch('guess',g);
}
$('guide').onclick=()=>$('manual').showModal();$('close').onclick=$('understood').onclick=()=>$('manual').close();
$('manual').addEventListener('click',e=>{if(e.target===$('manual')){const r=$('manual').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('manual').close()}});
$('routeLink').addEventListener('click',()=>document.querySelector('.route-menu').open=false);
document.addEventListener('click',e=>{if(!e.target.closest('.route-menu'))document.querySelector('.route-menu').open=false});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('.route-menu').open=false});
$('sound').onclick=toggleSound;$('guessform').onsubmit=submit;$('retry').onclick=connect;
$('start').onclick=()=>requestPitch('start');
$('next').onclick=()=>{if(state.results){revealIndex=null;render()}else requestPitch('start')};
$('share').onclick=async()=>{const h=state.history;const result='Ascent · '+(custom?'Custom '+seed.slice(0,8):replay?'Archive '+archive:state.day)+'\n'+format(state.results.score)+' / 1,000\n'+h.map(r=>Object.keys(r.links).length+'/6').join(' · ');try{await navigator.clipboard.writeText(result);message('Result copied.')}catch{message(result)}};
function refresh(){if(document.hidden||pending||mode==='animating')return;if((official&&state?.day!==today())||mode==='results'||mode==='play')connect()}
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
$('again').onclick=()=>{localStorage.setItem(ticketKey,crypto.randomUUID());location.reload()};
$('routeLink').hidden=!custom;
$('routeLink').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);message('Climb link copied.')}catch{message(location.href)}};
putDate(archive||today());mountain.init($('view'));connect();
})();