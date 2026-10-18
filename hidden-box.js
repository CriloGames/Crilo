/* White-box Easter egg: tiny, cosmetic and completely client-side.
   No backend, account, Daily state, badges, scores or local storage. */
(()=>{
 'use strict';
 const box=document.getElementById('criloHiddenBox');
 const note=document.getElementById('criloHiddenBoxNote');
 const wish=document.getElementById('criloHiddenWish');
 const whisper=document.getElementById('criloHiddenWhisper');
 if(!box||!note||!wish||!whisper)return;
 const messages=[
  'You found a little piece of sky, hidden in plain sight.',
  'Somewhere, a very small star just made a wish for you.',
  'A secret does not need a prize to be worth finding.',
  'This universe is exactly the size it needs to be.',
  'Shh. The stars are plotting something delightful.',
  'Congratulations: you have successfully done absolutely nothing.'
 ];
 let wishes=0;
 function setOpen(open){
  note.hidden=!open;
  box.setAttribute('aria-expanded',String(open));
 }
 box.addEventListener('click',()=>{
  setOpen(note.hidden);
 });
 wish.addEventListener('click',()=>{
  wishes++;
  whisper.textContent=messages[wishes%messages.length];
  note.dataset.phase=String(wishes%2);
 });
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
