(() => {
const $=id=>document.getElementById(id), wheel=$('wheel'),ctx=wheel.getContext('2d'),drawing=$('drawing'),dctx=drawing.getContext('2d');
let guestRun=false,user=null,profile=null,started=false,spinning=false,drawingLocked=false,isTest=false,saveOwnerTest=false,officialRun=null,ownerModeChosen=false;
let serverSessionId=null,finalSaveInProgress=false;
let drawMode='stationary',drawTool='pen',usedFillOnOfficial=false,undoStack=[],redoStack=[];let score=0,spins=5,multiplier=1,upgrades=0,doubles=0,ducks=0,totalSpins=0,numbersLanded=0,extraSpins=0,bestRollPoints=0,bestRollLabel='',rotation=0,segments=[],results=[],runProbability=1;
const palette=['#ffd86b','#9bd9ef','#ffb8d2','#c6dcff','#c8f4bd','#efc5ef','#aee9f4','#fff0a8','#c9f1df','#dfc8f6','#ffc8a8'];
// Separate desaturated night wheel: preserve the daylight palette and drawing artwork.
const paletteDark=["#80714c","#526d7d","#795f72","#657698","#59765e","#806486","#597b80","#8f794f","#628477","#76668f","#8d695b"];
const wheelIsDark=()=>document.documentElement?.dataset?.theme==='dark';
const fmt=n=>{n=Number(n)||0;if(n<1e3)return Math.round(n).toLocaleString();for(const [s,v] of [['Qa',1e15],['T',1e12],['B',1e9],['M',1e6],['K',1e3]])if(n>=v)return(n/v>=100?(n/v).toFixed(0):(n/v).toFixed(1)).replace('.0','')+s;return String(n)};
function resetSegments(){segments=[{type:'num',base:2},{type:'duck',label:'DUCK'},{type:'num',base:1},{type:'upgrade',label:'UP! ↑'},{type:'num',base:3},{type:'num',base:1},{type:'spins',label:'+2'},{type:'num',base:5},{type:'duck',label:'DUCK'},{type:'num',base:2},{type:'double',label:'×2'},{type:'num',base:1}]}
function label(s){return s.type==='num'?fmt(s.base*multiplier):s.label}
function drawDuckIcon(x,y,size){const dark=wheelIsDark();ctx.save();ctx.translate(x,y);ctx.strokeStyle=dark?'#25303c':'#17191e';ctx.lineWidth=Math.max(2,size*.08);ctx.fillStyle=dark?'#d3b575':'#ffe06a';ctx.beginPath();ctx.ellipse(-size*.08,size*.08,size*.34,size*.24,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(size*.22,-size*.13,size*.19,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#17191e';ctx.beginPath();ctx.arc(size*.28,-size*.17,size*.035,0,Math.PI*2);ctx.fill();ctx.fillStyle=dark?'#c58b6b':'#ff9d4d';ctx.beginPath();ctx.moveTo(size*.39,-size*.11);ctx.lineTo(size*.58,-size*.04);ctx.lineTo(size*.39,size*.01);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
function drawWheel(){const dark=wheelIsDark(),colors=dark?paletteDark:palette;const w=wheel.width,c=w/2,r=c-12,N=segments.length,a=Math.PI*2/N;ctx.clearRect(0,0,w,w);ctx.save();ctx.translate(c,c);ctx.rotate(rotation);segments.forEach((s,i)=>{const st=i*a-Math.PI/2,en=st+a;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,st,en);ctx.closePath();ctx.fillStyle=colors[i%colors.length];ctx.fill();ctx.strokeStyle=dark?'#384655':'#fff';ctx.lineWidth=4;ctx.stroke();const ang=st+a/2,tx=Math.cos(ang)*r*.69,ty=Math.sin(ang)*r*.69;if(s.type==='duck')drawDuckIcon(tx,ty,Math.max(34,Math.min(58,360/N)));else{ctx.save();ctx.translate(tx,ty);ctx.rotate(ang+Math.PI/2);ctx.fillStyle=dark?'#f6f1ec':'#17191e';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`1000 ${Math.max(17,Math.min(s.type!=='num'?27:36,310/N))}px system-ui`;ctx.strokeStyle=dark?'rgba(24,29,38,.94)':'rgba(255,255,255,.8)';ctx.lineWidth=5;ctx.strokeText(label(s),0,0);ctx.fillText(label(s),0,0);ctx.restore()}});ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.strokeStyle=dark?'#9ba8b7':'#17191e';ctx.lineWidth=7;ctx.stroke();ctx.restore();drawing.style.transform=drawMode==='spin'?('rotate('+rotation+'rad)'):'none'}
// Theme changes repaint just the wheel colors without touching spin state or the drawing.
if(typeof MutationObserver!=='undefined'&&document.documentElement){
 new MutationObserver(changes=>{if(changes.some(c=>c.attributeName==='data-theme'))drawWheel()})
  .observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
}
function update(){
 // When a completed Daily is reopened, show its saved server-side score
 // rather than the fresh wheel's default 0 and five remaining spins.
 // Owner Test Runs and new Dailies always use their active in-memory values.
 const savedDaily=!started&&!isTest&&!guestRun&&officialRun&&!officialRun.blocked&&
   Number.isFinite(Number(officialRun.score))?officialRun:null;
 const guestRecord=!user&&!started&&!isTest?guestDailyRecord():null;
 const savedGuest=guestRecord?.status==='complete'&&
   Number.isFinite(Number(guestRecord.score))?guestRecord:null;
 const savedResult=savedDaily||savedGuest;
 const displayedScore=savedResult?Number(savedResult.score):score;
 const revealed=results.length>0||!!savedResult; // No tier before a resolved Daily.
 const band=window.CriloRarity?.scoreBands?.find(b=>displayedScore<=b.max)||
   {key:'trash',label:'TRASH'};
 const tier=String(band.key||'trash').toLowerCase();
 $('score').textContent=fmt(displayedScore);
 $('wheelScorePanel').dataset.rarity=revealed?tier:'unrevealed';
 $('scoreTier').hidden=!revealed;
 $('scoreTierHint').hidden=revealed;
 $('scoreTierText').textContent=revealed?tier.toUpperCase():'';
 $('scoreTier').setAttribute('aria-label',revealed?'Score rarity: '+tier:'Score rarity not yet revealed');
 const heading=$('wheelScorePanel').querySelector('.wheel-score-eyebrow');
 if(heading)heading.textContent=savedDaily?'DAILY SCORE':savedGuest?'GUEST SCORE':'CURRENT SCORE';
 $('spins').textContent=savedResult?0:spins;
 // Saved results contain upgrade counts, not their final multiplier.
 // Rebuild displayed values only; never change the wheel's actual state.
 const savedUpgrades=savedResult?Math.max(0,Math.trunc(Number(
   savedDaily?savedDaily.upgrades:savedGuest.state?.upgrades)||0)):0;
 const savedMultiplier=Math.min(Number.MAX_SAFE_INTEGER,3**Math.min(32,savedUpgrades));
 $('level').textContent='×'+fmt(savedResult?savedMultiplier:multiplier);
 $('duckCount').textContent=savedResult?Math.max(0,Number(
   savedDaily?savedDaily.ducks:savedGuest.state?.ducks)||0):ducks;
 drawWheel();
}
// Seven rarity-specific finishing sounds; the visual seal is intentionally shorter.
// Each entry is [pitch, start offset, length, volume, wave, optional glide].
const CRILO_FINAL_RARITY_NOTES={
 trash:[[294,0,.20,.022,'triangle',185],[196,.20,.34,.025,'sine',131]],
 common:[[440,0,.13,.027,'sine'],[554,.16,.22,.032,'triangle']],
 uncommon:[[440,0,.12,.027,'triangle'],[587,.13,.13,.029,'triangle'],[698,.27,.29,.033,'sine']],
 rare:[[523,0,.11,.025,'sine'],[659,.12,.12,.027,'triangle'],[784,.25,.17,.032,'sine'],[1047,.41,.32,.029,'sine']],
 epic:[[392,0,.16,.031,'triangle'],[523,.11,.17,.033,'triangle'],[659,.23,.17,.034,'triangle'],[784,.36,.22,.036,'sine'],[1047,.57,.38,.029,'sine']],
 anomaly:[[659,0,.24,.025,'triangle',988],[523,.17,.28,.027,'sine',392],[988,.36,.34,.028,'triangle',1568],[1319,.62,.47,.025,'sine',784]],
 mythic:[[262,0,.19,.033,'triangle'],[392,.12,.19,.034,'triangle'],[523,.25,.19,.035,'triangle'],[659,.39,.19,.035,'sine'],[784,.54,.24,.037,'triangle'],[1047,.73,.32,.037,'sine'],[1568,.97,.55,.034,'sine']]
};
let lastFinalAnimationMs=0,finalCelebrationId=0;
function resetFinalCelebration(){
 // A new Daily or owner Test Run starts with a still, unaltered score.
 finalCelebrationId++;
 $('wheelScorePanel')?.classList.remove('crilo-final-settle');
 lastFinalAnimationMs=0;
}
function playFinalScoreWave(tier){
 resetFinalCelebration();
 const panel=$('wheelScorePanel');
 // No ceremony when score is unrevealed, or when motion is disabled.
 if(!panel||panel.dataset.rarity!==String(tier||'').toLowerCase()||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return 0;
 // Never split or rewrite digits: the saved number and its accessible text
 // stay unchanged. Restart only when an actual last spin is confirmed.
 void panel.offsetWidth;
 panel.classList.add('crilo-final-settle');
 const current=++finalCelebrationId;
 lastFinalAnimationMs=880;
 setTimeout(()=>{
  if(current===finalCelebrationId)panel.classList.remove('crilo-final-settle');
 },940);
 return lastFinalAnimationMs;
}
function sound(kind,tier=null){
 if(profile?.sound_enabled===false||localStorage.getItem('crilo_sound')==='off')return;
 try{
  const A=window.AudioContext||window.webkitAudioContext,ac=sound.ac||(sound.ac=new A());
  if(ac.state==='suspended')ac.resume().catch(()=>{});
  const now=ac.currentTime;
  // Balance perceived loudness by event; quieter wheel ticks get a lift.
  const levels={tick:3.0,num:2.1,spins:1.3,double:1.05,upgrade:.84,final:.95};
  const level=levels[kind]||1;
  const limiter=sound.limiter||(sound.limiter=(()=>{const c=ac.createDynamicsCompressor();c.threshold.value=-19;c.knee.value=12;c.ratio.value=7;c.attack.value=.003;c.release.value=.14;c.connect(ac.destination);return c})());
  // All sounds are synthesized locally; no downloads or external audio assets.
  function note(freq,delay,duration,volume=.035,wave='sine',endFreq=freq){
   const o=ac.createOscillator(),g=ac.createGain(),start=now+delay;
   o.type=wave;o.frequency.setValueAtTime(freq,start);
   if(endFreq!==freq)o.frequency.exponentialRampToValueAtTime(Math.max(30,endFreq),start+duration);
   o.connect(g);g.connect(limiter);
   g.gain.setValueAtTime(.0001,start);
   g.gain.exponentialRampToValueAtTime(Math.min(.13,Math.max(.0002,volume*level)),start+.008);
   g.gain.exponentialRampToValueAtTime(.0001,start+duration);
   o.start(start);o.stop(start+duration+.01);
  }
  if(kind==='final'){
   // Each final SCORE tier gets its own motif. Start after the last number
   // landing chime so the two sounds don't mask one another.
   // Nothing here runs on a Duck, ×2, Upgrade or +2 that extends the run.
   for(const [frequency,delay,duration,volume,wave,target] of CRILO_FINAL_RARITY_NOTES[String(tier||'').toLowerCase()]||CRILO_FINAL_RARITY_NOTES.common)
    note(frequency,.22+delay,duration,volume,wave,target===undefined?frequency:target);
   return;
  }
  if(kind==='tick'){
   if(now-(sound.lastTick||0)<.065)return;
   sound.lastTick=now;
   note(950,0,.035,.018,'triangle',480);
  }else if(kind==='num'){
   note(560,0,.085,.024,'sine',680);
  }else if(kind==='spins'){
   // +2 spins: two buoyant, rising chimes.
   note(587,0,.17,.045,'triangle');
   note(784,.12,.24,.047,'sine');
   note(1175,.24,.28,.018,'sine');
  }else if(kind==='double'){
   // Double: punchy low impact followed by a sparkling upward flourish.
   note(220,0,.16,.065,'triangle',155);
   note(523,.055,.19,.042,'triangle',659);
   note(784,.17,.24,.045,'sine');
   note(1047,.29,.32,.03,'sine');
  }else if(kind==='upgrade'){
   // Upgrade: the biggest victory sound, a rising five-note fanfare.
   note(196,0,.25,.055,'triangle',147);
   note(392,.045,.20,.045,'triangle');
   note(523,.16,.22,.052,'triangle');
   note(659,.28,.24,.05,'triangle');
   note(784,.40,.28,.056,'sine');
   note(1047,.54,.52,.052,'sine');
   note(1568,.59,.48,.017,'sine');

  }
 }catch{}
}
function pop(text){const p=$('eventPop');p.textContent=text;p.classList.remove('show');void p.offsetWidth;p.classList.add('show')}
function addDuck(){ducks++;$('duckCount').textContent=ducks;return DuckWorld.spawn()}

function bump(){const w=$('wheelWrap');w.classList.remove('upgrade-bump');void w.offsetWidth;w.classList.add('upgrade-bump')}
// Guest Daily identity and artwork are stored locally, but the server
// selects every spin and stores the authoritative score/counters. The one-time
// guest ticket is required to claim the run after sign-in. Other tabs adopt
// the same ticket rather than getting another attempt.
const GUEST_DAILY_STORAGE_KEY='crilo_guest_daily_v1';
const GUEST_DAILY_SCHEMA=3;
const guestTabId=String(Date.now())+'-'+Math.random().toString(36).slice(2);
let guestDailyClaimedHere=false,guestDailyClaimedPeriod=null;
let guestDrawingData='',guestPendingUpgradeBases=null;
function guestProofRecord(){try{return JSON.parse(localStorage.getItem(GUEST_DAILY_STORAGE_KEY)||'null')}catch{return null}}
function guestDailyRecord(){
 try{
  const raw=localStorage.getItem(GUEST_DAILY_STORAGE_KEY);
  if(raw===null)return null;
  const saved=JSON.parse(raw);
  return saved&&saved.period===Crilo.dailyPeriod()?saved:null;
 }catch(error){return {storageUnavailable:true};}
}
function guestDailyValid(s){
 const finite=n=>Number.isFinite(n)&&n>=0;
 return s&&typeof s==='object'&&Array.isArray(s.segments)&&s.segments.length>=12&&s.segments.length<=220&&
  Array.isArray(s.results)&&s.results.length<=1000&&typeof s.drawing==='string'&&
  s.drawing.startsWith('data:image/png;base64,')&&s.drawing.length<2000000&&
  ['stationary','spin'].includes(s.drawMode)&&
  finite(s.score)&&Number.isInteger(s.spins)&&s.spins>=0&&s.spins<=1000&&
  Number.isInteger(s.totalSpins)&&s.totalSpins>=0&&s.totalSpins<=1000&&
  finite(s.multiplier)&&s.multiplier>=1&&finite(s.upgrades)&&finite(s.doubles)&&
  finite(s.ducks)&&finite(s.extraSpins)&&finite(s.numbersLanded)&&
  finite(s.bestRollPoints)&&finite(s.runProbability)&&Number.isFinite(s.rotation)&&
  s.segments.every(x=>x&&['num','duck','upgrade','spins','double'].includes(x.type)&&
   (x.type!=='num'||Number.isFinite(x.base)&&x.base>0));
}
function guestDailyState(){
 return {score,spins,multiplier,upgrades,doubles,ducks,totalSpins,numbersLanded,
  extraSpins,bestRollPoints,bestRollLabel,rotation,runProbability,
  results:results.map(r=>({...r})),segments:segments.map(v=>({...v})),
  drawing:guestDrawingData,drawMode};
}
function guestOwnsDaily(){
 if(!guestDailyClaimedHere||!guestDailyClaimedPeriod||Crilo.dailyPeriod()!==guestDailyClaimedPeriod)return false;
 try{
  const stored=JSON.parse(localStorage.getItem(GUEST_DAILY_STORAGE_KEY)||'null');
  return !!stored&&stored.period===guestDailyClaimedPeriod&&
   stored.tabId===guestTabId&&stored.status==='started';
 }catch{return false;}
}
function guestDailyShow(message,title='Guest Daily paused'){
 lockDrawing();
 setDrawingPanelMode(title==='Guest Daily complete'?'guest-complete':'unavailable');
 started=false;
 $('spinButton').disabled=true;$('spinButton').classList.add('hidden');
 $('result').classList.add('hidden');
 $('playedPanel').classList.remove('hidden');
 $('playedPanel').querySelector('strong').textContent=title;
 $('playedText').textContent=message;
 $('message').textContent=message;
 showDailyRecap(null);
}
function guestDailyLocked(){
 if(user||isTest||guestDailyClaimedHere)return false;
 const saved=guestDailyRecord();
 if(!saved)return false;
 if(saved.storageUnavailable){
  guestDailyShow('Allow this site to save browser data to play as a guest, or sign in.','Browser storage required');
 }else if(saved.status==='complete'){
  guestDailyShow(saved.version===GUEST_DAILY_SCHEMA?
   'Sign in to claim this completed Daily for your account. A new guest Daily opens at the next reset.':
   'This older guest Daily was not server-verified and cannot be claimed.','Guest Daily complete');
  showDailyRecap(saved,'guest');
  if(guestDailyValid(saved.state))$('reviewDailyBtn').classList.remove('hidden');
  update();
 }else{
  guestDailyShow(saved.version===GUEST_DAILY_SCHEMA&&guestDailyValid(saved.state)?
   'This Daily is already open in another tab. Refresh this page to continue the same run.':
   'An earlier guest Daily was started, but its progress cannot be restored. A new Daily opens at the next reset.',
   'Guest Daily already started');
 }
 return true;
}
function saveGuestDaily(pending=null,completed=false){
 if(!guestOwnsDaily())return false;
 try{
  const current=JSON.parse(localStorage.getItem(GUEST_DAILY_STORAGE_KEY)||'null');
  if(!current||current.tabId!==guestTabId||current.period!==guestDailyClaimedPeriod)return false;
  const record={...current,version:GUEST_DAILY_SCHEMA,status:completed?'complete':'started',
   state:guestDailyState(),pending:completed?null:pending,
   ...(completed?{score:Math.round(score),spins:totalSpins,completedAt:new Date().toISOString()}:{})};
  localStorage.setItem(GUEST_DAILY_STORAGE_KEY,JSON.stringify(record));
  return localStorage.getItem(GUEST_DAILY_STORAGE_KEY)===JSON.stringify(record);
 }catch(error){console.warn('Guest Daily save failed:',error);return false;}
}
function guestSaveOrPause(pending=null){
 if(saveGuestDaily(pending))return true;
 guestDailyClaimedHere=false;
 guestDailyShow('Your guest progress could not be saved. Check browser storage or continue the run in your other tab.',
  'Guest Daily paused');
 return false;
}
async function claimGuestDaily(){
 if(guestDailyClaimedHere)return guestOwnsDaily();
 if(guestDailyLocked())return false;
 try{
  guestDrawingData=drawing.toDataURL('image/png');
  if(!guestDrawingData.startsWith('data:image/png;base64,'))throw Error('Could not preserve drawing');
  const {data:proof,error:proofError}=await criloDB.rpc('crilo_guest_begin');
  if(proofError||!proof?.token||proof.period!==Crilo.dailyPeriod())
   throw proofError||new Error('Guest spin proof could not be created');
  const startedAt=new Date().toISOString();
  const pixels=dctx.getImageData(0,0,drawing.width,drawing.height).data;
  let drawingIsBlank=true;
  for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==0){drawingIsBlank=false;break}
  const record={version:GUEST_DAILY_SCHEMA,period:proof.period,status:'started',
   verifiedToken:proof.token,drawingIsBlank,tabId:guestTabId,startedAt,pending:null,state:guestDailyState()};
  localStorage.setItem(GUEST_DAILY_STORAGE_KEY,JSON.stringify(record));
  if(localStorage.getItem(GUEST_DAILY_STORAGE_KEY)!==JSON.stringify(record))
   throw Error('Guest Daily storage unavailable');
  guestDailyClaimedHere=true;guestDailyClaimedPeriod=record.period;
  return true;
 }catch(error){
  guestDailyShow('Guest play requires working browser storage to protect your Daily progress. Enable site storage or sign in.',
   'Cannot save guest Daily');
  return false;
 }
}
function completeGuestDaily(){
 if(!guestDailyClaimedHere)return;
 if(!saveGuestDaily(null,true)){
  $('message').textContent='Guest Daily finished, but could not save its completed state.';
 }
 guestDailyClaimedHere=false;
}
function restoreGuestDaily(saved){
 if(saved.version!==GUEST_DAILY_SCHEMA||saved.status!=='started'||!saved.verifiedToken||!guestDailyValid(saved.state))return false;
 const previous=saved.state;
 try{
  // Take ownership of this already-started run so the old tab cannot write
  // stale progress when it finishes an animation.
  const adopted={...saved,tabId:guestTabId};
  localStorage.setItem(GUEST_DAILY_STORAGE_KEY,JSON.stringify(adopted));
  if(localStorage.getItem(GUEST_DAILY_STORAGE_KEY)!==JSON.stringify(adopted))return false;
 }catch{return false;}
 guestDailyClaimedHere=true;guestDailyClaimedPeriod=saved.period;
 guestDrawingData=previous.drawing;guestRun=true;started=true;isTest=false;
 serverSessionId=null;
 DuckWorld.clear();
 score=previous.score;spins=previous.spins;multiplier=previous.multiplier;
 upgrades=previous.upgrades;doubles=previous.doubles;ducks=previous.ducks;
 totalSpins=previous.totalSpins;numbersLanded=previous.numbersLanded;
 extraSpins=previous.extraSpins;bestRollPoints=previous.bestRollPoints;
 bestRollLabel=previous.bestRollLabel||'';rotation=previous.rotation;
 runProbability=previous.runProbability;
 results=previous.results.map(r=>({...r}));segments=previous.segments.map(v=>({...v}));
 setCenterDrawingSpinMode(previous.drawMode);
 $('guestSaveNotice').classList.add('hidden');
 $('result').classList.add('hidden');$('playedPanel').classList.add('hidden');
 $('spinButton').classList.remove('hidden');$('spinButton').disabled=false;
 drawingLocked=false;dctx.clearRect(0,0,drawing.width,drawing.height);
 lockDrawing();
 const image=new Image();
 image.onload=()=>{if(!guestOwnsDaily())return;dctx.clearRect(0,0,drawing.width,drawing.height);dctx.drawImage(image,0,0,drawing.width,drawing.height);};
 image.src=guestDrawingData;
 for(let i=0;i<Math.min(ducks,15);i++)DuckWorld.spawn();
 update();
 // A refresh rechecks the authoritative guest session, never a browser-picked
 // pending outcome. No client-side results are trusted for leaderboard claims.
 restoreGuestServerState().then(state=>{
  if(!guestOwnsDaily())return;
  if(state.finished){$('message').textContent='Your guest spin was restored.';endRun();}
  else{
   $('message').textContent='Your verified guest Daily was restored — '+spins+' spins remaining.';
   saveGuestDaily();
  }
 }).catch(error=>{
  console.warn('Server guest restore failed',error);
  guestDailyShow('Your guest progress could not be verified. Reconnect and refresh.','Verification unavailable');
 });
 return true;
}
function guestUpgradeChoices(){
 const pool=[1,1,2,2,3,3,5,5,8,10],count=4+Math.min(upgrades+1,8);
 return Array.from({length:count},()=>pool[Math.floor(Math.random()*pool.length)]);
}
async function restoreGuestServerState(){
 const saved=guestProofRecord();
 if(!saved?.verifiedToken||saved.version!==GUEST_DAILY_SCHEMA)throw new Error('Missing server guest ticket');
 const {data:state,error}=await criloDB.rpc('crilo_guest_state',{p_token:saved.verifiedToken});
 if(error||!state||state.claimed||state.period!==saved.period)throw error||new Error('Invalid guest server state');
 score=Number(state.score);spins=Number(state.remaining_spins);
 multiplier=Number(state.multiplier);upgrades=Number(state.upgrades);doubles=Number(state.doubles);
 ducks=Number(state.ducks);totalSpins=Number(state.spin_count);
 numbersLanded=Number(state.numbers_landed);extraSpins=Number(state.extra_spins);
 segments=serverSegments(state.segments);
 results=(state.results||[]).map(r=>({...r,label:r.type==='num'?fmt(Number(r.points)||0):
  ({duck:'DUCK',upgrade:'UP! ↑',spins:'+2',double:'×2'}[r.type]||r.type)}));
 runProbability=results.reduce((p,r)=>p*Number(r.probability||1),1);
 bestRollPoints=results.reduce((p,r)=>Math.max(p,Number(r.points)||0),0);
 const best=results.find(r=>Number(r.points)===bestRollPoints);
 bestRollLabel=best?.type==='double'?'×2':best?.type==='num'?'+'+fmt(bestRollPoints):'';
 update();return state;
}
const officialServerMode=()=>Boolean(user&&!guestRun&&!isTest);
function serverSegments(items){
 const labels={duck:'DUCK',upgrade:'UP! ↑',spins:'+2',double:'×2'};
 return (items||[]).map(s=>({...s,label:s.type==='num'?undefined:labels[s.type]}));
}
async function restoreOfficialServerState(){
 if(!serverSessionId){
  const {data,error}=await criloDB.rpc('crilo_begin_server_spin_session');
  if(error||!data)throw error||new Error('Could not start an official spin session');
  serverSessionId=data;
 }
 const {data:s,error}=await criloDB.rpc('crilo_get_server_spin_state',{p_session:serverSessionId});
 if(error||!s)throw error||new Error('Could not retrieve official spin state');
 score=Number(s.score);spins=Number(s.remaining_spins);multiplier=Number(s.multiplier);
 upgrades=Number(s.upgrades);doubles=Number(s.doubles);ducks=Number(s.ducks);
 totalSpins=Number(s.spin_count);numbersLanded=Number(s.numbers_landed);
 extraSpins=Number(s.extra_spins);segments=serverSegments(s.segments);
 results=(s.results||[]).map(r=>({...r,label:r.type==='num'?fmt(Number(r.points)||0):({duck:'DUCK',upgrade:'UP! ↑',spins:'+2',double:'×2'}[r.type]||r.type)}));
 runProbability=results.reduce((p,r)=>p*Number(r.probability||1),1);
 bestRollPoints=results.reduce((p,r)=>Math.max(p,Number(r.points)||0),0);
 const best=results.find(r=>Number(r.points)===bestRollPoints);
 bestRollLabel=best?.type==='double'?'×2':best?.type==='num'?'+'+fmt(bestRollPoints):'';
 update();
 return s;
}
function addNumbers(){const count=4+Math.min(upgrades,8),bases=[1,1,2,2,3,3,5,5,8,10];for(let i=0;i<count;i++)segments.push({type:'num',base:guestRun&&guestPendingUpgradeBases?guestPendingUpgradeBases[i]:bases[Math.floor(Math.random()*bases.length)]})}
function outcomeProbability(s){if(s.type==='num')return segments.filter(x=>x.type==='num'&&x.base===s.base).length/segments.length;return segments.filter(x=>x.type===s.type).length/segments.length}
function rarity(){return CriloRarity.classify(score)}
function recordBest(points,labelText){if(points>bestRollPoints){bestRollPoints=Math.round(points);bestRollLabel=labelText}}
function resolve(s,serverReply=null){if(guestRun&&!guestOwnsDaily()){guestDailyShow('This guest Daily is open in another tab. Refresh here to resume the saved run.');return;}const p=serverReply?Number(serverReply.outcome.probability):outcomeProbability(s);runProbability*=p;let points=0;if(s.type==='num'){points=serverReply?Number(serverReply.outcome.points):s.base*multiplier;score+=points;numbersLanded++;recordBest(points,'+'+fmt(points));$('message').textContent='+'+fmt(points);sound('num')}
if(s.type==='double'){points=serverReply?Number(serverReply.outcome.points):score;score*=2;spins++;doubles++;recordBest(points,'×2');pop('×2!');$('message').textContent='DOUBLE — score ×2 and this spin is free.';sound('double')}
if(s.type==='upgrade'){multiplier=serverReply?Math.min(Number.MAX_SAFE_INTEGER,multiplier*3):multiplier*3;upgrades++;spins++;if(!serverReply)addNumbers();bump();pop('UP! ↑');$('message').textContent='UPGRADE — number values ×3. The wheel grew.';sound('upgrade')}
if(s.type==='spins'){spins+=2;extraSpins+=2;pop('+2!');$('message').textContent='+2 SPINS';sound('spins')}
if(s.type==='duck'){spins++;const duck=addDuck();pop('DUCK!');$('message').textContent='DUCK — free spin. A little friend has arrived.';DuckWorld.playSound(duck)}
results.push(serverReply?{...serverReply.outcome,label:label(s)}:{type:s.type,label:label(s),base:s.base||null,points:Math.round(points),segments:segments.length,probability:p});
if(serverReply){
 segments=serverSegments(serverReply.segments);
 if(Number(serverReply.spin_count)!==totalSpins){
  console.error('Official wheel spin history disagreed with server state; saving blocked',serverReply);
  $('message').textContent='Official wheel synchronization error. Reload to restore your saved spins.';
  $('spinButton').disabled=true;update();return;
 }
 // The terminal score and remaining spins come from the server, even at
 // extreme-number and 500-spin safety limits.
 score=Number(serverReply.score);spins=Number(serverReply.remaining_spins);
}
update();
if(guestRun&&spins>0&&!guestSaveOrPause())return;
if(spins<=0){
 // Classify only after the LAST resolved spin, after every extra-spin effect.
 // This path is shared by guest, official Daily and owner Test Runs.
 sound('final',rarity().color);
 playFinalScoreWave(rarity().color);
 endRun();
}}
function hideDrawPlaceholder(){document.getElementById('drawPlaceholder')?.classList.add('hidden')}
function showDrawPlaceholder(){document.getElementById('drawPlaceholder')?.classList.remove('hidden')}
function setDrawingPanelMode(mode){
 const panel=$('drawPanel'),title=$('drawPanelTitle'),description=$('drawPanelDescription'),note=$('drawSafetyNote');
 if(!panel||!title||!description)return;
 const finished=mode==='complete'||mode==='guest-complete'||mode==='test-complete';
 panel.classList.toggle('daily-finished',finished);
 panel.classList.toggle('draw-unavailable',mode==='unavailable');
 // Do not leave the Pen or Fill button selected beneath the translucent
 // completed-state scrim. Restore the actual tool on the next editable run.
 panel.querySelectorAll('.drawing-tool').forEach(button=>{
  button.classList.toggle('active',mode==='ready'&&button.dataset.tool===drawTool);
  button.setAttribute('aria-pressed',String(mode==='ready'&&button.dataset.tool===drawTool));
 });
 const copy={
  ready:['Drawing Studio','Draw first. Your first spin locks the drawing.'],
  locked:['Drawing locked','Your artwork is saved for this run.'],
  complete:["Today's Daily is complete",'Nice spin! Your drawing is saved. A new canvas opens with your next Daily.'],
  'guest-complete':["Today's guest Daily is complete",'Your drawing is locked. Sign in to claim this Daily, including your score and badges.'],
  'test-complete':['Test Run finished','Your test drawing is locked. Start another Test Run to draw again.'],
  unavailable:['Drawing unavailable','You can draw again when your next Daily becomes available.']
 };
 const lines=copy[mode]||copy.ready;
 title.textContent=lines[0];description.textContent=lines[1];
 // A compact visible lock explanation is shown in the panel instead of
 // floating over the controls. Keep the existing live status accessible.
 const completedHeading=$('drawCompleteHeading'),completedDetail=$('drawCompleteDetail');
 if(completedHeading&&completedDetail){
  const labels={
   complete:['Daily complete · Drawing locked','A fresh canvas opens with your next Daily.'],
   'guest-complete':['Guest Daily complete · Drawing locked','A fresh canvas opens after the next Daily reset.'],
   'test-complete':['Test Run finished · Drawing locked','Start another Test Run for a fresh canvas.']
  };
  const label=labels[mode]||labels.complete;
  completedHeading.textContent=label[0];completedDetail.textContent=label[1];
 }
 note?.classList.toggle('hidden',finished||mode==='unavailable');
}
function setDrawingEditorDisabled(disabled){
 $('drawPanel')?.querySelectorAll('button,input,select').forEach(el=>{el.disabled=disabled});
}
function lockDrawing(){
 stopDrawing();stopPixelStroke();closeDrawingColorPicker();hideDrawPlaceholder();
 drawingLocked=true;$('wheelWrap').classList.add('locked');$('drawPanel').classList.add('locked-panel');
 setDrawingEditorDisabled(true);
 setDrawingPanelMode('locked');
}
function unlockDrawing(){
 drawingLocked=false;$('wheelWrap').classList.remove('locked');$('drawPanel').classList.remove('locked-panel');
 setDrawingEditorDisabled(false);
 setDrawingPanelMode('ready');
}
async function spin(){if(spinning||spins<=0)return;
 if(!profile&&user){$('message').textContent='Loading your account. Please wait.';return;}
 if(profile?.is_owner&&!ownerModeChosen){$('message').textContent='Choose Official Daily or Test Run before spinning.';$('spinButton').classList.add('hidden');return;}
 // Auth events can arrive after the wheel is ready, especially on a refreshed owner tab.
 // Recheck the persisted session before telling a signed-in player to log in.
 if(!user||!profile){
  $('spinButton').disabled=true;
  try{
   const {data:sessionData}=await criloDB.auth.getSession();
   const sessionUser=sessionData?.session?.user;
   if(sessionUser){
    user=sessionUser;
    if(Crilo.profile?.id===user.id)profile=Crilo.profile;
    if(!profile){
     const {data:loadedProfile}=await criloDB.from('profiles').select('id,username,is_owner').eq('id',user.id).maybeSingle();
     if(loadedProfile)profile=loadedProfile;
    }
   }
  }catch(err){console.error('Could not restore sign-in for spin',err)}
  $('spinButton').disabled=false;
 }
 if(!started){guestRun=!user; if(user&&!profile){open('profileModal');return}beginRun();}
 if(guestRun&&!isTest&&!guestDailyClaimedHere&&!await claimGuestDaily())return;
 if(guestRun&&!guestOwnsDaily()){guestDailyShow('Your guest Daily moved to another tab. Refresh to resume.');return;}
lockDrawing();
// Keep the same diameter, counters and scroll position for every SPIN.
spinning=true;$('spinButton').disabled=true;
let officialReply=null;
if(guestRun&&!isTest){
 try{
  const lastCount=totalSpins;
  const state=await restoreGuestServerState();
  if(state.finished){spinning=false;await endRun();return;}
  if(Number(state.spin_count)>lastCount){
   spinning=false;$('spinButton').disabled=false;saveGuestDaily();
   $('message').textContent='Your previous guest spin was restored. Press SPIN to continue.';
   return;
  }
  const {data,error}=await criloDB.rpc('crilo_guest_spin',{p_token:guestProofRecord()?.verifiedToken});
  if(error||!data)throw error||new Error('No verified guest outcome');
  officialReply=data;
 }catch(error){
  spinning=false;$('spinButton').disabled=false;
  $('message').textContent='Could not verify this guest spin. Reconnect and try again.';
  console.warn('Verified guest spin failed',error);return;
 }
}
if(officialServerMode()){
 try{
  // Recover any completed server spin before making another irreversible request.
  const priorLocalSpins=totalSpins;
  const state=await restoreOfficialServerState();
  if(state.finished){
   spinning=false;
   $('message').textContent='Restoring your completed official Daily.';
   await endRun();return;
  }
  if(Number(state.spin_count)>priorLocalSpins){
   spinning=false;
   $('spinButton').disabled=false;
   $('message').textContent='Saved spins restored. Press SPIN to continue.';
   return;
  }
  if(Number(state.spin_count)<priorLocalSpins)throw new Error('Server spin count decreased');
  const {data,error}=await criloDB.rpc('crilo_server_spin',{p_session:serverSessionId});
  if(error||!data)throw error||new Error('No authoritative spin response');
  officialReply=data;
 }catch(err){
  spinning=false;$('spinButton').disabled=false;
  $('message').textContent=String(err?.message||'').includes('Gmail alias already linked')?
    'This Gmail address is an alias of an older Crilo account. Sign in with the original address to play the Daily.':
    String(err?.message||'').includes('previous Daily has closed')?
   'The previous Daily has closed. Refresh this page to begin the new Daily.':
   'Could not confirm the official spin. Press SPIN to safely restore server state before requesting another spin.';
  console.error('Authoritative Daily spin failed',err);return;
 }
}
const N=segments.length,a=Math.PI*2/N,index=officialReply?Number(officialReply.outcome_index):Math.floor(Math.random()*N),target=index*a+a/2-Math.PI/2,current=((rotation%(Math.PI*2))+Math.PI*2)%(Math.PI*2);let desired=(-Math.PI/2-target)%(Math.PI*2);if(desired<0)desired+=Math.PI*2;let delta=desired-current;if(delta<0)delta+=Math.PI*2;const start=rotation,end=rotation+Math.PI*2*(5+Math.floor(Math.random()*3))+delta,t0=performance.now(),dur=2800;let lastTick=-1;
if(guestRun&&!isTest){
 const outcome=segments[index];
 const pending={index,rotation:end,upgradeBases:[],verified:true};
 if(!guestSaveOrPause(pending))return;
 guestPendingUpgradeBases=null;
}
spins--;totalSpins++;update();$('message').textContent='...';
function anim(t){let p=Math.min(1,(t-t0)/dur),ease=1-Math.pow(1-p,4);rotation=start+(end-start)*ease;const tick=Math.floor(rotation/a);if(tick!==lastTick){lastTick=tick;sound('tick')}drawWheel();if(p<1)requestAnimationFrame(anim);else{rotation=end;spinning=false;resolve(segments[index],officialReply);if(spins>0)$('spinButton').disabled=false}}requestAnimationFrame(anim)}
// Size the wheel ONCE on page load before any Daily/Test run is chosen.
// Changing size on the first SPIN makes the wheel and button jump.
let playLayoutWidth=0,playLayoutHeight=0;
function fitPlayViewport(){
 const body=document.body;
 const stage=document.querySelector('.wheel-stage');
 const button=$('spinButton');
 const header=document.querySelector('.topbar');
 if(!body||!stage||!button)return;
 body.classList.add('wheel-session-fit');
 const viewportHeight=Math.min(window.innerHeight||9999,window.visualViewport?.height||9999);
 const viewportWidth=window.innerWidth||document.documentElement.clientWidth||375;
 const headerHeight=header?.getBoundingClientRect().height||68;
 const stageRect=stage.getBoundingClientRect();
 const buttonRect=button.getBoundingClientRect();
 // Measure the actual gap to the bottom of SPIN and reserve enough for the
 // score, counters and an owner run-mode banner that may appear later.
 // Previously an oversized 260/300px allowance + 60px margin made the
 // drawing wheel unnecessarily small on laptops and tablets.
 const measuredBelow=Math.max(0,buttonRect.bottom-stageRect.bottom);
 const reservedBelow=viewportWidth<=700?225:250;
 const belowWheel=Math.max(reservedBelow,measuredBelow);
 const room=viewportHeight-headerHeight-belowWheel-40;
 // Short desktop viewports need a little more room for the rarity score,
 // run counters, and completion actions. Keep the generous 640px cap on
 // phones/tablets; choose the diameter once BEFORE a spin starts.
 const desktopCap=viewportWidth>=1024
  ?Math.min(570,Math.floor(viewportHeight*.55)):640;
 const diameter=Math.max(140,Math.floor(Math.min(desktopCap,viewportWidth-24,room)));
 body.style.setProperty('--crilo-wheel-fit',diameter+'px');
 playLayoutWidth=viewportWidth;playLayoutHeight=viewportHeight;
}
function alignPlayViewport(){
 const stage=document.querySelector('.wheel-stage');
 const header=document.querySelector('.topbar');
 if(!stage||typeof window.scrollTo!=='function')return;
 // Align once on Daily/Test selection; never scroll during any SPIN.
 requestAnimationFrame(()=>{
  const headerHeight=header?.getBoundingClientRect().height||68;
  const top=stage.getBoundingClientRect().top+window.scrollY-headerHeight-25;
  const root=document.documentElement;
  const previous=root.style.scrollBehavior;
  root.style.scrollBehavior='auto';
  window.scrollTo({top:Math.max(0,top),behavior:'instant'});
  root.style.scrollBehavior=previous;
 });
}
window.addEventListener('resize',()=>{
 if(!document.body?.classList?.contains('wheel-session-fit')||spinning)return;
 const h=Math.min(window.innerHeight||9999,window.visualViewport?.height||9999);
 // Intentional desktop resizes and phone orientation changes can refit;
 // brief Safari address-bar changes should leave the wheel untouched.
 if(Math.abs((window.innerWidth||0)-playLayoutWidth)>18||
    (window.innerWidth>700&&Math.abs(h-playLayoutHeight)>70))
  fitPlayViewport();
});
function beginRun(alignPlay=false){
 resetFinalCelebration();
 if(!user&&!isTest){
  const saved=guestDailyRecord();
  if(saved?.status==='started'&&saved.version===GUEST_DAILY_SCHEMA&&saved.verifiedToken&&guestDailyValid(saved.state)){
   if(restoreGuestDaily(saved))return;
  }
  if(guestDailyLocked())return;
 }
 // A genuinely new run must never inherit a disabled editor from a prior
 // guest, official Daily, or completed owner Test Run.
 if(drawingLocked){
  dctx.clearRect(0,0,drawing.width,drawing.height);
  showDrawPlaceholder();undoStack=[];redoStack=[];
 }
 unlockDrawing();
 document.body?.classList?.remove('wheel-run-active');serverSessionId=null;$('retrySaveBtn').classList.add('hidden');$('retrySaveBtn').disabled=false;DuckWorld.clear();if(!user)guestRun=true;else guestRun=false;$('guestSaveNotice').classList.add('hidden');started=true;score=0;spins=5;multiplier=1;upgrades=0;doubles=0;ducks=0;totalSpins=0;numbersLanded=0;extraSpins=0;bestRollPoints=0;bestRollLabel='';rotation=0;results=[];runProbability=1;resetSegments();resetRecentPaintColors();$('result').classList.add('hidden');$('playedPanel').classList.add('hidden');$('resultNextDaily').classList.add('hidden');$('reviewDailyBtn').classList.add('hidden');$('reviewDailyBtn').setAttribute('aria-expanded','false');showDailyRecap(null);$('message').classList.remove('hidden');$('spinButton').classList.remove('hidden');$('spinButton').disabled=false;setDrawingPanelMode('ready');update();if(alignPlay)alignPlayViewport()}
// Save only the image needed for the public Daily. WebP is optional: browsers
// without it, or drawings that are already smaller as PNG, keep the original.
function optimizedDailyDrawing(canvas,isBlank){
 if(isBlank)return null;
 const png=canvas.toDataURL('image/png');
 try{
  const webp=canvas.toDataURL('image/webp',0.96);
  // Favor visual fidelity over a tiny byte reduction.
  if(webp.startsWith('data:image/webp;base64,') && webp.length<=png.length*0.8)return webp;
 }catch(err){console.warn('Optional drawing compression unavailable',err)}
 return png;
}
async function endRun(){if(finalSaveInProgress)return;finalSaveInProgress=true;try{DuckWorld.clear(); $('spinButton').disabled=true;started=false;
 setDrawingPanelMode(guestRun?'guest-complete':isTest?'test-complete':'complete');
 const r=rarity();if(guestRun){completeGuestDaily();renderResult(r);showGuestBadgePreview(r);$('resultNextDaily').classList.remove('hidden');$('resultEyebrow').textContent='GUEST RUN COMPLETE';$('message').textContent='Guest Daily complete! Sign in to save this score, badges, and leaderboard place.';$('guestSaveNotice').classList.remove('hidden');$('replayTestBtn').classList.add('hidden');setTimeout(()=>{if(guestRun&&!user)open('guestFinishModal');},Math.max(0,lastFinalAnimationMs));if(user&&profile)await claimFinishedGuestDaily();return}let drawingData=null;const pixels=dctx.getImageData(0,0,drawing.width,drawing.height).data;let drawingIsBlank=true;for(let i=3;i<pixels.length;i+=4){if(pixels[i]!==0){drawingIsBlank=false;break}}
 // Guest drawings stay in guest-only storage; owner Test Runs retain their
 // original PNG behavior. Official runs use the smaller safe representation.
 drawingData=isTest?drawing.toDataURL('image/png'):optimizedDailyDrawing(drawing,drawingIsBlank);
 const draftKey=officialServerMode()&&user?.id?'crilo-pending-official-drawing-'+user.id:'';
 if(draftKey&&serverSessionId){try{
  const prior=JSON.parse(localStorage.getItem(draftKey)||'null');
  if(drawingIsBlank&&prior?.sessionId===serverSessionId&&typeof prior.drawing==='string'&&/^data:image\/(?:png|webp);base64,/.test(prior.drawing)){
   drawingData=prior.drawing;drawingIsBlank=Boolean(prior.isBlank);
  }
  localStorage.setItem?.(draftKey,JSON.stringify({sessionId:serverSessionId,drawing:drawingData,isBlank:drawingIsBlank}));
 }catch(err){console.warn('Could not cache Daily drawing',err)}}
 const payload={user_id:user.id,run_date:Crilo.dailyPeriod(),score:Math.round(score),spins:totalSpins,upgrades,doubles,ducks,drawing:drawingData,drawing_is_blank:drawingIsBlank,numbers_landed:numbersLanded,extra_spins:extraSpins,best_roll_points:bestRollPoints,best_roll_label:bestRollLabel,rarity_score:r.probability,rarity_label:r.label,rarity_odds:r.odds,results,...(officialServerMode()?{verified_spin_session_id:serverSessionId}:{})};let data=null,error=null;let priorBadges=null;
if(!isTest){const before=await criloDB.from('user_badges').select('badge_id').eq('user_id',user.id);if(!before.error)priorBadges=new Set((before.data||[]).map(b=>String(b.badge_id)));}
if(isTest){
 // A Test Run must never fall through to official Daily storage, even if
 // ownership/session information becomes stale while the wheel is active.
 if(!profile?.is_owner){
  error=new Error('Only the owner may save a Test Run. Nothing was submitted as an official Daily.');
 }else{
  const response=await criloDB.rpc('crilo_save_owner_test_run',{p_run:payload});
  error=response.error;
  if(!error)data={is_test:true,id:response.data};
 }
}else{
 const response=await criloDB.from('daily_runs').insert(payload).select('is_test,daily_period').single();
 data=response.data;error=response.error;
 if(error&&serverSessionId){
  // A lost HTTP response may hide a successful insert. Look up its immutable
  // server proof before retrying, to avoid duplicate-save confusion.
  const prior=await criloDB.from('daily_runs').select('id,daily_period').eq('user_id',user.id).eq('verified_spin_session_id',serverSessionId).maybeSingle();
  if(prior.data?.id){data={...prior.data,is_test:false};error=null;}
 }
}
renderResult(r);
$('replayTestBtn').classList.toggle('hidden',!profile?.is_owner);
if(error){
 $('retrySaveBtn').classList.toggle('hidden',isTest);$('retrySaveBtn').disabled=false;
 $('message').textContent='Run finished, but saving failed: '+error.message+'. Your server spins are safe — retry saving your Daily.';
 console.error(error);return;
}
$('retrySaveBtn').classList.add('hidden');
if(draftKey){try{localStorage.removeItem?.(draftKey)}catch(err){console.warn('Could not clear Daily drawing cache',err)}}
if(isTest){
 $('message').textContent='Private test run saved. It does not count toward leaderboards, badges, or official Dailies.';
 $('replayTestBtn').classList.remove('hidden');
}else{
 $('resultNextDaily').classList.remove('hidden');$('message').textContent='Official Daily saved. See how you ranked.';
 if(window.CriloBadgeEvents){
  await window.CriloBadgeEvents.track('daily_run_screen');
  await window.CriloBadgeEvents.track('daily_results');
  if(!drawingIsBlank)await window.CriloBadgeEvents.track('drawing_mark');
  if(usedFillOnOfficial)await window.CriloBadgeEvents.track('drawing_canvas');
 }
 if(priorBadges)await showNewBadges(priorBadges);
 else{
  $('newBadgePanel').open=false;
  $('newBadgePanel').classList.remove('hidden');
  $('newBadgeCount').textContent='BADGE RESULTS UNAVAILABLE';
  $('newBadgeOrder').textContent='OFFICIAL DAILY';
  $('newBadgeList').textContent='Unable to check the badges earned during this run.';
 }
 officialRun={...payload,is_test:false};
 update(); // Immediately show the completed DAILY SCORE.
 
}
}finally{finalSaveInProgress=false}
}
// Guests cannot be granted server badges. Only show a clearly labeled
// score-tier preview, never an awarded badge or saved achievement.
function showGuestBadgePreview(r){
 const tier=String(r?.color||'trash').toLowerCase();
 const allowed=['trash','common','uncommon','rare','epic','anomaly','mythic'];
 const safeTier=allowed.includes(tier)?tier:'trash';
 const title=safeTier[0].toUpperCase()+safeTier.slice(1)+' Score';
 const panel=$('newBadgePanel');
 panel.open=false;
 panel.classList.add('guest-badge-mode');
 $('newBadgeCount').textContent='BADGES YOU COULD EARN';
 $('newBadgeOrder').textContent='GUEST PREVIEW · NOT AWARDED';
 $('newBadgeList').innerHTML=
  '<div class="badge-top-chip new-badge-item guest-badge-item" data-badge-rarity="'+safeTier+'">'+
   '<span class="new-badge-item-copy"><strong>'+title+'</strong>'+
   '<small>'+safeTier.toUpperCase()+' · PREVIEW ONLY</small>'+
   '<p>Your final score would qualify for this score-tier badge in an official Daily.</p></span></div>'+
  '<p class="guest-badge-disclaimer">Guest runs do not earn or save badges. '+
  'Sign in to claim this completed guest Daily and earn any badges it qualifies for. Badges are not awarded until the claim succeeds.</p>';
 panel.classList.remove('hidden');
}
// Only compare badge IDs before/after this official Daily. Badge rules and
// award timing remain server-side; Owner Test Runs never reach this path.
async function showNewBadges(prior,{review=false}={}){
 const panel=$('newBadgePanel');
 panel.open=false;
 panel.classList.remove('guest-badge-mode');
 $('newBadgeCount').textContent='CHECKING BADGES EARNED';
 $('newBadgeOrder').textContent='OFFICIAL DAILY';
 $('newBadgeList').textContent='Checking your official Daily awards…';
 panel.classList.remove('hidden');
 const {data:earned,error}=await criloDB.from('user_badges')
  .select('badge_id').eq('user_id',user.id);
 if(error){
  $('newBadgeCount').textContent='BADGE RESULTS UNAVAILABLE';
  $('newBadgeList').textContent='Could not load badge results. Try Badge Collections later.';
  return;
 }
 const ids=[...new Set((earned||[]).map(x=>String(x.badge_id)))]
  .filter(id=>!prior.has(id));
 if(!review&&!isTest&&user?.id){
  try{localStorage.setItem('crilo-reviewed-daily-badges:'+user.id+':'+Crilo.dailyPeriod(),JSON.stringify(ids))}
  catch(_){}
 }
 if(!ids.length){
  $('newBadgeCount').textContent=review?'NO BADGES LINKED TO THIS DAILY':'NO NEW BADGES THIS DAILY';
  $('newBadgeOrder').textContent='OFFICIAL DAILY';
  $('newBadgeList').textContent=review?'No badges linked to this saved Daily were found.':'No new badges were awarded on this run.';
  return;
 }
 const {data:badges,error:badgeError}=await criloDB.from('badges')
  .select('id,badge_key,name,description,category,requirement,is_secret').in('id',ids);
 if(badgeError||!badges?.length){
  $('newBadgeCount').textContent='BADGE DETAILS UNAVAILABLE';
  $('newBadgeList').textContent='Badges were awarded, but their details could not be loaded.';
  return;
 }
 const collection=window.CriloBadgeCollection;
 const rarity=b=>collection?.rarity(b)||String(b.requirement?.rarity||'common').toLowerCase();
 // Display new rewards from lowest to highest rarity, independent of
 // whatever order the database returned. Trash (if awarded) precedes Common.
 const order=collection?.rarityOrder||['trash','common','uncommon','rare','epic','anomaly','mythic'];
 const ranks=new Map(order.map((tier,index)=>[tier,index]));
 const sorted=badges.slice().sort((a,b)=>
  (ranks.get(rarity(a))??1)-(ranks.get(rarity(b))??1)||
  String(a.name||'').localeCompare(String(b.name||'')));
 const byKey=new Map(badges.map(b=>[String(b.badge_key),b]));
 $('newBadgeCount').textContent=badges.length+' BADGE'+(badges.length===1?'':'S')+' EARNED';
 $('newBadgeOrder').textContent=review?'SAVED OFFICIAL DAILY · RARITY ORDER':'SORTED BY RARITY';
 $('newBadgeList').innerHTML=sorted.map(b=>{
  const tier=rarity(b),label=Crilo.esc(String(b.name||'Badge'));
  return '<button type="button" class="badge-top-chip new-badge-item"'+
   ' data-badge-key="'+Crilo.esc(String(b.badge_key))+
   '" data-badge-rarity="'+Crilo.esc(tier)+
   '" aria-label="Preview newly earned '+label+' badge">'+
   '<span class="new-badge-item-copy"><strong>'+label+'</strong>'+
   '<small>'+Crilo.esc(tier.toUpperCase())+' · UNLOCKED</small>'+
   '<p>'+Crilo.esc(b.description||'')+'</p></span>'+
   '<span class="new-badge-open" aria-hidden="true">↗</span></button>';
 }).join('');
 $('newBadgePanel').classList.remove('hidden');
 const list=$('newBadgeList'),dialog=$('dailyBadgePreviewDialog');
 list.onclick=event=>{
  const button=event.target.closest?.('button[data-badge-key]');
  const b=button&&byKey.get(button.dataset.badgeKey);
  if(!b||!collection||!dialog)return;
  $('dailyBadgePreviewCard').innerHTML=collection.tileHTML(b,true,Crilo.esc,{expanded:true,interactive:false});
  $('dailyBadgePreviewSetName').textContent=String(b.category||'Badge collection')+' · UNLOCKED';
  $('dailyBadgePreviewOpenSet').href='badge-sets.html?badge='+encodeURIComponent(String(b.badge_key));
  dialog.showModal();$('dailyBadgePreviewClose').focus();
 };
 $('dailyBadgePreviewClose').onclick=()=>dialog.close();
 dialog.onclick=event=>{if(event.target===dialog)dialog.close()};
}
/* Share one completed-state summary across restored official runs, guest
   Dailies and the owner's completed-Daily selector. Scores come from the
   existing saved record; neither Test Runs nor removed Dailies appear here. */
/* The success card stays minimal. The owner-only Daily/Test selector
   retains its separate recap; the public score stays in the wheel HUD. */
// A saved official Daily is reviewed from its persisted database record,
// without re-running, editing the canvas, or mutating owner Test Run state.
const reviewBadgeKey=record=>'crilo-reviewed-daily-badges:'+user?.id+':'+record?.daily_period;
let reviewBusy=false;
async function showSavedDailyBadges(record){
 const panel=$('newBadgePanel');
 panel.open=false;
 panel.classList.remove('hidden','guest-badge-mode');
 $('newBadgeCount').textContent='BADGES EARNED THIS DAILY';
 $('newBadgeOrder').textContent='OFFICIAL DAILY';
 $('newBadgeList').textContent='Loading saved badge awards…';
 let badgeIds=[];
 try{
  const cached=JSON.parse(localStorage.getItem(reviewBadgeKey(record))||'null');
  if(Array.isArray(cached))badgeIds=cached.filter(id=>/^\d+$/.test(String(id)));
 }catch(_){}
 try{
  if(record.id!=null){
   const {data:linked,error}=await criloDB.from('user_badges')
    .select('badge_id').eq('user_id',user.id).eq('run_id',record.id);
   if(error)throw error;
   badgeIds.push(...(linked||[]).map(b=>String(b.badge_id)));
  }
  badgeIds=[...new Set(badgeIds)];
  if(!badgeIds.length){
   $('newBadgeCount').textContent='NO BADGES LINKED TO THIS DAILY';
   $('newBadgeList').textContent='No badges linked to this run were found. Visit Badge Collections to see all earned badges.';
   return;
  }
  const {data:all,error:allError}=await criloDB.from('user_badges')
   .select('badge_id').eq('user_id',user.id);
  if(allError)throw allError;
  const selected=new Set(badgeIds);
  const prior=new Set((all||[]).map(row=>String(row.badge_id)).filter(id=>!selected.has(id)));
  await showNewBadges(prior,{review:true});
 }catch(error){
  console.warn('Daily badge review unavailable',error);
  $('newBadgeCount').textContent='BADGE REVIEW UNAVAILABLE';
  $('newBadgeList').textContent='Could not load this run’s awards. Your badges remain in Badge Collections.';
 }
}
async function toggleDailyReview(){
 const btn=$('reviewDailyBtn');
 const guestRecord=!user?guestDailyRecord():null;
 const guestFinished=!!guestRecord&&guestRecord.status==='complete'&&guestDailyValid(guestRecord.state);
 const officialSaved=!!user&&!!officialRun&&!officialRun.blocked;
 if(reviewBusy||(!officialSaved&&!guestFinished)||(isTest&&started))return;
 if(!$('result').classList.contains('hidden')){
  $('result').classList.add('hidden');
  btn.setAttribute('aria-expanded','false');
  btn.firstChild.textContent='REVIEW DAILY ';
  return;
 }
 reviewBusy=true;btn.disabled=true;
 try{
  const saved=guestFinished?{
   score:guestRecord.score,spins:guestRecord.spins,
   upgrades:guestRecord.state.upgrades,doubles:guestRecord.state.doubles,
   ducks:guestRecord.state.ducks,extra_spins:guestRecord.state.extraSpins,
   best_roll_points:guestRecord.state.bestRollPoints,results:guestRecord.state.results
  }:officialRun;
  const r=window.CriloRarity.classify(Number(saved.score)||0);
  renderResult(r,saved);
  $('resultEyebrow').textContent=guestFinished?'GUEST DAILY COMPLETE':'YOUR OFFICIAL DAILY';
  $('resultNextDaily').classList.remove('hidden');
  if(guestFinished){
   showGuestBadgePreview(r);
   $('guestSaveNotice').classList.remove('hidden');
  }else await showSavedDailyBadges(saved);
  btn.setAttribute('aria-expanded','true');
  btn.firstChild.textContent='HIDE DAILY REVIEW ';
  $('result').scrollIntoView?.({behavior:'smooth',block:'start'});
 }finally{btn.disabled=false;reviewBusy=false}
}
function showDailyRecap(record,mode='official'){
 const amount=Number(record?.score);
 const owner=mode==='official'&&!!profile?.is_owner&&!!record&&!record.blocked&&
   Number.isFinite(amount)&&amount>=0;
 $('ownerCompleteRecap')?.classList.toggle('hidden',!owner);
 if(!owner)return;
 const band=window.CriloRarity?.scoreBands?.find(item=>amount<=item.max);
 $('ownerCompleteScore').textContent=fmt(amount)+' points · '+
   String(band?.key||'trash').toUpperCase();
}
function syncDailyCountdown(clock){
 $('resultNextCountdown').textContent=clock;
 $('ownerCompleteNext').textContent='Next Daily in '+clock;
}
function renderResult(r,stored=null){
 const saved=stored&&typeof stored==='object'?stored:null;
 const number=(field,fallback=0)=>saved&&Number.isFinite(Number(saved[field]))?Number(saved[field]):fallback;
 const badgePanel=$('newBadgePanel');
 badgePanel.open=false;
 badgePanel.classList.add('hidden');
 badgePanel.classList.remove('guest-badge-mode');
 $('newBadgeList').replaceChildren();
 $('newBadgeOrder').textContent='SORTED BY RARITY';
 $('resultNextDaily').classList.add('hidden');
 $('result').classList.remove('hidden');
 $('result').dataset.rarity=r.color;
 $('resultEyebrow').textContent=isTest?'TEST RUN COMPLETE':'DAILY COMPLETE';
 $('finalScore').textContent=fmt(number('score',score));
 $('rarityLabel').textContent=saved?.rarity_label||r.label;
 const savedTail=Number(saved?.rarity_score);
 $('rarityOdds').textContent=saved&&saved.rarity_score!==null&&saved.rarity_score!==undefined&&
   Number.isFinite(savedTail)&&savedTail>=0&&savedTail<=1?
    (savedTail*100).toFixed(2)+'% of simulated runs scored at least this high.':
    r.explanation;
 $('statSpins').textContent=number('spins',totalSpins);
 $('statUpgrades').textContent=number('upgrades',upgrades);
 $('statDoubles').textContent=number('doubles',doubles);
 $('statDucks').textContent=number('ducks',ducks);
 $('statExtra').textContent=number('extra_spins',extraSpins);
 const best=Array.isArray(saved?.results)?saved.results.reduce((value,spin)=>
   Math.max(value,Number(spin?.points)||0),0):bestRollPoints;
 $('statBestRoll').textContent=fmt(number('best_roll_points',best));
}
async function checkPlayed(){if(!user)return;const period=Crilo.dailyPeriod();const {data:penalty,error:penaltyError}=await criloDB.rpc('crilo_my_daily_penalty',{p_period:period});if(penaltyError)console.warn('Daily eligibility check:',penaltyError.message);const {data:played}=await criloDB.from('daily_runs').select('id,score,spins,upgrades,doubles,ducks,extra_spins,best_roll_points,rarity_label,rarity_score,rarity_odds,results,drawing,daily_period').eq('user_id',user.id).eq('daily_period',period).eq('is_test',false).maybeSingle();const data=penalty?.blocked?{score:0,drawing:null,blocked:true,reason:penalty.reason}:played;officialRun=data||null;showDailyRecap(data,data?.blocked?'blocked':'official');
 $('reviewDailyBtn').classList.toggle('hidden',!data||!!data.blocked);
 if(!data||data.blocked){
  $('result').classList.add('hidden');
  $('reviewDailyBtn').setAttribute('aria-expanded','false');
 }
// Refresh the score HUD from the same database row as the completed-Daily card.
if(data)update();
if(profile?.is_owner){$('ownerDailyChoiceBtn').disabled=!!data;$('ownerDailyChoiceBtn').title=data?'Official Daily already completed for this period.':'Play your one official Daily.';}if(data){lockDrawing();setDrawingPanelMode(data.blocked?'unavailable':'complete');$('message').classList.add('hidden');$('playedPanel').querySelector('strong').textContent=data.blocked?'Official Daily removed':'Official Daily complete';if(profile?.is_owner){$('ownerRunControls').classList.add('hidden');$('ownerSaveRunBtn').textContent='Play Test Run';$('ownerRunModeHint').textContent='Official Daily complete. Private test runs do not count toward rankings or badges.';}$('playedPanel').classList.remove('hidden');$('playedText').textContent=data.blocked?'This Daily was removed for '+data.reason+'. Your score and points were removed, your current streak was reset, and your account received its one official warning. You cannot replay this Daily period.':'Your result is saved. You’re all set for today.';$('spinButton').classList.add('hidden');if(profile?.is_owner){$('playedPanel').classList.add('hidden');$('ownerRunControls').querySelector('strong').textContent='Choose your run';$('ownerRunControls').querySelector('.played-check').textContent='✓';$('ownerRunModeHint').textContent=(data.blocked?'This Daily is locked after an owner removal. Private Test Runs remain available.':'Official Daily saved. Test Runs remain private.');$('ownerDailyChoiceBtn').classList.remove('hidden');$('ownerDailyChoiceBtn').disabled=true;$('ownerDailyChoiceBtn').textContent=data.blocked?'Daily Run — Locked':'Daily Run — Completed';$('ownerSaveRunBtn').textContent='Test Run';$('ownerRunControls').classList.remove('hidden');$('ownerRunControls').classList.add('owner-daily-finished');}if(data.drawing){hideDrawPlaceholder();const img=new Image();img.onload=()=>{dctx.clearRect(0,0,drawing.width,drawing.height);dctx.drawImage(img,0,0,drawing.width,drawing.height);drawingLocked=true;$('wheelWrap').classList.add('locked')};img.src=data.drawing}}else if(!profile?.is_owner){beginRun();$('message').textContent='Your Daily is ready. Press SPIN when you’re ready.';}else{$('ownerRunControls').querySelector('strong').textContent='Choose your run';$('ownerRunControls').querySelector('.played-check').textContent='↻';$('ownerRunModeHint').textContent='Daily Run counts toward rankings and badges. Test Run is private.';$('ownerDailyChoiceBtn').classList.remove('hidden');$('ownerDailyChoiceBtn').disabled=false;$('ownerDailyChoiceBtn').textContent='Daily Run';$('ownerSaveRunBtn').textContent='Test Run';$('ownerRunControls').classList.remove('owner-daily-finished');$('spinButton').classList.add('hidden');$('ownerRunControls').classList.remove('hidden');$('ownerActiveMode').classList.add('hidden');$('message').textContent='Choose Daily Run or Test Run before spinning.';}}
function open(id){$(id)?.classList.remove('hidden')}function close(id){$(id)?.classList.add('hidden')}
async function sendMagicLink(){const email=$('emailInput').value.trim();if(!email){$('authStatus').textContent='Enter your email first.';return}$('sendLinkBtn').disabled=true;const {error}=await criloDB.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});$('sendLinkBtn').disabled=false;$('authStatus').textContent=error?error.message:'Check your email for the sign-in link.'}
async function saveProfile(){const username=$('usernameInput').value.trim(),name_color=$('nameColorInput').value;const usernameError=Crilo.validateUsername(username);if(usernameError){$('profileStatus').textContent=usernameError;return}const {error}=await criloDB.from('profiles').upsert({id:user.id,username,name_color},{onConflict:'id'});if(error){$('profileStatus').textContent=error.code==='23505'?'That username is taken.':error.message;return}close('profileModal');await Crilo.refreshIdentity();location.reload()}
function startTest(save=true){if(!profile?.is_owner||spinning)return;stopDrawing();stopPixelStroke();ownerModeChosen=true;isTest=true;usedFillOnOfficial=false;saveOwnerTest=true;$('ownerActiveMode').textContent='TEST RUN — private, no leaderboard or badges';$('ownerActiveMode').classList.remove('hidden');$('ownerRunControls').classList.add('hidden');$('spinButton').classList.remove('hidden');$('testBanner').classList.remove('hidden');unlockDrawing();dctx.clearRect(0,0,drawing.width,drawing.height);showDrawPlaceholder();undoStack=[];redoStack=[];beginRun(true)}
function countdown(){const diff=Math.max(0,Crilo.nextReset()-new Date()),s=Math.floor(diff/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;const clock=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;$('resetCountdown').textContent='NEXT DAILY '+clock;syncDailyCountdown(clock);if(diff<1000&&!(started&&!isTest&&!guestRun&&(totalSpins>0||spinning))&&!finalSaveInProgress&&!(!isTest&&!guestRun&&serverSessionId&&!officialRun))setTimeout(()=>location.reload(),1200)}setInterval(countdown,1000);countdown();
window.addEventListener('storage',event=>{
 if(event.key!==GUEST_DAILY_STORAGE_KEY||user||isTest)return;
 if(guestDailyClaimedHere&&!guestOwnsDaily()){
  guestDailyClaimedHere=false;
  guestDailyShow('This guest Daily was opened in another tab. Refresh this page to resume the saved progress.');
 }else if(!guestDailyClaimedHere&&!started&&!spinning){
  guestDailyLocked();
 }
});
let guestClaimInProgress=false;
async function claimFinishedGuestDaily(){
 if(guestClaimInProgress||!user||!profile)return false;
 const saved=guestProofRecord();
 if(!saved||saved.status!=='complete'||saved.version!==GUEST_DAILY_SCHEMA||!saved.verifiedToken)return false;
 guestClaimInProgress=true;
 $('message').classList.remove('hidden');
 $('message').textContent='Saving your completed guest Daily to your account…';
 try{
  const before=await criloDB.from('user_badges').select('badge_id').eq('user_id',user.id);
  const priorBadges=before.error?null:new Set((before.data||[]).map(x=>String(x.badge_id)));
  const isBlank=Boolean(saved.drawingIsBlank);
  const {data,error}=await criloDB.rpc('crilo_claim_guest_daily',{
   p_token:saved.verifiedToken,
   p_drawing:isBlank?null:saved.state?.drawing,
   p_drawing_is_blank:isBlank
  });
  if(error||!data||!['saved','already_saved'].includes(data.status))
   throw error||new Error('The server did not confirm your guest run');
  localStorage.removeItem(GUEST_DAILY_STORAGE_KEY);
  guestDailyClaimedHere=false;guestDailyClaimedPeriod=null;guestRun=false;
  close('guestFinishModal');close('authModal');
  $('guestSaveNotice').classList.add('hidden');
  $('message').textContent='Guest Daily saved! Your score now counts toward leaderboards, stats and badges.';
  try{
   if(data.status==='saved'&&window.CriloBadgeEvents){
    await window.CriloBadgeEvents.track('daily_run_screen');
    await window.CriloBadgeEvents.track('daily_results');
    if(!isBlank)await window.CriloBadgeEvents.track('drawing_mark');
   }
   if(data.status==='saved'&&priorBadges)await showNewBadges(priorBadges);
  }catch(badgeError){console.warn('Claim succeeded; follow-up badge event not confirmed',badgeError)}
  $('guestClaimRetryBtn')?.classList.add('hidden');
  try{await DuckWorld.load(criloDB,user)}catch(loadError){console.warn('Duck refresh pending',loadError)}
  await checkPlayed();
  return true;
 }catch(error){
  console.warn('Guest Daily claim failed',error);
  $('message').textContent='Guest run preserved, but not yet saved: '+
   (error?.message||'Please sign in and try again.');
  return false;
 }finally{guestClaimInProgress=false}
}
async function handleDailyAuth(e){
 user=e.detail.user;profile=e.detail.profile;ownerModeChosen=!profile?.is_owner;
 $('ownerRunControls').classList.toggle('hidden',!profile?.is_owner);
 if(!user){
  $('message').classList.remove('hidden');
  $('message').textContent='Play for free! Sign up to save future Daily runs.';
  if(!started&&$('result').classList.contains('hidden'))beginRun();
  return;
 }
 if(profile?.is_owner&&!guestRun){
  $('spinButton').classList.add('hidden');
  $('message').textContent='Choose Official Daily or Test Run to begin.';
 }
 if(!profile){open('profileModal');return}
 if(await claimFinishedGuestDaily())return;
 const unclaimed=guestProofRecord();
 if(unclaimed?.status==='complete'&&unclaimed.version===GUEST_DAILY_SCHEMA&&unclaimed.verifiedToken){
  $('guestSaveNotice').classList.remove('hidden');
  $('guestClaimRetryBtn').classList.remove('hidden');
  $('guestSignupBtn').classList.add('hidden');
  return; // Never start an official Daily while its guest claim is unresolved.
 }
 if(unclaimed?.status==='complete'&&unclaimed.version!==GUEST_DAILY_SCHEMA){
  $('message').textContent='This older guest run has no server proof and cannot be added to competitive rankings.';
 }
 if(guestRun&&(started||!$('result').classList.contains('hidden'))){
  $('guestSaveNotice').classList.add('hidden');
  // Signing in mid-guest-run cannot convert that attempt to an official
  // Daily. Explain the distinction instead of saying "Sign up" to a user
  // who is already signed in.
  $('message').classList.remove('hidden');
  $('message').textContent=started?
   'Finish this verified guest Daily to save it to your account.':
   'The guest Daily is preserved, but its claim has not finished.';
  return;
 }
 $('message').classList.remove('hidden');
 $('message').textContent='Checking your Daily…';
 await DuckWorld.load(criloDB,user);
 await checkPlayed();
};
window.addEventListener('crilo-auth-ready',handleDailyAuth);
// A restored login can finish before the large gameplay bundle evaluates.
// Rehydrate once even if we missed that early auth-ready event.
if(Crilo.authResolved){
 handleDailyAuth({detail:{user:Crilo.user,profile:Crilo.profile}})
  .catch(error=>console.warn('Daily rehydration failed',error));
}
window.addEventListener('crilo-signin-request',()=>open('authModal'));
window.addEventListener('crilo-auth-error',e=>{open('authModal');$('authStatus').textContent='Sign-in failed: '+(e.detail?.message||'Please request a new email link.');});
$('reviewDailyBtn').addEventListener('click',toggleDailyReview);
$('retrySaveBtn').addEventListener('click',async()=>{
 if(isTest||guestRun||!user||!serverSessionId||finalSaveInProgress)return;
 $('retrySaveBtn').disabled=true;
 try{
  const state=await restoreOfficialServerState();
  if(!state.finished)throw new Error('Your server spin session is not yet complete.');
  await endRun();
 }catch(err){$('message').textContent='Could not restore completed server spins: '+(err?.message||'Please try again.');$('retrySaveBtn').disabled=false;console.error('Save retry failed',err)}
});
$('rarityInfoBtn').addEventListener('click',()=>{const panel=$('rarityMethod'),open=panel.classList.toggle('hidden')===false;$('rarityInfoBtn').setAttribute('aria-expanded',String(open))});$('spinButton').addEventListener('click',spin);$('guestSignupBtn').addEventListener('click',()=>{
 if(user&&profile){claimFinishedGuestDaily();return}
 open('authModal');
});
$('guestClaimRetryBtn').addEventListener('click',()=>claimFinishedGuestDaily());$('guestFinishSignIn').addEventListener('click',()=>{close('guestFinishModal');open('authModal')});$('guestFinishDismiss').addEventListener('click',()=>close('guestFinishModal'));$('clearDrawing').addEventListener('click',()=>{if(!drawingLocked){snapshot();dctx.clearRect(0,0,drawing.width,drawing.height)}});$('helpBtn').addEventListener('click',()=>open('helpModal'));$('sendLinkBtn').addEventListener('click',sendMagicLink);$('saveProfileBtn').addEventListener('click',saveProfile);$('replayTestBtn').addEventListener('click',()=>startTest(false));$('ownerSaveRunBtn').addEventListener('click',()=>startTest(true));$('ownerDailyChoiceBtn').addEventListener('click',()=>{if(!profile?.is_owner||officialRun||spinning)return;ownerModeChosen=true;isTest=false;usedFillOnOfficial=false;saveOwnerTest=false;$('ownerActiveMode').textContent='OFFICIAL DAILY — counts toward leaderboard and badges';$('ownerActiveMode').classList.remove('hidden');$('testBanner').classList.add('hidden');$('ownerRunControls').classList.add('hidden');beginRun(true);$('message').textContent='OFFICIAL DAILY — this run counts toward the leaderboard and badges.';});document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>close(b.dataset.close)));

let painting=false,last=null,activeDrawingPointer=null,activeDrawingType=null,resumeMainStroke=false;
// Pointer capture can keep sending moves outside a canvas. Never join a stroke
// across its boundary, even if the pointer later re-enters while held down.
function insidePaintArea(canvas,event){
 const rect=canvas.getBoundingClientRect();
 const inside=Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)&&
  rect.width>0&&rect.height>0&&event.clientX>=rect.left&&
  event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;
 if(!inside)return false;
 if(canvas===drawing||canvas===pixelCanvas){
  // Both visible drawing surfaces are circles, not their square canvas boxes.
  // CSS rotation expands getBoundingClientRect() but not the round canvas.
  // Its true diameter is the untransformed clientWidth.
  const radius=(canvas.clientWidth||rect.width)/2;
  const dx=event.clientX-rect.left-rect.width/2;
  const dy=event.clientY-rect.top-rect.height/2;
  return dx*dx+dy*dy<=radius*radius;
 }
 return true;
}
function stopDrawing(event){
 if(activeDrawingPointer===null)return;
 if(event?.pointerId!==undefined&&event.pointerId!==activeDrawingPointer)return;
 const id=activeDrawingPointer;activeDrawingPointer=null;activeDrawingType=null;painting=false;last=null;resumeMainStroke=false;
 try{if(drawing.hasPointerCapture?.(id))drawing.releasePointerCapture(id)}catch(error){
  console.warn('Drawing pointer release:',error);
 }
}
function snapshot(){undoStack.push(dctx.getImageData(0,0,200,200));if(undoStack.length>25)undoStack.shift();redoStack=[]}
function history(from,to){if(drawingLocked||!from.length)return;to.push(dctx.getImageData(0,0,200,200));dctx.putImageData(from.pop(),0,0)}
$('undoDrawing').onclick=()=>history(undoStack,redoStack);$('redoDrawing').onclick=()=>history(redoStack,undoStack);
// Both drawing editors share one mode. Changing either selector updates the
// wheel immediately; closing Pixel Studio never resets the player's choice.
function setCenterDrawingSpinMode(mode){
 if(mode!=='stationary'&&mode!=='spin')return;
 drawMode=mode;
 $('drawMode').value=mode;
 $('pixelDrawMode').value=mode;
 drawWheel();
}
$('drawMode').onchange=e=>setCenterDrawingSpinMode(e.target.value);
$('pixelDrawMode').onchange=e=>setCenterDrawingSpinMode(e.target.value);
document.querySelectorAll('.drawing-tool').forEach(b=>b.onclick=()=>{if(drawingLocked)return;stopDrawing();drawTool=b.dataset.tool;document.querySelectorAll('.drawing-tool').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b))})});
function point(e){
 const r=drawing.getBoundingClientRect(),side=drawing.clientWidth||r.width;
 // Work from the unrotated circular diameter, never its expanded rotated box.
 const x=100+(e.clientX-r.left-r.width/2)*200/side;
 const y=100+(e.clientY-r.top-r.height/2)*200/side;
 if(drawMode==='spin'){
  const a=-rotation,c=100,dx=x-c,dy=y-c;
  return{x:c+dx*Math.cos(a)-dy*Math.sin(a),y:c+dx*Math.sin(a)+dy*Math.cos(a)};
 }
 return{x,y};
}
function fill(x,y){
 const w=CANVAS_SIDE,xx=Math.floor(x),yy=Math.floor(y);
 if(!Number.isFinite(x)||!Number.isFinite(y)||xx<0||yy<0||xx>=w||yy>=w||!insideCirclePixel(xx,yy))return false;
 const img=dctx.getImageData(0,0,w,w),d=img.data,start=yy*w+xx,src=Array.from(d.slice(start*4,start*4+4));
 const hex=$('drawColor').value,col=[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),255];
 if(src.every((v,i)=>v===col[i]))return false;
 const seen=new Uint8Array(w*w),q=[start];seen[start]=1;
 for(let head=0;head<q.length;head++){
  const n=q[head],o=n*4;
  if(!src.every((v,i)=>Math.abs(d[o+i]-v)<24))continue;
  for(let j=0;j<4;j++)d[o+j]=col[j];
  const px=n%w,py=Math.floor(n/w);
  for(const v of [px>0?n-1:-1,px<w-1?n+1:-1,py>0?n-w:-1,py<w-1?n+w:-1]){
   if(v<0||seen[v])continue;
   const vx=v%w,vy=Math.floor(v/w);
   if(!insideCirclePixel(vx,vy))continue;
   seen[v]=1;q.push(v);
  }
 }
 maskInvisibleCorners(d);
 dctx.putImageData(img,0,0);
 return true;
}
function drawDot(p){
 dctx.save();
 dctx.globalCompositeOperation=drawTool==='eraser'?'destination-out':'source-over';
 dctx.fillStyle=drawTool==='eraser'?'#000000':$('drawColor').value;
 dctx.beginPath();dctx.arc(p.x,p.y,3,0,Math.PI*2);dctx.fill();
 dctx.restore();
 if(drawTool!=='eraser')recordPaintColor($('drawColor').value);
}
drawing.addEventListener('pointerdown',e=>{
 if(drawingLocked||isDrawingColorPickerOpen()||activeDrawingPointer!==null||!insidePaintArea(drawing,e)||
    (e.pointerType==='mouse'&&e.button!==0))return;
 e.preventDefault();
 hideDrawPlaceholder();
 const p=point(e);snapshot();
 if(drawTool==='fill'){if(fill(p.x,p.y)){recordPaintColor($('drawColor').value);if(!isTest&&!guestRun)usedFillOnOfficial=true}return}
 resumeMainStroke=false;activeDrawingPointer=e.pointerId;activeDrawingType=e.pointerType;painting=true;last=p;
 try{drawing.setPointerCapture(e.pointerId)}catch(error){stopDrawing(e);return}
 drawDot(p);
});
drawing.addEventListener('pointermove',e=>{
 // A window switch may release pointer capture without releasing the mouse
 // button. Rejoin ONLY if a real mouse move still reports the left button
 // down. If it was released outside, the first hover clears this permission.
 if(!painting&&resumeMainStroke){
  if(e.pointerType==='mouse'&&(e.buttons&1)===1&&!drawingLocked&&
      !isDrawingColorPickerOpen()&&insidePaintArea(drawing,e)){
   resumeMainStroke=false;painting=true;activeDrawingPointer=e.pointerId;
   activeDrawingType=e.pointerType;last=null;
   try{drawing.setPointerCapture(e.pointerId)}catch(error){stopDrawing(e);return}
  }else if(e.pointerType==='mouse'&&(e.buttons&1)===0)resumeMainStroke=false;
 }
 if(!painting||drawingLocked||isDrawingColorPickerOpen()||e.pointerId!==activeDrawingPointer)return;
 if(e.pointerType!=='touch'&&typeof e.buttons==='number'&&(e.buttons&1)===0){
  stopDrawing(e);return;
 }
 if(!insidePaintArea(drawing,e)){last=null;return}
 const p=point(e);
 if(last===null)drawDot(p);
 else{
  dctx.save();
  dctx.globalCompositeOperation=drawTool==='eraser'?'destination-out':'source-over';
  dctx.strokeStyle=drawTool==='eraser'?'#000000':$('drawColor').value;
  dctx.lineWidth=6;dctx.lineCap='round';dctx.lineJoin='round';
  dctx.beginPath();dctx.moveTo(last.x,last.y);dctx.lineTo(p.x,p.y);dctx.stroke();
  dctx.restore();
 }
 last=p;
});
for(const type of ['pointerup','pointercancel'])
 drawing.addEventListener(type,stopDrawing);
drawing.addEventListener('lostpointercapture',event=>{
 const canResume=painting&&event.pointerId===activeDrawingPointer&&activeDrawingType==='mouse';
 stopDrawing(event);
 if(canResume&&!drawingLocked&&!isDrawingColorPickerOpen())resumeMainStroke=true;
});
drawing.addEventListener('pointerleave',e=>{
 if(e.pointerId===activeDrawingPointer)last=null;
});
document.addEventListener('pointerup',stopDrawing);
document.addEventListener('pointercancel',stopDrawing);
const pixelCanvas=$('pixelCanvas'),pixelCtx=pixelCanvas.getContext('2d',{willReadFrequently:true});
const CANVAS_SIDE=200,CANVAS_RADIUS=100;
function insideCirclePixel(x,y){
 const dx=x+.5-CANVAS_RADIUS,dy=y+.5-CANVAS_RADIUS;
 return dx*dx+dy*dy<=CANVAS_RADIUS*CANVAS_RADIUS;
}
function maskInvisibleCorners(pixels){
 for(let y=0;y<CANVAS_SIDE;y++)for(let x=0;x<CANVAS_SIDE;x++){
  if(!insideCirclePixel(x,y)){
   const index=(y*CANVAS_SIDE+x)*4;
   pixels[index]=pixels[index+1]=pixels[index+2]=pixels[index+3]=0;
  }
 }
}
// A circular clipping path prevents pen/eraser strokes leaving invisible
// pixels. ImageData ignores clipping, so flood fills must check the same mask.
for(const context of [dctx,pixelCtx]){
 context.beginPath();context.arc(100,100,100,0,Math.PI*2);context.clip();
}
const recentPaintColors=[];
function renderRecentPaintColors(){
 for(const [hostId,kind] of [['drawRecentSwatches','main'],['pixelRecentSwatches','pixel']]){
  const host=$(hostId);
  if(!host||typeof host.appendChild!=='function')continue;
  // Hide the empty strip on the Daily editor; keep Pixel Studio's own hint.
  if(kind==='main'&&host.parentElement)
   host.parentElement.classList.toggle('has-colors',recentPaintColors.length>0);
  host.replaceChildren();
  if(!recentPaintColors.length){
   if(kind==='main'){
    // Five inert placeholders reserve the swatch slots before the first color.
    for(let i=0;i<5;i++){
     const slot=document.createElement('span');
     slot.className='recent-color-empty-slot';
     slot.setAttribute('aria-hidden','true');
     host.appendChild(slot);
    }
    continue;
   }
   const hint=document.createElement('span');
   hint.className='recent-colors-empty';hint.textContent='Colors you paint with will appear here';
   host.appendChild(hint);continue;
  }
  for(const hex of recentPaintColors){
   const button=document.createElement('button');
   button.type='button';button.className='recent-color-swatch';
   button.style.backgroundColor=hex;button.title=hex;
   button.setAttribute('aria-label','Use recent color '+hex);
   button.addEventListener('click',()=>setActivePaintColor(hex));
   host.appendChild(button);
  }
  if(kind==='main'){
   for(let i=recentPaintColors.length;i<5;i++){
    const slot=document.createElement('span');
    slot.className='recent-color-empty-slot';
    slot.setAttribute('aria-hidden','true');
    host.appendChild(slot);
   }
  }
 }
}
function recordPaintColor(value){
 const color=String(value||'').toLowerCase();
 if(!/^#[a-f0-9]{6}$/.test(color))return;
 const index=recentPaintColors.indexOf(color);
 if(index!==-1)recentPaintColors.splice(index,1);
 recentPaintColors.unshift(color);
 if(recentPaintColors.length>5)recentPaintColors.length=5;
 renderRecentPaintColors();
}
function resetRecentPaintColors(){recentPaintColors.length=0;renderRecentPaintColors()}
// Use the browser's ordinary native color palette, not a second color modal.
// Keep drawing suspended until the chooser closes or loses focus.
let activeColorPicker=null;
function setActivePaintColor(value){
 if(!/^#[a-fA-F0-9]{6}$/.test(String(value)))return;
 $('drawColor').value=value;$('pixelColor').value=value;
}
function isDrawingColorPickerOpen(){return activeColorPicker!==null}
function closeDrawingColorPicker(){activeColorPicker=null}
for(const id of ['drawColor','pixelColor']){
 const input=$(id);
 input.addEventListener('pointerdown',()=>{
  stopDrawing();stopPixelStroke();activeColorPicker=id;
 });
 input.addEventListener('click',()=>{activeColorPicker=id});
 input.addEventListener('input',event=>setActivePaintColor(event.target.value));
 input.addEventListener('change',event=>{
  setActivePaintColor(event.target.value);
  // The browser might retain focus even after a native palette is dismissed.
  activeColorPicker=null;
 });
 input.addEventListener('blur',()=>{
  if(activeColorPicker===id)activeColorPicker=null;
 });
}
// Intercept Escape during capture, before app.js's generic popup closer
// would hide Pixel Studio without copying its edited canvas to the wheel.
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 // Escape dismisses a native palette first, preserving the Studio artwork.
 if(isDrawingColorPickerOpen()){event.preventDefault();closeDrawingColorPicker();return}
 if(!$('pixelStudioModal').classList.contains('hidden')){
  event.preventDefault();
  pixelClose();
 }
},true);
setActivePaintColor($('drawColor').value);
renderRecentPaintColors();
let pixelTool='pen',pixelPainting=false,pixelHistory=[],pixelLast=null,pixelPointerId=null,pixelPointerType=null,resumePixelStroke=false;
function stopPixelStroke(event){
 if(pixelPointerId===null)return;
 if(event?.pointerId!==undefined&&event.pointerId!==pixelPointerId)return;
 const id=pixelPointerId;pixelPointerId=null;pixelPointerType=null;pixelPainting=false;pixelLast=null;resumePixelStroke=false;
 try{if(pixelCanvas.hasPointerCapture?.(id))pixelCanvas.releasePointerCapture(id)}catch(error){console.warn('Pixel pointer release:',error)}
}
function pixelSave(){pixelHistory.push(pixelCtx.getImageData(0,0,200,200));if(pixelHistory.length>30)pixelHistory.shift()}
function pixelOpen(){if(drawingLocked)return;stopDrawing();pixelHistory=[];pixelCtx.clearRect(0,0,200,200);pixelCtx.drawImage(drawing,0,0);setActivePaintColor($('drawColor').value);$('pixelDrawMode').value=drawMode;$('pixelStudioModal').classList.remove('hidden')}
function pixelClose(){if($('pixelStudioModal').classList.contains('hidden'))return;closeDrawingColorPicker();stopPixelStroke();hideDrawPlaceholder();snapshot();dctx.clearRect(0,0,200,200);dctx.drawImage(pixelCanvas,0,0);setActivePaintColor($('pixelColor').value);setCenterDrawingSpinMode($('pixelDrawMode').value);$('pixelStudioModal').classList.add('hidden')}
$('pixelStudioBtn').addEventListener('click',pixelOpen);
$('pixelExit').addEventListener('click',pixelClose);
$('pixelStudioModal').addEventListener('click',event=>{
 if(event.target===$('pixelStudioModal')&&!isDrawingColorPickerOpen())pixelClose();
});
document.querySelectorAll('.pixel-tool').forEach(b=>b.addEventListener('click',()=>{stopPixelStroke();pixelTool=b.dataset.pixelTool;document.querySelectorAll('.pixel-tool').forEach(x=>x.classList.toggle('active',x===b))}));
$('pixelUndo').addEventListener('click',()=>{if(pixelHistory.length)pixelCtx.putImageData(pixelHistory.pop(),0,0)});
$('pixelClear').addEventListener('click',()=>{pixelSave();pixelCtx.clearRect(0,0,200,200)});
function pixelPoint(e){
 const r=pixelCanvas.getBoundingClientRect();
 // Preserve subpixel pointer positions so round strokes stay as smooth as
 // the main drawing, even when the 200px canvas is displayed much larger.
 return {
  x:Math.max(0,Math.min(199.999,(e.clientX-r.left)*200/r.width)),
  y:Math.max(0,Math.min(199.999,(e.clientY-r.top)*200/r.height))
 };
}
// Keep the original Pixel Studio brush widths (1 / 2 / 4 / 8 pixels)
// while retaining slightly softened, round-capped stroke edges.
function pixelBrushWidth(){
 return ({1:1,2:2,4:4,8:8})[Number($('pixelSize').value)]||2;
}
function pixelPaint(p){
 pixelCtx.save();
 pixelCtx.globalCompositeOperation=pixelTool==='erase'?'destination-out':'source-over';
 pixelCtx.fillStyle=pixelTool==='erase'?'#000000':$('pixelColor').value;
 pixelCtx.beginPath();
 pixelCtx.arc(p.x,p.y,pixelBrushWidth()/2,0,Math.PI*2);
 pixelCtx.fill();
 pixelCtx.restore();
}
function pixelLine(a,b){
 pixelCtx.save();
 pixelCtx.globalCompositeOperation=pixelTool==='erase'?'destination-out':'source-over';
 pixelCtx.strokeStyle=pixelTool==='erase'?'#000000':$('pixelColor').value;
 pixelCtx.lineWidth=pixelBrushWidth();
 pixelCtx.lineCap='round';
 pixelCtx.lineJoin='round';
 pixelCtx.beginPath();
 pixelCtx.moveTo(a.x,a.y);
 pixelCtx.lineTo(b.x,b.y);
 pixelCtx.stroke();
 pixelCtx.restore();
}
function pixelFill(p){
 const w=CANVAS_SIDE,x=Math.floor(p.x),y=Math.floor(p.y);
 if(!insideCirclePixel(x,y))return false;
 const img=pixelCtx.getImageData(0,0,w,w),d=img.data,start=y*w+x;
 const src=Array.from(d.slice(start*4,start*4+4)),hex=$('pixelColor').value;
 const col=[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),255];
 if(src.every((v,i)=>v===col[i]))return false;
 const seen=new Uint8Array(w*w),q=[start];seen[start]=1;
 for(let head=0;head<q.length;head++){
  const n=q[head],o=n*4;
  if(!src.every((v,i)=>v===d[o+i]))continue;
  for(let j=0;j<4;j++)d[o+j]=col[j];
  const x=n%w,y=Math.floor(n/w);
  for(const v of [x>0?n-1:-1,x<w-1?n+1:-1,y>0?n-w:-1,y<w-1?n+w:-1]){
   if(v<0||seen[v])continue;
   if(!insideCirclePixel(v%w,Math.floor(v/w)))continue;
   seen[v]=1;q.push(v);
  }
 }
 maskInvisibleCorners(d);pixelCtx.putImageData(img,0,0);return true;
}
pixelCanvas.addEventListener('pointerdown',e=>{
 if(drawingLocked||isDrawingColorPickerOpen()||pixelPointerId!==null||!insidePaintArea(pixelCanvas,e)||
    (e.pointerType==='mouse'&&e.button!==0))return;
 e.preventDefault();pixelSave();
 const p=pixelPoint(e);
 if(pixelTool==='fill'){if(pixelFill(p)){recordPaintColor($('pixelColor').value);if(!isTest&&!guestRun)usedFillOnOfficial=true}return}
 resumePixelStroke=false;pixelPointerId=e.pointerId;pixelPointerType=e.pointerType;pixelPainting=true;pixelLast=p;
 try{pixelCanvas.setPointerCapture(e.pointerId)}catch(error){stopPixelStroke(e);return}
 pixelPaint(p);if(pixelTool!=='erase')recordPaintColor($('pixelColor').value);
});
pixelCanvas.addEventListener('pointermove',e=>{
 if(!pixelPainting&&resumePixelStroke){
  if(e.pointerType==='mouse'&&(e.buttons&1)===1&&!drawingLocked&&
      !isDrawingColorPickerOpen()&&insidePaintArea(pixelCanvas,e)){
   resumePixelStroke=false;pixelPainting=true;pixelPointerId=e.pointerId;
   pixelPointerType=e.pointerType;pixelLast=null;
   try{pixelCanvas.setPointerCapture(e.pointerId)}catch(error){stopPixelStroke(e);return}
  }else if(e.pointerType==='mouse'&&(e.buttons&1)===0)resumePixelStroke=false;
 }
 if(!pixelPainting||drawingLocked||isDrawingColorPickerOpen()||e.pointerId!==pixelPointerId)return;
 if(e.pointerType!=='touch'&&typeof e.buttons==='number'&&(e.buttons&1)===0){
  stopPixelStroke(e);return;
 }
 if(!insidePaintArea(pixelCanvas,e)){pixelLast=null;return}
 const p=pixelPoint(e);
 if(pixelLast===null)pixelPaint(p);
 else pixelLine(pixelLast,p);
 pixelLast=p;
});
for(const type of ['pointerup','pointercancel'])
 pixelCanvas.addEventListener(type,stopPixelStroke);
pixelCanvas.addEventListener('lostpointercapture',event=>{
 const canResume=pixelPainting&&event.pointerId===pixelPointerId&&pixelPointerType==='mouse';
 stopPixelStroke(event);
 if(canResume&&!drawingLocked&&!isDrawingColorPickerOpen())resumePixelStroke=true;
});
pixelCanvas.addEventListener('pointerleave',e=>{
 if(e.pointerId===pixelPointerId)pixelLast=null;
});
document.addEventListener('pointerup',stopPixelStroke);
document.addEventListener('pointercancel',stopPixelStroke);
// Resume after a real focus change only while the original left mouse
// button remains down; never infer this from focus alone.
function suspendHeldStrokes(){
 const main=painting&&activeDrawingType==='mouse';
 const pixel=pixelPainting&&pixelPointerType==='mouse';
 stopDrawing();stopPixelStroke();
 if(main&&!drawingLocked&&!isDrawingColorPickerOpen())resumeMainStroke=true;
 if(pixel&&!drawingLocked&&!isDrawingColorPickerOpen())resumePixelStroke=true;
}
window.addEventListener('blur',suspendHeldStrokes);
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendHeldStrokes()});
document.addEventListener('pointerup',()=>{resumeMainStroke=false;resumePixelStroke=false});
document.addEventListener('pointercancel',()=>{resumeMainStroke=false;resumePixelStroke=false});
document.addEventListener('pointermove',event=>{
 if(event.pointerType==='mouse'&&(event.buttons&1)===0){
  resumeMainStroke=false;resumePixelStroke=false;
 }
});

resetSegments();update();fitPlayViewport();
})();