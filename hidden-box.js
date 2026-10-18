/* Tiny homepage secret: intentionally no reward, badge, score or account calls.
   The eventual purpose can be added later without changing the hidden trigger. */
(()=>{
 'use strict';
 const box=document.getElementById('criloHiddenBox');
 const note=document.getElementById('criloHiddenBoxNote');
 if(!box||!note)return;
 function setOpen(open){
  note.hidden=!open;
  box.setAttribute('aria-expanded',String(open));
 }
 box.addEventListener('click',()=>setOpen(note.hidden));
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!note.hidden){
   setOpen(false);
   box.focus();
  }
 });
 document.addEventListener('pointerdown',event=>{
  if(!note.hidden&&!box.contains(event.target)&&!note.contains(event.target)){
   setOpen(false);
  }
 });
})();
