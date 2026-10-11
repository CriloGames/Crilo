/* Profile icon customization. Only fixed icons / one A-Z 0-9 letter and
 * preset backgrounds. No uploads or user-controlled markup are rendered.
 * Saving requires the server-authorized per-account RPC. */
(()=>{
 'use strict';
 const colors=[
  ['#FFF0A8','Butter'],['#DDF3E2','Mint'],['#DFECFF','Sky'],
  ['#F1E6FF','Lilac'],['#FFDDE6','Blush'],['#FFE8D0','Peach'],
  ['#E0F5F2','Sea glass'],['#F2F0E9','Oat']
 ];
 const symbols={
  star:['Star','<path d="m24 5 5.9 12.1 13.3 1.9-9.6 9.3 2.3 13.2L24 35.4l-11.9 6.1 2.3-13.2-9.6-9.3 13.3-1.9Z"/>'],
  duck:['Duck','<path d="M7 28c-3-9 2-16 11-16 5 0 8 2 10 5 0-6 4-10 9-10 5 0 8 4 8 9l5 4-6 3c-2 12-12 20-24 19-9 0-15-5-13-14Z" transform="translate(-2 -1) scale(.96)"/><path d="M13 32c5 4 11 5 17 2"/><circle cx="37" cy="16" r="1.6" fill="currentColor" stroke="none"/>'],
  flower:['Flower','<circle cx="24" cy="25" r="5"/><path d="M24 20C9 4 15-1 24 12c9-13 15-8 0 8Zm5 5c19-10 21 0 7 3 9 13 1 19-7 3Zm-5 5c-10 20-18 12-8-1-19-8-11-16 3-9Z"/><path d="M24 32v12m0-7c-4-4-8-4-11-2"/>'],
  bolt:['Lightning','<path d="M27 4 9 27h14l-3 17 20-25H26Z"/>'],
  heart:['Heart','<path d="M24 42 7 26C-2 17 9 5 19 13l5 5 5-5C39 5 50 17 41 26Z"/>'],
  moon:['Moon','<path d="M35 39A19 19 0 0 1 34 6c-3 13 4 23 14 26-3 4-8 7-13 7Z" transform="translate(-5 1)"/><path d="m36 7 1 4 4 1-4 1-1 4-1-4-4-1 4-1Z"/>'],
  dice:['Dice','<rect x="9" y="9" width="30" height="30" rx="6"/><circle cx="17" cy="17" r="2.1" fill="currentColor" stroke="none"/><circle cx="31" cy="17" r="2.1" fill="currentColor" stroke="none"/><circle cx="24" cy="24" r="2.1" fill="currentColor" stroke="none"/><circle cx="17" cy="31" r="2.1" fill="currentColor" stroke="none"/><circle cx="31" cy="31" r="2.1" fill="currentColor" stroke="none"/>'],
  wave:['Wave','<path d="M4 16c7-7 13-7 20 0s13 7 20 0M4 25c7-7 13-7 20 0s13 7 20 0M4 34c7-7 13-7 20 0s13 7 20 0"/>'],
  sun:['Sun','<circle cx="24" cy="24" r="10"/><path d="M24 3v8m0 26v8M3 24h8m26 0h8M9 9l6 6m18 18 6 6M39 9l-6 6M15 33l-6 6"/>']
 };
 const $=id=>document.getElementById(id);
 const validLetter=value=>/^[A-Z0-9]$/.test(String(value||''));
 const safeColor=value=>colors.some(c=>c[0]===value)?value:colors[0][0];
 const safeSymbol=value=>validLetter(value)||typeof value==='string'&&value.startsWith('icon:')&&Object.hasOwn(symbols,value.slice(5))?value:null;
 const svg=key=>'<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-linecap="round">'+symbols[key][1]+'</svg>';
 const render=(element,data)=>{
  if(!element)return;
  const symbol=safeSymbol(data?.avatar_symbol),bg=safeColor(data?.avatar_background);
  element.replaceChildren();
  element.style.backgroundColor=bg;
  if(symbol?.startsWith('icon:')){
   const key=symbol.slice(5);
   element.innerHTML=svg(key); // Static approved icon paths only.
   element.setAttribute('aria-label',symbols[key][0]+' profile icon');
  }else{
   const text=symbol||(String(data?.username||'C').charAt(0).toUpperCase()||'C');
   element.textContent=text;
   element.setAttribute('aria-label',text+' profile icon');
  }
 };
 const modal=$('avatarEditorModal'),profileIcon=$('avatar'),editButton=$('avatarEditBtn'),
  preview=$('avatarEditorPreview'),letter=$('avatarCustomLetter'),
  defaultButton=$('avatarUseInitial'),iconHost=$('avatarIconOptions'),
  colorHost=$('avatarColorOptions'),status=$('avatarEditorStatus'),
  saveButton=$('avatarEditorSave');
 if(!modal||!profileIcon||!editButton||!preview||!iconHost||!colorHost)return;
 let profile=null,own=false,chosen=null,background=colors[0][0],openingFocus=null,loading=false;
 for(const [key,[name]] of Object.entries(symbols)){
  const button=document.createElement('button');button.type='button';
  button.className='avatar-editor-option';button.dataset.symbol='icon:'+key;
  button.setAttribute('aria-label','Choose '+name);button.setAttribute('aria-pressed','false');
  button.innerHTML=svg(key)+'<span>'+name+'</span>';
  button.addEventListener('click',()=>{chosen='icon:'+key;status.textContent='';redraw()});
  iconHost.append(button);
 }
 for(const [value,name] of colors){
  const button=document.createElement('button');button.type='button';
  button.className='avatar-editor-swatch';button.dataset.color=value;
  button.style.backgroundColor=value;
  button.title=name;button.setAttribute('aria-label',name+' background');
  button.setAttribute('aria-pressed','false');
  const check=document.createElement('span');check.textContent='✓';check.setAttribute('aria-hidden','true');button.append(check);
  button.addEventListener('click',()=>{background=value;redraw()});
  colorHost.append(button);
 }
 function redraw(){
  render(preview,{avatar_symbol:chosen,avatar_background:background,username:profile?.username||'C'});
  defaultButton.setAttribute('aria-pressed',String(chosen===null));
  iconHost.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.symbol===chosen)));
  colorHost.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===background)));
 }
 function close(){
  if(loading)return;
  modal.classList.add('hidden');
  document.removeEventListener('keydown',onKey);
  openingFocus?.focus?.({preventScroll:true});
 }
 function onKey(event){if(event.key==='Escape'&&!loading){event.preventDefault();close()}}
 function open(){
  if(!own||!profile||loading)return;
  openingFocus=document.activeElement;
  chosen=safeSymbol(profile.avatar_symbol);
  background=safeColor(profile.avatar_background);
  letter.value=validLetter(chosen)?chosen:'';
  status.textContent='';
  saveButton.disabled=false;
  redraw();
  modal.classList.remove('hidden');
  document.addEventListener('keydown',onKey);
  $('avatarEditorClose').focus({preventScroll:true});
 }
 defaultButton.addEventListener('click',()=>{chosen=null;letter.value='';status.textContent='';redraw()});
 letter.addEventListener('input',()=>{
  letter.value=letter.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,1);
  if(letter.value){chosen=letter.value;status.textContent='';redraw()}
 });
 letter.addEventListener('focus',()=>{if(!letter.value)letter.select()});
 profileIcon.addEventListener('click',open);
 editButton.addEventListener('click',open);
 $('avatarEditorClose').addEventListener('click',close);
 $('avatarEditorCancel').addEventListener('click',close);
 modal.addEventListener('click',event=>{if(event.target===modal)close()});
 saveButton.addEventListener('click',async()=>{
  if(!own||!profile||!Crilo.user||Crilo.user.id!==profile.id||loading)return;
  loading=true;saveButton.disabled=true;status.textContent='Saving your icon…';
  try{
   const {data,error}=await criloDB.rpc('crilo_update_profile_icon',{
    p_symbol:chosen,p_background:background
   });
   if(error)throw error;
   if(!data||data.avatar_symbol!==chosen||data.avatar_background!==background)
    throw new Error('The server did not confirm the saved icon.');
   profile={...profile,...data};
   if(Crilo.profile?.id===profile.id)Crilo.profile={...Crilo.profile,...data};
   render(profileIcon,profile);
   status.textContent='Saved!';
   loading=false;
   close();
  }catch(error){
   status.textContent='Could not save: '+(error?.message||'Please try again.');
  }finally{loading=false;saveButton.disabled=false}
 });
 function bind(data,canEdit){
  profile=data||null;
  own=!!(canEdit&&data?.id&&Crilo.user?.id===data.id);
  render(profileIcon,profile);
  profileIcon.disabled=!own;
  profileIcon.classList.toggle('avatar-can-edit',own);
  profileIcon.title=own?'Customize profile icon':'Profile icon';
  editButton.classList.toggle('hidden',!own);
 }
 window.CriloAvatar={render,bind};
})();
