/* Permanent Mystery Collection section on the player's own Statistics page.
 * Only earned curiosities reveal names; no ranked gameplay changes. */
(()=>{
 'use strict';
 const box=document.getElementById('criloCuriosities');
 if(!box)return;
 const open=document.getElementById('criloCuriositiesOpen');
 const close=document.getElementById('criloCuriositiesClose');
 const modal=document.getElementById('criloCuriositiesDialog');
 const list=document.getElementById('criloCuriositiesList');
 const count=document.getElementById('criloCuriositiesCount');
 // Existing six collectible curiosities. No rewards modify wheel gameplay.
 const prizes={
  sleepy_duck:['The Napping Duck','This duck fell asleep halfway through saying quack.'],
  cosmic_quack:['A Quack from Space','A tiny radio transmission from somewhere beyond the pond.'],
  backwards_map:['The Backwards Map','Every arrow points to where you just came from.'],
  tiny_crown:['An Absurdly Tiny Crown','It is too small for the smallest duck. Nobody knows whose it is.'],
  cloud_recipe:['Recipe for a Cloud','One pinch of fog, two drops of rain, and a very patient spoon.'],
  lost_button:['The Missing Button','Nobody remembers what this button used to do.']
 };
 let serial=0;
 const hide=()=>{box.hidden=true;if(modal.open)modal.close()};
 async function refresh(){
  const ticket=++serial,me=window.Crilo?.user?.id;
  const target=new URLSearchParams(location.search).get('id');
  if(!me||(target&&target!==me)){hide();return}
  // Show the actual Statistics tab while its saved discoveries load.
  box.hidden=false;
  count.textContent='Loading collection…';
  const {data,error}=await criloDB.rpc('crilo_mystery_gift',{p_action:'status'});
  if(ticket!==serial)return;
  if(error){console.warn('Curiosities unavailable:',error.message);count.textContent='Unavailable';return}
  const found=[...new Set(Array.isArray(data?.discovered)?data.discovered:[])]
   .filter(key=>Object.hasOwn(prizes,key));
  count.textContent=found.length+' / '+Object.keys(prizes).length+' found';
  list.replaceChildren();
  for(const [key,[name,story]] of Object.entries(prizes)){
   const won=found.includes(key);
   const item=document.createElement('li');
   item.className=won?'crilo-curiosity-found':'crilo-curiosity-locked';
   const icon=document.createElement('span');
   icon.className='crilo-curiosity-symbol';icon.setAttribute('aria-hidden','true');
   const art=won?window.CriloMysteryCuriosityIcon?.(key):'';
   if(art){icon.innerHTML=art;icon.classList.add('has-art')}
   else icon.textContent=won?'✦':'?';
   const copy=document.createElement('span');
   const title=document.createElement('strong'),description=document.createElement('small');
   title.textContent=won?name:'Undiscovered';
   description.textContent=won?story:'A little mystery waiting to be found.';
   copy.append(title,description);
   item.append(icon,copy);list.append(item);
  }
  box.hidden=false;
  open.setAttribute('aria-label','View Mystery Collection, '+found.length+' of six discovered');
 }
 open.addEventListener('click',()=>modal.showModal());
 close.addEventListener('click',()=>modal.close());
 modal.addEventListener('click',e=>{if(e.target===modal)modal.close()});
 window.addEventListener('crilo-auth-ready',refresh);
 window.addEventListener('crilo-mystery-discovered',refresh);
 if(window.Crilo?.authResolved)void refresh();
})();
