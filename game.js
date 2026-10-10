(() => {
const $=id=>document.getElementById(id), wheel=$('wheel'),ctx=wheel.getContext('2d'),drawing=$('drawing'),dctx=drawing.getContext('2d');
let guestRun=false,user=null,profile=null,started=false,spinning=false,drawingLocked=false,isTest=false,saveOwnerTest=false,officialRun=null,ownerModeChosen=false;
let serverSessionId=null;
let drawMode='stationary',drawTool='pen',usedFillOnOfficial=false,undoStack=[],redoStack=[];let score=0,spins=5,multiplier=1,upgrades=0,doubles=0,ducks=0,totalSpins=0,numbersLanded=0,extraSpins=0,bestRollPoints=0,bestRollLabel='',rotation=0,segments=[],results=[],runProbability=1;
const palette=['#ffd86b','#9bd9ef','#ffb8d2','#c6dcff','#c8f4bd','#efc5ef','#aee9f4','#fff0a8','#c9f1df','#dfc8f6','#ffc8a8'];
const fmt=n=>{n=Number(n)||0;if(n<1e3)return Math.round(n).toLocaleString();for(const [s,v] of [['Qa',1e15],['T',1e12],['B',1e9],['M',1e6],['K',1e3]])if(n>=v)return(n/v>=100?(n/v).toFixed(0):(n/v).toFixed(1)).replace('.0','')+s;return String(n)};
function resetSegments(){segments=[{type:'num',base:2},{type:'duck',label:'DUCK'},{type:'num',base:1},{type:'upgrade',label:'UP! ↑'},{type:'num',base:3},{type:'num',base:1},{type:'spins',label:'+2'},{type:'num',base:5},{type:'duck',label:'DUCK'},{type:'num',base:2},{type:'double',label:'×2'},{type:'num',base:1}]}
function label(s){return s.type==='num'?fmt(s.base*multiplier):s.label}
function drawDuckIcon(x,y,size){ctx.save();ctx.translate(x,y);ctx.strokeStyle='#17191e';ctx.lineWidth=Math.max(2,size*.08);ctx.fillStyle='#ffe06a';ctx.beginPath();ctx.ellipse(-size*.08,size*.08,size*.34,size*.24,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(size*.22,-size*.13,size*.19,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#17191e';ctx.beginPath();ctx.arc(size*.28,-size*.17,size*.035,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff9d4d';ctx.beginPath();ctx.moveTo(size*.39,-size*.11);ctx.lineTo(size*.58,-size*.04);ctx.lineTo(size*.39,size*.01);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
function drawWheel(){const w=wheel.width,c=w/2,r=c-12,N=segments.length,a=Math.PI*2/N;ctx.clearRect(0,0,w,w);ctx.save();ctx.translate(c,c);ctx.rotate(rotation);segments.forEach((s,i)=>{const st=i*a-Math.PI/2,en=st+a;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,st,en);ctx.closePath();ctx.fillStyle=palette[i%palette.length];ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.stroke();const ang=st+a/2,tx=Math.cos(ang)*r*.69,ty=Math.sin(ang)*r*.69;if(s.type==='duck')drawDuckIcon(tx,ty,Math.max(34,Math.min(58,360/N)));else{ctx.save();ctx.translate(tx,ty);ctx.rotate(ang+Math.PI/2);ctx.fillStyle='#17191e';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`1000 ${Math.max(17,Math.min(s.type!=='num'?27:36,310/N))}px system-ui`;ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=5;ctx.strokeText(label(s),0,0);ctx.fillText(label(s),0,0);ctx.restore()}});ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.strokeStyle='#17191e';ctx.lineWidth=7;ctx.stroke();ctx.restore();drawing.style.transform=drawMode==='spin'?('rotate('+rotation+'rad)'):'none'}
function update(){
 const band=window.CriloRarity?.scoreBands?.find(b=>score<=b.max)||
   {key:'trash',label:'TRASH'};
 const tier=String(band.key||'trash').toLowerCase();
 $('score').textContent=fmt(score);
 $('wheelScorePanel').dataset.rarity=tier;
 $('scoreTierText').textContent=tier.toUpperCase();
 $('scoreTier').setAttribute('aria-label','Score rarity: '+tier);
 $('spins').textContent=spins;
 $('level').textContent='×'+fmt(multiplier);
 $('duckCount').textContent=ducks;
 drawWheel();
}
function sound(kind){
 if(profile?.sound_enabled===false||localStorage.getItem('crilo_sound')==='off')return;
 try{
  const A=window.AudioContext||window.webkitAudioContext,ac=sound.ac||(sound.ac=new A());
  if(ac.state==='suspended')ac.resume().catch(()=>{});
  const now=ac.currentTime;
  // Balance perceived loudness by event; quieter wheel ticks get a lift.
  const levels={tick:3.0,num:2.1,spins:1.3,double:1.05,upgrade:.84};
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
function addNumbers(){const count=4+Math.min(upgrades,8),bases=[1,1,2,2,3,3,5,5,8,10];for(let i=0;i<count;i++)segments.push({type:'num',base:bases[Math.floor(Math.random()*bases.length)]})}
function outcomeProbability(s){if(s.type==='num')return segments.filter(x=>x.type==='num'&&x.base===s.base).length/segments.length;return segments.filter(x=>x.type===s.type).length/segments.length}
function rarity(){return CriloRarity.classify(score)}
function recordBest(points,labelText){if(points>bestRollPoints){bestRollPoints=Math.round(points);bestRollLabel=labelText}}
function resolve(s,serverReply=null){const p=serverReply?Number(serverReply.outcome.probability):outcomeProbability(s);runProbability*=p;let points=0;if(s.type==='num'){points=s.base*multiplier;score+=points;numbersLanded++;recordBest(points,'+'+fmt(points));$('message').textContent='+'+fmt(points);sound('num')}
if(s.type==='double'){points=score;score*=2;spins++;doubles++;recordBest(points,'×2');pop('×2!');$('message').textContent='DOUBLE — score ×2 and this spin is free.';sound('double')}
if(s.type==='upgrade'){multiplier*=3;upgrades++;spins++;addNumbers();bump();pop('UP! ↑');$('message').textContent='UPGRADE — number values ×3. The wheel grew.';sound('upgrade')}
if(s.type==='spins'){spins+=2;extraSpins+=2;pop('+2!');$('message').textContent='+2 SPINS';sound('spins')}
if(s.type==='duck'){spins++;const duck=addDuck();pop('DUCK!');$('message').textContent='DUCK — free spin. A little friend has arrived.';DuckWorld.playSound(duck)}
results.push(serverReply?{...serverReply.outcome,label:label(s)}:{type:s.type,label:label(s),base:s.base||null,points:Math.round(points),segments:segments.length,probability:p});
if(serverReply){
 segments=serverSegments(serverReply.segments);
 if(Number(serverReply.score)!==score||Number(serverReply.remaining_spins)!==spins||Number(serverReply.spin_count)!==totalSpins){
  console.error('Official wheel disagreed with server state; saving blocked',serverReply);
  $('message').textContent='Official wheel synchronization error. Reload to restore your saved spins.';
  $('spinButton').disabled=true;update();return;
 }
}
update();if(spins<=0)endRun()}
function hideDrawPlaceholder(){document.getElementById('drawPlaceholder')?.classList.add('hidden')}
function showDrawPlaceholder(){document.getElementById('drawPlaceholder')?.classList.remove('hidden')}
function lockDrawing(){hideDrawPlaceholder();if(drawingLocked)return;drawingLocked=true;$('wheelWrap').classList.add('locked');$('drawPanel').classList.add('locked-panel');$('clearDrawing').disabled=true;$('drawColor').disabled=true;$('drawMode').disabled=true;document.querySelectorAll('.drawing-tool').forEach(b=>b.disabled=true)}
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
lockDrawing();
// Never scroll while a wheel animation begins. On iPhone an animated
// scroll, dynamic address-bar height and wheel resizing could combine
// into the reported apparent zoom/jump during Daily spins.
document.body?.classList?.add('wheel-run-active');
spinning=true;$('spinButton').disabled=true;
let officialReply=null;
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
  $('message').textContent='Could not confirm the official spin. Press SPIN to safely restore server state before requesting another spin.';
  console.error('Authoritative Daily spin failed',err);return;
 }
}
spins--;totalSpins++;update();$('message').textContent='...';
const N=segments.length,a=Math.PI*2/N,index=officialReply?Number(officialReply.outcome_index):Math.floor(Math.random()*N),target=index*a+a/2-Math.PI/2,current=((rotation%(Math.PI*2))+Math.PI*2)%(Math.PI*2);let desired=(-Math.PI/2-target)%(Math.PI*2);if(desired<0)desired+=Math.PI*2;let delta=desired-current;if(delta<0)delta+=Math.PI*2;const start=rotation,end=rotation+Math.PI*2*(5+Math.floor(Math.random()*3))+delta,t0=performance.now(),dur=2800;let lastTick=-1;function anim(t){let p=Math.min(1,(t-t0)/dur),ease=1-Math.pow(1-p,4);rotation=start+(end-start)*ease;const tick=Math.floor(rotation/a);if(tick!==lastTick){lastTick=tick;sound('tick')}drawWheel();if(p<1)requestAnimationFrame(anim);else{rotation=end;spinning=false;resolve(segments[index],officialReply);if(spins>0)$('spinButton').disabled=false}}requestAnimationFrame(anim)}
// Size to REAL visible space below the sticky nav and above the complete
// SPIN button. A fixed pixel size per run avoids 100dvh/iOS address-bar
// resizes changing the wheel while it is spinning.
let playLayoutWidth=0,playLayoutHeight=0;
function fitPlayViewport(align=false){
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
 // This includes the actual score, rarity chip, counters, owner mode banner
 // and margins, instead of guessing their heights at every screen size.
 const belowWheel=Math.max(180,buttonRect.bottom-stageRect.bottom);
 const room=viewportHeight-headerHeight-belowWheel-28-25;
 const diameter=Math.max(140,Math.floor(Math.min(600,viewportWidth-24,room)));
 body.style.setProperty('--crilo-wheel-fit',diameter+'px');
 playLayoutWidth=viewportWidth;playLayoutHeight=viewportHeight;
 if(align){
  // One deliberate alignment when the player CHOOSES Daily/Test, not on
  // every spin. No smooth scrolling: avoids iOS browser chrome bouncing.
  requestAnimationFrame(()=>{
   const top=stage.getBoundingClientRect().top+window.scrollY-headerHeight-25;
   const root=document.documentElement;
   const previous=root.style.scrollBehavior;
   root.style.scrollBehavior='auto';
   window.scrollTo({top:Math.max(0,top),behavior:'instant'});
   root.style.scrollBehavior=previous;
  });
 }
}
window.addEventListener('resize',()=>{
 if(!document.body?.classList?.contains('wheel-session-fit')||spinning)return;
 const h=Math.min(window.innerHeight||9999,window.visualViewport?.height||9999);
 // Ignore iPhone's small, frequent visual viewport changes as toolbars slide;
 // recalculate for real desktop resizes and orientation changes.
 if(Math.abs((window.innerWidth||0)-playLayoutWidth)>18||
    (window.innerWidth>700&&Math.abs(h-playLayoutHeight)>70))
  fitPlayViewport(false);
});
function beginRun(alignPlay=false){document.body?.classList?.remove('wheel-run-active');serverSessionId=null;DuckWorld.clear();if(!user)guestRun=true;else guestRun=false;$('guestSaveNotice').classList.add('hidden');started=true;score=0;spins=5;multiplier=1;upgrades=0;doubles=0;ducks=0;totalSpins=0;numbersLanded=0;extraSpins=0;bestRollPoints=0;bestRollLabel='';rotation=0;results=[];runProbability=1;resetSegments();$('result').classList.add('hidden');$('playedPanel').classList.add('hidden');$('spinButton').classList.remove('hidden');$('spinButton').disabled=false;update();fitPlayViewport(alignPlay)}
async function endRun(){DuckWorld.clear(); $('spinButton').disabled=true;started=false;const r=rarity();if(guestRun){renderResult(r);$('resultEyebrow').textContent='GUEST RUN COMPLETE';$('message').textContent='Guest run complete. Sign up to save future rolls — this one cannot be saved.';$('guestSaveNotice').classList.remove('hidden');$('replayTestBtn').classList.add('hidden');open('guestFinishModal');return}const drawingData=drawing.toDataURL('image/png');const pixels=dctx.getImageData(0,0,drawing.width,drawing.height).data;let drawingIsBlank=true;for(let i=3;i<pixels.length;i+=4){if(pixels[i]!==0){drawingIsBlank=false;break}}const payload={user_id:user.id,run_date:Crilo.dailyPeriod(),score:Math.round(score),spins:totalSpins,upgrades,doubles,ducks,drawing:drawingData,drawing_is_blank:drawingIsBlank,numbers_landed:numbersLanded,extra_spins:extraSpins,best_roll_points:bestRollPoints,best_roll_label:bestRollLabel,rarity_score:r.probability,rarity_label:r.label,rarity_odds:r.odds,results,...(officialServerMode()?{verified_spin_session_id:serverSessionId}:{})};let data=null,error=null;let priorBadges=null;
if(!isTest){const before=await criloDB.from('user_badges').select('badge_id').eq('user_id',user.id);if(!before.error)priorBadges=new Set((before.data||[]).map(b=>b.badge_id));}
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
}
renderResult(r);
$('replayTestBtn').classList.toggle('hidden',!profile?.is_owner);
if(error){$('message').textContent='Run finished, but saving failed: '+error.message;console.error(error);return}
if(isTest){
 $('message').textContent='Private test run saved. It does not count toward leaderboards, badges, or official Dailies.';
 $('replayTestBtn').classList.remove('hidden');
}else{
 $('message').textContent='Official Daily saved. See how you ranked.';
 if(window.CriloBadgeEvents){
  await window.CriloBadgeEvents.track('daily_run_screen');
  await window.CriloBadgeEvents.track('daily_results');
  if(!drawingIsBlank)await window.CriloBadgeEvents.track('drawing_mark');
  if(usedFillOnOfficial)await window.CriloBadgeEvents.track('drawing_canvas');
 }
 if(priorBadges)await showNewBadges(priorBadges);
 officialRun={...payload,is_test:false};
 
}
}
async function showNewBadges(prior){
 const {data:earned,error}=await criloDB.from('user_badges').select('badge_id').eq('user_id',user.id);
 if(error)return;
 const ids=(earned||[]).map(x=>x.badge_id).filter(id=>!prior.has(id));
 if(!ids.length)return;
 const {data:badges,error:badgeError}=await criloDB.from('badges').select('id,name,description,requirement').in('id',ids);
 if(badgeError||!badges?.length)return;
 $('newBadgeCount').textContent=badges.length+' NEW BADGE'+(badges.length===1?'':'S')+' UNLOCKED';
 $('newBadgeList').innerHTML=badges.map(b=>'<div class="new-badge-item" data-badge-rarity="'+Crilo.esc(String(b.requirement?.rarity||'common').toLowerCase())+'"><div><strong>'+Crilo.esc(b.name)+'</strong><p>'+Crilo.esc(b.description||'')+'</p></div></div>').join('');
 $('newBadgePanel').classList.remove('hidden');$('newBadgePanel').open=true;
}
function renderResult(r){
 $('newBadgePanel').classList.add('hidden');$('newBadgePanel').open=false;
 $('result').classList.remove('hidden');
 $('result').dataset.rarity=r.color;
 $('resultEyebrow').textContent=isTest?'TEST RUN COMPLETE':'DAILY COMPLETE';
 $('finalScore').textContent=fmt(score);
 $('rarityLabel').textContent=r.label;
 $('rarityOdds').textContent=r.explanation;
 $('statSpins').textContent=totalSpins;$('statUpgrades').textContent=upgrades;$('statDoubles').textContent=doubles;$('statDucks').textContent=ducks;$('statExtra').textContent=extraSpins;$('statBestRoll').textContent=fmt(bestRollPoints)
}
async function checkPlayed(){if(!user)return;const period=Crilo.dailyPeriod();const {data}=await criloDB.from('daily_runs').select('score,spins,upgrades,doubles,ducks,drawing,daily_period').eq('user_id',user.id).eq('daily_period',period).eq('is_test',false).maybeSingle();officialRun=data||null;if(profile?.is_owner){$('ownerDailyChoiceBtn').disabled=!!data;$('ownerDailyChoiceBtn').title=data?'Official Daily already completed for this period.':'Play your one official Daily.';}if(data){if(profile?.is_owner){$('ownerRunControls').classList.add('hidden');$('ownerSaveRunBtn').textContent='Play Test Run';$('ownerRunModeHint').textContent='Official Daily complete. Private test runs do not count toward rankings or badges.';}$('playedPanel').classList.remove('hidden');$('playedText').textContent=`You scored ${Number(data.score).toLocaleString()} this Daily.`;$('spinButton').classList.add('hidden');if(profile?.is_owner){$('playedPanel').classList.add('hidden');$('ownerRunControls').querySelector('strong').textContent='Choose your run';$('ownerRunControls').querySelector('.played-check').textContent='✓';$('ownerRunModeHint').textContent=`Official Daily completed — ${Number(data.score).toLocaleString()} points. Test runs are private.`;$('ownerDailyChoiceBtn').classList.remove('hidden');$('ownerDailyChoiceBtn').disabled=true;$('ownerDailyChoiceBtn').textContent='Daily Run — Completed';$('ownerSaveRunBtn').textContent='Test Run';$('ownerRunControls').classList.remove('hidden');$('ownerRunControls').classList.add('owner-daily-finished');}if(data.drawing){hideDrawPlaceholder();const img=new Image();img.onload=()=>{dctx.clearRect(0,0,drawing.width,drawing.height);dctx.drawImage(img,0,0,drawing.width,drawing.height);drawingLocked=true;$('wheelWrap').classList.add('locked')};img.src=data.drawing}}else if(!profile?.is_owner)beginRun();else{$('ownerRunControls').querySelector('strong').textContent='Choose your run';$('ownerRunControls').querySelector('.played-check').textContent='↻';$('ownerRunModeHint').textContent='Daily Run counts toward rankings and badges. Test Run is private.';$('ownerDailyChoiceBtn').classList.remove('hidden');$('ownerDailyChoiceBtn').disabled=false;$('ownerDailyChoiceBtn').textContent='Daily Run';$('ownerSaveRunBtn').textContent='Test Run';$('ownerRunControls').classList.remove('owner-daily-finished');$('spinButton').classList.add('hidden');$('ownerRunControls').classList.remove('hidden');$('ownerActiveMode').classList.add('hidden');$('message').textContent='Choose Daily Run or Test Run before spinning.';}}
function open(id){$(id)?.classList.remove('hidden')}function close(id){$(id)?.classList.add('hidden')}
async function sendMagicLink(){const email=$('emailInput').value.trim();if(!email){$('authStatus').textContent='Enter your email first.';return}$('sendLinkBtn').disabled=true;const {error}=await criloDB.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});$('sendLinkBtn').disabled=false;$('authStatus').textContent=error?error.message:'Check your email for the sign-in link.'}
async function saveProfile(){const username=$('usernameInput').value.trim(),name_color=$('nameColorInput').value;const usernameError=Crilo.validateUsername(username);if(usernameError){$('profileStatus').textContent=usernameError;return}const {error}=await criloDB.from('profiles').upsert({id:user.id,username,name_color},{onConflict:'id'});if(error){$('profileStatus').textContent=error.code==='23505'?'That username is taken.':error.message;return}close('profileModal');await Crilo.refreshIdentity();location.reload()}
function startTest(save=true){if(!profile?.is_owner||spinning)return;ownerModeChosen=true;isTest=true;usedFillOnOfficial=false;saveOwnerTest=true;$('ownerActiveMode').textContent='TEST RUN — private, no leaderboard or badges';$('ownerActiveMode').classList.remove('hidden');$('ownerRunControls').classList.add('hidden');$('spinButton').classList.remove('hidden');$('testBanner').classList.remove('hidden');drawingLocked=false;dctx.clearRect(0,0,drawing.width,drawing.height);showDrawPlaceholder();undoStack=[];redoStack=[];$('drawPanel').classList.remove('locked-panel');$('drawMode').disabled=false;document.querySelectorAll('.drawing-tool').forEach(b=>b.disabled=false);$('clearDrawing').disabled=false;$('drawColor').disabled=false;beginRun(true)}
function countdown(){const diff=Math.max(0,Crilo.nextReset()-new Date()),s=Math.floor(diff/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;$('resetCountdown').textContent=`NEXT DAILY ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;if(diff<1000)setTimeout(()=>location.reload(),1200)}setInterval(countdown,1000);countdown();
window.addEventListener('crilo-auth-ready',async e=>{user=e.detail.user;profile=e.detail.profile;ownerModeChosen=!profile?.is_owner;$('ownerRunControls').classList.toggle('hidden',!profile?.is_owner);if(profile?.is_owner){$('spinButton').classList.add('hidden');$('message').textContent='Choose Official Daily or Test Run to begin.';}if(!user){$('message').textContent='Play for free! Sign up to save future Daily runs.';if(!started&&$('result').classList.contains('hidden'))beginRun();return}if(!profile){open('profileModal');return}if(guestRun&&(started||!$('result').classList.contains('hidden')))return;await DuckWorld.load(criloDB,user);await checkPlayed()});window.addEventListener('crilo-signin-request',()=>open('authModal'));
window.addEventListener('crilo-auth-error',e=>{open('authModal');$('authStatus').textContent='Sign-in failed: '+(e.detail?.message||'Please request a new email link.');});
$('rarityInfoBtn').addEventListener('click',()=>{const panel=$('rarityMethod'),open=panel.classList.toggle('hidden')===false;$('rarityInfoBtn').setAttribute('aria-expanded',String(open))});$('spinButton').addEventListener('click',spin);$('guestSignupBtn').addEventListener('click',()=>open('authModal'));$('guestFinishSignIn').addEventListener('click',()=>{close('guestFinishModal');open('authModal')});$('guestFinishDismiss').addEventListener('click',()=>close('guestFinishModal'));$('clearDrawing').addEventListener('click',()=>{if(!drawingLocked){snapshot();dctx.clearRect(0,0,drawing.width,drawing.height)}});$('helpBtn').addEventListener('click',()=>open('helpModal'));$('sendLinkBtn').addEventListener('click',sendMagicLink);$('saveProfileBtn').addEventListener('click',saveProfile);$('replayTestBtn').addEventListener('click',()=>startTest(false));$('ownerSaveRunBtn').addEventListener('click',()=>startTest(true));$('ownerDailyChoiceBtn').addEventListener('click',()=>{if(!profile?.is_owner||officialRun||spinning)return;ownerModeChosen=true;isTest=false;usedFillOnOfficial=false;saveOwnerTest=false;$('ownerActiveMode').textContent='OFFICIAL DAILY — counts toward leaderboard and badges';$('ownerActiveMode').classList.remove('hidden');$('testBanner').classList.add('hidden');$('ownerRunControls').classList.add('hidden');beginRun(true);$('message').textContent='OFFICIAL DAILY — this run counts toward the leaderboard and badges.';});document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>close(b.dataset.close)));

let painting=false,last=null;
function snapshot(){undoStack.push(dctx.getImageData(0,0,200,200));if(undoStack.length>25)undoStack.shift();redoStack=[]}
function history(from,to){if(drawingLocked||!from.length)return;to.push(dctx.getImageData(0,0,200,200));dctx.putImageData(from.pop(),0,0)}
$('undoDrawing').onclick=()=>history(undoStack,redoStack);$('redoDrawing').onclick=()=>history(redoStack,undoStack);
$('drawMode').onchange=e=>{drawMode=e.target.value;drawWheel()};
document.querySelectorAll('.drawing-tool').forEach(b=>b.onclick=()=>{drawTool=b.dataset.tool;document.querySelectorAll('.drawing-tool').forEach(x=>x.classList.toggle('active',x===b))});
function point(e){const r=drawing.getBoundingClientRect(),x=(e.clientX-r.left)*200/r.width,y=(e.clientY-r.top)*200/r.height;if(drawMode==='spin'){const a=-rotation,c=100,dx=x-c,dy=y-c;return{x:c+dx*Math.cos(a)-dy*Math.sin(a),y:c+dx*Math.sin(a)+dy*Math.cos(a)}}return{x,y}}
function fill(x,y){const w=200,img=dctx.getImageData(0,0,w,w),d=img.data,xx=Math.max(0,Math.min(199,Math.floor(x))),yy=Math.max(0,Math.min(199,Math.floor(y))),start=yy*w+xx,src=Array.from(d.slice(start*4,start*4+4)),hex=$('drawColor').value,col=[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),255],seen=new Uint8Array(w*w),q=[start];if(src.every((v,i)=>v===col[i]))return false;seen[start]=1;for(let head=0;head<q.length;head++){const n=q[head],o=n*4;if(!src.every((v,i)=>Math.abs(d[o+i]-v)<24))continue;for(let j=0;j<4;j++)d[o+j]=col[j];const x=n%w,y=Math.floor(n/w);for(const v of [x>0?n-1:-1,x<199?n+1:-1,y>0?n-w:-1,y<199?n+w:-1])if(v>=0&&!seen[v]){seen[v]=1;q.push(v)}}dctx.putImageData(img,0,0);return true}
drawing.addEventListener('pointerdown',e=>{if(drawingLocked)return;hideDrawPlaceholder();e.preventDefault();const p=point(e);snapshot();if(drawTool==='fill'){if(fill(p.x,p.y)&&!isTest&&!guestRun)usedFillOnOfficial=true;return}painting=true;drawing.setPointerCapture(e.pointerId);last=p;dctx.fillStyle=$('drawColor').value;dctx.beginPath();dctx.arc(p.x,p.y,3,0,Math.PI*2);dctx.fill()});
drawing.addEventListener('pointermove',e=>{if(!painting||drawingLocked)return;const p=point(e);dctx.strokeStyle=$('drawColor').value;dctx.lineWidth=6;dctx.lineCap='round';dctx.lineJoin='round';dctx.beginPath();dctx.moveTo(last.x,last.y);dctx.lineTo(p.x,p.y);dctx.stroke();last=p});
drawing.addEventListener('pointerup',()=>{painting=false;last=null});drawing.addEventListener('pointercancel',()=>{painting=false;last=null});
const pixelCanvas=$('pixelCanvas'),pixelCtx=pixelCanvas.getContext('2d',{willReadFrequently:true});
let pixelTool='pen',pixelPainting=false,pixelHistory=[],pixelLast=null;
function pixelSave(){pixelHistory.push(pixelCtx.getImageData(0,0,200,200));if(pixelHistory.length>30)pixelHistory.shift()}
function pixelOpen(){if(drawingLocked)return;pixelHistory=[];pixelCtx.clearRect(0,0,200,200);pixelCtx.drawImage(drawing,0,0);$('pixelColor').value=$('drawColor').value;$('pixelStudioModal').classList.remove('hidden')}
function pixelClose(){if(pixelPainting)pixelPainting=false;hideDrawPlaceholder();snapshot();dctx.clearRect(0,0,200,200);dctx.drawImage(pixelCanvas,0,0);$('drawColor').value=$('pixelColor').value;$('pixelStudioModal').classList.add('hidden')}
$('pixelStudioBtn').addEventListener('click',pixelOpen);
$('pixelClose').addEventListener('click',pixelClose);
document.querySelectorAll('.pixel-tool').forEach(b=>b.addEventListener('click',()=>{pixelTool=b.dataset.pixelTool;document.querySelectorAll('.pixel-tool').forEach(x=>x.classList.toggle('active',x===b))}));
$('pixelUndo').addEventListener('click',()=>{if(pixelHistory.length)pixelCtx.putImageData(pixelHistory.pop(),0,0)});
$('pixelClear').addEventListener('click',()=>{pixelSave();pixelCtx.clearRect(0,0,200,200)});
function pixelPoint(e){const r=pixelCanvas.getBoundingClientRect();return{x:Math.max(0,Math.min(199,Math.floor((e.clientX-r.left)*200/r.width))),y:Math.max(0,Math.min(199,Math.floor((e.clientY-r.top)*200/r.height)))}}
function pixelPaint(p){const size=Number($('pixelSize').value),x=Math.floor(p.x/size)*size,y=Math.floor(p.y/size)*size;if(pixelTool==='erase')pixelCtx.clearRect(x,y,size,size);else{pixelCtx.fillStyle=$('pixelColor').value;pixelCtx.fillRect(x,y,size,size)}}
function pixelLine(a,b){const dx=b.x-a.x,dy=b.y-a.y,steps=Math.max(Math.abs(dx),Math.abs(dy));for(let i=0;i<=steps;i++)pixelPaint({x:a.x+dx*i/(steps||1),y:a.y+dy*i/(steps||1)})}
function pixelFill(p){const w=200,img=pixelCtx.getImageData(0,0,w,w),d=img.data,start=p.y*w+p.x,src=Array.from(d.slice(start*4,start*4+4)),hex=$('pixelColor').value,col=[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),255];if(src.every((v,i)=>v===col[i]))return false;const seen=new Uint8Array(w*w),q=[start];seen[start]=1;for(let head=0;head<q.length;head++){const n=q[head],o=n*4;if(!src.every((v,i)=>v===d[o+i]))continue;for(let j=0;j<4;j++)d[o+j]=col[j];const x=n%w,y=Math.floor(n/w);for(const v of [x>0?n-1:-1,x<199?n+1:-1,y>0?n-w:-1,y<199?n+w:-1])if(v>=0&&!seen[v]){seen[v]=1;q.push(v)}}pixelCtx.putImageData(img,0,0);return true}
pixelCanvas.addEventListener('pointerdown',e=>{e.preventDefault();pixelSave();const p=pixelPoint(e);if(pixelTool==='fill'){if(pixelFill(p)&&!isTest&&!guestRun)usedFillOnOfficial=true;return}pixelPainting=true;pixelCanvas.setPointerCapture(e.pointerId);pixelLast=p;pixelPaint(p)});
pixelCanvas.addEventListener('pointermove',e=>{if(!pixelPainting)return;const p=pixelPoint(e);pixelLine(pixelLast,p);pixelLast=p});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])pixelCanvas.addEventListener(ev,()=>{pixelPainting=false;pixelLast=null});

resetSegments();update();
})();