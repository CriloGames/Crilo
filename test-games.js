/* THE LAST LIGHT — owner-only local prototype. Never touches public scores,
   official Daily records, achievements, or player storage. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const access=$('testAccess'),collection=$('testCollection'),prototype=$('lightPrototype');
 const canvas=$('llCanvas'),stage=$('llStage'),ctx=canvas?.getContext('2d');
 if(!access||!collection||!canvas||!stage||!ctx)return;
 const overlay=$('llOverlay'),start=$('llStart'),prompt=$('llPrompt');
 const timeLabel=$('llTime'),precisionLabel=$('llPrecision'),bestLabel=$('llBest');
 const phaseLabel=$('llPhase'),status=$('llStatus'),difficulty=$('llDifficulty');
 const pauseButton=$('llPause'),resetButton=$('llReset'),soundButton=$('llSound');
 const configs={
  gentle:{speed:37,size:.124,reaction:.12},
  standard:{speed:58,size:.107,reaction:.18},
  intense:{speed:82,size:.092,reaction:.24}
 };
 let ownerId=null,authRevision=0,mode='standard',state='idle',soundOn=false,audio=null;
 let w=1100,h=640,dpr=1,raf=0,lastTime=0,elapsed=0,accuracyTotal=0;
 let pointer=null,touchId=null,trail=[],trailClock=0;
 let light={x:550,y:320,vx:0,vy:0,rx:62,ry:62,angle:0};
 let cachedBest=0;
 const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
 const pointInside=(p)=>{
  if(!p)return false;
  const dx=p.x-light.x,dy=p.y-light.y;
  const cs=Math.cos(light.angle),sn=Math.sin(light.angle);
  const u=dx*cs+dy*sn,v=-dx*sn+dy*cs;
  return (u*u)/(light.rx*light.rx)+(v*v)/(light.ry*light.ry)<=1;
 };
 const normalizedOffset=(p)=>{
  if(!p)return 0;
  const dx=p.x-light.x,dy=p.y-light.y;
  const cs=Math.cos(light.angle),sn=Math.sin(light.angle);
  const u=dx*cs+dy*sn,v=-dx*sn+dy*cs;
  return Math.sqrt((u*u)/(light.rx*light.rx)+(v*v)/(light.ry*light.ry));
 };
 const fmt=t=>{
  const m=Math.floor(t/60),s=Math.floor(t%60),cs=Math.floor((t%1)*100);
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(cs).padStart(2,'0');
 };
 const localKey=()=> 'crilo_owner_last_light_v1:'+ownerId+':'+mode;
 const readBest=()=>{
  try{const v=Number(localStorage.getItem(localKey()));return Number.isFinite(v)&&v>0?Math.min(v,86400):0}
  catch{return 0}
 };
 const saveBest=()=>{
  if(!ownerId||elapsed<=cachedBest)return;
  cachedBest=elapsed;
  try{localStorage.setItem(localKey(),String(elapsed))}catch{}
 };
 function labels(){
  timeLabel.textContent=fmt(elapsed);
  precisionLabel.textContent=accuracyTotal>0&&elapsed>0?
    (accuracyTotal/elapsed*100).toFixed(1)+'%':'—';
  bestLabel.textContent=cachedBest?fmt(cachedBest):'—';
  phaseLabel.textContent=elapsed<18?'Stillness':elapsed<33?'Momentum':elapsed<55?'Distortion':'Survival';
 }
 function chirp(frequency=400,duration=.08){
  if(!soundOn)return;
  try{
   const Audio=window.AudioContext||window.webkitAudioContext;
   if(!Audio)return;
   audio=audio||new Audio();
   if(audio.state==='suspended')audio.resume().catch(()=>{});
   const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime;
   osc.type='sine';osc.frequency.value=frequency;
   gain.gain.setValueAtTime(.0001,t);
   gain.gain.exponentialRampToValueAtTime(.035,t+.012);
   gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
   osc.connect(gain);gain.connect(audio.destination);
   osc.start(t);osc.stop(t+duration+.015);
   osc.onended=()=>{try{osc.disconnect();gain.disconnect()}catch{}};
  }catch{}
 }
 function cancelLoop(){
  if(raf)cancelAnimationFrame(raf);
  raf=0;lastTime=0;
 }
 function setOverlay(tag,title,copy,button,note){
  $('llOverlayTag').textContent=tag;
  $('llOverlayTitle').textContent=title;
  $('llOverlayCopy').textContent=copy;
  start.textContent=button;
  $('llOverlayNote').textContent=note;
  overlay.hidden=false;
  prompt.hidden=true;
 }
 function setStatus(value){status.textContent=value}
 function syncPause(){pauseButton.disabled=state!=='running';pauseButton.textContent='Pause'}
 function scaleLight(){
  const config=configs[mode],minDim=Math.min(w,h);
  const shrink=clamp((elapsed-28)/80,0,1)*.10;
  const base=clamp(minDim*config.size*(1-shrink),31,110);
  const distortion=clamp((elapsed-20)/30,0,1);
  const wave=Math.sin(elapsed*.95)*distortion;
  light.rx=base*(1+wave*.17);
  light.ry=base*(1-wave*.17);
  light.angle=distortion*Math.sin(elapsed*.3)*.27;
 }
 function fit(){
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const previousW=w,previousH=h;
  const nextW=rect.width,nextH=rect.height;
  if(state==='running'&&(Math.abs(nextW-w)>2||Math.abs(nextH-h)>2))pause('Window size changed.');
  if(previousW>0&&previousH>0){
   light.x*=nextW/previousW;light.y*=nextH/previousH;
   light.vx*=nextW/previousW;light.vy*=nextH/previousH;
   trail=trail.map(p=>({x:p.x*nextW/previousW,y:p.y*nextH/previousH}));
   if(pointer){pointer.x*=nextW/previousW;pointer.y*=nextH/previousH}
  }
  w=nextW;h=nextH;dpr=Math.min(window.devicePixelRatio||1,2);
  const pixelW=Math.max(1,Math.round(w*dpr)),pixelH=Math.max(1,Math.round(h*dpr));
  if(canvas.width!==pixelW||canvas.height!==pixelH){
   canvas.width=pixelW;canvas.height=pixelH;
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  scaleLight();draw();
 }
 function reset(showIntro=true){
  cancelLoop();
  state='idle';elapsed=0;accuracyTotal=0;pointer=null;touchId=null;
  trail.length=0;trailClock=0;
  light={x:w/2,y:h/2,vx:0,vy:0,rx:58,ry:58,angle:0};
  cachedBest=ownerId?readBest():0;
  scaleLight();labels();draw();syncPause();
  stage.classList.remove('is-running');
  prompt.hidden=true;
  if(showIntro)setOverlay('THE LAST LIGHT','Keep up with it.',
    'Your mouse must stay inside the moving light. If the cursor crosses the boundary, your run ends immediately.',
    'START TRACKING','Move into the light and click to begin. No rhythm or target clicking.');
  setStatus('Ready when you are. Your results stay on this device and never count toward public scores.');
 }
 function arm(){
  if(!ownerId)return;
  if(state!=='paused')reset(false);
  state='armed';
  overlay.hidden=true;
  prompt.hidden=false;
  syncPause();draw();
  setStatus('Put your cursor inside the light, then click. The light starts moving as soon as you begin.');
 }
 function pause(reason='Paused.'){
  if(state!=='running')return;
  state='paused';cancelLoop();stage.classList.remove('is-running');
  touchId=null;syncPause();
  setOverlay('TAKE YOUR TIME','Paused.',
    'Your timer and the light are frozen. Click Continue, then put your cursor inside the light to resume.',
    'CONTINUE','No progress is lost while paused.');
  setStatus(reason+' Resume whenever you are ready.');
 }
 function lose(){
  if(state!=='running')return;
  state='lost';cancelLoop();stage.classList.remove('is-running');syncPause();saveBest();labels();
  chirp(180,.22);
  const percent=elapsed>0?(accuracyTotal/elapsed*100).toFixed(1):'0.0';
  setOverlay('THE LIGHT WENT OUT','Light lost.',
   'Survived '+fmt(elapsed)+' with '+percent+'% center accuracy. '+(elapsed>=cachedBest-.001?'Personal best on '+mode+'.':'Try to beat your best.'),
   'TRY AGAIN','One escape from the boundary ends the run. Change difficulty above to compare.');
  setStatus('Run complete. Survival and accuracy are private playtest stats, not public leaderboard scores.');
  draw();
 }
 function begin(p,id){
  if(state!=='armed'||!pointInside(p))return false;
  pointer=p;touchId=id??null;state='running';prompt.hidden=true;overlay.hidden=true;
  stage.classList.add('is-running');syncPause();lastTime=0;chirp(530,.07);
  setStatus('Tracking. Stay inside the light. Press Esc or Pause if you need a break.');
  raf=requestAnimationFrame(frame);
  return true;
 }
 function step(dt){
  elapsed+=dt;
  scaleLight();
  const phase=clamp(elapsed/90,0,1),cfg=configs[mode];
  const scale=clamp(Math.min(w,h)/640,.68,1.35);
  const speed=cfg.speed*scale*(1+phase*1.03);
  const t=elapsed;
  // Smooth autonomous heading changes, with momentum rather than teleporting.
  let dx=Math.cos(.74*t+.45*Math.sin(t*.23))+.48*Math.sin(t*1.22);
  let dy=.85*Math.sin(t*.62+.5)+.36*Math.cos(t*1.07);
  const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
  // At the edge the light becomes skittish; staying centered calms it.
  const nd=pointer?normalizedOffset(pointer):0;
  const fear=cfg.reaction*clamp((nd-.36)/.64,0,1);
  const ux=pointer?(light.x-pointer.x)/(Math.hypot(light.x-pointer.x,light.y-pointer.y)||1):0;
  const uy=pointer?(light.y-pointer.y)/(Math.hypot(light.x-pointer.x,light.y-pointer.y)||1):0;
  const chaseX=dx*speed+ux*speed*fear;
  const chaseY=dy*speed+uy*speed*fear;
  const blend=1-Math.exp(-dt*(1.30+phase*.72));
  light.vx+=(chaseX-light.vx)*blend;
  light.vy+=(chaseY-light.vy)*blend;
  light.x+=light.vx*dt;light.y+=light.vy*dt;
  // Soft wall turns keep the safe region entirely inside the arena.
  const margin=Math.max(light.rx,light.ry)+10;
  if(light.x<margin){light.x=margin;light.vx=Math.abs(light.vx)*.7}
  if(light.x>w-margin){light.x=w-margin;light.vx=-Math.abs(light.vx)*.7}
  if(light.y<margin){light.y=margin;light.vy=Math.abs(light.vy)*.7}
  if(light.y>h-margin){light.y=h-margin;light.vy=-Math.abs(light.vy)*.7}
  trailClock+=dt;
  if(trailClock>.10){trailClock=0;trail.push({x:light.x,y:light.y});if(trail.length>38)trail.shift()}
  // Instant loss for leaving the current moving/rotating safe boundary.
  if(!pointInside(pointer)){lose();return}
  const nd2=normalizedOffset(pointer);
  accuracyTotal+=clamp(1-.60*nd2*nd2,0,1)*dt;
 }
 function frame(now){
  if(state!=='running')return;
  raf=0;
  const dt=lastTime?clamp((now-lastTime)/1000,0,.04):0;
  lastTime=now;
  if(dt>0)step(dt);
  draw();labels();
  if(state==='running')raf=requestAnimationFrame(frame);
 }
 function draw(){
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#050608';ctx.fillRect(0,0,w,h);
  if(!ownerId||!prototype||prototype.hidden)return;
  // Old path is intentionally faint: only the actual warm circle is safe.
  if(elapsed>18&&trail.length>2){
   ctx.beginPath();
   trail.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
   ctx.strokeStyle='rgba(204,204,177,.13)';ctx.lineWidth=1.5;ctx.lineCap='round';ctx.stroke();
  }
  const glow=Math.max(light.rx,light.ry)*2.1;
  const halo=ctx.createRadialGradient(light.x,light.y,0,light.x,light.y,glow);
  halo.addColorStop(0,'rgba(243,223,173,.17)');
  halo.addColorStop(.45,'rgba(239,215,160,.05)');
  halo.addColorStop(1,'rgba(243,223,173,0)');
  ctx.fillStyle=halo;ctx.fillRect(light.x-glow,light.y-glow,glow*2,glow*2);
  ctx.save();ctx.translate(light.x,light.y);ctx.rotate(light.angle);
  ctx.beginPath();ctx.ellipse(0,0,light.rx,light.ry,0,0,Math.PI*2);
  ctx.fillStyle='#f8e9c712';ctx.fill();
  ctx.lineWidth=2.25;ctx.strokeStyle='#f4e5bc';ctx.stroke();
  ctx.beginPath();ctx.ellipse(0,0,light.rx*.76,light.ry*.76,0,0,Math.PI*2);
  ctx.lineWidth=.8;ctx.strokeStyle='rgba(246,229,185,.15)';ctx.stroke();
  ctx.restore();
  if(pointer&&state==='running'){
   const nearEdge=normalizedOffset(pointer)>.76;
   ctx.strokeStyle=nearEdge?'#ffbd8a':'#f5f4ed';
   ctx.lineWidth=1.6;ctx.beginPath();
   ctx.moveTo(pointer.x-8,pointer.y);ctx.lineTo(pointer.x-3,pointer.y);
   ctx.moveTo(pointer.x+3,pointer.y);ctx.lineTo(pointer.x+8,pointer.y);
   ctx.moveTo(pointer.x,pointer.y-8);ctx.lineTo(pointer.x,pointer.y-3);
   ctx.moveTo(pointer.x,pointer.y+3);ctx.lineTo(pointer.x,pointer.y+8);
   ctx.stroke();
   ctx.fillStyle=nearEdge?'#ffbd8a':'#fffdf4';
   ctx.beginPath();ctx.arc(pointer.x,pointer.y,1.7,0,Math.PI*2);ctx.fill();
  }
 }
 const eventPoint=e=>{
  const r=canvas.getBoundingClientRect();
  return {x:e.clientX-r.left,y:e.clientY-r.top};
 };
 canvas.addEventListener('pointerdown',e=>{
  if(!ownerId||prototype.hidden||!['armed','running'].includes(state))return;
  if(e.pointerType==='mouse'&&e.button!==0)return;
  const p=eventPoint(e);
  if(state==='armed'){
   if(!pointInside(p)){
    setStatus('Move into the illuminated circle before clicking.');return;
   }
   e.preventDefault();
   if(e.pointerType==='touch'){
    try{canvas.setPointerCapture(e.pointerId)}catch{}
   }
   begin(p,e.pointerType==='touch'?e.pointerId:null);
  }
 });
 canvas.addEventListener('pointermove',e=>{
  if(state!=='running')return;
  if(e.pointerType==='touch'&&e.pointerId!==touchId)return;
  if(e.pointerType!=='touch'&&touchId!==null)return;
  pointer=eventPoint(e);
  if(!pointInside(pointer))lose();
 });
 canvas.addEventListener('pointerleave',e=>{
  if(state==='running'&&e.pointerType!=='touch')lose();
 });
 canvas.addEventListener('pointerup',e=>{
  if(state==='running'&&e.pointerType==='touch'&&e.pointerId===touchId){
   try{canvas.releasePointerCapture(e.pointerId)}catch{}
   pause('Finger lifted; the run is paused so you can reposition.');
  }
 });
 canvas.addEventListener('pointercancel',e=>{
  if(state==='running'&&e.pointerType==='touch'&&e.pointerId===touchId)pause('Touch interrupted.');
 });
 $('testOpenLight').addEventListener('click',()=>{
  if(!ownerId)return;
  prototype.hidden=false;fit();reset();
  prototype.scrollIntoView({behavior:'smooth',block:'start'});
 });
 start.addEventListener('click',()=>{if(state==='lost'||state==='idle'||state==='paused')arm()});
 resetButton.addEventListener('click',()=>{if(ownerId)reset()});
 pauseButton.addEventListener('click',()=>pause());
 difficulty.addEventListener('change',()=>{
  mode=configs[difficulty.value]?difficulty.value:'standard';
  if(ownerId)reset();
 });
 soundButton.addEventListener('click',()=>{
  if(!ownerId)return;
  soundOn=!soundOn;
  soundButton.textContent=soundOn?'Sound: On':'Sound: Off';
  soundButton.setAttribute('aria-pressed',String(soundOn));
  if(soundOn)chirp(630,.06);
 });
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&state==='running'){e.preventDefault();pause('Keyboard pause.')}
 });
 window.addEventListener('blur',()=>{if(state==='running')pause('Window lost focus.')});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='running')pause('Tab hidden.')});
 window.addEventListener('pagehide',()=>cancelLoop());
 if(window.ResizeObserver)new ResizeObserver(fit).observe(stage);
 else window.addEventListener('resize',fit,{passive:true});
 function deny(message){
  ownerId=null;cancelLoop();prototype.hidden=true;collection.hidden=true;
  collection.inert=true;access.hidden=false;access.classList.add('is-denied');
  access.textContent=message;
 }
 async function verify(){
  const revision=++authRevision;
  // Do not trust sessionStorage header previews or a pre-existing owner flag.
  // Every visit must independently confirm the current user and profile.
  deny('Checking your owner account…');
  access.classList.remove('is-denied');
  if(typeof criloDB==='undefined'||!criloDB?.auth?.getUser){deny('Sign-in service is unavailable. Please refresh.');return}
  try{
   const {data:auth,error:authError}=await criloDB.auth.getUser();
   if(revision!==authRevision)return;
   const user=auth?.user;
   if(authError||!user){deny('Owner access only. Please sign in with the owner account.');return}
   const {data:profile,error}=await criloDB.from('profiles')
    .select('id,is_owner').eq('id',user.id).maybeSingle();
   if(revision!==authRevision)return;
   if(error||profile?.id!==user.id||profile.is_owner!==true){
    deny('This playtest area is available only to Crilo’s owner account.');return;
   }
   ownerId=user.id;access.hidden=true;
   collection.hidden=false;collection.inert=false;
   cachedBest=readBest();labels();fit();
  }catch(err){
   if(revision===authRevision)deny('Could not verify owner access. Check your connection and refresh.');
  }
 }
 window.addEventListener('crilo-auth-ready',verify);
 if(window.Crilo?.authResolved)void verify();
})();
