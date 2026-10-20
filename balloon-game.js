/* Keep It Up! Independent Crilo balloon mini-game.
 * Local personal best only; never writes official/bonus runs, badges, rankings,
 * accounts or statistics. Pointer, touch and keyboard share one physics loop. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const stage=$('balloonStage'),balloon=$('balloonTarget'),overlay=$('balloonOverlay'),
  start=$('balloonStart'),pause=$('balloonPause'),sound=$('balloonSound'),
  scoreLabel=$('balloonScore'),bestLabel=$('balloonBest'),
  kicker=$('balloonOverlayKicker'),title=$('balloonOverlayTitle'),
  description=$('balloonOverlayText'),status=$('balloonStatus'),pop=$('balloonPopWord');
 if(![stage,balloon,overlay,start,pause,sound,scoreLabel,bestLabel,kicker,title,description,status,pop].every(Boolean))return;

 const BEST_KEY='crilo_keep_it_up_best_v1';
 const palette=[
  ['#f3a6bd','#ffe7e9','#dc7c9c'],
  ['#b7a9ea','#efe4ff','#8878cb'],
  ['#a9ddc3','#eaffef','#77bca4'],
  ['#f3c77f','#fff3cd','#dfab55'],
  ['#a4d3e9','#e7f7ff','#74afcb'],
  ['#e3b3d9','#ffe6f6','#c28cbc']
 ];
 const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
 const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
 let best=0;
 try{
  const stored=Number(localStorage.getItem(BEST_KEY));
  if(Number.isSafeInteger(stored)&&stored>=0&&stored<=999999)best=stored;
 }catch{/* Keep playing if storage is unavailable */}
 let enabled=true;
 try{enabled=localStorage.getItem('crilo_sound')!=='off'}catch{}
 let context=null;
 let state='ready',score=0,x=0,y=0,vx=0,vy=0,lastTime=0,frame=0;
 let width=0,height=0,hitTimer=0;
 let popTimer=0;
 const radius=50,halfHeight=57,ground=47;
 const screen=()=>({width:stage.clientWidth,height:stage.clientHeight});
 const maxY=()=>height-ground-halfHeight;
 const showMessage=text=>{status.textContent=text};
 bestLabel.textContent=String(best);
 sound.setAttribute('aria-pressed',String(enabled));
 sound.textContent=enabled?'♫ Sound on':'♫ Sound off';
 function record(){
  if(score<=best)return;
  best=score;bestLabel.textContent=String(best);
  try{localStorage.setItem(BEST_KEY,String(best))}catch{}
 }
 function color(){
  const p=palette[Math.floor(score/5)%palette.length];
  stage.style.setProperty('--balloon-color',p[0]);
  stage.style.setProperty('--balloon-light',p[1]);
  stage.style.setProperty('--balloon-deep',p[2]);
 }
 function dimensions(){
  const prevW=width,prevH=height;
  const size=screen();width=Math.max(220,size.width);height=Math.max(280,size.height);
  if(prevW&&prevH){
   x=clamp(x/prevW*width,radius,width-radius);
   y=clamp(y/prevH*height,halfHeight,maxY());
  }
  render();
 }
 function render(){
  balloon.style.left=x+'px';balloon.style.top=y+'px';
  stage.dataset.state=state;
  stage.dataset.x=String(Math.round(x));
  stage.dataset.y=String(Math.round(y));
  stage.dataset.vy=String(Math.round(vy));
  stage.dataset.bounces=String(score);
  stage.dataset.best=String(best);
 }
 function tone(){
  if(!enabled)return;
  try{
   const AudioContext=window.AudioContext||window.webkitAudioContext;
   if(!AudioContext)return;
   if(!context)context=new AudioContext();
   if(context.state==='suspended')void context.resume().catch(()=>{});
   const t=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
   osc.type='sine';osc.frequency.setValueAtTime(560,t);
   osc.frequency.exponentialRampToValueAtTime(840,t+.085);
   gain.gain.setValueAtTime(.0001,t);
   gain.gain.exponentialRampToValueAtTime(.055,t+.012);
   gain.gain.exponentialRampToValueAtTime(.0001,t+.12);
   osc.connect(gain);gain.connect(context.destination);osc.start(t);osc.stop(t+.13);
  }catch{/* Audio failures must not stop gameplay */}
 }
 function label(effect){
  pop.classList.remove('is-visible');
  void pop.offsetWidth;
  pop.textContent=effect;
  pop.style.left=x+'px';pop.style.top=(y-55)+'px';
  pop.classList.add('is-visible');
  clearTimeout(popTimer);
  popTimer=window.setTimeout(()=>pop.classList.remove('is-visible'),reduced()?400:540);
 }
 function stopLoop(){
  if(frame){cancelAnimationFrame(frame);frame=0;}
  lastTime=0;
 }
 function gameOver(){
  if(state!=='playing')return;
  state='over';stopLoop();balloon.disabled=true;pause.disabled=true;pause.textContent='Pause';
  record();
  kicker.textContent=score>best-1&&score>0?'NICE TRY!':'BOOP...';
  title.textContent=score===0?'Oops.':score>=20?'What a run!':'Down it goes.';
  description.textContent='You kept it up for '+score+' '+(score===1?'bounce':'bounces')+
   '. Your best is '+best+'. Want another go?';
  start.textContent='Play again ↗';
  overlay.hidden=false;
  showMessage('Game over. '+score+' bounces. Press Play again to try again.');
  render();start.focus({preventScroll:true});
 }
 function tick(now){
  frame=0;
  if(state!=='playing')return;
  if(lastTime){
   // Clamp long frames to avoid accidental losses due to slow devices.
   const dt=clamp((now-lastTime)/1000,0,.045);
   const gravity=355+Math.min(score*8,195);
   vy+=gravity*dt;
   const wind=Math.sin(now*.0011)*Math.min(7+score*.38,19);
   vx+=wind*dt;
   x+=vx*dt;y+=vy*dt;
   const edge=Math.min(radius,width/2);
   if(x<edge){x=edge;vx=Math.abs(vx)*.77}
   else if(x>width-edge){x=width-edge;vx=-Math.abs(vx)*.77}
   if(y<halfHeight){y=halfHeight;vy=Math.abs(vy)*.30}
   if(y>=maxY()){y=maxY();render();gameOver();return}
  }
  lastTime=now;
  render();
  frame=requestAnimationFrame(tick);
 }
 function startLoop(){
  if(frame)cancelAnimationFrame(frame);
  lastTime=0;frame=requestAnimationFrame(tick);
 }
 function showOverlay(which){
  overlay.hidden=false;
  if(which==='paused'){
   kicker.textContent='A LITTLE BREAK';title.textContent='Holding steady.';
   description.textContent='Your balloon will wait here until you are ready.';
   start.textContent='Keep going ↗';
  }
 }
 function begin(){
  if(state==='paused'){
   state='playing';pause.textContent='Pause';overlay.hidden=true;
   showMessage('Back in the air. Keep tapping!');
   startLoop();render();balloon.focus({preventScroll:true});return;
  }
  if(state!=='ready'&&state!=='over')return;
  stopLoop();
  const rect=screen();width=Math.max(220,rect.width);height=Math.max(280,rect.height);
  score=0;scoreLabel.textContent='0';
  x=width*.50;y=Math.min(height*.48,maxY()-40);
  vx=45;vy=-240;state='playing';
  balloon.disabled=false;pause.disabled=false;pause.textContent='Pause';
  overlay.hidden=true;
  color();render();showMessage('Keep it up! Tap the balloon before it falls.');
  startLoop();balloon.focus({preventScroll:true});
 }
 function hold(){
  if(state==='playing'){
   stopLoop();state='paused';pause.textContent='Resume';showOverlay('paused');
   showMessage('Paused. Your run is safe until you resume.');
   render();start.focus({preventScroll:true});
  }else if(state==='paused')begin();
 }
 function bounceAt(clientX=null){
  if(state!=='playing')return;
  score++;scoreLabel.textContent=String(score);record();
  const box=stage.getBoundingClientRect();
  const toward=clientX===null?0:clamp((x-(clientX-box.left))/radius,-1,1);
  vx=clamp(vx*.33+toward*165+(Math.sin(score*1.7)*18),-255,255);
  vy=-(355+Math.min(score*3.5,100));
  balloon.classList.remove('is-hit');void balloon.offsetWidth;
  if(!reduced())balloon.classList.add('is-hit');
  clearTimeout(hitTimer);
  hitTimer=window.setTimeout(()=>balloon.classList.remove('is-hit'),190);
  color();label(score%10===0?'WOW!':score%5===0?'NICE!':'+1');
  tone();render();
  if(score%10===0)showMessage(score+' bounces! The balloon is getting quicker.');
 }
 balloon.addEventListener('pointerdown',event=>{
  if(event.button!==undefined&&event.button!==0)return;
  if(state!=='playing')return;
  event.preventDefault();
  bounceAt(event.clientX);
 });
 // Assistive tech triggers click without a pointer event.
 balloon.addEventListener('click',event=>{if(event.detail===0)bounceAt()});
 document.addEventListener('keydown',event=>{
  if(state!=='playing'||event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
  if(![' ','ArrowUp'].includes(event.key))return;
  const active=document.activeElement;
  if(active&&active!==balloon&&/^(BUTTON|INPUT|TEXTAREA|SELECT|A)$/.test(active.tagName))return;
  if(document.getElementById('gameInfoModal')?.hidden===false)return;
  event.preventDefault();bounceAt();
 });
 start.addEventListener('click',begin);
 pause.addEventListener('click',hold);
 sound.addEventListener('click',()=>{
  enabled=!enabled;sound.setAttribute('aria-pressed',String(enabled));
  sound.textContent=enabled?'♫ Sound on':'♫ Sound off';
 });
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&state==='playing')hold();
 });
 // The browser's back-forward cache can restore an already-loaded page.
 // Turn active play into a resumable pause rather than canceling its only RAF.
 window.addEventListener('pagehide',()=>{
  if(state==='playing')hold();
  else stopLoop();
 });
 // Reading the info dialog must never cause a surprise floor collision.
 document.getElementById('gameInfoBtn')?.addEventListener('click',()=>{
  if(state==='playing')hold();
 });
 if('ResizeObserver' in window){
  new ResizeObserver(()=>dimensions()).observe(stage);
 }else window.addEventListener('resize',dimensions,{passive:true});
 dimensions();color();x=width/2;y=Math.min(height*.48,maxY()-40);render();
})();
