/* Five curated wheel drawings for Crilo Statistics profiles.
 * The server decides eligibility, ownership and moderation. We never
 * create or modify a Daily, nor upload arbitrary artwork from this UI.
 */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const gallery=$('featuredDrawings'),picker=$('featuredDrawingPicker'),
  preview=$('featuredDrawingPreview');
 if(!gallery||!picker||!preview)return;
 const options=$('fdPickerOptions'),status=$('fdPickerStatus'),
  saveButton=$('fdPickerSave'),clearButton=$('fdPickerClear'),
  moreButton=$('fdPickerMore'),hint=$('featuredDrawingsHint');
 const queryId=new URLSearchParams(location.search).get('id');
 const PAGE_SIZE=18,IMAGE=/^data:image\/(?:png|webp);base64,[A-Za-z0-9+/=]+$/;
 let target=null,mine=false,featured=new Map(),loadVersion=0;
 let editSlot=0,chosen=null,choices=[],offset=0,hasMore=false,
  choicesBusy=false,saving=false,returnTo=null,previewReturn=null;
 const art=src=>typeof src==='string'&&src.length>100&&IMAGE.test(src)?src:null;
 const key=x=>x?.source&&x?.run_id?x.source+':'+x.run_id:null;
 const fmtDate=value=>{
  const text=String(value||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return 'Saved Daily';
  const d=new Date(text+'T12:00:00Z');
  return Number.isFinite(d.getTime())?
   new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(d):
   'Saved Daily';
 };
 const kind=x=>x?.source==='bonus'?'Bonus Run':'Official Daily';
 function element(tag,className,text){
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined)el.textContent=String(text);
  return el;
 }
 function picture(record){
  const img=element('img');
  img.alt='Wheel drawing from '+kind(record)+' on '+fmtDate(record.daily_period);
  img.loading='lazy';img.decoding='async';img.src=art(record.drawing)||'blank-wheel.svg';
  img.addEventListener('error',()=>{
   img.removeAttribute('src');
   img.alt='This drawing could not be displayed';
  },{once:true});
  return img;
 }
 function render(){
  gallery.replaceChildren();
  for(let slot=1;slot<=5;slot++){
   const record=featured.get(slot),canOpen=mine||!!record;
   const tile=element(canOpen?'button':'div',
    'profile-drawing-slot '+(record?'has-drawing':'is-empty'));
   if(canOpen){tile.type='button';tile.dataset.slot=String(slot)}
   if(record){
    const date=fmtDate(record.daily_period);
    tile.append(picture(record));
    const label=element('span','profile-drawing-slot-meta');
    label.append(element('strong',kind(record)),element('time','',date));
    tile.append(label);
    tile.setAttribute('aria-label',(mine?'Change':'View')+' featured drawing '+slot+
     ': '+kind(record)+' on '+date);
   }else{
    tile.append(element('span','profile-drawing-plus','+'),
     element('span','profile-drawing-empty-caption',
      mine?'Choose drawing':'Empty slot'));
    tile.setAttribute('aria-label',mine?'Choose drawing for slot '+slot:'Empty drawing slot '+slot);
   }
   gallery.append(tile);
  }
  hint.textContent=mine?
   'Select an empty slot or drawing to choose your favorites from completed Dailies.':
   featured.size?'These are the player’s favorite saved drawings.':'No featured drawings selected yet.';
 }
 async function loadFeatured(){
  const requested=queryId||window.Crilo?.user?.id||null;
  const serial=++loadVersion;
  target=requested;mine=!!(target&&window.Crilo?.user?.id===target);
  if(!target){featured.clear();render();hint.textContent='Sign in to feature your saved drawings.';return}
  if(typeof criloDB==='undefined'||!criloDB?.rpc){
   featured.clear();render();hint.textContent='Drawings cannot be loaded right now.';return;
  }
  try{
   const {data,error}=await criloDB.rpc('crilo_profile_featured_drawings',{p_user:target});
   if(serial!==loadVersion)return;
   if(error)throw error;
   featured=new Map((Array.isArray(data)?data:[]).filter(row=>
    Number.isInteger(Number(row.slot))&&Number(row.slot)>=1&&Number(row.slot)<=5&&
    art(row.drawing)&&['official','bonus'].includes(row.source)&&row.run_id).
    map(row=>[Number(row.slot),row]));
   render();
  }catch(err){
   if(serial!==loadVersion)return;
   gallery.replaceChildren(element('p','profile-drawings-loading',
    'Featured drawings are temporarily unavailable.'));
   hint.textContent='';
   console.warn('Featured drawings unavailable',err);
  }
 }
 function resetPicker(){
  editSlot=0;chosen=null;choices=[];offset=0;hasMore=false;
  choicesBusy=false;saving=false;
 }
 function showDialog(dialog){
  if(typeof dialog.showModal==='function')dialog.showModal();
  else dialog.setAttribute('open','');
 }
 function closeDialog(dialog){
  if(typeof dialog.close==='function')dialog.close();
  else{dialog.removeAttribute('open');dialog.dispatchEvent(new Event('close'))}
 }
 function updateActions(){
  const existing=featured.get(editSlot);
  const duplicate=choices.some(x=>key(x)===chosen&&
   [...featured].some(([slot,featuredRecord])=>slot!==editSlot&&key(featuredRecord)===chosen));
  saveButton.disabled=saving||choicesBusy||!chosen||key(existing)===chosen||duplicate;
  clearButton.disabled=saving||!existing;
  moreButton.disabled=choicesBusy||saving;
  moreButton.hidden=!hasMore;
 }
 function renderChoices(){
  options.replaceChildren();
  if(!choices.length){
   options.append(element('p','profile-drawings-loading',
    choicesBusy?'Finding your saved drawings…':
    'No saved Official or Bonus Run drawings are available to feature yet.'));
  }
  for(let i=0;i<choices.length;i++){
   const d=choices[i],inOther=[...featured].find(([slot,rec])=>slot!==editSlot&&key(rec)===key(d));
   const tile=element('button','profile-drawing-choice'+(chosen===key(d)?' is-selected':''),undefined);
   tile.type='button';tile.dataset.choiceIndex=String(i);
   tile.disabled=!!inOther;
   tile.setAttribute('aria-pressed',String(chosen===key(d)));
   tile.setAttribute('aria-label',fmtDate(d.daily_period)+' '+kind(d)+
    (inOther?' already featured in slot '+inOther[0]:''));
   tile.append(picture(d),element('span','',fmtDate(d.daily_period)),
    element('small','',inOther?'Already featured · slot '+inOther[0]:kind(d)));
   options.append(tile);
  }
  updateActions();
 }
 async function loadChoices(){
  if(choicesBusy||!editSlot||!mine||!target)return;
  choicesBusy=true;moreButton.disabled=true;
  if(offset===0)options.replaceChildren(element('p','profile-drawings-loading','Finding your saved drawings…'));
  try{
   const {data,error}=await criloDB.rpc('crilo_my_featured_drawing_choices',{
    p_limit:PAGE_SIZE,p_offset:offset
   });
   if(error)throw error;
   if(!editSlot||!picker.open)return;
   const batch=(Array.isArray(data)?data:[]).filter(d=>
    art(d.drawing)&&key(d)&&['official','bonus'].includes(d.source));
   choices.push(...batch);
   offset+=(Array.isArray(data)?data.length:0);
   hasMore=Array.isArray(data)&&data.length===PAGE_SIZE;
   status.textContent=choices.length?choices.length+' saved drawings shown.':'';
  }catch(err){
   status.textContent='Could not load saved drawings. Try again.';
   console.warn('Featured drawing picker unavailable',err);
  }finally{choicesBusy=false;renderChoices()}
 }
 function openPicker(slot,trigger){
  if(!mine||!Number.isInteger(slot)||slot<1||slot>5)return;
  editSlot=slot;chosen=key(featured.get(slot));choices=[];offset=0;
  hasMore=false;saving=false;returnTo=trigger;
  $('fdSlotNumber').textContent=String(slot);
  status.textContent='';
  showDialog(picker);
  renderChoices();
  void loadChoices();
 }
 function openPreview(record,trigger){
  const source=art(record?.drawing);if(!source)return;
  previewReturn=trigger;
  $('fdPreviewImage').src=source;
  $('fdPreviewTitle').textContent='Drawing from '+fmtDate(record.daily_period);
  $('fdPreviewMeta').textContent=kind(record)+' · '+Number(record.score||0).toLocaleString('en-US')+' points';
  showDialog(preview);
 }
 gallery.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-slot]');
  if(!button||!gallery.contains(button))return;
  const slot=Number(button.dataset.slot);
  if(mine)openPicker(slot,button);
  else if(featured.has(slot))openPreview(featured.get(slot),button);
 });
 options.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-choice-index]');
  if(!button||button.disabled||saving)return;
  const item=choices[Number(button.dataset.choiceIndex)];
  if(!item)return;
  chosen=key(item);
  status.textContent='Selected '+fmtDate(item.daily_period)+' · '+kind(item)+'.';
  renderChoices();
 });
 moreButton.addEventListener('click',()=>{void loadChoices()});
 async function saveChoice(clear=false){
  if(!mine||!editSlot||saving)return;
  const selected=clear?null:choices.find(d=>key(d)===chosen);
  if(!clear&&!selected)return;
  saving=true;updateActions();status.textContent='Saving your featured drawings…';
  try{
   const {error}=await criloDB.rpc('crilo_set_profile_featured_drawing',{
    p_position:editSlot,
    p_source:selected?.source||null,
    p_run_id:selected?.run_id||null
   });
   if(error)throw error;
   // Reload from the server so deletions or moved slots remain canonical.
   const {data,error:readError}=await criloDB.rpc('crilo_profile_featured_drawings',{p_user:target});
   if(readError)throw readError;
   featured=new Map((Array.isArray(data)?data:[]).filter(x=>art(x.drawing)).
    map(x=>[Number(x.slot),x]).filter(([slot])=>slot>=1&&slot<=5));
   render();
   status.textContent='';
   closeDialog(picker);
  }catch(err){
   status.textContent='Unable to save this drawing. '+String(err.message||'Please try again.');
  }finally{saving=false;updateActions()}
 }
 saveButton.addEventListener('click',()=>{void saveChoice(false)});
 clearButton.addEventListener('click',()=>{void saveChoice(true)});
 $('fdPickerClose').addEventListener('click',()=>closeDialog(picker));
 $('fdPreviewClose').addEventListener('click',()=>closeDialog(preview));
 picker.addEventListener('close',()=>{
  resetPicker();
  const restore=returnTo;returnTo=null;
  if(restore?.isConnected)restore.focus({preventScroll:true});
  else gallery.querySelector('button[data-slot]')?.focus({preventScroll:true});
 });
 preview.addEventListener('close',()=>{
  $('fdPreviewImage').removeAttribute('src');
  const restore=previewReturn;previewReturn=null;
  if(restore?.isConnected)restore.focus({preventScroll:true});
 });
 window.addEventListener('crilo-auth-ready',()=>{void loadFeatured()});
 if(window.Crilo?.authResolved)void loadFeatured();
})();
