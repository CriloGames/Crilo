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
   intro:'A dot will start moving. Keep your cursor exactly on the circle around it for 11 seconds. No clicking targets or rhythm.',
   button:'START DISTANCE',
   help:'Click anywhere on the dotted ring to start. Follow the moving dot while keeping your pointer on the ring. Being too close or too far reduces your score. Complete the full 11 seconds.',
   metric:'TIME LEFT'
  },
  motion:{
   title:'Perfect Motion',description:'Copy a moving cursor — including its speed changes.',
   intro:'Watch a cursor trace a route, remembering when it slows and speeds up. Then repeat its exact motion.',
   button:'WATCH MOTION',
   help:'Watch the ghost cursor and its changes in speed. When it disappears, begin at the marked start and drag across the same route for 5.2 seconds. Your score combines where the cursor was and when it got there.',
   metric:'TIME LEFT'
  }
 };
 const modeSelect=$('apMode'),lastLabel=$('apLast'),bestLabel=$('apBest');
 const roundLabel=$('apRound'),metricTitle=$('apMetricTitle'),metric=$('apMetric');
 const hudLeft=$('apHudLeft'),hudRight=$('apHudRight'),message=$('apMessage');
 const overlay=$('apOverlay'),start=$('apStart'),status=$('apStatus'),progress=$('apProgress');
 let ownerId=null,verifySerial=0,mode='path',phase='intro',rounds={path:1,distance:1,motion:1};
 let bests={path:0,distance:0,motion:0},lastScores={path:null,distance:null,motion:null};
 let route=[],preview=0,elapsed=0,activePointer=null,mouse=null,attempt=[],timeSamples=[];
 let lastFrame=0,raf=0,accuracyIntegral=0,lastStep=0;
 let pixelRatio=1;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const lerp=(a,b,t)=>a+(b-a)*t;
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const pct=n=>clamp(n,0,100).toFixed(2)+'%';
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
  overlay.hidden=false;
 }
 function clearOverlay(){overlay.hidden=true}
 function createRoute(m,round){
  const pts=[],type=(round-1)%5,tilt=(round*0.63)%6.28;
  for(let i=0;i<=240;i++){
   const u=i/240,t=u*Math.PI*2;
   let x=125+710*u,y=280;
   if(type===0)y+=92*Math.sin(t+tilt*.15)+42*Math.sin(2*t+.6);
   if(type===1)y+=112*Math.sin(1.5*t+.3)+28*Math.cos(3*t+.4);
   if(type===2){x+=29*Math.sin(t*3);y+=119*Math.cos(t*1.25+.35);}
   if(type===3)y+=95*Math.sin(2.35*t+.15)+30*Math.cos(t*4+.7);
   if(type===4){x+=36*Math.sin(2*t+.4);y+=115*Math.sin(t*1.8+.2);}
   if(m==='motion')y=280+(y-280)*.78+23*Math.sin(3.5*t+tilt*.18);
   pts.push({x:clamp(x,90,W-90),y:clamp(y,82,H-82)});
  }
  return pts;
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
  const r=rounds.distance,offset=(r-1)*.58;
  return {x:480+169*Math.sin(.68*t+offset)+42*Math.sin(1.47*t+offset*.8),
   y:280+99*Math.cos(.77*t+offset*.7)+31*Math.sin(1.17*t+offset)};
 }
 function pointOnRing(t){
  const p=distanceCenter(t);
  return {x:p.x+82,y:p.y};
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
 function pathScore(points){
  if(points.length<3||lengthOf(points)<20)return 0;
  const original=sampleByArc(route,120),drawn=sampleByArc(points,120);
  const mean=original.reduce((a,p,i)=>a+dist(p,drawn[i]),0)/120;
  const shape=Math.exp(-mean/105);
  const lengthPenalty=Math.exp(-1.45*Math.abs(lengthOf(points)-lengthOf(route))/lengthOf(route));
  const endPenalty=Math.exp(-dist(route.at(-1),points.at(-1))/115);
  const startPenalty=Math.exp(-dist(route[0],points[0])/115);
  return clamp(100*shape*lengthPenalty*endPenalty*startPenalty,0,100);
 }
 function motionScore(){
  const duration=DURATION.motion;
  if(timeSamples.length<3)return 0;
  let area=0;
  for(let i=1;i<timeSamples.length;i++){
   const a=timeSamples[i-1],b=timeSamples[i],dt=b.t-a.t;
   if(dt<=0)continue;
   const target=targetAt(motionProgress(clamp(b.t/duration,0,1)));
   const error=b.missing?260:dist(b.point,target);
   area+=Math.exp(-error/103)*dt;
  }
  const timeAccuracy=100*area/duration;
  return clamp(timeAccuracy*.72+pathScore(attempt)*.28,0,100);
 }
 function renderStats(){
  lastLabel.textContent=lastScores[mode]===null?'—':pct(lastScores[mode]);
  bestLabel.textContent=bests[mode]>0?pct(bests[mode]):'—';
  roundLabel.textContent=String(rounds[mode]).padStart(2,'0');
  metricTitle.textContent=modes[mode].metric;
  const remaining=DURATION[mode]-elapsed;
  metric.textContent=phase==='active'?
   (mode==='path'?labelSec(elapsed):labelSec(remaining)):
   phase==='preview'?labelSec((mode==='motion'?DURATION.motion:3.8)-preview):
   phase==='result'?mode==='path'?labelSec(elapsed):'DONE':'—';
  hudLeft.textContent=modes[mode].title.toUpperCase();
  hudRight.textContent=phase==='preview'?'WATCH':phase==='ready'?'YOUR TURN':
   phase==='active'?(mode==='path'?'TRACE':Math.ceil(remaining)+'s'):
   phase==='result'?(lastScores[mode]!==null?pct(lastScores[mode]):'FINISHED'):'READY';
 }
 function reset(keepRound=true){
  cancel();phase='intro';elapsed=0;preview=0;lastStep=0;activePointer=null;mouse=null;
  attempt=[];timeSamples=[];accuracyIntegral=0;
  if(!keepRound)rounds[mode]++;
  route=createRoute(mode,rounds[mode]);
  arena.classList.remove('is-drawing','is-tracking');
  showOverlay(mode==='path'?'01 / 03':mode==='distance'?'02 / 03':'03 / 03',
   modes[mode].title,modes[mode].intro,modes[mode].button,
   'Every attempt gets an accuracy percentage. Aim for 99%.');
  setMessage('');
  renderStats();draw();
  announce('Ready for '+modes[mode].title+'. Your results stay in your browser.');
 }
 function switchMode(next){
  if(!modes[next]||!ownerId)return;
  mode=next;
  modeSelect.value=next;
  $('apModeDescription').textContent=modes[next].description;
  $('apHowTitle').textContent=modes[next].title;
  $('apHowCopy').textContent=modes[next].help;
  reset();
 }
 function startPreview(){
  if(!ownerId||prototype.hidden)return;
  if(phase==='result'){reset();} 
  if(mode==='distance'){
   phase='ready';clearOverlay();
   setMessage('MOVE ONTO THE DOTTED RING • CLICK TO BEGIN');
   announce('Find the moving dot’s distance ring and click on it to start.');
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
  const score=clamp(value,0,100);
  lastScores[mode]=score;
  const isBest=saveBest(score);
  renderStats();
  setMessage('');
  draw();
  const detail=mode==='path'?'Your path is shown in orange over the original blue line.':
   mode==='distance'?'The score measures how closely you stayed 82 pixels from the moving dot.':
    'The score combines route accuracy (28%) and matching its timing (72%).';
  showOverlay(isBest?'NEW PERSONAL BEST':'ATTEMPT COMPLETE',
   pct(score),detail,
   'TRY AGAIN','Same challenge, another attempt. Or choose NEW CHALLENGE.');
  announce('You scored '+pct(score)+' in '+modes[mode].title+'. '+(isBest?'New personal best.':'Try again to improve.'));
 }
 function addPoint(p){
  const last=attempt.at(-1);
  if(!last||dist(last,p)>.35){
   if(attempt.length>=2600)return;
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
  attempt=[];timeSamples=[];mouse=p;lastFrame=0;
  if(mode!=='distance')addPoint(p);
  arena.classList.toggle('is-drawing',mode!=='distance');
  arena.classList.toggle('is-tracking',mode==='distance');
  setMessage(mode==='distance'?'KEEP YOUR CURSOR ON THE RING':mode==='motion'?'MATCH THE ORIGINAL SPEED':'COPY THE CURVE');
  announce(mode==='distance'?'Tracking distance for 11 seconds.':mode==='path'?'Draw and release to score.':'Keep drawing until the timer runs out.');
  renderStats();schedule();
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
     const radius=Math.abs(dist(mouse,distanceCenter(elapsed))-82);
     accuracyIntegral+=Math.exp(-radius/58)*actual;
    }
   }else if(mode==='motion'){
    timeSamples.push({t:elapsed,point:mouse?{x:mouse.x,y:mouse.y}:null,
     missing:!mouse});
   }
   if(elapsed>=DURATION[mode]){finish();return}
  }else return;
  renderStats();draw();schedule();
 }
 function schedule(){
  if(!raf)raf=requestAnimationFrame(frame);
 }
 function drawLine(points,color,width,alpha=1,part=1){
  if(points.length<2)return;
  const last=Math.max(1,Math.floor((points.length-1)*clamp(part,0,1)));
  ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;
  ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
  ctx.moveTo(points[0].x,points[0].y);
  for(let i=1;i<=last;i++)ctx.lineTo(points[i].x,points[i].y);
  ctx.stroke();ctx.restore();
 }
 function dot(p,r,color,outline='#101820'){
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);
  ctx.fillStyle=color;ctx.fill();
  if(outline){ctx.lineWidth=2;ctx.strokeStyle=outline;ctx.stroke()}
 }
 function draw(){
  const dpr=Math.min(2,window.devicePixelRatio||1);
  if(dpr!==pixelRatio){pixelRatio=dpr;canvas.width=W*dpr;canvas.height=H*dpr}
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#0a0e16';ctx.fillRect(0,0,W,H);
  if(!ownerId||prototype.hidden)return;
  const origin=route[0],end=route.at(-1);
  if(mode==='distance'){
   const p=distanceCenter(phase==='active'?elapsed:phase==='result'?DURATION.distance:0);
   ctx.beginPath();ctx.arc(p.x,p.y,82,0,2*Math.PI);
   ctx.setLineDash([5,7]);ctx.lineWidth=2.5;ctx.strokeStyle='#e8ce93';ctx.stroke();
   ctx.setLineDash([]);
   ctx.beginPath();ctx.arc(p.x,p.y,72,0,Math.PI*2);
   ctx.lineWidth=.7;ctx.strokeStyle='#e2c58d45';ctx.stroke();
   ctx.beginPath();ctx.arc(p.x,p.y,92,0,Math.PI*2);
   ctx.strokeStyle='#e2c58d45';ctx.stroke();
   dot(p,8,'#f6db9f',null);
   if(mouse&&(phase==='active'||phase==='ready')){
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(mouse.x,mouse.y);
    ctx.strokeStyle='#a7d9eb66';ctx.lineWidth=1.5;ctx.stroke();
    dot(mouse,5,'#a7e3ef',null);
   }
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
    drawLine(route,'#abd8f0',5,.88);
    dot(origin,7,'#a9d8f0');dot(end,6,'#f3cf98');
   }
   drawLine(attempt,'#f0b67f',4,.96);
   if(attempt.length)dot(attempt.at(-1),5,'#f7c28e',null);
   if(mouse&&phase==='active')dot(mouse,5,'#fff6e4',null);
  }
  ctx.font='700 11px ui-monospace,monospace';
  ctx.fillStyle='#9babc0';
  if(mode==='distance'){ctx.fillText('STAY 82 PX AWAY',21,H-22)}
  else if(phase==='result'){ctx.fillStyle='#a9d8f0';ctx.fillText('— TARGET',21,H-22);
    ctx.fillStyle='#f0b67f';ctx.fillText('— YOUR ATTEMPT',115,H-22);}
 }
 canvas.addEventListener('pointerdown',e=>{
  if(!ownerId||prototype.hidden||phase!=='ready')return;
  if(e.pointerType==='mouse'&&e.button!==0)return;
  const p=position(e);
  if(mode==='distance'){
   if(Math.abs(dist(p,distanceCenter(0))-82)>31){
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
  mouse=position(e);
  if(mode!=='distance')addPoint(mouse);
  draw();
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
 $('apNew').addEventListener('click',()=>{if(ownerId){rounds[mode]++;reset()}});
 start.addEventListener('click',startPreview);
 window.addEventListener('blur',()=>{
  if(phase==='active'||phase==='preview')reset();
 });
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&(phase==='active'||phase==='preview'))reset();
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
