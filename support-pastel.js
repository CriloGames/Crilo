/* Colorful sticker confetti. Decoration only: no network, payment or analytics calls. */
(function(){
  'use strict';
  const field=document.getElementById('shapeCanvas');
  if(!field)return;
  let seed=0xC710B1A;
  function random(){
    seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
    return (seed>>>0)/4294967296;
  }
  const types=['circle','bean','pill','box','donut','spark','flower','heart','squiggle'];
  const palette=['#ff9fbd','#ffd18d','#ffeea0','#aee8c8','#9cd8ed','#c4b0f5','#f9bbde','#baddec','#bfe7a5','#f8c69e','#dbb8f0','#b2f0ed'];
  const pieces=230;
  const fragment=document.createDocumentFragment();
  for(let i=0;i<pieces;i++){
    const el=document.createElement('span');
    const type=types[Math.floor(random()*types.length)];
    el.className='shape '+type;
    const size=Math.round(10+random()*70+(random()>.9?60:0));
    el.style.setProperty('--x',(random()*109-4.5).toFixed(2)+'%');
    el.style.setProperty('--y',(random()*109-4.5).toFixed(2)+'%');
    el.style.setProperty('--s',size+'px');
    el.style.setProperty('--rot',Math.floor(random()*360)+'deg');
    el.style.setProperty('--c',palette[Math.floor(random()*palette.length)]);
    el.style.setProperty('--o',(.68+random()*.32).toFixed(2));
    el.style.setProperty('--dur',Math.round(7+random()*10)+'s');
    el.style.setProperty('--delay',(-random()*16).toFixed(2)+'s');
    if(type==='circle'&&size>=35&&random()>.78)el.classList.add('has-face');
    fragment.appendChild(el);
  }
  field.appendChild(fragment);
})();
