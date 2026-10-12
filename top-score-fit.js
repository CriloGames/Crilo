/* Presentation only. Score values continue to come from leaderboard.js.
   Adjust only the font-size class of the top card for long numeric strings. */
(()=>{
 'use strict';
 const el=document.getElementById('bestScore');
 if(!el)return;
 const fit=()=>{
  const value=(el.textContent||'').replace(/[^0-9]/g,'');
  const length=value.length;
  el.dataset.digits=length>9?'long':String(length);
 };
 new MutationObserver(fit).observe(el,{childList:true,characterData:true,subtree:true});
 fit();
})();
