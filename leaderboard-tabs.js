/* Keep every leaderboard category on ONE row at every viewport and zoom.
 * Mouse/trackpad, touch swipe, keyboard, and explicit arrows can all reach
 * off-screen categories without breaking the header into two uneven rows. */
(() => {
 'use strict';
 const strip=document.getElementById('leaderTabs');
 const wrap=document.querySelector('.leader-tabs-wrap');
 const previous=document.getElementById('leaderTabPrev');
 const next=document.getElementById('leaderTabNext');
 if(!strip||!wrap||!previous||!next)return;
 function update(){
  // Compare against the full wrapper width, not the width after adding arrows;
  // otherwise arrows can remain visible even when all tabs would fit.
  const fits=strip.scrollWidth<=wrap.clientWidth+2;
  wrap.classList.toggle('tabs-fit',fits);
  previous.hidden=next.hidden=fits;
  const remaining=Math.max(0,strip.scrollWidth-strip.clientWidth);
  previous.disabled=fits||strip.scrollLeft<=2;
  next.disabled=fits||strip.scrollLeft>=remaining-2;
 }
 function scroll(direction){
  const distance=Math.max(160,Math.round(strip.clientWidth*.72));
  if(typeof strip.scrollBy==='function')
   strip.scrollBy({left:direction*distance,behavior:'smooth'});
  else strip.scrollLeft+=direction*distance;
  update();
 }
 previous.addEventListener('click',()=>scroll(-1));
 next.addEventListener('click',()=>scroll(1));
 strip.addEventListener('scroll',update,{passive:true});
 // Clicking an off-screen/partially visible tab should never scroll the whole
 // document up or down. Only align it within its own horizontal category strip.
 strip.querySelectorAll('.leader-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
   const item=tab.getBoundingClientRect();
   const viewport=strip.getBoundingClientRect();
   const delta=item.left<viewport.left+8?item.left-viewport.left-12:
     item.right>viewport.right-8?item.right-viewport.right+12:0;
   if(delta&&typeof strip.scrollBy==='function')
    strip.scrollBy({left:delta,behavior:'smooth'});
  });
 });
 window.addEventListener('resize',update);
 window.addEventListener('orientationchange',update);
 window.visualViewport?.addEventListener?.('resize',update);
 if(typeof ResizeObserver==='function')new ResizeObserver(update).observe(wrap);
 document.fonts?.ready?.then(update).catch(()=>{});
 update();
})();
