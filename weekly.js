/* Lucky Seven: independent weekly wheel; every outcome is server-verified.
 * This page never writes normal Dailies, bonus Dailies, badges or streaks. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const canvas=$('weeklyWheel');if(!canvas)return;
 const ctx=canvas.getContext('2d');
 const startBtn=$('weeklyStart'),spinBtn=$('weeklySpin'),signIn=$('weeklySignIn');
 const dailyLink=$('weeklyDailyLink'),statusText=$('weeklyStatus'),finish=$('weeklyFinished');
 const scoreEl=$('weeklyScore'),remainingEl=$('weeklyRemaining'),takenEl=$('weeklyTaken');
 const ribbonEl=$('weeklyRibbons'),leaderList=$('weeklyLeaders'),weekLabel=$('weeklyWeekLabel');
 const countdownEl=$('weeklyCountdown');
 const fmt=n=>Math.max(0,Number(n)||0).toLocaleString('en-US');
 const initial=[
  {type:'num',base:40},{type:'duck'},{type:'num',base:20},{type:'upgrade'},
  {type:'num',base:60},{type:'num',base:20},{type:'spins'},{type:'num',base:80},
  {type:'duck'},{type:'num',base:40},{type:'double'},{type:'num',base:20}
 ];
 const colors=['#ffe4a2','#b6deef','#ffd5e3','#c8e5d0','#d6cef4','#f1dabf',
  '#c4e3ff','#fce9ad','#c1e9e0','#dfd5f3','#ffd8bb','#e2f1c7'];
 let segments=initial.concat(initial),rotation=0,multiplier=1;
 let session=null,serverState=null,weeklyStatus=null;
 let busy=false,animating=false,revision=0,currentAccount=null;
 const TAU=Math.PI*2;
 function weekEnd(now=new Date()){
  const shifted=new Date(now.getTime()-22*3600000);
  const daysFromMon=(shifted.getUTCDay()+6)%7;
  return new Date(Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),
   shifted.getUTCDate()-daysFromMon+7,22));
 }
 function countdown(){
  const end=weeklyStatus?.ends_at?new Date(weeklyStatus.ends_at):weekEnd();
  const ms=Math.max(0,end.getTime()-Date.now());
  const days=Math.floor(ms/86400000),hours=Math.floor(ms/3600000)%24,
   minutes=Math.floor(ms/60000)%60,seconds=Math.floor(ms/1000)%60;
  countdownEl.textContent=(days?days+'d ':'')+
   String(hours).padStart(2,'0')+':'+String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0');
 }
 function themeDark(){return document.documentElement.dataset.theme==='dark'}
 function formatLabel(part){
  if(part.type==='num')return fmt(Number(part.base||0)*multiplier);
  return {duck:'DUCK',double:'×2',upgrade:'UP!',spins:'+2'}[part.type]||'?';
 }
 function draw(){
  const w=canvas.width,h=canvas.height,r=276,cx=w/2,cy=h/2;
  ctx.clearRect(0,0,w,h);
  ctx.save();ctx.translate(cx,cy);
  ctx.shadowColor=themeDark()?'#aa9fe344':'#b1a1dd55';
  ctx.shadowBlur=15;ctx.shadowOffsetY=6;
  ctx.beginPath();ctx.arc(0,0,r+8,0,TAU);
  ctx.fillStyle=themeDark()?'#d9d2e9':'#ffffff';ctx.fill();
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  const step=TAU/segments.length;
  for(let i=0;i<segments.length;i++){
   const a=-Math.PI/2-step/2+rotation+i*step;
   ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,a,a+step);
   ctx.closePath();ctx.fillStyle=colors[i%colors.length];ctx.fill();
   ctx.strokeStyle='#ffffffcf';ctx.lineWidth=1.6;ctx.stroke();
   const label=formatLabel(segments[i]);
   const angle=a+step/2;
   const dist=r*.77,x=Math.cos(angle)*dist,y=Math.sin(angle)*dist;
   ctx.save();ctx.translate(x,y);ctx.rotate(angle+Math.PI/2);
   const arcWidth=step*dist;
   const large=segments.length<27?19:segments.length<42?14:10;
   ctx.font='900 '+large+'px system-ui,sans-serif';
   ctx.fillStyle='#27313a';ctx.textAlign='center';ctx.textBaseline='middle';
   // Canvas maxWidth keeps very large upgraded values within narrow slices.
   ctx.fillText(label,0,0,Math.max(7,Math.min(95,arcWidth*.78)));
   ctx.restore();
  }
  ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.lineWidth=5;
  ctx.strokeStyle='#373445';ctx.stroke();
  ctx.beginPath();ctx.arc(0,0,75,0,TAU);ctx.fillStyle=themeDark()?'#e9e5f4':'#ffffff';ctx.fill();
  ctx.lineWidth=4;ctx.strokeStyle='#373445';ctx.stroke();
  ctx.fillStyle='#6d58a4';ctx.font='1000 61px system-ui,sans-serif';
  ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText('7',0,-7);
  ctx.fillStyle='#687383';ctx.font='900 12px system-ui,sans-serif';
  ctx.fillText('LUCKY',0,36);
  ctx.restore();
 }
 function paintState(data){
  if(!data||typeof data!=='object')return;
  serverState=data;
  if(Array.isArray(data.segments)&&data.segments.length>0)segments=data.segments;
  multiplier=Math.max(1,Number(data.multiplier)||1);
  scoreEl.textContent=fmt(data.score);
  remainingEl.textContent=fmt(data.remaining_spins);
  takenEl.textContent=fmt(data.spin_count);
  if(Number(data.spin_count)===0)rotation=0;
  draw();
 }
 const rpc=async(name,args)=>{
  const {data,error}=await criloDB.rpc(name,args);
  if(error)throw error;
  return data;
 };
 function stateText(message){statusText.textContent=message}
 function updateControls(){
  const signed=!!window.Crilo?.user;
  const finished=Boolean(weeklyStatus?.finished);
  const started=Boolean(weeklyStatus?.started)&&!!session;
  signIn.hidden=signed;
  startBtn.hidden=!signed||finished||started;
  spinBtn.hidden=!signed||finished||!started;
  spinBtn.disabled=busy||animating||Number(serverState?.remaining_spins||0)<=0;
  dailyLink.hidden=!signed||started||finished||!!weeklyStatus?.can_start;
  startBtn.disabled=busy||!weeklyStatus?.can_start;
  startBtn.textContent=busy?'PLEASE WAIT…':'START YOUR WEEKLY';
  if(!started&&!finished){
   remainingEl.textContent='7';takenEl.textContent='0';scoreEl.textContent='0';
  }
  finish.hidden=!finished;
 }
 async function loadState(){
  if(!session)return;
  const state=await rpc('crilo_weekly_state',{p_session:session});
  paintState(state);
  return state;
 }
 async function loadLeaders(){
  try{
   const data=await rpc('crilo_weekly_leaders',{p_limit:50});
   leaderList.replaceChildren();
   if(!Array.isArray(data)||!data.length){
    const empty=document.createElement('li');empty.className='weekly-empty';
    empty.textContent='No completed weekly rounds yet. Be the first!';
    leaderList.append(empty);return;
   }
   for(let i=0;i<data.length;i++){
    const item=data[i],li=document.createElement('li');
    const place=document.createElement('span');place.className='weekly-rank';
    place.textContent=String(i+1)+'.';
    const player=document.createElement('span');player.className='weekly-leader-player';
    const name=document.createElement('a');
    name.textContent=String(item.username||'Crilo player');
    name.href='profile.html?id='+encodeURIComponent(String(item.user_id||''));
    if(/^#[0-9A-Fa-f]{6}$/.test(item.name_color||''))name.style.color=item.name_color;
    const meta=document.createElement('small');
    meta.textContent=fmt(item.spins)+' spins · '+fmt(item.ducks)+' ducks';
    player.append(name,meta);
    const points=document.createElement('strong');points.className='weekly-leader-score';
    points.textContent=fmt(item.score);
    li.append(place,player,points);leaderList.append(li);
   }
  }catch(e){
   console.warn('Weekly leaderboard:',e);
   leaderList.replaceChildren();
   const empty=document.createElement('li');empty.className='weekly-empty';
   empty.textContent='Weekly leaderboard temporarily unavailable.';
   leaderList.append(empty);
  }
 }
 async function refresh(){
  const ticket=++revision;
  const player=window.Crilo?.user||null;
  if(!player){
   currentAccount=null;session=null;serverState=null;weeklyStatus=null;
   segments=initial.concat(initial);rotation=0;multiplier=1;draw();
   ribbonEl.textContent='—';
   stateText('Sign in and finish your Official Daily to unlock Lucky Seven.');
   updateControls();return;
  }
  if(currentAccount!==player.id){
   currentAccount=player.id;session=null;serverState=null;segments=initial.concat(initial);rotation=0;multiplier=1;draw();
  }
  try{
   const info=await rpc('crilo_weekly_status');
   if(ticket!==revision||window.Crilo?.user?.id!==player.id)return;
   weeklyStatus=info;
   const previousSession=session;
   session=info.session_id||null;
   ribbonEl.textContent=fmt(info.ribbons);
   weekLabel.textContent=info.week_period?'Week of '+String(info.week_period):'This week';
   if(session&&!info.finished){
    if(info.save_pending){
     try{await rpc('crilo_weekly_save',{p_session:session})}catch(e){console.warn('Weekly recovery:',e)}
     if(ticket!==revision)return;
     const updated=await rpc('crilo_weekly_status');
     if(ticket!==revision)return;
     weeklyStatus=updated;
     ribbonEl.textContent=fmt(updated.ribbons);
    }
    await loadState();
    if(ticket!==revision)return;
   }else if(info.finished){
    if(session&&!serverState)await loadState();
    if(ticket!==revision)return;
    scoreEl.textContent=fmt(weeklyStatus.score);
    remainingEl.textContent='0';
    takenEl.textContent=fmt(weeklyStatus.spins);
   }
   if(session!==previousSession&&session&&serverState?.spin_count>0)rotation=0;
   draw();
   if(weeklyStatus.finished){
    stateText('Your weekly ribbon is saved. See you at the next Monday reset!');
   }else if(session){
    stateText('Your seven-spin weekly wheel is ready. Extra spins and refunds still count!');
   }else if(weeklyStatus.can_start){
    stateText('Your Official Daily is complete. Lucky Seven is unlocked!');
   }else{
    stateText('Complete today’s Official Daily to unlock one Lucky Seven round this week.');
   }
   updateControls();
  }catch(e){
   if(ticket!==revision)return;
   console.warn('Weekly status:',e);stateText('Could not load your weekly game: '+String(e.message||'Please refresh.'));
   startBtn.disabled=true;spinBtn.disabled=true;
  }
 }
 async function start(){
  if(busy||animating||!window.Crilo?.user||!weeklyStatus?.can_start)return;
  busy=true;updateControls();stateText('Preparing your seven-spin wheel…');
  try{
   const id=await rpc('crilo_weekly_begin_session');
   session=id;
   const state=await loadState();
   weeklyStatus={...weeklyStatus,started:true,session_id:id};
   stateText(state?.finished?'Restoring your weekly results…':'Lucky Seven is ready. Good luck!');
   updateControls();
   if(state?.finished)await complete();
  }catch(e){stateText('Could not start: '+String(e.message||e))}
  finally{busy=false;updateControls()}
 }
 function labelOutcome(outcome){
  switch(outcome?.type){
   case 'num':return '+'+fmt(outcome.points)+' points';
   case 'double':return '×2! Your score doubled and the spin was refunded.';
   case 'duck':return 'DUCK! That spin was refunded.';
   case 'upgrade':return 'UPGRADE! Number values tripled and your spin was refunded.';
   case 'spins':return '+2 Spins! Keep going.';
   default:return 'Spin recorded.';
  }
 }
 async function animateLanding(index,n){
  if(!Number.isInteger(index)||index<0||index>=n)return;
  const step=TAU/n,desired=(-index*step);
  const forward=((desired-rotation)%TAU+TAU)%TAU;
  const from=rotation,to=rotation+TAU*5+forward;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const duration=reduced?100:2300;
  animating=true;
  await new Promise(resolve=>{
   const startTime=performance.now();
   function frame(now){
    const t=Math.min(1,(now-startTime)/duration);
    const ease=1-Math.pow(1-t,4);
    rotation=from+(to-from)*ease;draw();
    if(t<1)requestAnimationFrame(frame);else resolve();
   }
   requestAnimationFrame(frame);
  });
  animating=false;
  rotation=((rotation%TAU)+TAU)%TAU;
  draw();
 }
 async function complete(){
  if(!session)return;
  try{
   await rpc('crilo_weekly_save',{p_session:session});
   const info=await rpc('crilo_weekly_status');
   weeklyStatus=info;ribbonEl.textContent=fmt(info.ribbons);
   stateText('Weekly complete! Your score is on this week’s leaderboard, and your Lucky Seven ribbon is saved.');
   await loadLeaders();
  }catch(e){stateText('Your spins are saved. Could not finalize the weekly ribbon: '+String(e.message||e)+'. Refresh to retry.')}
  finally{updateControls()}
 }
 async function spin(){
  if(busy||animating||!session||!serverState||Number(serverState.remaining_spins)<=0)return;
  busy=true;updateControls();stateText('Finding your next landing…');
  const oldLength=segments.length;
  try{
   const answer=await rpc('crilo_weekly_spin',{p_session:session});
   const index=Number(answer.outcome_index);
   await animateLanding(index,oldLength);
   const state=await loadState();
   stateText(labelOutcome(answer.outcome)+' '+fmt(state.remaining_spins)+' spins remaining.');
   if(answer.finished||state.finished)await complete();
  }catch(e){
   console.warn('Weekly wheel:',e);
   try{await loadState()}catch{}
   stateText('Spin status needs refreshing: '+String(e.message||e)+'. This button will not automatically reroll.');
  }finally{busy=false;updateControls()}
 }
 startBtn.addEventListener('click',start);
 spinBtn.addEventListener('click',spin);
 signIn.addEventListener('click',()=>{
  window.dispatchEvent(new CustomEvent('crilo-signin-request'));
 });
 window.addEventListener('crilo-auth-ready',refresh);
 const themeObserver=typeof MutationObserver!=='undefined'?
  new MutationObserver(()=>draw()):null;
 themeObserver?.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 window.addEventListener('focus',()=>{
  if(window.Crilo?.authResolved&&!busy&&!animating)void refresh();
  void loadLeaders();
 });
 window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()});
 setInterval(()=>{
  countdown();
  if(weeklyStatus?.ends_at&&new Date(weeklyStatus.ends_at).getTime()<=Date.now()){
   if(!busy&&!animating)void refresh();
  }
 },1000);
 draw();countdown();void loadLeaders();
 updateControls();
 if(window.Crilo?.authResolved)void refresh();
})();
