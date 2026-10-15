/* Crilo Mystery Gift: server-authoritative surprise after a verified Daily.
 * Pure bonus play. Never touches Daily Wheel state, points, badges, or spins. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const panel=$('criloMysteryPanel'),launch=$('criloMysteryOpen'),
  progress=$('criloMysteryProgress'),modal=$('criloMysteryModal'),
  close=$('criloMysteryClose'),canvas=$('criloMysteryWheel'),
  spin=$('criloMysterySpin'),message=$('criloMysteryMessage'),
  shelf=$('criloMysteryShelf'),title=$('criloMysteryTitle');
 if(!panel||!launch||!progress||!modal||!canvas||!spin||!message||!shelf||!title)return;
 const ctx=canvas.getContext('2d');
 const prizes={
  sleepy_duck:['The Napping Duck','This duck fell asleep halfway through saying quack.'],
  cosmic_quack:['A Quack from Space','A tiny radio transmission from somewhere beyond the pond.'],
  backwards_map:['The Backwards Map','Every arrow points to where you just came from.'],
  tiny_crown:['An Absurdly Tiny Crown','It is too small for the smallest duck. Nobody knows whose it is.'],
  cloud_recipe:['Recipe for a Cloud','One pinch of fog, two drops of rain, and a very patient spoon.'],
  lost_button:['The Missing Button','Nobody remembers what this button used to do.']
 };
 let state=null,token=0,busy=false,animation=0,rotation=0;
 const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const won=i=>i%2===0;
 const names=Object.keys(prizes);
 function draw(){
  if(!ctx)return;
  const side=canvas.width,c=side/2,r=c-12,part=Math.PI/4;
  ctx.clearRect(0,0,side,side);
  ctx.save();ctx.translate(c,c);ctx.rotate(rotation);
  for(let i=0;i<8;i++){
   const a=-Math.PI/2+i*part,b=a+part;
   ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,a,b);ctx.closePath();
   ctx.fillStyle=won(i)?'#ffe8a8':i%4===1?'#d8e9f2':'#e8dcf4';
   ctx.fill();ctx.strokeStyle='#24262a';ctx.lineWidth=2.6;ctx.stroke();
   ctx.save();ctx.rotate(a+part/2);ctx.translate(r*.67,0);
   ctx.rotate(Math.PI/2);
   ctx.fillStyle='#28282e';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.font='bold 28px system-ui,sans-serif';ctx.fillText(won(i)?'★':'·',0,0);
   ctx.restore();
  }
  ctx.restore();
  ctx.beginPath();ctx.arc(c,c,23,0,Math.PI*2);
  ctx.fillStyle='#fffaf0';ctx.fill();ctx.strokeStyle='#24262a';ctx.lineWidth=4;ctx.stroke();
  ctx.font='bold 22px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#24262a';ctx.fillText('?',c,c);
 }
 function atSlice(i){return -(i+0.5)*Math.PI/4}
 function reveal(){
  if(!state)return;
  if(!state.available){
   title.textContent='The Mystery Shelf';
   message.textContent='No surprise gift appeared today. Come back after another Daily to discover more.';
   spin.hidden=true;
   return;
  }
  if(!state.spun){
   title.textContent='The Mystery Gift';
   message.textContent='Land on a golden star to open the gift. One chance per Daily.';
   spin.hidden=false;spin.disabled=false;
   return;
  }
  spin.hidden=true;
  if(state.prize&&prizes[state.prize]){
   title.textContent='You opened it!';
   message.textContent=prizes[state.prize][0]+' — '+prizes[state.prize][1];
  }else{
   title.textContent='Just missed!';
   message.textContent='The little gift rattles, waves goodbye, and waddles away. Better luck next time.';
  }
 }
 function renderShelf(){
  const discoveries=Array.isArray(state?.discovered)?state.discovered.filter(k=>names.includes(k)):[];
  progress.textContent=discoveries.length+' / '+names.length+' mystery discoveries';
  shelf.replaceChildren();
  for(const key of names){
   const found=discoveries.includes(key);
   const item=document.createElement('div');
   item.className='crilo-mystery-item'+(found?' found':'');
   const symbol=document.createElement('span');
   symbol.className='crilo-mystery-item-symbol';
   symbol.textContent=found?'✦':'?';
   const copy=document.createElement('span');
   const label=document.createElement('strong');
   label.textContent=found?prizes[key][0]:'Undiscovered';
   const description=document.createElement('small');
   description.textContent=found?prizes[key][1]:'Find this by opening a Mystery Gift.';
   copy.append(label,description);item.append(symbol,copy);shelf.appendChild(item);
  }
 }
 function render(){
  const eligible=!!state?.eligible;
  panel.classList.toggle('hidden',!eligible);
  if(!eligible)return;
  const available=!!state?.available;
  launch.classList.toggle('hidden',!available);
  launch.textContent=state.spun?'Review today\'s Mystery Gift':'Open today\'s Mystery Gift';
  renderShelf();
  if(!modal.classList.contains('hidden'))reveal();
 }
 async function refresh(){
  const myToken=++token;
  const active=window.Crilo?.user;
  if(!active||typeof criloDB==='undefined'){
   state=null;panel.classList.add('hidden');dismiss();return;
  }
  const {data,error}=await criloDB.rpc('crilo_mystery_gift',{p_action:'status'});
  if(myToken!==token)return;
  if(error){console.warn('Mystery Gift status:',error.message);return}
  state=data||null;render();
 }
 function show(){
  // The Mystery Shelf remains browseable even when no gift appears today.
  if(!state?.eligible||busy)return;
  modal.classList.remove('hidden');
  rotation=state.spun&&Number.isInteger(state.slice)?atSlice(state.slice):0;
  draw();reveal();
  close.focus();
 }
 function dismiss(){
  if(busy)return;
  modal.classList.add('hidden');
 }
 function animateTo(index){
  return new Promise(done=>{
   const TWO=Math.PI*2,target=atSlice(index);
   const rem=((target-rotation)%TWO+TWO)%TWO;
   const start=rotation,end=start+TWO*5+rem,duration=2900;
   if(reduced()||typeof requestAnimationFrame!=='function'){
    rotation=target;draw();done();return;
   }
   const begin=performance.now();
   function frame(now){
    const t=Math.max(0,Math.min(1,(now-begin)/duration));
    rotation=start+(end-start)*(1-Math.pow(1-t,4));draw();
    if(t<1){animation=requestAnimationFrame(frame);return}
    rotation=target;draw();animation=0;done();
   }
   animation=requestAnimationFrame(frame);
  });
 }
 async function play(){
  if(busy||!state?.available||state.spun)return;
  busy=true;spin.disabled=true;close.disabled=true;
  message.textContent='The tiny wheel is deciding…';
  try{
   const {data,error}=await criloDB.rpc('crilo_mystery_gift',{p_action:'spin'});
   if(error)throw error;
   if(!data?.spun||!Number.isInteger(data.slice)||data.slice<0||data.slice>7)
    throw new Error('The server did not save a valid mystery spin.');
   // The server chooses the slice; client animation cannot affect prizes.
   state=data;await animateTo(data.slice);render();
  }catch(error){
   message.textContent='Could not save the mystery spin. Try again; your opportunity is safe.';
   console.warn('Mystery Gift:',error);
  }finally{
   busy=false;close.disabled=false;
   if(state?.spun)spin.hidden=true;
   else spin.disabled=false;
  }
 }
 launch.addEventListener('click',show);
 $('criloMysteryShelfButton').addEventListener('click',show);
 spin.addEventListener('click',play);
 close.addEventListener('click',dismiss);
 modal.addEventListener('click',e=>{if(e.target===modal)dismiss()});
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden'))dismiss()});
 window.addEventListener('crilo-auth-ready',refresh);
 window.addEventListener('crilo-official-daily-saved',refresh);
 window.CriloMysteryGift={refresh};
 if(window.Crilo?.authResolved)refresh();
})();
