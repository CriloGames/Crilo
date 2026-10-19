/* Hidden server-verified rare Mystery Gift; no changes to ranked gameplay. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const shortcut=$('criloMysteryShortcut'),shortcutLabel=$('criloMysteryShortcutLabel'),
  shortcutBtn=$('criloMysteryShelfButton'),progress=$('criloMysteryProgress'),
  modal=$('criloMysteryModal'),close=$('criloMysteryClose'),
  collectionModal=$('criloMysteryShelfDialog'),collectionClose=$('criloMysteryShelfClose'),
  reviewButton=$('criloMysteryReviewButton'),canvas=$('criloMysteryWheel'),
  spin=$('criloMysterySpin'),message=$('criloMysteryMessage'),
  shelf=$('criloMysteryShelf'),title=$('criloMysteryTitle'),wheelWrap=$('wheelWrap');
 if(!shortcut||!shortcutBtn||!progress||!modal||!close||!collectionModal||
    !collectionClose||!reviewButton||!canvas||!spin||!message||!shelf||!title||!wheelWrap)return;
 const ctx=canvas.getContext('2d');
 const prizes={
  sleepy_duck:['The Napping Duck','This duck fell asleep halfway through saying quack.'],
  cosmic_quack:['A Quack from Space','A tiny radio transmission from somewhere beyond the pond.'],
  backwards_map:['The Backwards Map','Every arrow points to where you just came from.'],
  tiny_crown:['An Absurdly Tiny Crown','It is too small for the smallest duck. Nobody knows whose it is.'],
  cloud_recipe:['Recipe for a Cloud','One pinch of fog, two drops of rain, and a very patient spoon.'],
  lost_button:['The Missing Button','Nobody remembers what this button used to do.']
 };
 const names=Object.keys(prizes),presentedThisPage=new Set(),collectionAction=$('criloMysteryOpenCollection');
 let state=null,token=0,busy=false,animation=0,rotation=0,runMode='official',returnFocus=null,collectionFromGift=false;
 const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const won=i=>i%2===0;
 const openDialog=dialog=>{
  returnFocus=document.activeElement;
  dialog.classList.remove('hidden');
  dialog.querySelector('[role="dialog"]')?.focus();
 };
 const closeDialog=(dialog,restoreFocus=true)=>{
  dialog.classList.add('hidden');
  if(restoreFocus&&returnFocus?.isConnected&&typeof returnFocus.focus==='function'){
   returnFocus.focus({preventScroll:true});
  }
 };
 function dismiss(restoreFocus=true){
  if(busy)return;
  const hadGift=!modal.classList.contains('hidden')||collectionFromGift;
  collectionFromGift=false;
  const hadModal=hadGift||!collectionModal.classList.contains('hidden');
  closeDialog(modal,false);closeDialog(collectionModal,false);
  if(hadModal&&restoreFocus&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
  if(hadGift&&restoreFocus){
   // If a signed-in player has bonus Dailies ready, show the continuation
   // AFTER the rare surprise has been dismissed—not behind its popup.
   window.dispatchEvent(new Event('crilo-mystery-closed'));
  }
 }
 function setMode(mode){
  runMode=mode==='test'||mode==='bonus'?mode:'official';
  if(runMode!=='official'){shortcut.classList.add('hidden');dismiss(false)}
  else render();
 }
 function presentationKey(){
  const u=window.Crilo?.user?.id,p=state?.period;
  return u&&p?'crilo-mystery-auto-presented:'+u+':'+p:null;
 }
 function popIfSurprise(){
  if(runMode!=='official'||!state?.eligible||!state.available||state.spun||busy)return;
  const key=presentationKey();
  if(!key||presentedThisPage.has(key))return;
  try{if(localStorage.getItem(key)==='1')return}catch(_){}
  presentedThisPage.add(key);
  try{localStorage.setItem(key,'1')}catch(_){}
  showGift(true);
 }
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
   title.textContent='The Mystery Gift';
   message.textContent='No gift appeared today.';
   spin.hidden=true;collectionAction.hidden=true;return;
  }
  if(!state.spun){
   title.textContent='A Mystery Gift!';
   message.textContent='A golden star wins a collectible curiosity. These are just for fun: no extra points, spins, or leaderboard advantage.';
   spin.hidden=false;spin.disabled=busy;collectionAction.hidden=true;return;
  }
  spin.hidden=true;collectionAction.hidden=!state.prize;
  if(state.prize&&prizes[state.prize]){
   title.textContent='You opened it!';
   message.textContent=prizes[state.prize][0]+' — '+prizes[state.prize][1]+' Saved to your Curiosities collection. Just for fun—your score and odds stay unchanged.';
  }else{
   title.textContent='Just missed!';
   message.textContent='The gift rattles, waves goodbye, and waddles away. No collectible this time; your Daily score is unchanged.';
  }
 }
 function renderShelf(){
  const discovered=[...new Set(Array.isArray(state?.discovered)?state.discovered:[])]
   .filter(key=>names.includes(key));
  progress.textContent=discovered.length+' / '+names.length+' collected';
  shelf.replaceChildren();
  for(const key of discovered){
   const item=document.createElement('div');item.className='crilo-mystery-item found';
   const symbol=document.createElement('span');symbol.className='crilo-mystery-item-symbol';
   const art=window.CriloMysteryCuriosityIcon?.(key);
   if(art)symbol.innerHTML=art;
   else symbol.textContent='✦';
   const copy=document.createElement('span'),label=document.createElement('strong');
   label.textContent=prizes[key][0];
   const description=document.createElement('small');description.textContent=prizes[key][1];
   copy.append(label,description);item.append(symbol,copy);shelf.append(item);
  }
  if(!discovered.length){
   const empty=document.createElement('p');empty.className='crilo-mystery-empty';
   empty.textContent='No mysteries collected yet.';
   shelf.append(empty);
  }
 }
 function render(){
  const visible=runMode==='official'&&!!window.Crilo?.user;
  if(state?.collection_complete&&!state?.spun&&!busy) dismiss();
  const waiting=visible&&!!(state?.eligible&&state.available&&!state.spun);
  // Only an already-triggered unopened event has a recovery button.
  // No public hint or permanent collection progress beneath the wheel.
  shortcut.classList.toggle('hidden',!waiting);
  if(!visible){dismiss(false);return}
  shortcut.classList.toggle('gift-ready',waiting);
  shortcutLabel.textContent='Open your surprise';
  shortcutBtn.setAttribute('aria-label','Reopen your Mystery Gift');
  reviewButton.classList.toggle('hidden',!(state?.eligible&&state?.available&&state?.spun));
  renderShelf();
  if(!modal.classList.contains('hidden'))reveal();
 }
 async function refresh(options){
  const autoOpen=options?.autoOpen===true,myToken=++token;
  if(!window.Crilo?.user||typeof criloDB==='undefined'){
   state=null;shortcut.classList.add('hidden');dismiss(false);return;
  }
  let data,error;
  try{
   ({data,error}=await criloDB.rpc('crilo_mystery_gift',{p_action:'status'}));
  }catch(e){error=e}
  if(myToken!==token)return;
  if(error){console.warn('Mystery Gift status:',error.message);return}
  state=data||null;render();
  if(autoOpen)popIfSurprise();
 }
 function showGift(automatic=false){
  if(runMode!=='official'||!state?.eligible||!state?.available||busy)return;
  if(!collectionModal.classList.contains('hidden'))closeDialog(collectionModal,false);
  rotation=state.spun&&Number.isInteger(state.slice)?atSlice(state.slice):0;
  draw();reveal();openDialog(modal);
  if(automatic){
   // After the result card appears below the wheel, bring the surprise wheel
   // into view so the player genuinely notices the gift.
   wheelWrap.scrollIntoView?.({block:'center',behavior:reduced()?'auto':'smooth'});
  }
 }
 function showCollection(){
  if(runMode!=='official'||!window.Crilo?.user||busy)return;
  // Remember whether the player came from an open Gift *before* hiding it.
  // Otherwise dismiss() misses the Gift-closed signal and the Bonus Runs
  // continuation stays stranded behind the collection popup.
  collectionFromGift=!modal.classList.contains('hidden');
  if(collectionFromGift)closeDialog(modal,false);
  renderShelf();openDialog(collectionModal);
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
   if(data?.collection_complete&&!data?.spun){
    // A floating curiosity completed the six while the mini-wheel was open.
    state=data;busy=false;render();return;
   }
   if(!data?.spun||!Number.isInteger(data.slice)||data.slice<0||data.slice>7)
    throw new Error('The server did not save a valid mystery spin.');
   // The server chooses the slice; client animation cannot affect prizes.
   state=data;await animateTo(data.slice);render();
   if(data.collection_complete){
    window.CriloFloatingMystery?.complete?.();
    window.dispatchEvent(new Event('crilo-mystery-discovered'));
   }
  }catch(error){
   message.textContent='Could not save the mystery spin. Try again; your opportunity is safe.';
   console.warn('Mystery Gift:',error);
  }finally{
   busy=false;close.disabled=false;
   if(state?.spun)spin.hidden=true;
   else spin.disabled=false;
  }
 }

 shortcutBtn.addEventListener('click',()=>{
  if(state?.eligible&&state?.available&&!state.spun)showGift();
  else showCollection();
 });
 reviewButton.addEventListener('click',()=>showGift());
 collectionAction?.addEventListener('click',showCollection);
 spin.addEventListener('click',play);
 close.addEventListener('click',()=>dismiss());
 collectionClose.addEventListener('click',()=>dismiss());
 modal.addEventListener('click',e=>{if(e.target===modal)dismiss()});
 collectionModal.addEventListener('click',e=>{if(e.target===collectionModal)dismiss()});
 window.addEventListener('keydown',e=>{
  const current=!collectionModal.classList.contains('hidden')?collectionModal:
   !modal.classList.contains('hidden')?modal:null;
  if(!current)return;
  if(e.key==='Escape'){e.preventDefault();dismiss();return}
  if(e.key!=='Tab')return;
  const focusable=[...current.querySelectorAll('button:not([disabled]):not([hidden])')].filter(x=>x.getClientRects().length);
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(e.shiftKey&&(document.activeElement===first||!current.contains(document.activeElement))){
   e.preventDefault();last.focus()
  }else if(!e.shiftKey&&(document.activeElement===last||!current.contains(document.activeElement))){
   e.preventDefault();first.focus()
  }
 });
 window.addEventListener('crilo-auth-ready',refresh);
 window.addEventListener('crilo-mystery-discovered',()=>{
  // Another Mystery discovery may have completed the collection.
  if(!busy)void refresh();
 });
 window.addEventListener('crilo-official-wheel-stopped',()=>refresh({autoOpen:true}));
 window.addEventListener('crilo-official-daily-saved',()=>refresh({autoOpen:true}));
 window.CriloMysteryGift={refresh,setMode};
 if(window.Crilo?.authResolved)refresh();
})();
