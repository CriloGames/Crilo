/* Shared standalone-game information dialog; independent of auth and gameplay. */
(()=>{
 'use strict';
 const btn=document.getElementById('gameInfoBtn');
 const modal=document.getElementById('gameInfoModal');
 const close=document.getElementById('gameInfoClose');
 if(!btn||!modal||!close)return;
 let lastFocus=null;
 const open=()=>{
  lastFocus=document.activeElement;
  modal.hidden=false;
  btn.setAttribute('aria-expanded','true');
  close.focus();
 };
 const dismiss=()=>{
  modal.hidden=true;
  btn.setAttribute('aria-expanded','false');
  if(lastFocus&&lastFocus.isConnected)lastFocus.focus();
  else btn.focus();
 };
 btn.addEventListener('click',open);
 close.addEventListener('click',dismiss);
 modal.addEventListener('click',event=>{if(event.target===modal)dismiss()});
 document.addEventListener('keydown',event=>{
  if(modal.hidden)return;
  if(event.key==='Escape'){event.preventDefault();dismiss()}
  if(event.key==='Tab'){
   const reachable=[...modal.querySelectorAll('a[href],button:not([disabled])')].filter(el=>el.getClientRects().length);
   if(!reachable.length)return;
   const first=reachable[0],last=reachable[reachable.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
 });
})();
