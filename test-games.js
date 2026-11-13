/* ALMOST PERFECT — three owner-only local precision challenges.
   No score writes, Daily mutations, achievements, or public leaderboard data. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const access=$('testAccess'),collection=$('testCollection'),prototype=$('precisionPrototype');
 const canvas=$('apCanvas'),arena=$('apArena'),ctx=canvas?.getContext('2d');
 if(!access||!collection||!prototype||!canvas||!arena||!ctx)return;

 const W=960,H=560,DURATION={path:9,distance:11,motion:5.2};
 const modes={
  path:{
   title:'Perfect Path',description:'Memorize a path, then draw it from memory.',
   intro:'A curve appears for a few seconds, then disappears. Recreate it with a single mouse drag.',
   button:'SHOW THE PATH',
   help:'Watch the complete line, then start at the highlighted dot and draw its shape. Release to compare your attempt against the original. Accuracy includes shape, distance, length, and the endpoint.',
   metric:'DRAW TIME'
  },
  distance:{
   title:'Perfect Distance',description:'Keep an exact distance from the moving dot.',
   intro:'A new target distance is chosen for each game. Memorize the dotted ring: it disappears once the dot starts moving.',
   button:'START DISTANCE',
   help:'Each new game chooses a different target distance. Look at the ring, then click it to start. The ring and connecting guide vanish immediately: follow the moving dot for 11 seconds using your memory of the distance. Try Same Distance keeps the target distance and movement pattern for a fair retry.',
   metric:'TIME LEFT'
  },
  motion:{
   title:'Perfect Motion',description:'Copy a moving cursor — including its speed changes.',
   intro:'Watch a cursor trace a route, remembering when it slows and speeds up. Then repeat its exact motion.',
   button:'WATCH MOTION',
   help:'Watch the ghost cursor and its changes in speed. Recreate its route and timing for 5.2 seconds. Scoring allows small imperfections but still rewards precision. Afterward, use Replay Both Lines to watch the blue reference and your orange attempt draw together in real time.',
   metric:'TIME LEFT'
  }
 };
 const modeSelect=$('apMode'),lastLabel=$('apLast'),bestLabel=$('apBest');
 const metricTitle=$('apMetricTitle'),metric=$('apMetric');
 const hudLeft=$('apHudLeft'),hudRight=$('apHudRight'),message=$('apMessage');
 const overlay=$('apOverlay'),start=$('apStart'),status=$('apStatus'),progress=$('apProgress');
 const resultPanel=$('apResult'),resultLabel=$('apResultLabel'),resultScore=$('apResultScore');
 const resultDetail=$('apResultDetail'),compareButton=$('apCompare'),replayButton=$('apReplay');
 const liveDisplay=$('apLiveScore'),liveValue=$('apLiveValue'),soundButton=$('apSound');
 let ownerId=null,verifySerial=0,mode='path',phase='intro';
 let routeSeed=0,previousSeed=0,showReference=true,distancePattern=null,targetDistance=82;
 let bests={path:0,distance:0,motion:0},lastScores={path:null,distance:null,motion:null};
 let route=[],preview=0,elapsed=0,activePointer=null,mouse=null,attempt=[],timeSamples=[];
 let lastFrame=0,raf=0,accuracyIntegral=0,lastStep=0,replayElapsed=0;
 let pixelRatio=1,soundEnabled=true,audioContext=null,lastSoundAt=0,soundTravel=0;
 let liveWeighted=0,liveDistance=0,liveMotionArea=0;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const lerp=(a,b,t)=>a+(b-a)*t;
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const pct=n=>clamp(n,0,100).toFixed(2)+'%';
 // Nonlinear precision bonus: reward an accurate overall curve without
 // flattening the rankings. It is zero at 0% and 100%, largest mid-range,
 // and strictly increases with the underlying accuracy at every point.
 // Only Path and Motion use it; Distance keeps its measured score.
 const boostPrecisionScore=raw=>{
  const accuracy=clamp(raw,0,100);
  return clamp(accuracy+16*Math.sin(Math.PI*accuracy/100),0,100);
 };
 // The number in the arena is a provisional live estimate. The final
 // score is still computed using the full completed trace and timing.
 function nearestLineError(p){
  let best=Infinity;
  for(let i=1;i<route.length;i++){
   const a=route[i-1],b=route[i],dx=b.x-a.x,dy=b.y-a.y;
   const len=dx*dx+dy*dy;
   const u=len?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/len,0,1):0;
   const x=a.x+u*dx,y=a.y+u*dy;
   const d=(p.x-x)*(p.x-x)+(p.y-y)*(p.y-y);
   if(d<best)best=d;
  }
  return Math.sqrt(best);
 }
 function recordLiveStroke(before,after){
  if(!before||!after||mode==='distance')return;
  const moved=dist(before,after);
  if(moved<.3)return;
  // Long pointer jumps do not get rewarded just for skipping curved sections.
  const weight=Math.min(moved,24);
  const error=nearestLineError(after);
  const quality=.42*Math.exp(-error/75)+.58*Math.exp(-error/125);
  liveWeighted+=quality*weight;liveDistance+=weight;
 }
 function renderLive(){
  const active=phase==='active';
  liveDisplay.hidden=!active;
  if(!active)return;
  let accuracy=null;
  if(mode==='path'&&liveDistance>3){
   accuracy=boostPrecisionScore(100*liveWeighted/liveDistance);
  }else if(mode==='distance'&&elapsed>.04){
   // Cumulative accuracy avoids revealing the hidden target radius.
   accuracy=100*accuracyIntegral/elapsed;
  }else if(mode==='motion'&&elapsed>.04){
   const shape=liveDistance>3?100*liveWeighted/liveDistance:0;
   accuracy=boostPrecisionScore(.72*(100*liveMotionArea/elapsed)+.28*shape);
  }
  liveValue.textContent=accuracy===null?'—':pct(accuracy);
 }
 // Small synthesized notes. No audio files, external assets, or looping music.
 // Construct the context only from an actual user gesture.
 function playTone(frequency,duration=.08,delay=0,volume=.015,type='sine'){
  if(!soundEnabled)return;
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)return;
  try{
   if(!audioContext)audioContext=new Context();
   if(audioContext.state==='suspended'){
    const resume=audioContext.resume();
    resume?.catch?.(()=>{});
   }
   const t=audioContext.currentTime+delay;
   const osc=audioContext.createOscillator(),gain=audioContext.createGain();
   osc.type=type;osc.frequency.setValueAtTime(frequency,t);
   gain.gain.setValueAtTime(.0001,t);
   gain.gain.exponentialRampToValueAtTime(volume,t+.012);
   gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
   osc.connect(gain);gain.connect(audioContext.destination);
   osc.start(t);osc.stop(t+duration+.02);
   osc.onended=()=>{try{osc.disconnect();gain.disconnect()}catch{}};
  }catch{}
 }
 function soundBegin(){
  soundTravel=0;lastSoundAt=Date.now();
  playTone(370,.08,0,.021,'sine');
  playTone(520,.085,.065,.012,'sine');
 }
 function soundMove(before,after){
  if(!soundEnabled||!before||!after)return;
  soundTravel+=Math.min(dist(before,after),45);
  const now=Date.now();
  if(soundTravel<23||now-lastSoundAt<65)return;
  lastSoundAt=now;soundTravel=0;
  const pitch=mode==='distance'?228:198;
  playTone(pitch+28*Math.sin(now/190),.053,0,.0075,'triangle');
 }
 function soundFinish(score){
  const good=score>=82;
  playTone(good?525:320,.12,0,.023,'sine');
  playTone(good?660:390,.13,.115,.022,'sine');
  if(good)playTone(784,.16,.235,.017,'sine');
 }
 const labelSec=n=>Math.max(0,n).toFixed(1)+'s';
 const key=m=>'crilo_owner_almost_perfect_v1:'+ownerId+':'+m;
 const readBest=m=>{
  if(!ownerId)return 0;
  try{const n=Number(localStorage.getItem(key(m)));return Number.isFinite(n)?clamp(n,0,100):0}
  catch{return 0}
 };
 function saveBest(value){
  if(value<=bests[mode]||!ownerId)return false;
  bests[mode]=value;
  try{localStorage.setItem(key(mode),value.toFixed(4))}catch{}
  return true;
 }
 function cancel(){
  if(raf)cancelAnimationFrame(raf);
  raf=0;lastFrame=0;
 }
 function setMessage(text){
  message.textContent=text||'';
  message.hidden=!text;
 }
 function announce(text){status.textContent=text}
 function showOverlay(tag,title,copy,action,note){
  $('apOverlayTag').textContent=tag;
  $('apOverlayTitle').textContent=title;
  $('apOverlayCopy').textContent=copy;
  $('apOverlayNote').textContent=note||'Your results are private to this device.';
  start.textContent=action;
  overlay.classList.remove('is-result');
  overlay.hidden=false;
 }
 function clearOverlay(){overlay.hidden=true}
 // A freshly generated seed creates new shapes every time NEW GAME is chosen.
 // Reject a duplicate seed, even if a deterministic test/browser RNG repeats.
 function nextSeed(){
  const value=(Math.floor(Math.random()*0xffffffff)>>>0)||1;
  previousSeed=value===previousSeed?(value+0x9e3779b9)>>>0:value;
  return previousSeed||1;
 }
 function seededRng(initial){
  let s=initial>>>0||1;
  return ()=>{
   s^=s<<13;s^=s>>>17;s^=s<<5;
   return (s>>>0)/4294967296;
  };
 }
 function createRoute(m,seed){
  const random=seededRng(seed),curveCount=3;
  const parts=[];
  for(let j=0;j<curveCount;j++){
   parts.push({amplitude:20+random()*(j===0?99:67),
    frequency: .52+random()*2.25+(j*.26),
    offset:random()*Math.PI*2});
  }
  const xWave=15+random()*41,xFreq=.55+random()*1.9,xPhase=random()*6.283;
  const shift=(random()-.5)*44;
  const values=[];
  for(let i=0;i<=240;i++){
   const u=i/240,t=u*Math.PI*2;
   let y=280+shift;
   for(const p of parts)y+=p.amplitude*Math.sin(t*p.frequency+p.offset);
   const x=121+718*u+xWave*Math.sin(t*xFreq+xPhase)*Math.sin(Math.PI*u);
   values.push({x,y});
  }
  const ys=values.map(p=>p.y),mid=(Math.min(...ys)+Math.max(...ys))/2;
  const range=Math.max(...ys)-Math.min(...ys);
  const scale=Math.min(1,316/Math.max(range,1));
  return values.map(p=>({x:clamp(p.x,96,W-96),y:clamp(280+(p.y-mid)*scale,105,H-105)}));
 }
 function createDistancePattern(seed){
  const rand=seededRng((seed^0xa3c59ac3)>>>0);
  return {phaseX:rand()*Math.PI*2,phaseY:rand()*Math.PI*2,
   frequencyX:.43+rand()*.52,frequencyY:.48+rand()*.55,
   detailX:1.12+rand()*.66,detailY:1.04+rand()*.63,
   amplitudeX:105+rand()*76,amplitudeY:70+rand()*65,
   phaseDetailX:rand()*6.283,phaseDetailY:rand()*6.283};
 }
 // Change the invisible target distance on every NEW GAME (not on Retry).
 // Avoid practically identical consecutive distances so each round feels new.
 function chooseTargetDistance(seed,previous){
  const rng=seededRng((seed^0x7c3a5e91)>>>0);
  let next=Math.round(62+rng()*55);
  if(previous>0&&Math.abs(next-previous)<18){
   const higher=previous+20,lower=previous-20;
   next=higher<=117&&(lower<62||rng()>.5)?higher:lower;
  }
  return next;
 }
 function targetAt(u){
  const i=clamp(u,0,1)*(route.length-1),n=Math.floor(i);
  return {x:lerp(route[n].x,route[Math.min(n+1,route.length-1)].x,i-n),
   y:lerp(route[n].y,route[Math.min(n+1,route.length-1)].y,i-n)};
 }
 function smooth(x){return x*x*(3-2*x)}
 // Monotone time map with deliberately uneven movement between anchor beats.
 function motionProgress(u){
  const beats=[0,.22,.48,.74,1],positions=[0,.10,.63,.77,1];
  for(let i=0;i<4;i++){
   if(u<=beats[i+1])return lerp(positions[i],positions[i+1],
    smooth(clamp((u-beats[i])/(beats[i+1]-beats[i]),0,1)));
  }
  return 1;
 }
 function distanceCenter(t){
  const p=distancePattern||createDistancePattern(12345);
  return {x:480+p.amplitudeX*Math.sin(p.frequencyX*t+p.phaseX)+
     35*Math.sin(p.detailX*t+p.phaseDetailX),
   y:280+p.amplitudeY*Math.cos(p.frequencyY*t+p.phaseY)+
     23*Math.sin(p.detailY*t+p.phaseDetailY)};
 }
 function pointOnRing(t){
  const p=distanceCenter(t);
  return {x:p.x+targetDistance,y:p.y};
 }
 function lengthOf(points){
  let n=0;for(let i=1;i<points.length;i++)n+=dist(points[i-1],points[i]);
  return n;
 }
 function sampleByArc(points,count){
  if(!points.length)return [];
  let cumulative=[0];
  for(let i=1;i<points.length;i++)cumulative.push(cumulative[i-1]+dist(points[i-1],points[i]));
  const len=cumulative[cumulative.length-1],samples=[];let index=1;
  for(let i=0;i<count;i++){
   const wanted=len*i/(count-1);
   while(index<cumulative.length-1&&cumulative[index]<wanted)index++;
   const lower=cumulative[index-1]??0,upper=cumulative[index]??lower;
   const mix=upper>lower?(wanted-lower)/(upper-lower):0;
   samples.push({x:lerp(points[index-1]?.x??points[0].x,points[index]?.x??points[0].x,mix),
    y:lerp(points[index-1]?.y??points[0].y,points[index]?.y??points[0].y,mix)});
  }
  return samples;
 }
 function pathScore(points,forgiving=true){
  if(points.length<3||lengthOf(points)<20)return 0;
  const original=sampleByArc(route,120),drawn=sampleByArc(points,120);
  const mean=original.reduce((a,p,i)=>a+dist(p,drawn[i]),0)/120;
  const lengthError=Math.abs(lengthOf(points)-lengthOf(route))/lengthOf(route);
  const startError=dist(route[0],points[0]),endError=dist(route.at(-1),points.at(-1));
  // Keep the original strict score for Perfect Motion's timing/path blend.
  const strict=Math.exp(-mean/105)*Math.exp(-1.45*lengthError)*
   Math.exp(-endError/115)*Math.exp(-startError/115);
  if(!forgiving)return clamp(100*strict,0,100);
  // Perfect Path should value an identifiable overall curve, even when
  // the hand-drawn details, exact length, or endpoint aren't pixel-perfect.
  // Blend the original metric with a gentler curve instead of inflating
  // every imperfect attempt to an artificially high percentage.
  const recognizable=Math.exp(-mean/155)*Math.exp(-.65*lengthError)*
   Math.exp(-(startError+endError)/360);
  return clamp(100*(.48*strict+.52*recognizable),0,100);
 }
 function motionScore(){
  const duration=DURATION.motion;
  if(timeSamples.length<3)return 0;
  let area=0;
  for(let i=1;i<timeSamples.length;i++){
   const a=timeSamples[i-1],b=timeSamples[i],dt=b.t-a.t;
   if(dt<=0)continue;
   const target=targetAt(motionProgress(clamp(b.t/duration,0,1)));
   if(b.missing||!b.point)continue;
   const error=dist(b.point,target);
   const strict=Math.exp(-error/103);
   const forgiving=Math.exp(-error/155);
   area+=(.48*strict+.52*forgiving)*dt;
  }
  const timeAccuracy=100*area/duration;
  // Like Perfect Path, reward a recognizable reproduction instead of
  // requiring near-pixel accuracy for every sampled moment.
  // Missing time still scores zero; this cannot reward early release.
  return clamp(timeAccuracy*.72+pathScore(attempt)*.28,0,100);
 }
 function renderStats(){
  lastLabel.textContent=lastScores[mode]===null?'—':pct(lastScores[mode]);
  bestLabel.textContent=bests[mode]>0?pct(bests[mode]):'—';
  metricTitle.textContent=modes[mode].metric;
  const remaining=DURATION[mode]-elapsed;
  metric.textContent=phase==='active'?
   (mode==='path'?labelSec(elapsed):labelSec(remaining)):
   phase==='preview'?labelSec((mode==='motion'?DURATION.motion:3.8)-preview):
   phase==='replay'?labelSec(DURATION.motion-replayElapsed):
   phase==='result'?mode==='path'?labelSec(elapsed):'DONE':'—';
  hudLeft.textContent=modes[mode].title.toUpperCase();
  hudRight.textContent=phase==='preview'?'WATCH':phase==='ready'?'YOUR TURN':
   phase==='active'?(mode==='path'?'TRACE':Math.ceil(remaining)+'s'):
   phase==='replay'?'REPLAY '+labelSec(replayElapsed):
   phase==='result'?(lastScores[mode]!==null?pct(lastScores[mode]):'FINISHED'):'READY';
 }
 function reset({reroll=false}={}){
  cancel();phase='intro';elapsed=0;preview=0;replayElapsed=0;lastStep=0;activePointer=null;mouse=null;
  attempt=[];timeSamples=[];accuracyIntegral=0;
  liveWeighted=0;liveDistance=0;liveMotionArea=0;soundTravel=0;
  if(reroll||!route.length){
   routeSeed=nextSeed();
   route=createRoute(mode,routeSeed);
   distancePattern=createDistancePattern(routeSeed);
   targetDistance=chooseTargetDistance(routeSeed,targetDistance);
  }
  resultPanel.hidden=true;
  replayButton.hidden=true;replayButton.textContent='REPLAY BOTH LINES ▶';showReference=true;compareButton.textContent='MY LINE ONLY';
  $('apRetry').textContent=mode==='distance'?'TRY SAME DISTANCE':'TRY SAME SHAPE';
  arena.classList.remove('is-drawing','is-tracking');
  showOverlay(mode==='path'?'01 / 03':mode==='distance'?'02 / 03':'03 / 03',
   modes[mode].title,modes[mode].intro,modes[mode].button,
   'Every attempt gets an accuracy percentage. Aim for 99%.');
  setMessage('');
  renderStats();renderLive();draw();
  announce('Ready for '+modes[mode].title+'. Your results stay in your browser.');
 }
 function switchMode(next){
  if(!modes[next]||!ownerId)return;
  mode=next;
  arena.setAttribute('data-mode',mode);
  modeSelect.value=next;
  $('apModeDescription').textContent=modes[next].description;
  $('apHowTitle').textContent=modes[next].title;
  $('apHowCopy').textContent=modes[next].help;
  reset({reroll:true});
 }
 function startPreview(){
  if(!ownerId||prototype.hidden)return;
  if(phase==='result'){reset();} 
  if(mode==='distance'){
   phase='ready';clearOverlay();
   setMessage('MEMORIZE THE RING • CLICK IT TO BEGIN');
   announce('Memorize '+targetDistance+' pixels, then click the dotted ring. The entire distance guide disappears once you begin.');
   renderStats();draw();return;
  }
  phase='preview';preview=0;clearOverlay();
  setMessage(mode==='path'?'MEMORIZE THE SHAPE':'WATCH WHERE AND WHEN IT MOVES');
  announce(mode==='path'?'Remember the curve. It will disappear.':'Watch the cursor’s route and speed changes.');
  renderStats();schedule();
 }
 function previewDone(){
  phase='ready';cancel();
  setMessage('START AT THE BLUE DOT • HOLD AND DRAG');
  announce('Ready. Press and drag from the blue starting dot to draw your attempt.');
  renderStats();draw();
 }
 function finish(){
  if(phase!=='active')return;
  const value=mode==='path'?pathScore(attempt):mode==='distance'?
   100*accuracyIntegral/DURATION.distance:motionScore();
  phase='result';cancel();activePointer=null;
  arena.classList.remove('is-drawing','is-tracking');
  const score=mode==='distance'?clamp(value,0,100):boostPrecisionScore(value);
  renderLive();soundFinish(score);
  lastScores[mode]=score;
  const isBest=saveBest(score);
  renderStats();
  setMessage('');
  draw();
  const detail=mode==='path'?'Your orange drawing and the original blue path stay visible above.':
   mode==='distance'?'The hidden target was '+targetDistance+' pixels from the dot. Next game chooses a different distance.':
    'Your orange route and blue reference stay visible. Replay both to compare their timing (72%) and shape (28%).';
  clearOverlay();
  resultLabel.textContent=isBest?'NEW PERSONAL BEST':'ATTEMPT COMPLETE';
  resultScore.textContent=pct(score);
  resultDetail.textContent=detail;
  compareButton.hidden=mode==='distance';
  replayButton.hidden=mode!=='motion';
  replayButton.textContent='REPLAY BOTH LINES ▶';
  resultPanel.hidden=false;
  announce('You scored '+pct(score)+' in '+modes[mode].title+'. '+(isBest?'New personal best.':'Try again to improve.'));
 }
 // Retain the original attempt data while animating both trajectories on the
 // same timeline. Replay is a visualization only; it does not rescore or save.
 function stopReplay(finished=false){
  if(phase!=='replay')return;
  cancel();phase='result';
  replayButton.textContent='REPLAY BOTH LINES ▶';
  setMessage('');
  renderStats();draw();
  announce(finished?'Replay complete. Blue is the reference; orange is your attempt.':'Replay stopped. Your score and original attempt are unchanged.');
 }
 function replayMotion(){
  if(!ownerId||mode!=='motion'||prototype.hidden)return;
  if(phase==='replay'){stopReplay();return}
  if(phase!=='result')return;
  cancel();phase='replay';replayElapsed=0;
  replayButton.textContent='STOP REPLAY ■';
  setMessage('BLUE = REFERENCE • ORANGE = YOUR ATTEMPT');
  announce('Replaying your attempt and the reference at their original speeds.');
  renderStats();draw();schedule();
 }
 function addPoint(p){
  const last=attempt.at(-1);
  if(!last||dist(last,p)>.35){
   if(attempt.length>=2600)return;
   recordLiveStroke(last,p);
   soundMove(last,p);
   attempt.push({x:p.x,y:p.y});
  }
 }
 function position(e){
  const box=canvas.getBoundingClientRect();
  return {x:(e.clientX-box.left)/Math.max(1,box.width)*W,
   y:(e.clientY-box.top)/Math.max(1,box.height)*H};
 }
 function begin(p,id){
  activePointer=id;
  phase='active';elapsed=0;accuracyIntegral=0;
  liveWeighted=0;liveDistance=0;liveMotionArea=0;
  attempt=[];timeSamples=[];mouse=p;lastFrame=0;
  soundBegin();
  if(mode==='motion')timeSamples.push({t:0,point:{x:p.x,y:p.y},missing:false});
  if(mode!=='distance')addPoint(p);
  arena.classList.toggle('is-drawing',mode!=='distance');
  arena.classList.toggle('is-tracking',mode==='distance');
  setMessage(mode==='distance'?'KEEP YOUR CURSOR ON THE RING':mode==='motion'?'MATCH THE ORIGINAL SPEED':'COPY THE CURVE');
  announce(mode==='distance'?'Tracking distance for 11 seconds.':mode==='path'?'Draw and release to score.':'Keep drawing until the timer runs out.');
  renderStats();renderLive();schedule();
 }
 function frame(now){
  raf=0;
  const dt=lastFrame?clamp((now-lastFrame)/1000,0,.05):0;
  lastFrame=now;
  if(phase==='preview'){
   preview+=dt;
   if(preview>=(mode==='motion'?DURATION.motion:3.8)){
    previewDone();return;
   }
  }else if(phase==='active'){
   const before=elapsed;elapsed=Math.min(DURATION[mode],elapsed+dt);
   const actual=elapsed-before;
   if(mode==='distance'){
    if(mouse){
     const radius=Math.abs(dist(mouse,distanceCenter(elapsed))-targetDistance);
     accuracyIntegral+=Math.exp(-radius/58)*actual;
    }
   }else if(mode==='motion'){
    timeSamples.push({t:elapsed,point:mouse?{x:mouse.x,y:mouse.y}:null,
     missing:!mouse});
    if(mouse&&actual>0){
     const expected=targetAt(motionProgress(clamp(elapsed/DURATION.motion,0,1)));
     const error=dist(mouse,expected);
     liveMotionArea+=(.48*Math.exp(-error/103)+.52*Math.exp(-error/155))*actual;
    }
   }
   if(elapsed>=DURATION[mode]){finish();return}
  }else if(phase==='replay'){
   replayElapsed=Math.min(DURATION.motion,replayElapsed+dt);
   if(replayElapsed>=DURATION.motion){stopReplay(true);return}
  }else return;
  renderStats();renderLive();draw();schedule();
 }
 function schedule(){
  if(!raf)raf=requestAnimationFrame(frame);
 }
 function drawLine(points,color,width,alpha=1,part=1){
  if(points.length<2)return;
  const last=Math.max(1,Math.floor((points.length-1)*clamp(part,0,1)));
  ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  for(let i=1;i<=last;i++)ctx.lineTo(points[i].x,points[i].y);
  // Understroke softens jagged pixels without creating a neon or glossy trail.
  ctx.globalAlpha=alpha*.17;ctx.lineWidth=width+5;ctx.stroke();
  ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.stroke();
  ctx.restore();
 }
 function dot(p,r,color,outline='#101820'){
  ctx.save();
  ctx.beginPath();ctx.arc(p.x,p.y,r+8,0,Math.PI*2);
  ctx.strokeStyle=color;ctx.globalAlpha=.19;ctx.lineWidth=1.25;ctx.stroke();
  ctx.globalAlpha=1;
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);
  ctx.fillStyle=color;ctx.fill();
  if(outline){ctx.lineWidth=2;ctx.strokeStyle=outline;ctx.stroke()}
  ctx.restore();
 }
 function drawCanvasBackdrop(){
  // Graph-paper texture: low contrast so the moving targets remain the focus.
  ctx.fillStyle='#101923';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#e9f2f704';
  for(let x=28;x<W;x+=28)ctx.fillRect(x,0,1,H);
  for(let y=28;y<H;y+=28)ctx.fillRect(0,y,W,1);
  ctx.fillStyle='#ddeef208';
  for(let x=140;x<W;x+=140)ctx.fillRect(x,0,1,H);
  for(let y=140;y<H;y+=140)ctx.fillRect(0,y,W,1);
  // Small registration marks give the board a designed, tactile feel.
  ctx.fillStyle='#aec6ce4b';
  for(const x of [23,W-23]){
   ctx.fillRect(x-7,25,14,1);ctx.fillRect(x,19,1,13);
   ctx.fillRect(x-7,H-25,14,1);ctx.fillRect(x,H-31,1,13);
  }
 }
 function draw(){
  const dpr=Math.min(2,window.devicePixelRatio||1);
  if(dpr!==pixelRatio){pixelRatio=dpr;canvas.width=W*dpr;canvas.height=H*dpr}
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
  ctx.clearRect(0,0,W,H);drawCanvasBackdrop();
  if(!ownerId||prototype.hidden)return;
  const origin=route[0],end=route.at(-1);
  if(mode==='distance'){
   const p=distanceCenter(phase==='active'?elapsed:phase==='result'?DURATION.distance:0);
   // The aiming ring, tolerance rings, and connecting distance line must ALL
   // vanish immediately at the start, leaving only the moving dot and cursor.
   if(phase!=='active'){
    ctx.beginPath();ctx.arc(p.x,p.y,targetDistance,0,2*Math.PI);
    ctx.setLineDash([5,7]);ctx.lineWidth=2.5;ctx.strokeStyle='#e8ce93';ctx.stroke();
    ctx.setLineDash([]);
    for(const radius of [targetDistance-10,targetDistance+10]){
     ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);
     ctx.lineWidth=.7;ctx.strokeStyle='#e2c58d45';ctx.stroke();
    }
   }
   dot(p,8,'#f6db9f',null);
   if(mouse&&(phase==='active'||phase==='ready')){
    if(phase==='ready'){
     ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(mouse.x,mouse.y);
     ctx.strokeStyle='#a7d9eb66';ctx.lineWidth=1.5;ctx.stroke();
    }
    dot(mouse,5,'#a7e3ef',null);
   }
  }else if(phase==='replay'){
   // Draw both motion traces in lockstep using the recorded time samples.
   const u=motionProgress(clamp(replayElapsed/DURATION.motion,0,1));
   drawLine(route,'#abd8f0',5,.92,u);
   dot(targetAt(u),8,'#abd8f0',null);
   let segment=[],cursor=null;
   const flush=()=>{if(segment.length>1)drawLine(segment,'#f0b67f',4,.95);segment=[]};
   for(const sample of timeSamples){
    if(sample.t>replayElapsed)break;
    if(sample.missing||!sample.point){flush();cursor=null;continue}
    segment.push(sample.point);cursor=sample.point;
   }
   flush();
   if(cursor)dot(cursor,7,'#f0b67f',null);
  }else if(phase==='preview'){
   if(mode==='path'){
    const part=clamp(preview/2.65,0,1);
    drawLine(route,'#a9d8f0',6,.95,part);
    dot(origin,8,'#a9d8f0');
    if(part>=1)dot(end,7,'#f0c18b');
   }else{
    drawLine(route,'#93aac0',2,.23);
    const u=motionProgress(clamp(preview/DURATION.motion,0,1));
    drawLine(route,'#a9d8f0',4,.87,u);
    dot(targetAt(u),9,'#f5d79d',null);
    dot(origin,6,'#a9d8f0');
   }
  }else if(phase==='intro'){
   drawLine(route,'#9fbbce',3,.22);
   dot(origin,7,'#aed8ed');dot(end,7,'#ecca95');
  }else if(phase==='ready'){
   // Memory game: only the starting point and end marker remain visible.
   dot(origin,10,'#aee3f3');
   ctx.beginPath();ctx.arc(origin.x,origin.y,24,0,Math.PI*2);
   ctx.strokeStyle='#afe4f39a';ctx.lineWidth=1.5;ctx.stroke();
   dot(end,4,'#b4b9bd',null);
  }else{
   if(phase==='result'){
    if(showReference){drawLine(route,'#abd8f0',5,.88);
     dot(origin,7,'#a9d8f0');dot(end,6,'#f3cf98');}
   }
   drawLine(attempt,'#f0b67f',4,.96);
   if(attempt.length)dot(attempt.at(-1),5,'#f7c28e',null);
   if(mouse&&phase==='active')dot(mouse,5,'#fff6e4',null);
  }
  ctx.font='700 11px ui-monospace,monospace';
  ctx.fillStyle='#9babc0';
  if(mode==='distance'){
   ctx.fillText(phase==='active'?'GUIDE HIDDEN — HOLD YOUR DISTANCE':
    'TARGET DISTANCE: '+targetDistance+' PX',21,H-22);
  }else if(phase==='replay'){
   ctx.fillStyle='#abd8f0';ctx.fillText('— REFERENCE',21,H-22);
   ctx.fillStyle='#f0b67f';ctx.fillText('— YOUR RUN',142,H-22);
  }
  else if(phase==='result'){
    if(showReference){ctx.fillStyle='#a9d8f0';ctx.fillText('— TARGET',21,H-22);}
    ctx.fillStyle='#f0b67f';ctx.fillText('— YOUR ATTEMPT',showReference?115:21,H-22);
   }
 }
 canvas.addEventListener('pointerdown',e=>{
  if(!ownerId||prototype.hidden||phase!=='ready')return;
  if(e.pointerType==='mouse'&&e.button!==0)return;
  const p=position(e);
  if(mode==='distance'){
   if(Math.abs(dist(p,distanceCenter(0))-targetDistance)>31){
    announce('Click the dotted ring around the gold dot to begin.');return;
   }
  }else if(dist(p,route[0])>43){
   announce('Start inside the circle around the blue dot.');return;
  }
  e.preventDefault();
  if(e.pointerType!=='mouse'){
   try{canvas.setPointerCapture(e.pointerId)}catch{}
  }else try{canvas.setPointerCapture(e.pointerId)}catch{}
  begin(p,e.pointerId);
 });
 canvas.addEventListener('pointermove',e=>{
  if(phase==='ready'){mouse=position(e);draw();return}
  if(phase!=='active')return;
  if(mode!=='distance'&&e.pointerId!==activePointer)return;
  if(mode==='distance'&&activePointer!==null&&e.pointerType==='touch'&&e.pointerId!==activePointer)return;
  const previous=mouse;
  mouse=position(e);
  if(mode==='distance')soundMove(previous,mouse);
  else addPoint(mouse);
  renderLive();draw();
 });
 canvas.addEventListener('pointerup',e=>{
  if(phase!=='active'||activePointer!==e.pointerId)return;
  if(mode==='path'){
   addPoint(position(e));finish();
  }else if(mode==='motion'){
   // Releasing early ends the attempt: remaining time counts as missed.
   mouse=null;
   finish();
  }else if(e.pointerType!=='mouse')mouse=null;
  try{canvas.releasePointerCapture(e.pointerId)}catch{}
  if(mode==='distance')activePointer=null;
 });
 canvas.addEventListener('pointerleave',e=>{
  if(phase==='active'&&mode==='distance'&&e.pointerType==='mouse')mouse=null;
 });
 canvas.addEventListener('pointercancel',e=>{
  if(phase!=='active'||activePointer!==e.pointerId)return;
  if(mode==='path'||mode==='motion')finish();
  else mouse=null;
  activePointer=null;
 });
 $('testOpenPrecision').addEventListener('click',()=>{
  if(!ownerId)return;
  prototype.hidden=false;prototype.inert=false;
  switchMode(mode);prototype.scrollIntoView({behavior:'smooth',block:'start'});
 });
 modeSelect.addEventListener('change',()=>switchMode(modeSelect.value));
 $('apNew').addEventListener('click',()=>{if(ownerId)reset({reroll:true})});
 $('apNewResult').addEventListener('click',()=>{if(ownerId)reset({reroll:true})});
 $('apRetry').addEventListener('click',()=>{if(ownerId)reset()});
 replayButton.addEventListener('click',replayMotion);
 soundButton.addEventListener('click',()=>{
  soundEnabled=!soundEnabled;
  soundButton.textContent=soundEnabled?'SOUND: ON':'SOUND: OFF';
  soundButton.setAttribute('aria-pressed',String(soundEnabled));
  if(soundEnabled)playTone(525,.09,0,.016);
 });
 compareButton.addEventListener('click',()=>{
  if(!ownerId||phase!=='result'||mode==='distance')return;
  showReference=!showReference;
  compareButton.textContent=showReference?'MY LINE ONLY':'SHOW BOTH LINES';
  draw();
 });
 start.addEventListener('click',startPreview);
 window.addEventListener('blur',()=>{
  if(phase==='active'||phase==='preview'||phase==='replay')reset();
 });
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&(phase==='active'||phase==='preview'||phase==='replay'))reset();
 });
 window.addEventListener('pagehide',cancel);
 function deny(reason){
  ownerId=null;cancel();prototype.hidden=true;prototype.inert=true;
  collection.hidden=true;collection.inert=true;access.hidden=false;
  access.classList.add('is-denied');access.textContent=reason;
 }
 async function verify(){
  const ticket=++verifySerial;
  deny('Checking your owner account…');access.classList.remove('is-denied');
  // Header preview and client-side flags do not grant access.
  if(typeof criloDB==='undefined'||!criloDB?.auth?.getUser){
   deny('Sign-in service is unavailable. Refresh to try again.');return;
  }
  try{
   const {data,error}=await criloDB.auth.getUser();
   if(ticket!==verifySerial)return;
   if(error||!data?.user?.id){
    deny('Owner access only. Please sign in with the owner account.');return;
   }
   const userId=data.user.id;
   const {data:profile,error:readError}=await criloDB.from('profiles')
    .select('id,is_owner').eq('id',userId).maybeSingle();
   if(ticket!==verifySerial)return;
   if(readError||profile?.id!==userId||profile.is_owner!==true){
    deny('This playtest area is available only to Crilo’s owner account.');return;
   }
   ownerId=userId;
   for(const m of Object.keys(modes))bests[m]=readBest(m);
   access.hidden=true;collection.hidden=false;collection.inert=false;
   prototype.hidden=true;prototype.inert=true;
   switchMode('path');
  }catch{
   if(ticket===verifySerial)deny('Could not verify owner access. Check your connection and refresh.');
  }
 }
 window.addEventListener('crilo-auth-ready',verify);
 if(window.Crilo?.authResolved)void verify();
})();
