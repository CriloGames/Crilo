/* Crilo shape playground — free, local, and separate from PayPal. */
(()=>{
'use strict';
const scene=document.getElementById('shapeCanvas'),status=document.getElementById('shapeStatus');
const addButtons=[...document.querySelectorAll('[data-add-shape]')];
const layerButtons=[...document.querySelectorAll('[data-depth-layer]')];
const gravityButton=document.getElementById('shapeGravity');
const resetButton=document.getElementById('shapeReset');
const deleteButton=document.getElementById('shapeDelete');
if(!scene||!status||!gravityButton||!resetButton||!deleteButton)return;
const TYPES=['cube','slab','cylinder','sphere','prism','arch'];
const COLORS=[
  ['#F7B6C8','#D9899F','#FFE1E9'],['#A9DAF0','#76B1CF','#D8F1FF'],
  ['#F9DB91','#D9B768','#FFF0C4'],['#B5E4C5','#83BB99','#DBF6E2'],
  ['#D0BDF3','#A48BC8','#EEE1FF'],['#FFBEA0','#D79679','#FFE0CC']
];
const KEY='crilo:shape-playground:v1',LIMIT=46;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
let shapes=[],nextId=1,selectedId=null,layer=1,gravity=true,held=null,frame=0,last=0,active=false,saver=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const size=()=>({w:scene.clientWidth||375,h:scene.clientHeight||700});
const announce=text=>{status.textContent=text};
function paint(s){
 const node=s.node;if(!node)return;
 node.style.left=s.x+'px';node.style.top=s.y+'px';
 node.style.width=s.w+'px';node.style.height=s.h+'px';
 node.style.setProperty('--depth',Math.max(7,Math.min(21,s.w*.17)).toFixed(1)+'px');
 node.style.zIndex=String(10+s.layer*100+(s.id===selectedId?60:0));
 node.dataset.layer=String(s.layer);
 node.classList.toggle('selected',s.id===selectedId);
 node.classList.toggle('held',held?.id===s.id);
 node.setAttribute('aria-label',s.type+' on depth layer '+s.layer+', resize using the corner handles or arrow keys');
}
function draw(s){
 const el=document.createElement('div');
 el.className='toy-shape type-'+s.type;
 el.dataset.shapeId=String(s.id);
 el.tabIndex=0;el.setAttribute('role','group');
 el.innerHTML='<div class="toy-shadow"></div><div class="toy-object"><span class="toy-top"></span><span class="toy-side"></span><span class="toy-front"></span><span class="toy-glint"></span></div>';
 ['nw','ne','sw','se'].forEach(corner=>{
  const handle=document.createElement('span');handle.className='toy-handle at-'+corner;
  handle.dataset.resize=corner;handle.setAttribute('aria-hidden','true');el.appendChild(handle);
 });
 const color=COLORS[(s.id-1)%COLORS.length];
 el.style.setProperty('--face',color[0]);el.style.setProperty('--side',color[1]);el.style.setProperty('--top',color[2]);
 scene.appendChild(el);s.node=el;paint(s);
}
function select(s){
 selectedId=s?.id??null;
 if(s)layer=s.layer;
 layerButtons.forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.depthLayer)===layer)));
 for(const obj of shapes)paint(obj);
 deleteButton.disabled=!s;
}
function add(type,options={}){
 if(shapes.length>=LIMIT){announce('Shape limit reached. Remove one to make room.');return null;}
 const dims=size(),w=options.w|| (type==='slab'?115:type==='sphere'?74:88);
 const h=options.h||(type==='slab'?58:type==='prism'?100:type==='arch'?104:80);
 const index=shapes.length,seedX=(index*71+23) % Math.max(120,dims.w-120);
 const toolbarBottom=document.querySelector('.shape-toolbar')?.getBoundingClientRect().bottom||130;
 const sceneTop=scene.getBoundingClientRect().top;
 const visibleTop=Math.max(150,toolbarBottom-sceneTop+24);
 const tipBottom=document.querySelector('.tip-card')?.getBoundingClientRect().bottom||0;
 const dropTop=dims.w<640?Math.max(visibleTop,tipBottom-sceneTop+25):visibleTop;
 const s={id:nextId++,type:TYPES.includes(type)?type:'cube',
   x:clamp(options.x??(index%2===0?16+seedX*.32:dims.w-w-17-seedX*.12),0,Math.max(0,dims.w-w)),
   y:clamp(options.y??(dropTop+index%3*12),0,Math.max(0,dims.h-h)),
   w,h,layer:options.layer??layer,vx:0,vy:0,node:null};
 shapes.push(s);draw(s);select(s);announce(s.type+' added. Drag to move; resize using a corner.');saveLater();return s;
}
function remove(){
 const s=shapes.find(x=>x.id===selectedId);if(!s)return;
 s.node.remove();shapes=shapes.filter(x=>x!==s);select(null);
 announce('Shape removed.');saveLater();
}
function snapshot(){
 const dims=size();
 return shapes.map(s=>({type:s.type,layer:s.layer,x:s.x/dims.w,y:s.y/dims.h,w:s.w,h:s.h}));
}
function saveLater(){clearTimeout(saver);saver=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(snapshot()))}catch(_){}},300)}
function seed(){
 const dims=size(),data=[
  ['cube',.05,.20,86,86,1],['slab',.13,.06,115,55,2],['sphere',.77,.20,82,82,3],
  ['arch',.80,.04,75,96,1],['cylinder',.04,.53,76,96,2],['prism',.81,.54,86,90,2],
  ['cube',.25,.12,75,75,3],['slab',.60,.11,115,55,1],
  ['sphere',.21,.35,76,76,2],['cube',.69,.35,78,78,1],
  ['prism',.12,.04,76,78,3],['cylinder',.66,.02,78,95,2]
 ];
 for(const item of data){
  const [type,x,y,w,h,z]=item;
  add(type,{x:Math.min(dims.w-w,x*dims.w),
   y:Math.max(155,y*dims.h),w,h,layer:z});
 }
 select(null);
}
function reset(){
 for(const s of shapes)s.node?.remove();
 shapes=[];nextId=1;select(null);
 seed();announce('Fresh pile! Pick a shape from the top bar.');saveLater();
}
function restore(){
 let data=null;
 try{data=JSON.parse(localStorage.getItem(KEY)||'null')}catch(_){}
 const dims=size();
 if(!Array.isArray(data)||!data.length||data.length>LIMIT){seed();return;}
 for(const o of data){
  if(!TYPES.includes(o.type))continue;
  const w=clamp(Number(o.w)||80,38,210),h=clamp(Number(o.h)||80,38,210);
  add(o.type,{x:clamp(Number(o.x)*dims.w||0,0,dims.w-w),
   y:clamp(Number(o.y)*dims.h||0,0,dims.h-h),w,h,layer:clamp(Number(o.layer)||1,1,3)});
 }
 select(null);
}
function position(e){const r=scene.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
function down(e){
 const el=e.target.closest('.toy-shape');if(!el)return;
 const s=shapes.find(obj=>String(obj.id)===el.dataset.shapeId);if(!s)return;
 e.preventDefault();select(s);
 const corner=e.target.closest('[data-resize]')?.dataset.resize||null;
 const p=position(e);
 held={id:s.id,corner,p0:p,x:s.x,y:s.y,w:s.w,h:s.h};
 s.vx=0;s.vy=0;active=true;
 el.setPointerCapture(e.pointerId);paint(s);
}
function move(e){
 if(!held)return;
 const s=shapes.find(x=>x.id===held.id);if(!s)return;
 e.preventDefault();
 const p=position(e),dx=p.x-held.p0.x,dy=p.y-held.p0.y,dims=size();
 if(held.corner){
  const c=held.corner;
  const right=c.includes('e'),bottom=c.includes('s');
  const dw=right?dx:-dx,dh=bottom?dy:-dy;
  const maxW=right?dims.w-held.x:held.x+held.w;
  const maxH=bottom?dims.h-held.y:held.y+held.h;
  const w=clamp(held.w+dw,38,Math.max(38,Math.min(230,maxW)));
  const h=clamp(held.h+dh,38,Math.max(38,Math.min(230,maxH)));
  s.x=right?held.x:held.x+held.w-w;
  s.y=bottom?held.y:held.y+held.h-h;
  s.w=w;s.h=h;
 }else{
  const nx=clamp(held.x+dx,0,Math.max(0,dims.w-s.w));
  const ny=clamp(held.y+dy,0,Math.max(0,dims.h-s.h));
  s.vx=clamp((nx-s.x)*.38,-7,7);s.vy=clamp((ny-s.y)*.28,-7,7);
  s.x=nx;s.y=ny;
 }
 paint(s);
}
function up(){
 if(!held)return;
 const s=shapes.find(x=>x.id===held.id);
 held=null;active=false;
 if(s){s.vy=0;paint(s);}
 saveLater();
}
scene.addEventListener('pointerdown',down);
scene.addEventListener('pointermove',move);
scene.addEventListener('pointerup',up);
scene.addEventListener('pointercancel',up);
scene.addEventListener('lostpointercapture',up);
scene.addEventListener('keydown',e=>{
 const el=e.target.closest('.toy-shape');if(!el)return;
 const s=shapes.find(x=>String(x.id)===el.dataset.shapeId);if(!s)return;
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Delete','Backspace'].includes(e.key))e.preventDefault();
 select(s);
 const dims=size(),step=e.shiftKey?20:8;
 if(e.key==='ArrowLeft')s.x-=step;
 else if(e.key==='ArrowRight')s.x+=step;
 else if(e.key==='ArrowUp')s.y-=step;
 else if(e.key==='ArrowDown')s.y+=step;
 else if(e.key==='+'||e.key==='='){s.w+=step;s.h+=step;}
 else if(e.key==='-'){s.w-=step;s.h-=step;}
 else if(e.key==='Delete'||e.key==='Backspace'){remove();return;}
 else return;
 s.w=clamp(s.w,38,230);s.h=clamp(s.h,38,230);
 s.x=clamp(s.x,0,Math.max(0,dims.w-s.w));s.y=clamp(s.y,0,Math.max(0,dims.h-s.h));
 s.vx=s.vy=0;paint(s);saveLater();
});
for(const button of addButtons)button.addEventListener('click',()=>add(button.dataset.addShape));
for(const button of layerButtons)button.addEventListener('click',()=>{
 layer=Number(button.dataset.depthLayer);
 const s=shapes.find(x=>x.id===selectedId);
 if(s){s.layer=layer;paint(s);}
 layerButtons.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.depthLayer)===layer)));
 announce('Depth layer '+layer+' selected. '+(s?'Selected shape moved to this layer.':'New shapes will use this layer.'));
 saveLater();
});
gravityButton.addEventListener('click',()=>{
 gravity=!gravity;
 gravityButton.setAttribute('aria-pressed',String(gravity));
 gravityButton.textContent=gravity?'Gravity on':'Gravity off';
 announce(gravity?'Gravity enabled. Drop a block to watch it fall.':'Gravity paused. Shapes stay where you place them.');
});
resetButton.addEventListener('click',reset);
deleteButton.addEventListener('click',remove);
function tick(t){
 if(!last)last=t;
 const dt=clamp((t-last)/16.67,.3,2);last=t;
 if(gravity&&!document.hidden){
  const dims=size();
  const objects=[...shapes].sort((a,b)=>b.y-a.y);
  for(const s of objects){
   if(held?.id===s.id)continue;
   s.vy=clamp(s.vy+.52*dt,-20,13);
   let nextY=s.y+s.vy*dt;
   let resting=dims.h-s.h;
   // Contact surfaces on the same Z layer: falling objects stack on other blocks.
   for(const other of objects){
    if(s===other||s.layer!==other.layer||held?.id===other.id)continue;
    const overlap=Math.min(s.x+s.w,other.x+other.w)-Math.max(s.x,other.x);
    if(overlap<Math.min(s.w,other.w)*.32)continue;
    const support=other.y-s.h;
    if(other.y<=s.y+7||support<0)continue;
    if(s.y+s.h<=other.y+5&&nextY>=support-1)resting=Math.min(resting,support);
   }
   if(nextY>=resting){
    nextY=resting;s.vy=s.vy>2?-s.vy*.14:0;
    if(Math.abs(s.vy)<.5)s.vy=0;
   }
   if(Math.abs(nextY-s.y)>.08){s.y=nextY;paint(s);}
  }
 }
 frame=requestAnimationFrame(tick);
}
function resized(){
 const dims=size();
 for(const s of shapes){
  s.x=clamp(s.x,0,Math.max(0,dims.w-s.w));
  s.y=clamp(s.y,0,Math.max(0,dims.h-s.h));paint(s);
 }
}
window.addEventListener('resize',resized,{passive:true});
window.addEventListener('pagehide',()=>{try{localStorage.setItem(KEY,JSON.stringify(snapshot()))}catch(_){}});
restore();
frame=requestAnimationFrame(tick);
})();
