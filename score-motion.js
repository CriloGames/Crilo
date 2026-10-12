/* Per-digit Daily and leaderboard scores: compact, sequential vertical bob.
   The complete previous digit settles BEFORE the next rises. Score text,
   inline tier coloring, nested metadata and the final-spin pop stay intact. */
(()=>{
 'use strict';
 const scores=['score','finalScore','bestScore'].map(id=>document.getElementById(id)).filter(Boolean);
 const leaderList=document.getElementById('leaderList');
 if(!scores.length&&!leaderList)return;
 const prefersReducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 // The complete rise and return lasts 275ms; the next digit waits another
 // 90ms before starting. Five digits finish in under two seconds.
 const STEP_MS=365,PEAK_MS=125,REST_MS=275,GAP_MS=440;
 const bobAnimations=new WeakMap();
 function animateDigits(digits){
  if(!digits.length||prefersReducedMotion?.matches)return;
  const duration=Math.max(1750,digits.length*STEP_MS+GAP_MS);
  digits.forEach((digit,index)=>{
   if(bobAnimations.has(digit))return;
   const animation=digit.animate([
    {offset:0,transform:'translate3d(0,0,0)',easing:'ease-out'},
    {offset:PEAK_MS/duration,transform:'translate3d(0,-.07em,0)',easing:'ease-in'},
    {offset:REST_MS/duration,transform:'translate3d(0,0,0)'},
    {offset:1,transform:'translate3d(0,0,0)'}
   ],{duration,delay:index*STEP_MS,iterations:Infinity,fill:'both'});
   animation.id='criloScoreDigitBob';
   bobAnimations.set(digit,animation);
  });
 }
 function wrapDigits(el){
  if(!el||el.classList.contains('crilo-final-animate'))return;
  // Duck totals can have illustrated ducks in the score; preserve them.
  if(el.querySelector('img,svg,canvas'))return;
  let changed=false;
  for(const node of [...el.childNodes]){
   if(node.nodeType!==Node.TEXT_NODE||!/[0-9]/.test(node.data))continue;
   const fragment=document.createDocumentFragment();
   for(const character of node.data){
    if(/[0-9]/.test(character)){
     const span=document.createElement('span');
     span.className='crilo-score-bob-digit';
     span.textContent=character;
     fragment.appendChild(span);
    }else fragment.appendChild(document.createTextNode(character));
   }
   node.replaceWith(fragment);
   changed=true;
  }
  if(changed)animateDigits([...el.querySelectorAll(':scope > .crilo-score-bob-digit')]);
 }
 function collect(){
  scores.forEach(wrapDigits);
  leaderList?.querySelectorAll('.leader-score').forEach(wrapDigits);
 }
 collect();
 // Updating a live score must rebuild the wave for that NEW number, without
 // changing any actual score or affecting the separate final-spin sequence.
 const observer=new MutationObserver(records=>{
  const changed=new Set();
  for(const record of records){
   const node=record.target;
   if(node===leaderList){
    leaderList.querySelectorAll('.leader-score').forEach(el=>changed.add(el));
   }else if(node.nodeType===Node.ELEMENT_NODE){
    if(scores.includes(node)||node.classList.contains('leader-score'))changed.add(node);
    else{
     const score=node.closest('.leader-score');
     if(score)changed.add(score);
    }
   }
  }
  changed.forEach(wrapDigits);
 });
 scores.forEach(el=>observer.observe(el,{childList:true,attributes:true,attributeFilter:['class']}));
 if(leaderList)observer.observe(leaderList,{childList:true,subtree:true});
 prefersReducedMotion?.addEventListener?.('change',()=>{
  for(const el of [...scores,...(leaderList?.querySelectorAll('.leader-score')||[])]){
   const digits=[...el.querySelectorAll(':scope > .crilo-score-bob-digit')];
   for(const digit of digits){
    bobAnimations.get(digit)?.cancel();
    bobAnimations.delete(digit);
   }
   if(!prefersReducedMotion.matches)animateDigits(digits);
  }
 });
})();
