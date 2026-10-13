/* Crilo's hidden Green Needle. The server chooses every one of 1,000 slices;
   browser animation never controls odds, attempts, or rewards. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const entry=$('secretWheelEntry'),dialog=$('secretWheelDialog'),canvas=$('secretWheelCanvas');
 if(!entry||!dialog||!canvas)return;
 const wheel=$('secretWheelDisc'),stage=$('secretWheelStage'),status=$('secretWheelResult');
 const remaining=$('secretWheelRemaining'),single=$('secretWheelSpin'),
       fast=$('secretWheelFast'),reward=$('secretWheelAward');
 let state={signed_in:false,spins_used:0,spins_left:1000,won:false,equipped:false};
 let spinning=false,rotation=0,openFocus=null,requestToken=0;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
 function paint(){
  const c=canvas.getContext('2d');if(!c)return;
  const size=320,r=150,step=Math.PI*2/1000;
  c.clearRect(0,0,size,size);c.save();c.translate(160,160);
  // Pastel concentric field. A thousand delicate engraved ticks: one green WIN.
  const fills=['#f6f0e5','#e9f4ef','#e9eef7','#f7eaf1','#f4f1e4'];
  for(let i=0;i<40;i++){
   const a=-Math.PI/2+i*Math.PI/20;
   c.beginPath();c.moveTo(0,0);c.arc(0,0,r,a,a+Math.PI/20+.001);c.closePath();
   c.fillStyle=fills[i%fills.length];c.fill();
  }
  c.beginPath();c.arc(0,0,148,0,Math.PI*2);c.strokeStyle='#99b8a9';c.lineWidth=4;c.stroke();
  c.beginPath();c.arc(0,0,114,0,Math.PI*2);c.strokeStyle='#d4ded9';c.lineWidth=1;c.stroke();
  for(let i=0;i<1000;i++){
   const a=-Math.PI/2+i*step;
   const long=i%10===0;
   c.beginPath();
   c.moveTo(Math.cos(a)*(long?131:140),Math.sin(a)*(long?131:140));
   c.lineTo(Math.cos(a)*146,Math.sin(a)*146);
   c.strokeStyle=long?'rgba(89,111,108,.34)':'rgba(89,111,108,.13)';
   c.lineWidth=long?.9:.45;c.stroke();
  }
  const win=-Math.PI/2;
  c.beginPath();c.moveTo(0,0);
  c.arc(0,0,r,win-step/2,win+step/2);c.closePath();
  c.fillStyle='#29ae63';c.fill();
  // Bold outer notch keeps the legitimately tiny 1/1000 win slice visible.
  c.beginPath();c.arc(0,0,150,win-step/2,win+step/2);
  c.strokeStyle='#218d54';c.lineWidth=9;c.stroke();
  c.beginPath();c.arc(0,0,150,0,Math.PI*2);c.strokeStyle='#93b7a4';c.lineWidth=1.5;c.stroke();
  c.restore();
 }
 function render(){
  const left=Math.max(0,Math.min(1000,Number(state.spins_left)||0));
  remaining.textContent=left.toLocaleString();
  const locked=!state.signed_in||state.won||left===0||spinning;
  single.disabled=locked;fast.disabled=locked;
  fast.textContent=left>0&&left<10?'QUICK ×'+left:'QUICK ×10';
  reward.hidden=!state.won;
  if(state.won){
   status.textContent='The needle landed on green. Your rewards are saved!';
  }else if(!state.signed_in){
   status.textContent='Sign in to save attempts and claim your prize.';
  }else if(left===0){
   status.textContent='All 1,000 attempts used. The green slice escaped this time.';
  }else if(!spinning&&!status.dataset.custom){
   status.textContent='One green slice. One thousand places to land.';
  }
  $('secretWheelSignIn').hidden=state.signed_in;
 }
 async function refresh(){
  if(!window.Crilo?.user){
   state={signed_in:false,spins_used:0,spins_left:1000,won:false,equipped:false};
   status.dataset.custom='';render();return;
  }
  const token=++requestToken;
  const {data,error}=await criloDB.rpc('crilo_secret_wheel_status');
  if(token!==requestToken)return;
  if(error){status.dataset.custom='1';status.textContent='Could not load attempts. Try opening the wheel again.';single.disabled=true;fast.disabled=true;return}
  if(data){state=data;status.dataset.custom='';render()}
 }
 function rotate(slot){
  const segment=(Number(slot)||0)%1000;
  const target=((360-segment*360/1000)%360+360)%360;
  const current=((rotation%360)+360)%360;
  rotation+=360*(reduced?0:4)+(target-current+360)%360;
  wheel.style.transform='rotate('+rotation+'deg)';
 }
 async function spin(count){
  if(spinning||!state.signed_in||state.won||state.spins_left<1)return;
  spinning=true;status.dataset.custom='1';status.textContent=count===1?'Listening for a little click…':'Finding ten places to land…';
  stage.classList.add('is-spinning');render();
  try{
   const {data,error}=await criloDB.rpc('crilo_secret_wheel_spin',{p_count:Math.min(count,state.spins_left)});
   if(error)throw error;
   if(!data||typeof data.spins_left!=='number')throw new Error('No spin result returned.');
   if(data.spins_taken>0 && data.last_slot!=null){
    rotate(data.last_slot);
    if(!reduced)await new Promise(resolve=>setTimeout(resolve,880));
   }
   state={...state,...data};
   if(data.new_win){
    status.textContent='WIN! The green slice was waiting for you.';
   }else if(data.spins_taken>0){
    status.textContent=data.spins_taken+' '+(data.spins_taken===1?'spin':'spins')+' down. '+state.spins_left+' left.';
   }else{
    status.textContent=state.won?'You already won!':'No spins left.';
   }
  }catch(error){
   status.textContent='Spin was not confirmed: '+(error?.message||'Try again.');
   await refresh();
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
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
 dialog.addEventListener('close',()=>openFocus?.focus?.({preventScroll:true}));
 single.addEventListener('click',()=>spin(1));
 fast.addEventListener('click',()=>spin(10));
 $('secretWheelSignIn').addEventListener('click',()=>{
  dialog.close();
  const auth=$('authModal');
  if(auth){auth.classList.remove('hidden');auth.querySelector('#emailInput')?.focus();}
  else $('accountBtn')?.click();
 });
 window.addEventListener('crilo-auth-ready',()=>{requestToken++;if(dialog.open)refresh()});
 paint();render();
})();
