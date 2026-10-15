/* Crilo's wandering Curiosities: a rare server-verified discovery when
 * entering an authenticated Crilo page. Fixed to the viewport while scrolling.
 * Clicking opens its description and saves it in the existing Mystery Collection.
 * All scores, wheel spins, badges and rankings remain untouched. */
(()=>{
 'use strict';
 if(window.CriloFloatingMysteryLoaded)return;
 window.CriloFloatingMysteryLoaded=true;
 const names={
  sleepy_duck:['The Napping Duck','This duck fell asleep halfway through saying quack.'],
  cosmic_quack:['A Quack from Space','A tiny radio transmission from somewhere beyond the pond.'],
  backwards_map:['The Backwards Map','Every arrow points to where you just came from.'],
  tiny_crown:['An Absurdly Tiny Crown','It is too small for the smallest duck. Nobody knows whose it is.'],
  cloud_recipe:['Recipe for a Cloud','One pinch of fog, two drops of rain, and a very patient spoon.'],
  lost_button:['The Missing Button','Nobody remembers what this button used to do.']
 };
 const shapes={
  sleepy_duck:'<path d="M10 29c1-8 8-13 16-11l4-6 5 2-3 8c4 2 6 5 6 9-5 8-23 8-28-2Z" fill="#ffe5a2"/><circle cx="25" cy="20" r="1.8" fill="#242933" stroke="none"/><path d="M16 30q9 4 17-1" fill="none"/><path d="M6 37h35" stroke="#7795ba"/><path d="M38 8h6l-6 6h6" stroke="#8c78b9"/>',
  cosmic_quack:'<circle cx="25" cy="25" r="15" fill="#dacaf8"/><ellipse cx="25" cy="25" rx="22" ry="8" transform="rotate(-28 25 25)" fill="none" stroke="#6e71a2" stroke-width="2.4"/><circle cx="20" cy="22" r="2.2" fill="#242933" stroke="none"/><path d="M27 30q4 3 8-1M10 6l2 3 3 1-3 1-2 3-1-3-3-1 3-1Z" fill="#ffe7a7"/>',
  backwards_map:'<path d="m8 11 12-3 10 4 12-3v30l-12 3-10-4-12 3V11Z" fill="#e7f0d9"/><path d="M20 8v30M30 12v30" stroke="#7f9a8a"/><path d="M34 20c-2 8-14 11-20 9l4-4M14 29l3 5" fill="none" stroke="#6d79a9" stroke-width="2.5" stroke-linecap="round"/>',
  tiny_crown:'<path d="m9 17 8 7 8-13 8 13 8-7-4 19H13L9 17Z" fill="#ffdf9f"/><path d="M13 37h24" stroke="#765c9d" stroke-width="3"/><circle cx="25" cy="28" r="3" fill="#cdaae9"/><path d="m9 9 2 3 3 1-3 1-2 3-1-3-3-1 3-1Z" fill="#c5b8ec"/>',
  cloud_recipe:'<path d="M13 34a9 9 0 0 1-2-17 11 11 0 0 1 21-4 10 10 0 1 1 4 20H13Z" fill="#e9edfb"/><path d="m21 37-3 6m10-6-3 6" stroke="#759bc8"/><path d="M38 38l5 5m-8-1 8-8" stroke="#987fb3"/><path d="M18 25q9-7 17 0" fill="none" stroke="#a3a9bd"/>',
  lost_button:'<rect x="9" y="7" width="32" height="36" rx="9" fill="#ead6f7"/><circle cx="25" cy="25" r="12" fill="#f7f1ff"/><circle cx="21" cy="21" r="2.2" fill="#826b9e" stroke="none"/><circle cx="29" cy="21" r="2.2" fill="#826b9e" stroke="none"/><circle cx="21" cy="29" r="2.2" fill="#826b9e" stroke="none"/><circle cx="29" cy="29" r="2.2" fill="#826b9e" stroke="none"/>'
 };
 const stylesheet=document.createElement('link');
 stylesheet.rel='stylesheet';stylesheet.href='floating-mystery.css?v=2';
 document.head.append(stylesheet);
 const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
 const $=id=>document.getElementById(id);
 let account=null,checked=false,request=0,claiming=false,spawn=null,node=null,dialog=null;
 const svg=key=>'<svg viewBox="0 0 50 50" width="49" height="49" aria-hidden="true" fill="none" stroke="#292b35" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(shapes[key]||'')+'</svg>';
 // Use shared authored illustrations for unlocked Statistics curiosities.
 window.CriloMysteryCuriosityIcon=key=>Object.hasOwn(shapes,key)?svg(key):'';
 const mysteryChannel=typeof BroadcastChannel==='function'?
  new BroadcastChannel('crilo-mystery-curiosity-v1'):null;
 mysteryChannel?.addEventListener('message',event=>{
  const msg=event.data;
  if(msg?.userId!==window.Crilo?.user?.id)return;
  if(msg?.type==='complete'){
   removeFloating();
   window.dispatchEvent(new Event('crilo-mystery-discovered'));
  }else if(msg?.type==='claimed'){
   if(msg.spawnId===spawn?.spawn_id)removeFloating();
   window.dispatchEvent(new Event('crilo-mystery-discovered'));
  }
 });
 function removeFloating(){
  node?.remove();node=null;
  if(dialog?.open)dialog.close();
  dialog?.remove();dialog=null;spawn=null;
 }
 function buildDetails(key,wasNew,count){
  const [name,story]=names[key];
  const overlay=document.createElement('dialog');
  overlay.className='crilo-wandering-dialog';
  overlay.setAttribute('aria-labelledby','criloWanderingTitle');
  const card=document.createElement('div');card.className='crilo-wandering-card';
  const close=document.createElement('button');close.type='button';
  close.className='crilo-wandering-close';close.textContent='×';close.setAttribute('aria-label','Close curiosity');
  const eyebrow=document.createElement('span');eyebrow.className='crilo-wandering-eyebrow';eyebrow.textContent='A LITTLE DISCOVERY';
  const picture=document.createElement('span');picture.className='crilo-wandering-large-art';
  picture.innerHTML=svg(key);
  const title=document.createElement('h2');title.id='criloWanderingTitle';title.textContent=name;
  const info=document.createElement('p');info.textContent=story;
  const result=document.createElement('p');result.className='crilo-wandering-result';
  result.textContent=wasNew?
   'Added to your Mystery Collection! ('+count+' / 6 found)':
   'Already in your Mystery Collection.';
  const small=document.createElement('p');small.className='crilo-wandering-note';
  small.textContent='Just a collectible. No points, extra spins, or leaderboard advantage.';
  const navigate=document.createElement('a');
  navigate.className='crilo-wandering-link';navigate.href='profile.html';
  navigate.textContent='View Mystery Collection in Statistics →';
  card.append(close,eyebrow,picture,title,info,result,small,navigate);
  overlay.append(card);document.body.append(overlay);
  close.addEventListener('click',()=>overlay.close());
  overlay.addEventListener('click',event=>{if(event.target===overlay)overlay.close()});
  overlay.addEventListener('close',()=>{overlay.remove();if(dialog===overlay)dialog=null});
  dialog=overlay;overlay.showModal();close.focus({preventScroll:true});
 }
 async function collect(){
  if(!spawn||claiming||!window.Crilo?.user)return;
  const id=spawn.spawn_id,key=spawn.key,owner=window.Crilo.user.id,ticket=request;
  claiming=true;
  if(node)node.disabled=true;
  try{
   const {data,error}=await criloDB.rpc('crilo_mystery_page_visit',{
    p_action:'claim',p_page:page,p_spawn_id:id
   });
   // Never show an earlier account's discovery after logout or switching.
   if(ticket!==request||window.Crilo?.user?.id!==owner||spawn?.spawn_id!==id)return;
   if(error)throw error;
   if(data?.state==='complete'){
    removeFloating();
    window.dispatchEvent(new Event('crilo-mystery-discovered'));
    return;
   }
   if(data?.state!=='collected'||data.key!==key)throw Error('Could not verify discovery');
   const fresh=data.new_discovery===true,found=Number(data.discovered_count)||0;
   node?.remove();node=null;spawn=null;
   mysteryChannel?.postMessage({type:'claimed',userId:owner,spawnId:id});
   if(found>=6)mysteryChannel?.postMessage({type:'complete',userId:owner});
   window.dispatchEvent(new CustomEvent('crilo-mystery-discovered',{detail:{key}}));
   buildDetails(key,fresh,found);
  }catch(error){
   if(ticket===request&&window.Crilo?.user?.id===owner){
    console.warn('Floating curiosity:',error);
    if(node){node.disabled=false;node.title='Could not save. Click again to retry.'}
   }
  }finally{claiming=false}
 }
 function showFloating(data){
  if(!names[data.key]||!shapes[data.key]||!data.spawn_id)return;
  if(node&&spawn?.spawn_id===data.spawn_id)return;
  node?.remove();spawn={key:data.key,spawn_id:data.spawn_id};
  const [name]=names[data.key];
  const item=document.createElement('button');
  item.type='button';item.className='crilo-wandering-find';
  item.dataset.side=Math.random()>.5?'right':'left';
  item.dataset.height=Math.random()>.5?'low':'middle';
  item.setAttribute('aria-label','A wandering curiosity: '+name+'. Click to discover it.');
  item.title=name;
  const mark=document.createElement('span');
  mark.className='crilo-wandering-art';mark.innerHTML=svg(data.key);
  const hint=document.createElement('span');
  hint.className='crilo-wandering-tooltip';hint.textContent=name;
  item.append(mark,hint);
  item.addEventListener('click',collect);
  document.body.append(item);node=item;
 }
 async function onIdentity(){
  const id=window.Crilo?.user?.id||null;
  if(!id){++request;account=null;checked=false;removeFloating();return}
  if(id!==account){account=id;checked=false;removeFloating()}
  // Navigation is checked only once per page load and account. Scrolling,
  // tab focus and repeated auth events never reroll the 8% server check.
  if(checked||typeof criloDB==='undefined')return;
  checked=true;const ticket=++request;
  try{
   const {data,error}=await criloDB.rpc('crilo_mystery_page_visit',{
    p_action:'enter',p_page:page
   });
   if(ticket!==request||window.Crilo?.user?.id!==id)return;
   if(error)throw error;
   if(data?.state==='complete')removeFloating();
   else if(data?.state==='ready')showFloating(data);
  }catch(error){
   if(ticket===request)console.warn('Floating curiosity unavailable:',error);
  }
 }
 window.CriloFloatingMystery={
  complete(){
   const userId=window.Crilo?.user?.id;
   if(!userId)return;
   removeFloating();
   mysteryChannel?.postMessage({type:'complete',userId});
  }
 };
 window.addEventListener('crilo-auth-ready',onIdentity);
 if(window.Crilo?.authResolved)void onIdentity();
})();
