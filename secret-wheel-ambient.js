/* A scattered constellation of complete little wheels.
 * Never crop half a wheel: find actual whitespace or omit that decoration.
 * Positions are stable and each wheel moves/fades on a different schedule.
 * The playable Green Needle is independent of this decorative layer. */
(()=>{
'use strict';
const prefix=location.pathname.startsWith('/domain/')?'../':'';
const glyph='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.55" aria-hidden="true"><circle cx="16" cy="16" r="13"/><path d="M16 3v26M3 16h26M7 7l18 18M25 7 7 25"/><circle cx="16" cy="16" r="2" fill="currentColor"/></svg>';
const protectedSelectors=[
 'header','footer','h1','h2','h3','h4','h5','h6','p','a','button',
 'input','textarea','select','canvas','img','svg','label','blockquote',
 '[role="progressbar"]','.profile-card','.settings-card','.game-card',
 '.duck-collection-card','.duck-progress','.leader-row','.best-card',
 '.leader-panel','.draw-panel','.wheel-stage','.stats','.result',
 '.friend-card','.support-card','.sound-stage','.shape-playground',
 '.collection-tile','.badge-top-chip','.modal-card','.featured-badges'
].join(',');
function boot(){
 if(document.querySelector('#criloAmbientWheels'))return;
 const link=document.createElement('link');link.rel='stylesheet';
 link.href=prefix+'secret-wheel-ambient.css?v=3';document.head.append(link);
 const layer=document.createElement('div');layer.id='criloAmbientWheels';
 layer.setAttribute('aria-hidden','true');document.body.append(layer);
 const nodes=[];
 for(let i=0;i<36;i++){
  const wheel=document.createElement('span');
  wheel.className='crilo-tiny-wheel crilo-fake-wheel';
  wheel.setAttribute('aria-hidden','true');wheel.hidden=true;
  wheel.innerHTML=glyph;layer.append(wheel);
  nodes.push({el:wheel,visible:false,x:0,y:0,size:0,pending:null,version:0});
 }
 let scheduled=false,lastSignature='',layoutCount=0;
 function blockers(height){
  const set=new Set(document.querySelectorAll(protectedSelectors));
  // Text-only fragments are often larger than their enclosing visible glyphs.
  for(const el of document.querySelectorAll('main div,main span,main small,main strong,main b,main em')){
   if(el.childElementCount===0&&el.textContent.trim())set.add(el);
  }
  const list=[];
  for(const el of set){
   if(layer.contains(el)||el.closest('#criloAmbientWheels'))continue;
   if(el.closest('[hidden],.hidden,[aria-hidden="true"]'))continue;
   const style=getComputedStyle(el);
   if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)continue;
   const rect=el.getBoundingClientRect();
   if(rect.width<3||rect.height<3)continue;
   const x=rect.left+scrollX,y=rect.top+scrollY;
   if(y>height||y+rect.height<0)continue;
   const pad=8; // also protects the floating-animation travel distance
   list.push({l:x-pad,r:x+rect.width+pad,t:y-pad,b:y+rect.height+pad});
  }
  return list;
 }
 function unobstructed(x,y,size,blocks){
  // Whole glyphs only. Do NOT clip-path through a number or through blank air.
  for(const b of blocks)if(x<b.r&&x+size>b.l&&y<b.b&&y+size>b.t)return false;
  return true;
 }
 function setWheel(node,loc,index,rand){
  const el=node.el;node.version++;const version=node.version;
  if(node.pending!==null){clearTimeout(node.pending);node.pending=null}
  if(!loc){el.classList.remove('is-visible');node.visible=false;return}
  const previous={x:node.x,y:node.y};
  const reveal=()=>{
   if(node.version!==version)return;
   node.x=loc.x;node.y=loc.y;node.size=loc.size;
   el.style.left=loc.x+'px';el.style.top=loc.y+'px';
   el.style.width=loc.size+'px';el.style.height=loc.size+'px';
   el.style.rotate=loc.angle+'deg';
   el.style.setProperty('--wheel-opacity',loc.opacity.toFixed(3));
   el.style.setProperty('--wheel-delay',(index%7*73+Math.floor(rand()*49))+'ms');
   el.style.setProperty('--wheel-speed',(860+(index*131)%560)+'ms');
   el.style.setProperty('--float-speed',(6.4+(index*37)%41/10).toFixed(1)+'s');
   el.style.setProperty('--float-offset',(-index*0.83)+'s');
   el.hidden=false;
   // Force the initial transparent style to exist before fading each wheel in.
   void el.offsetWidth;
   requestAnimationFrame(()=>{if(node.version===version)el.classList.add('is-visible')});
   node.visible=true;
  };
  // Long crossings could drift behind artwork. Fade first, then gently
  // reposition, instead of dragging a wheel across a block of text.
  if(node.visible&&Math.hypot(previous.x-loc.x,previous.y-loc.y)>65){
   el.classList.remove('is-visible');
   node.pending=setTimeout(()=>{node.pending=null;reveal()},240+(index%6)*90);
  }else reveal();
 }
 function layout(){
  scheduled=false;
  const width=Math.max(280,innerWidth);
  const height=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight,650);
  layer.style.height=height+'px';
  const signature=location.pathname+':'+Math.round(width)+':'+Math.round(height/40);
  const blocks=blockers(height);
  // The same viewport and page should not reroll decorations on every
  // asynchronous update to the score, ducks, or leaderboard.
  if(signature===lastSignature&&layoutCount>0&&layoutCount%5!==0){
   layoutCount++;return;
  }
  lastSignature=signature;layoutCount++;
  let seed=0x1d7e74a2;
  for(let i=0;i<signature.length;i++)seed=Math.imul(seed^signature.charCodeAt(i),16777619);
  const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296};
  const mobile=width<650,top=110,bottom=48;
  const count=Math.min(nodes.length,Math.max(mobile?11:15,Math.round(height/(mobile?128:116))));
  const space=Math.max(1,height-top-bottom),placed=[];
  let n=0;
  for(let i=0;i<count;i++){
   const yBand=top+(i+.15+rand()*.7)*space/count;
   let candidate=null;
   for(let attempt=0;attempt<140;attempt++){
    const size=mobile?11+Math.floor(rand()*13):14+Math.floor(rand()*19);
    const col=(i*5+attempt*4)%11;
    const x=Math.round(12+(width-size-24)*(col+.2+rand()*.6)/11);
    const yRaw=attempt<60?yBand+(rand()-.5)*Math.min(200,space/count*1.35)
       :top+rand()*Math.max(1,space-size);
    const y=Math.round(Math.max(top,Math.min(height-bottom-size,yRaw)));
    if(!unobstructed(x,y,size,blocks))continue;
    if(placed.some(p=>Math.abs(p.x-x)<(p.size+size)*.73&&
       Math.abs(p.y-y)<(p.size+size)*1.22))continue;
    candidate={x,y,size,angle:-74+Math.round(rand()*148),
      opacity:.055+rand()*.10};break;
   }
   if(candidate){
    placed.push(candidate);
    setWheel(nodes[n],candidate,n,rand);n++;
   }
  }
  for(let i=n;i<nodes.length;i++)if(nodes[i].visible)setWheel(nodes[i],null,i,rand);
 }
 function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(layout)}
 schedule();
 window.addEventListener('load',schedule,{once:true});
 window.addEventListener('resize',schedule,{passive:true});
 window.addEventListener('crilo-auth-ready',schedule);
 if(window.ResizeObserver){
  const main=document.querySelector('main');
  if(main)new ResizeObserver(schedule).observe(main);
 }
 const main=document.querySelector('main');
 if(main)new MutationObserver(schedule).observe(main,{childList:true,subtree:true});
 window.CriloAmbientWheels={refresh:()=>{lastSignature='';schedule()}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();