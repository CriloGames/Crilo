/* Your Curiosities shelf is concealed until the player wins a mystery.
 * It is private to the signed-in owner of the Statistics profile. */
(()=>{
 'use strict';
 const box=document.getElementById('criloCuriosities');
 if(!box)return;
 const open=document.getElementById('criloCuriositiesOpen');
 const close=document.getElementById('criloCuriositiesClose');
 const modal=document.getElementById('criloCuriositiesDialog');
 const list=document.getElementById('criloCuriositiesList');
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
  const {data,error}=await criloDB.rpc('crilo_mystery_gift',{p_action:'status'});
  if(ticket!==serial)return;
  if(error){console.warn('Curiosities unavailable:',error.message);hide();return}
  const found=[...new Set(Array.isArray(data?.discovered)?data.discovered:[])]
   .filter(key=>Object.hasOwn(prizes,key));
  if(!found.length){hide();return}
  list.replaceChildren();
  for(const key of found){
   const item=document.createElement('li'),title=document.createElement('strong');
   const description=document.createElement('small');
   title.textContent=prizes[key][0];
   description.textContent=prizes[key][1];
   item.append(title,description);
   list.append(item);
  }
  box.hidden=false;
  open.setAttribute('aria-label','View '+found.length+' discovered curiosities');
 }
 open.addEventListener('click',()=>modal.showModal());
 close.addEventListener('click',()=>modal.close());
 modal.addEventListener('click',e=>{if(e.target===modal)modal.close()});
 window.addEventListener('crilo-auth-ready',refresh);
 if(window.Crilo?.authResolved)void refresh();
})();
