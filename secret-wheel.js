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
  spinBtn.disabled=!state.signed_in||spinning;
  $('secretWheelSignIn').hidden=state.signed_in;
  reward.hidden=!state.won;
  if(state.won)$('secretWheelAwardText').textContent=
   'Unlocked: The Green Needle secret badge and individual display-name letter colors. Customize each letter in Settings.';
  if(!spinning&&!status.dataset.custom){
   status.textContent=!state.signed_in?'Sign in to save every spin and claim a prize.':
    state.won?'Your reward is yours forever. You can still spin just for fun.':
    'Unlimited tries. Exactly one green slice in every thousand.';
  }
 }
 async function refresh(){
  const token=++requestToken;
  if(!window.Crilo?.user){state={signed_in:false,spins_used:0,won:false};status.dataset.custom='';render();return}
  const {data,error}=await criloDB.rpc('crilo_secret_wheel_status');
  if(token!==requestToken)return;
  if(error){status.dataset.custom='1';status.textContent='Could not load spins. Try again.';spinBtn.disabled=true;return}
  if(data){state=data;status.dataset.custom='';render()}
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
  if(spinning||!state.signed_in)return;
  spinning=true;status.dataset.custom='1';
  status.textContent='Where will the needle land?';
  stage.classList.add('is-spinning');render();
  try{
   const {data,error}=await criloDB.rpc('crilo_secret_wheel_spin',{p_count:1});
   if(error)throw error;
   if(!data||data.spins_taken!==1||typeof data.last_slot!=='number')
    throw new Error('Server did not confirm the result.');
   rotate(data.last_slot);
   if(!reduced)await new Promise(resolve=>window.setTimeout(resolve,900));
   state={...state,...data};
   status.textContent=data.new_win?'WIN! You found the one green slice!':
    state.won?'Another spin, just for fun.':
    'Not green this time. Try again whenever you like.';
   if(data.new_win)celebrate();
  }catch(error){
   status.textContent='Spin not confirmed: '+(error?.message||'Try again.');
   const token=++requestToken;
   const {data}=await criloDB.rpc('crilo_secret_wheel_status');
   if(token===requestToken&&data)state=data;
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
 $('secretWheelToastClose').addEventListener('click',()=>{toast.hidden=true;spinBtn.focus({preventScroll:true})});
 $('secretWheelSignIn').addEventListener('click',()=>{
  dialog.close();
  const auth=$('authModal');
  if(auth){auth.classList.remove('hidden');auth.querySelector('#emailInput')?.focus();}
  else $('accountBtn')?.click();
 });
 window.addEventListener('crilo-auth-ready',()=>{requestToken++;if(dialog.open)refresh()});
 paint();render();
})();