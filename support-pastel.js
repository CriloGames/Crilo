/* Layered Crilo-themed pastel objects. Decoration only: no network, payment or analytics. */
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
  const palette=['#f7b0c4','#ffd48e','#f8e88d','#b8e6ca','#a6d8ec','#cab5f0','#f6bfdc','#c5e3ef','#c6e7a9','#f8c59a'];
  // Loosely stacked left/right clusters and lower central shapes, not a triangle.
  const anchors=[
    [12,12],[20,22],[13,34],[22,46],[14,60],[22,74],[15,88],
    [88,12],[80,24],[87,37],[78,50],[86,64],[78,78],[85,91],
    [36,88],[50,94],[64,89]
  ];
  const pieces=170;
  const fragment=document.createDocumentFragment();
  for(let i=0;i<pieces;i++){
    const el=document.createElement('span');
    const motif=i%15===0?['wheel','duck','domain'][Math.floor(i/15)%3]:null;
    const type=motif||types[Math.floor(random()*types.length)];
    el.className='shape '+type;
    const anchor=anchors[Math.floor(random()*anchors.length)];
    const spreadX=anchor[0]<30||anchor[0]>70?10:14;
    const x=anchor[0]+(random()-.5)*spreadX;
    const y=anchor[1]+(random()-.5)*9;
    const chance=random();
    const size=motif?Math.round(61+random()*62):
      chance>.84?Math.round(92+random()*42):
      chance>.55?Math.round(48+random()*34):
      Math.round(20+random()*24);
    el.style.setProperty('--x',x.toFixed(2)+'%');
    el.style.setProperty('--y',y.toFixed(2)+'%');
    el.style.setProperty('--s',size+'px');
    el.style.setProperty('--rot',Math.floor(random()*360)+'deg');
    el.style.setProperty('--c',palette[Math.floor(random()*palette.length)]);
    el.style.setProperty('--o',(.86+random()*.14).toFixed(2));
    el.style.setProperty('--dur',Math.round(7+random()*8)+'s');
    el.style.setProperty('--delay',(-random()*12).toFixed(2)+'s');
    if(type==='circle'&&size>=44&&random()>.82)el.classList.add('has-face');
    if(type==='duck'){
      const eye=document.createElement('i');
      eye.className='duck-eye';
      el.appendChild(eye);
    }
    fragment.appendChild(el);
  }
  field.appendChild(fragment);
})();
