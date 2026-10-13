/* Tiny wheel discoveries: scattered across actual empty space, not a border grid.
 * Foreground text/cards always win. If a wheel straddles content, clip away the
 * covered part; if too little remains, do not draw it. All decoys are inert.
 * The only playable Green Needle stays anchored beside More Games on Play. */
(()=>{
 'use strict';
 const prefix=location.pathname.startsWith('/domain/')?'../':'';
 const svg='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.55" aria-hidden="true"><circle cx="16" cy="16" r="13"/><path d="M16 3v26M3 16h26M7 7l18 18M25 7 7 25"/><circle cx="16" cy="16" r="2" fill="currentColor"/></svg>';
 const blockerSelectors=[
  'header','footer','h1','h2','h3','h4','h5','h6','p','a','button',
  'input','textarea','select','canvas','img','svg','label','blockquote',
  '[role="progressbar"]','.profile-card','.settings-card','.game-card',
  '.duck-collection-card','.duck-progress','.leader-row','.best-card',
  '.leader-panel','.draw-panel','.wheel-stage','.stats','.result',
  '.friend-card','.support-card','.sound-stage','.shape-playground',
  '.collection-tile','.badge-top-chip','.modal-card','.featured-badges'
 ].join(',');
 function boot(){
  if(document.getElementById('criloAmbientWheels'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href=prefix+'secret-wheel-ambient.css?v=2';
  document.head.append(link);
  const layer=document.createElement('div');
  layer.id='criloAmbientWheels';layer.setAttribute('aria-hidden','true');
  document.body.append(layer);
  // The playable wheel is NOT moved into the decorative overlay; its location
  // is permanent and discoverable in the More Games heading whitespace.
  const nodes=[];
  for(let i=0;i<36;i++){
   const wheel=document.createElement('span');
   wheel.className='crilo-tiny-wheel crilo-fake-wheel';wheel.setAttribute('aria-hidden','true');
   wheel.innerHTML=svg;wheel.hidden=true;layer.append(wheel);nodes.push(wheel);
  }
  let scheduled=false,lastW=0,lastH=0,layoutPass=0;
  function obstacles(){
   const targets=new Set(document.querySelectorAll(blockerSelectors));
   // Plain text in leaf divs/spans is also protected (including live notices).
   for(const el of document.querySelectorAll('main div,main span,main small,main strong,main b,main em')){
    if(el.childElementCount===0 && el.textContent.trim())targets.add(el);
   }
   const list=[];
   for(const el of targets){
    if(layer.contains(el)||el.closest('#criloAmbientWheels'))continue;
    if(el.closest('[hidden],.hidden,[aria-hidden="true"]'))continue;
    const box=el.getBoundingClientRect();
    if(box.width<4||box.height<4)continue;
    if(box.bottom<0||box.top>Math.max(document.body.scrollHeight,document.documentElement.scrollHeight))continue;
    const style=getComputedStyle(el);
    if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)continue;
    const x=box.left+scrollX,y=box.top+scrollY;
    list.push({l:x-3,r:x+box.width+3,t:y-3,b:y+box.height+3});
   }
   return list.sort((a,b)=>a.t-b.t);
  }
  function collision(x,y,s,blocks){
   const hit=blocks.filter(b=>b.l<x+s&&b.r>x&&b.t<y+s&&b.b>y);
   if(!hit.length)return {top:0,right:0,bottom:0,left:0,area:1};
   // Crop from an edge rather than letting artwork show through text/cards.
   let crop={top:0,right:0,bottom:0,left:0};
   for(const b of hit){
    const l=x+crop.left,r=x+s-crop.right,t=y+crop.top,bot=y+s-crop.bottom;
    if(b.l>=r||b.r<=l||b.t>=bot||b.b<=t)continue;
    const options=[
     {...crop,left:Math.max(crop.left,b.r-x)},
     {...crop,right:Math.max(crop.right,x+s-b.l)},
     {...crop,top:Math.max(crop.top,b.b-y)},
     {...crop,bottom:Math.max(crop.bottom,y+s-b.t)}
    ].map(c=>({...c,area:Math.max(0,s-c.left-c.right)*Math.max(0,s-c.top-c.bottom)/(s*s)}))
     .filter(c=>c.area>=.47);
    if(!options.length)return null;
    options.sort((a,b)=>b.area-a.area);
    crop=options[0];
   }
   // A partial crop must leave no visible pixels over protected content.
   const l=x+crop.left,r=x+s-crop.right,t=y+crop.top,bot=y+s-crop.bottom;
   if(blocks.some(b=>b.l<r&&b.r>l&&b.t<bot&&b.b>t))return null;
   return {...crop,area:Math.max(0,r-l)*Math.max(0,bot-t)/(s*s)};
  }
  function layout(){
   scheduled=false;
   const vw=innerWidth;
   const height=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight,650);
   lastW=vw;lastH=height;layer.style.height=height+'px';
   let seed=0x1d7e74a2;
   const text=location.pathname+'|'+Math.round(vw/64)+'|'+Math.round(height/100);
   for(let i=0;i<text.length;i++)seed=Math.imul(seed^text.charCodeAt(i),16777619);
   function rand(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296}
   const mobile=vw<650,top=125,bottom=55;
   const count=Math.min(nodes.length,Math.max(mobile?10:14,Math.round(height/(mobile?133:123))));
   const bands=Math.max(1,height-top-bottom);
   const blocks=obstacles();
   const placed=[];
   for(const node of nodes)node.hidden=true;
   let active=0;
   for(let i=0;i<count;i++){
    const yCenter=top+(i+.10+rand()*.82)*bands/count;
    let found=null;
    // Disperse attempts across the whole width. Most positions are not at
    // the margins, and a failed placement is simply left invisible.
    for(let attempt=0;attempt<75;attempt++){
     const s=mobile?13+Math.floor(rand()*13):14+Math.floor(rand()*19);
     const wide=Math.max(1,vw-s-12);
     const column=(i*5+attempt*3)%9;
     const center=(column+.32+rand()*.36)/9;
     const x=Math.round(6+wide*center);
     const y=Math.round(Math.max(top,Math.min(height-bottom-s,yCenter+(rand()-.5)*Math.min(140,bands/count))));
     const crop=collision(x,y,s,blocks);
     if(!crop||crop.area<.54)continue;
     if(placed.some(p=>Math.abs(p.x-x)<(p.s+s)*.75&&Math.abs(p.y-y)<(p.s+s)*1.25))continue;
     found={x,y,s,crop};break;
    }
    if(!found)continue;
    const {x,y,s,crop}=found;
    const el=nodes[active++];
    el.style.left=x+'px';el.style.top=y+'px';
    el.style.width=s+'px';el.style.height=s+'px';
    el.style.opacity=(.055+rand()*.10).toFixed(3);
    el.style.rotate=Math.round(-78+rand()*156)+'deg';
    el.style.clipPath='inset('+[crop.top,crop.right,crop.bottom,crop.left].map(n=>Math.max(0,Math.ceil(n))+'px').join(' ')+')';
    el.hidden=false;placed.push(found);
   }
  }
  function schedule(){
   if(scheduled)return;scheduled=true;
   requestAnimationFrame(layout);
  }
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
  window.CriloAmbientWheels={refresh:schedule};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
})();