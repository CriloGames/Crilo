/* Crilo's secret box is a completely self-contained silly toy.
   Never read/write accounts, Daily state, scores, badge awards or storage. */
(()=>{
 'use strict';
 const box=document.getElementById('criloHiddenBox');
 const panel=document.getElementById('criloHiddenBoxNote');
 const stage=document.getElementById('criloChaosStage');
 const cube=document.getElementById('criloChaosCube');
 const poke=document.getElementById('criloChaosPoke');
 const close=document.getElementById('criloChaosClose');
 const live=document.getElementById('criloChaosAccessible');
 if(!box||!panel||!stage||!cube||!poke||!close||!live)return;

 const effects=[
  ['squish','The little box was squished and bounced back.'],
  ['spin','The little box did a ridiculous spin.'],
  ['clone','It made another, smaller box.'],
  ['hat','It put on a tiny party hat.'],
  ['dash','The little box zoomed all over the place.'],
  ['duck','A tiny duck ran through the box.'],
  ['confetti','A surprise burst of confetti!'],
  ['panic','The little box panicked.'],
  ['noodle','A mysterious noodle went past.'],
  ['bonk','Another little box bonked into it.'],
  ['circle','The square tried being round for a change.'],
  ['trip','The little box fell over dramatically.'],
  ['hide','The little box hid in the floor.']
 ];
 let bag=[],lastEffect='',resetTimer=null;

 // A shuffled deck ensures players eventually see every surprise without
 // repeatedly getting the same one. It never persists to the account.
 function pick(){
  if(bag.length===0){
   bag=effects.map(([name])=>name);
   for(let i=bag.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [bag[i],bag[j]]=[bag[j],bag[i]];
   }
   if(bag[bag.length-1]===lastEffect&&bag.length>1){
    [bag[bag.length-1],bag[0]]=[bag[0],bag[bag.length-1]];
   }
  }
  lastEffect=bag.pop();
  return lastEffect;
 }

 function resetStage(){
  if(resetTimer!==null){window.clearTimeout(resetTimer);resetTimer=null;}
  stage.className='crilo-chaos-stage';
  stage.dataset.effect='idle';
  stage.querySelectorAll('.crilo-chaos-extra').forEach(node=>node.remove());
 }

 function setOpen(open){
  panel.hidden=!open;
  box.setAttribute('aria-expanded',String(open));
  if(!open)resetStage();
 }

 function extra(className){
  const element=document.createElement('span');
  element.className='crilo-chaos-extra '+className;
  stage.appendChild(element);
  return element;
 }
 function secondBox(className){
  const element=cube.cloneNode(true);
  element.removeAttribute('id');
  element.className='crilo-chaos-extra crilo-chaos-cube '+className;
  stage.appendChild(element);
 }
 function confetti(){
  const colors=['#f0abc4','#a6c4ef','#b7dbc0','#f4d18f','#d1b8f2'];
  for(let i=0;i<15;i++){
   const piece=extra('crilo-chaos-confetti');
   const angle=(i/15)*Math.PI*2;
   const distance=42+(i%4)*12;
   piece.style.setProperty('--dx',Math.round(Math.cos(angle)*distance)+'px');
   piece.style.setProperty('--dy',Math.round(Math.sin(angle)*distance-22)+'px');
   piece.style.setProperty('--turn',(i*73)+'deg');
   piece.style.setProperty('--piece-color',colors[i%colors.length]);
  }
 }

 function doPoke(){
  resetStage();
  const name=pick();
  stage.dataset.effect=name;
  stage.classList.add('is-'+name);
  // Reaching the action always changes only DOM nodes within this secret.
  if(name==='clone')secondBox('crilo-chaos-clone');
  if(name==='bonk')secondBox('crilo-chaos-bonker');
  if(name==='duck')extra('crilo-chaos-duck').textContent='🦆';
  if(name==='confetti')confetti();
  live.textContent=effects.find(effect=>effect[0]===name)[1];
  resetTimer=window.setTimeout(resetStage,1300);
 }

 box.addEventListener('click',()=>setOpen(panel.hidden));
 poke.addEventListener('click',doPoke);
 close.addEventListener('click',()=>{setOpen(false);box.focus();});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!panel.hidden){
   setOpen(false);
   box.focus();
  }
 });
 document.addEventListener('pointerdown',event=>{
  if(!panel.hidden&&!box.contains(event.target)&&!panel.contains(event.target)){
   setOpen(false);
  }
 });
})();
