/* Green Needle is a genuinely unlimited, one-spin-at-a-time, server-owned game.
 * Never use client randomness to choose a prize. Only the RPC result can award one. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const entry=$('secretWheelEntry'),dialog=$('secretWheelDialog'),canvas=$('secretWheelCanvas');
 if(!entry||!dialog||!canvas)return;
 const wheel=$('secretWheelDisc'),stage=$('secretWheelStage'),status=$('secretWheelResult');
 const used=$('secretWheelSpinCount'),spinBtn=$('secretWheelSpin'),
       reward=$('secretWheelAward'),toast=$('secretWheelWinToast');
 let state={signed_in:false,spins_used:0,won:false},spinning=false,rotation=27,requestToken=0,openFocus=null;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
 const ranks=$('secretWheelRankings'),ranksList=$('secretWheelRankList');
 const ranksStatus=$('secretWheelRankStatus'),tabs=[...dialog.querySelectorAll('[data-needle-order]')];
 let rankOrder='least',rankRequest=0,rankCache=new Map(),audioCtx=null;
 const soundEnabled=()=>localStorage.getItem('crilo_sound')!=='off' &&
  window.Crilo?.profile?.sound_enabled!==false;
 function getAudio(){
  if(!soundEnabled())return null;
  try{
   const AC=window.AudioContext||window.webkitAudioContext;
   if(!AC)return null;
   if(!audioCtx)audioCtx=new AC();
   if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
   return audioCtx;
  }catch{return null}
 }
 // Two restrained notes, not continuous wheel ticking.
 function tone(frequency,volume,length,delay=0){
  const ctx=getAudio();if(!ctx)return;
  try{
   const time=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type='sine';osc.frequency.setValueAtTime(frequency,time);
   gain.gain.setValueAtTime(.0001,time);
   gain.gain.exponentialRampToValueAtTime(volume,time+.012);
   gain.gain.exponentialRampToValueAtTime(.0001,time+length);
   osc.connect(gain);gain.connect(ctx.destination);
   osc.start(time);osc.stop(time+length+.015);
  }catch{}
 }
 function playSound(type){
  if(type==='start')tone(370,.016,.09);
  else if(type==='miss')tone(295,.021,.13);
  else if(type==='win'){tone(523,.048,.20);tone(659,.042,.26,.12)}
 }
 const esc=s=>window.Crilo?.esc?window.Crilo.esc(String(s??'')):
  String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;')
   .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
 function rankMarkup(p){
  const profile={username:p.username||'Crilo player',name_color:p.name_color,
   name_letter_colors:p.name_letter_colors};
  if(window.CriloNameColors?.markup)return window.CriloNameColors.markup(profile);
  return esc(profile.username);
 }
 async function loadRankings(order=rankOrder){
  if(!state.won||!dialog.open||!ranks.open)return;
  const token=++rankRequest;rankOrder=order;
  tabs.forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.needleOrder===order)));
  const cached=rankCache.get(order);
  if(cached){drawRanks(cached);return}
  ranksStatus.textContent='Loading winners…';
  ranksList.replaceChildren();
  const {data,error}=await criloDB.rpc('crilo_secret_wheel_leaderboard',{p_order:order});
  if(token!==rankRequest||!dialog.open||!state.won||!ranks.open)return;
  if(error){ranksStatus.textContent='Could not load winners. Reopen to try again.';return}
  const entries=Array.isArray(data?.players)?data.players.slice(0,250):[];
  rankCache.set(order,entries);drawRanks(entries);
 }
 function drawRanks(entries){
  ranksStatus.textContent=entries.length?
   'Showing '+entries.length+' winner'+(entries.length===1?'':'s')+
   ' · Spins taken to reach the first green slice.':
   'No winners yet.';
  ranksList.innerHTML=entries.map(item=>{
   const number=Math.max(1,Math.floor(Number(item.rank)||1));
   const count=Math.max(1,Number(item.spins)||1).toLocaleString('en-US');
   const base=/^#[0-9a-fA-F]{6}$/.test(item.name_color||'')?item.name_color:'inherit';
   const name=rankMarkup(item);
   return '<li class="secret-wheel-rank-row'+(item.is_you?' is-you':'')+'">'+
    '<span class="secret-wheel-rank-number">#'+number+'</span>'+
    '<span class="secret-wheel-rank-name" style="color:'+base+'">'+name+'</span>'+
    '<strong>'+count+' <small>spins</small></strong></li>';
  }).join('');
 }
 ranks.addEventListener('toggle',()=>{if(ranks.open)loadRankings()});
 tabs.forEach(tab=>tab.addEventListener('click',()=>{
  const choice=tab.dataset.needleOrder;
  if(choice!=='least'&&choice!=='most')return;
  loadRankings(choice);
 }));
 function paint(){
  const c=canvas.getContext('2d');if(!c)return;
  c.clearRect(0,0,320,320);c.save();c.translate(160,160);
  const r=150,step=Math.PI*2/1000;
  const fills=['#f6f0e5','#e9f4ef','#e9eef7','#f7eaf1','#f4f1e4'];
  for(let i=0;i<40;i++){
   const a=-Math.PI/2+i*Math.PI/20;c.beginPath();c.moveTo(0,0);c.arc(0,0,r,a,a+Math.PI/20+.001);
   c.closePath();c.fillStyle=fills[i%fills.length];c.fill();
  }
  c.beginPath();c.arc(0,0,148,0,Math.PI*2);c.strokeStyle='#99b8a9';c.lineWidth=4;c.stroke();
  c.beginPath();c.arc(0,0,114,0,Math.PI*2);c.strokeStyle='#d4ded9';c.lineWidth=1;c.stroke();
  for(let i=0;i<1000;i++){
   const a=-Math.PI/2+i*step;const long=i%10===0;c.beginPath();
   c.moveTo(Math.cos(a)*(long?131:140),Math.sin(a)*(long?131:140));
   c.lineTo(Math.cos(a)*146,Math.sin(a)*146);
   c.strokeStyle=long?'rgba(89,111,108,.34)':'rgba(89,111,108,.13)';
   c.lineWidth=long?.9:.45;c.stroke();
  }
  c.beginPath();c.moveTo(0,0);c.arc(0,0,r,-Math.PI/2-step/2,-Math.PI/2+step/2);
  c.closePath();c.fillStyle='#29ae63';c.fill();
  c.beginPath();c.arc(0,0,150,-Math.PI/2-step/2,-Math.PI/2+step/2);
  c.strokeStyle='#218d54';c.lineWidth=9;c.stroke();
  c.beginPath();c.arc(0,0,150,0,Math.PI*2);c.strokeStyle='#93b7a4';c.lineWidth=1.5;c.stroke();
  c.restore();
 }
 function render(){
  used.textContent=Math.max(0,Number(state.spins_used)||0).toLocaleString();
  spinBtn.disabled=!state.signed_in||spinning||state.won;
  spinBtn.textContent=state.won?'✓ YOU WON':'SPIN';
  ranks.hidden=!state.won;
  if(!state.won&&ranks.open)ranks.open=false;
  if(state.won)ranks.querySelector('summary').textContent=
   '✦ WINNER LEADERBOARD · TOP 250';
  $('secretWheelSignIn').hidden=state.signed_in;
  reward.hidden=!state.won;
  if(state.won)$('secretWheelAwardText').textContent=
   'Unlocked: The Green Needle secret badge and individual display-name letter colors. Customize each letter in Settings.';
  if(!spinning&&!status.dataset.custom){
   status.textContent=!state.signed_in?'Sign in to save every spin and claim a prize.':
    state.won?'You won in '+Number(state.winning_spin_count||state.spins_used).toLocaleString()+
     ' spins! Your badge and letter colors are unlocked.':
    'Unlimited tries. Exactly one green slice in every thousand.';
  }
 }
 async function refresh(){
  const token=++requestToken;
  if(!window.Crilo?.user){state={signed_in:false,spins_used:0,won:false};status.dataset.custom='';render();return}
  const {data,error}=await criloDB.rpc('crilo_secret_wheel_status');
  if(token!==requestToken)return;
  if(error){status.dataset.custom='1';status.textContent='Could not load spins. Try again.';spinBtn.disabled=true;return}
  if(data){
    const unlockedBefore=state.won;
    state=data;status.dataset.custom='';render();
    if(data.won&&!unlockedBefore)rankCache.clear();
    if(data.won&&ranks.open)loadRankings();
   }
 }
 function rotate(slot){
  const target=((360-((Number(slot)||0)%1000)*.36)%360+360)%360;
  const current=((rotation%360)+360)%360;
  rotation+=360*(reduced?0:5)+(target-current+360)%360;
  wheel.style.transform='rotate('+rotation+'deg)';
 }
 function celebrate(){
  const host=$('secretWheelConfetti');host.replaceChildren();
  if(!reduced){
   const palette=['#57cc86','#f4d684','#bca4eb','#94c7eb','#ffb4bf'];
   for(let i=0;i<58;i++){
    const bit=document.createElement('span');
    bit.className='secret-wheel-confetti-bit';
    bit.style.setProperty('--x',((i*137.5)%345-170).toFixed(0)+'px');
    bit.style.setProperty('--delay',(i%8)*31+'ms');
    bit.style.backgroundColor=palette[i%palette.length];
    bit.style.rotate=(i*47%180)+'deg';host.append(bit);
   }
   window.setTimeout(()=>host.replaceChildren(),3000);
  }
  toast.hidden=false;
  toast.setAttribute('role','alert');
  const close=$('secretWheelToastClose');close.focus({preventScroll:true});
  window.dispatchEvent(new CustomEvent('crilo-secret-wheel-win',{detail:{reward:'letter-colors'}}));
 }
 async function spin(){
  if(spinning||!state.signed_in||state.won)return;
  getAudio();playSound('start');
  spinning=true;status.dataset.custom='1';
  status.textContent='Where will the needle land?';
  stage.classList.add('is-spinning');render();
  try{
   const {data,error}=await criloDB.rpc('crilo_secret_wheel_spin',{p_count:1});
   if(error)throw error;
   if(data?.already_won||data?.won&&data.spins_taken===0){
    state={...state,...data};status.dataset.custom='';
    render();if(ranks.open)loadRankings();return;
   }
   if(!data||data.spins_taken!==1||typeof data.last_slot!=='number')
    throw new Error('Server did not confirm the result.');
   rotate(data.last_slot);
   if(!reduced)await new Promise(resolve=>window.setTimeout(resolve,900));
   state={...state,...data};
   playSound(data.new_win?'win':'miss');
   if(data.new_win){rankCache.clear();ranks.open=true;loadRankings();}
   status.textContent=data.new_win?'WIN! You found the one green slice!':
    'Not green this time. Try again whenever you like.';
   if(data.new_win)celebrate();
  }catch(error){
   status.textContent='Spin not confirmed: '+(error?.message||'Try again.');
   const token=++requestToken;
   const {data}=await criloDB.rpc('crilo_secret_wheel_status');
   if(token===requestToken&&data){
    state=data;
    if(data.won&&ranks.open)loadRankings();
   }
  }finally{
   spinning=false;stage.classList.remove('is-spinning');render();
  }
 }
 function open(){
  openFocus=document.activeElement;
  if(!dialog.open)dialog.showModal();
  status.dataset.custom='';render();refresh();
  $('secretWheelClose').focus({preventScroll:true});
 }
 entry.addEventListener('click',open);
 $('secretWheelClose').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
 dialog.addEventListener('close',()=>openFocus?.focus?.({preventScroll:true}));
 spinBtn.addEventListener('click',spin);
 $('secretWheelToastClose').addEventListener('click',()=>{toast.hidden=true;
  (state.won?ranks.querySelector('summary'):spinBtn).focus({preventScroll:true})});
 $('secretWheelSignIn').addEventListener('click',()=>{
  dialog.close();
  const auth=$('authModal');
  if(auth){auth.classList.remove('hidden');auth.querySelector('#emailInput')?.focus();}
  else $('accountBtn')?.click();
 });
 window.addEventListener('crilo-auth-ready',()=>{requestToken++;if(dialog.open)refresh()});
 paint();render();
})();