/* STACK LAB — completely free 3D block-stacking mini-game.
   No backend, no payment logic. Gravity and collisions work in one shared play plane. */
(()=>{
'use strict';
const board=document.getElementById('shapeCanvas');
const status=document.getElementById('shapeStatus');
const progress=document.getElementById('stackProgress');
const fill=document.getElementById('stackFill');
const bestLabel=document.getElementById('stackBest');
const celebrate=document.getElementById('stackCelebrate');
const removeButton=document.getElementById('shapeDelete');
const resetButton=document.getElementById('shapeReset');
const surprise=document.getElementById('shapeSurprise');
if(!board||!status||!progress||!fill||!bestLabel||!celebrate)return;
const TYPES=['cube','slab','cylinder','sphere','prism','arch'];
const RATIOS={cube:1,slab:1.75,cylinder:.9,sphere:1,prism:1,arch:.9};
const COLORS=[
 ['#f3b2ca','#ca87a4','#ffe1eb'],['#b3dff4','#79aace','#e2f5ff'],
 ['#f6d694','#d8ae6a','#fff0c5'],['#b6e2c8','#87bca3','#def7e6'],
 ['#d2c0f1','#a58bc8','#f0e6ff'],['#f4bea4','#cf977d','#ffdfc9']
];
const STORAGE='crilo:stack-lab:v2',BEST='crilo:stack-lab:best',MAX=32;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
let shapes=[],id=1,selected=null,held=null,goal=3,highest=0,winTimer=0;
let t0=0,frames=0,autosave=0,spawnNumber=0,rand=0xCAFE91;
let best=0;
try{best=Number(localStorage.getItem(BEST))||0}catch(_){}
const random=()=>{rand^=rand<<13;rand^=rand>>>17;rand^=rand<<5;return (rand>>>0)/4294967296};
const dimensions=()=>({w:board.clientWidth||390,h:board.clientHeight||680});
const topOf=selector=>{
 const node=document.querySelector(selector);
 return node?node.getBoundingClientRect().bottom-board.getBoundingClientRect().top:150;
};
const floor=()=>{
 const d=dimensions();
 // Keep the physical floor within the first screen instead of far below the fold.
 return clamp(Math.min(d.h-22,window.innerHeight-31),Math.min(390,d.h-22),d.h-15);
};
function positionFloor(){
 const y=floor();
 document.querySelector('.pastel-world').style.setProperty('--floor-y',y+'px');
}
function note(msg){status.textContent=msg}
function save(){
 try{
  const d=dimensions();
  localStorage.setItem(STORAGE,JSON.stringify(shapes.map(s=>({
   type:s.type,x:s.x/d.w,y:s.y/d.h,w:s.w,id:s.id
  }))));
 }catch(_){}
}
function saveSoon(){clearTimeout(autosave);autosave=setTimeout(save,400)}
function aspect(type,w){return w/(RATIOS[type]||1)}
function paint(s){
 if(!s.el)return;
 s.el.style.left=s.x+'px';s.el.style.top=s.y+'px';
 s.el.style.width=s.w+'px';s.el.style.height=s.h+'px';
 s.el.style.setProperty('--depth',clamp(s.w*.15,6,17)+'px');
 s.el.style.zIndex=String(20+s.id+(s.id===selected?100:0));
 s.el.classList.toggle('selected',selected===s.id);
 s.el.classList.toggle('held',held?.id===s.id);
 s.el.dataset.resting=String(Boolean(s.resting));
 s.el.setAttribute('aria-label',s.type+' block. Drag to stack; resize proportionally by a corner or press plus/minus.');
}
function draw(s){
 const el=document.createElement('div');
 el.className='toy-shape type-'+s.type;
 el.dataset.shapeId=String(s.id);
 el.tabIndex=0;el.setAttribute('role','group');
 el.innerHTML='<div class="toy-shadow"></div><div class="toy-object"><span class="toy-top"></span><span class="toy-side"></span><span class="toy-front"></span><span class="toy-glint"></span></div>';
 for(const corner of ['nw','ne','sw','se']){
  const n=document.createElement('span');n.className='toy-handle at-'+corner;
  n.dataset.resize=corner;n.setAttribute('aria-hidden','true');el.appendChild(n);
 }
 const colors=COLORS[(s.id-1)%COLORS.length];
 el.style.setProperty('--face',colors[0]);el.style.setProperty('--side',colors[1]);el.style.setProperty('--top',colors[2]);
 board.appendChild(el);s.el=el;paint(s);
}
function select(s){
 selected=s?.id??null;
 removeButton.disabled=!s;
 for(const obj of shapes)paint(obj);
}
function supportOverlap(a,b){return Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))}
function supports(s){
 // The closest vertical contact below this shape always wins.
 const yFloor=floor();
 let limit=yFloor-s.h,other=null;
 for(const b of shapes){
  if(b===s||held?.id===b.id)continue;
  if(supportOverlap(s,b)<Math.min(s.w,b.w)*.38)continue;
  const contact=b.y-s.h;
  if(contact<-1||b.y<s.y+s.h*.25)continue;
  if(contact<limit+1){limit=contact;other=b;}
 }
 return {limit,other};
}
function create(type,options={}){
 if(shapes.length>=MAX){note('The room is full. Remove a block to keep stacking.');return null;}
 const d=dimensions(),w=clamp(Number(options.w)||({slab:105,arch:73,cylinder:70,prism:75,sphere:72,cube:78}[type]||76),43,Math.min(194,d.w-14));
 const h=aspect(type,w);
 const card=document.querySelector('.tip-card').getBoundingClientRect();
 const cardBottom=card.bottom-board.getBoundingClientRect().top;
 // On small screens, begin just below the tip panel; on desktop, spawn to either side.
 const spawnY=d.w<570?Math.min(floor()-h-18,cardBottom+18):topOf('.shape-toolbar')+45;
 const lane=spawnNumber++%4;
 const positions=d.w<570?[.12,.51,.32,.68]:[.06,.84,.12,.77];
 const x=clamp(options.x??((d.w-w)*positions[lane]),0,Math.max(0,d.w-w));
 const y=clamp(options.y??spawnY,0,Math.max(0,floor()-h));
 const s={id:id++,type:TYPES.includes(type)?type:'cube',x,y,w,h,vy:0,resting:false,el:null};
 shapes.push(s);draw(s);
 if(options.select!==false)select(s);
 if(!options.quiet)note('Dropped '+s.type+'! Move it over another block to build your tower.');
 saveSoon();return s;
}
function remove(){
 const s=shapes.find(x=>x.id===selected);if(!s)return;
 s.el.remove();shapes=shapes.filter(x=>x!==s);
 select(null);note('Block removed.');saveSoon();updateScore();
}
function clear(){
 for(const s of shapes)s.el?.remove();
 shapes=[];id=1;selected=null;spawnNumber=0;removeButton.disabled=true;
}
function newPile(){
 clear();goal=3;highest=0;
 clearTimeout(winTimer);celebrate.classList.remove('celebrate');celebrate.hidden=true;
 const d=dimensions(),f=floor();
 // A small colorful starter set, visible at the bottom of the first screen.
 const count=d.w<570?3:d.w<900?4:6;
 const types=['slab','cube','sphere','cylinder','prism','arch'];
 for(let i=0;i<count;i++){
  const type=types[i],w=d.w<570?61:d.w<900?68:78,h=aspect(type,w);
  const x=(d.w-w)*(i+.5)/count;
  create(type,{x,y:f-h,w,quiet:true,select:false});
 }
 select(null);updateScore();
 note('Stack three blocks to reach the first star. The challenge is free!');
 saveSoon();
}
function restore(){
 let data;try{data=JSON.parse(localStorage.getItem(STORAGE)||'null')}catch(_){}
 if(!Array.isArray(data)||!data.length||data.length>MAX){newPile();return}
 const d=dimensions();
 for(const obj of data){
  if(!TYPES.includes(obj.type))continue;
  const w=clamp(Number(obj.w)||70,43,Math.min(194,d.w-14)),h=aspect(obj.type,w);
  create(obj.type,{x:clamp(Number(obj.x)*d.w||0,0,d.w-w),
   y:clamp(Number(obj.y)*d.h||0,0,floor()-h),w,quiet:true,select:false});
 }
 select(null);updateScore();
}
function point(e){const box=board.getBoundingClientRect();return {x:e.clientX-box.left,y:e.clientY-box.top}}
function pointerDown(e){
 const el=e.target.closest('.toy-shape');if(!el)return;
 const s=shapes.find(o=>String(o.id)===el.dataset.shapeId);
 if(!s)return;
 e.preventDefault();select(s);
 const p=point(e),corner=e.target.closest('[data-resize]')?.dataset.resize||null;
 held={id:s.id,pointer:e.pointerId,corner,p,x:s.x,y:s.y,w:s.w,h:s.h};
 s.vy=0;s.resting=false;
 el.setPointerCapture(e.pointerId);paint(s);
}
function pointerMove(e){
 if(!held||e.pointerId!==held.pointer)return;
 const s=shapes.find(o=>o.id===held.id);if(!s)return;
 e.preventDefault();
 const p=point(e),dx=p.x-held.p.x,dy=p.y-held.p.y,d=dimensions();
 if(held.corner){
  const east=held.corner.includes('e'),south=held.corner.includes('s');
  const signX=east?1:-1,signY=south?1:-1;
  // Uniform scaling preserves shape aspect ratio, regardless of corner direction.
  const factor=clamp(1+((signX*dx/held.w)+(signY*dy/held.h))*.5,
   Math.max(43/held.w,43/Math.max(held.h,1)),Math.min(194/held.w,194/held.h));
  const newW=clamp(held.w*factor,43,194),newH=aspect(s.type,newW);
  const anchorX=east?held.x:held.x+held.w;
  const anchorY=south?held.y:held.y+held.h;
  s.w=newW;s.h=newH;
  s.x=clamp(east?anchorX:anchorX-newW,0,Math.max(0,d.w-newW));
  s.y=clamp(south?anchorY:anchorY-newH,0,Math.max(0,floor()-newH));
 }else{
  s.x=clamp(held.x+dx,0,Math.max(0,d.w-s.w));
  s.y=clamp(held.y+dy,0,Math.max(0,floor()-s.h));
 }
 paint(s);
}
function pointerUp(e){
 if(!held||(e&&e.pointerId!==held.pointer))return;
 const s=shapes.find(o=>o.id===held.id);held=null;
 if(!s)return;
 // Snap a block to the top of a nearby shape when dropped over it.
 const sorted=shapes.filter(b=>b!==s)
  .filter(b=>supportOverlap(s,b)>=Math.min(s.w,b.w)*.38&&s.y<b.y)
  .sort((a,b)=>a.y-b.y);
 for(const other of sorted){
  if(s.y+s.h>=other.y-14&&s.y<other.y){
   s.y=clamp(other.y-s.h,0,floor()-s.h);break;
  }
 }
 s.vy=0;s.resting=false;paint(s);saveSoon();updateScore();
}
board.addEventListener('pointerdown',pointerDown);
board.addEventListener('pointermove',pointerMove);
board.addEventListener('pointerup',pointerUp);
board.addEventListener('pointercancel',pointerUp);
board.addEventListener('lostpointercapture',pointerUp);
board.addEventListener('keydown',e=>{
 const el=e.target.closest('.toy-shape');if(!el)return;
 const s=shapes.find(o=>String(o.id)===el.dataset.shapeId);if(!s)return;
 const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Delete','Backspace'];
 if(!keys.includes(e.key))return;
 e.preventDefault();select(s);
 const step=e.shiftKey?18:7,d=dimensions();
 if(e.key==='Delete'||e.key==='Backspace'){remove();return}
 if(e.key==='+'||e.key==='='||e.key==='-'){
  const next=clamp(s.w+(e.key==='-'?-step:step),43,Math.min(194,d.w-14));
  s.w=next;s.h=aspect(s.type,next);
 }else{
  if(e.key==='ArrowLeft')s.x-=step;
  if(e.key==='ArrowRight')s.x+=step;
  if(e.key==='ArrowUp')s.y-=step;
  if(e.key==='ArrowDown')s.y+=step;
 }
 s.x=clamp(s.x,0,d.w-s.w);s.y=clamp(s.y,0,floor()-s.h);
 s.vy=0;paint(s);saveSoon();updateScore();
});
for(const button of document.querySelectorAll('[data-add-shape]')){
 button.addEventListener('click',()=>create(button.dataset.addShape));
}
surprise.addEventListener('click',()=>{
 const kind=TYPES[Math.floor(random()*TYPES.length)];
 create(kind);note('Surprise! Try landing this '+kind+' on your tower.');
});
resetButton.addEventListener('click',newPile);
removeButton.addEventListener('click',remove);
function towerScore(){
 const memo=new Map(),visiting=new Set();
 const stackDepth=s=>{
  if(memo.has(s.id))return memo.get(s.id);
  if(visiting.has(s.id))return 1;
  visiting.add(s.id);
  const b=s.support;
  const depth=1+(b&&b!==s?stackDepth(b):0);
  visiting.delete(s.id);memo.set(s.id,depth);return depth;
 };
 let max=0;
 for(const s of shapes){
  if(!s.resting)continue;
  const score=stackDepth(s);
  if(score>max)max=score;
 }
 return max;
}
function updateScore(){
 const count=towerScore();
 highest=Math.max(highest,count);
 if(highest>best){
  best=highest;
  try{localStorage.setItem(BEST,String(best))}catch(_){}
 }
 if(count>=goal){
  goal+=goal<5?2:3;
  celebrate.textContent='✦ Stack complete! Next star: '+goal+' ✦';
  celebrate.hidden=false;
  celebrate.classList.add('celebrate');
  clearTimeout(winTimer);
  winTimer=setTimeout(()=>{
    celebrate.classList.remove('celebrate');
    setTimeout(()=>{if(!celebrate.classList.contains('celebrate'))celebrate.hidden=true;},350);
  },1900);
  note('You reached the star! Keep stacking to '+goal+' blocks.');
 }
 progress.textContent='Tower '+count+' / '+goal;
 fill.style.width=Math.min(100,count/goal*100)+'%';
 bestLabel.textContent='Best '+best;
 board.dataset.tower=String(count);board.dataset.goal=String(goal);
}
function physics(now){
 if(!t0)t0=now;
 const dt=clamp((now-t0)/16.7,.25,2);t0=now;
 if(!document.hidden){
  // Sort bottom first so supporting blocks settle before blocks above them.
  const ordered=[...shapes].sort((a,b)=>b.y-a.y);
  for(const s of ordered){
   if(held?.id===s.id)continue;
   const prev=s.y,wasResting=s.resting,wasSupport=s.support;
   s.vy=clamp(s.vy+.65*dt,-5,14);
   const support=supports(s);
   const next=s.y+s.vy*dt;
   if(next>=support.limit-.15){
    s.y=support.limit;
    s.vy=0;
    s.resting=true;s.support=support.other;
   }else{
    s.y=Math.min(next,floor()-s.h);
    s.resting=false;s.support=null;
   }
   if(Math.abs(prev-s.y)>.05||wasResting!==s.resting||wasSupport!==s.support)paint(s);
  }
 }
 if(++frames%9===0)updateScore();
 requestAnimationFrame(physics);
}
function resize(){
 positionFloor();const d=dimensions();
 for(const s of shapes){
  s.w=Math.min(s.w,d.w-12);s.h=aspect(s.type,s.w);
  s.x=clamp(s.x,0,Math.max(0,d.w-s.w));
  s.y=clamp(s.y,0,Math.max(0,floor()-s.h));
  paint(s);
 }
}
window.addEventListener('resize',resize,{passive:true});
window.addEventListener('pagehide',save);
positionFloor();restore();requestAnimationFrame(physics);
})();
