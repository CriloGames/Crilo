/* Individual score digits bob in a smooth wave from left to right.
   Non-digit labels, metadata, artwork, real-time updates, and Crilo's
   final-spin glyph celebration remain untouched. */
(()=>{
 'use strict';
 const scores=['score','finalScore','bestScore'].map(id=>document.getElementById(id)).filter(Boolean);
 const leaderList=document.getElementById('leaderList');
 if(!scores.length&&!leaderList)return;
 function wrapDigits(el){
  if(!el||el.classList.contains('crilo-final-animate'))return;
  // Duck leaderboards contain actual artwork: keep it completely intact.
  if(el.querySelector('img,svg,canvas'))return;
  let i=0;
  for(const node of [...el.childNodes]){
   if(node.nodeType!==Node.TEXT_NODE||!/[0-9]/.test(node.data))continue;
   const replacement=document.createDocumentFragment();
   for(const character of node.data){
    if(/[0-9]/.test(character)){
     const span=document.createElement('span');
     span.className='crilo-score-bob-digit';
     span.textContent=character;
     span.style.animationDelay=(i*.22)+'s';
     i++;
     replacement.appendChild(span);
    }else replacement.appendChild(document.createTextNode(character));
   }
   node.replaceWith(replacement);
  }
 }
 function collect(){
  scores.forEach(wrapDigits);
  leaderList?.querySelectorAll('.leader-score').forEach(wrapDigits);
 }
 collect();
 const observer=new MutationObserver(records=>{
  const updated=new Set();
  for(const record of records){
   const node=record.target;
   if(node===leaderList){
    leaderList.querySelectorAll('.leader-score').forEach(el=>updated.add(el));
   }else if(node.nodeType===Node.ELEMENT_NODE){
    if(scores.includes(node)||node.classList.contains('leader-score'))updated.add(node);
    else{
     const score=node.closest('.leader-score');
     if(score)updated.add(score);
    }
   }
  }
  updated.forEach(wrapDigits);
 });
 scores.forEach(el=>observer.observe(el,{childList:true,attributes:true,attributeFilter:['class']}));
 if(leaderList)observer.observe(leaderList,{childList:true,subtree:true});
})();
