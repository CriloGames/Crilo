/* Secret, low-contrast wheels: scattered, varied, nonuniform and decorative.
 * Exactly one can open the actual wheel, on the main Play page.
 * Decorative wheels have no pointer events or accessibility focus targets. */
(()=>{
 'use strict';
 function boot(){
  if(document.querySelector('#criloAmbientWheels'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href=(location.pathname.startsWith('/domain/')?'../':'')+'secret-wheel-ambient.css?v=1';document.head.append(link);
  const layer=document.createElement('div');layer.id='criloAmbientWheels';
  document.body.append(layer);
  const real=document.getElementById('secretWheelEntry');
  const svg='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.55" aria-hidden="true"><circle cx="16" cy="16" r="13"/><path d="M16 3v26M3 16h26M7 7l18 18M25 7 7 25"/><circle cx="16" cy="16" r="2" fill="currentColor"/></svg>';
  if(real){real.classList.add('crilo-tiny-wheel','crilo-real-wheel');real.title='';real.setAttribute('aria-label','Open the hidden wheel');real.innerHTML=svg;layer.append(real);}
  const wheels=[];for(let i=0;i<18;i++){
   const el=document.createElement('span');el.className='crilo-tiny-wheel crilo-fake-wheel';
   el.innerHTML=svg;el.setAttribute('aria-hidden','true');layer.append(el);wheels.push(el);
  }
  let lastHeight=0,lastWidth=0;
  function scatter(){
   const vw=window.innerWidth,ht=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight,650);
   if(ht===lastHeight&&vw===lastWidth)return;
   lastHeight=ht;lastWidth=vw;
   layer.style.height=ht+'px';
   let seed=2166136261;
   const path=location.pathname||'/';
   for(let i=0;i<path.length;i++)seed=Math.imul(seed^path.charCodeAt(i),16777619);
   function rand(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296}
   const mobile=vw<650;
   const count=mobile?Math.max(8,Math.min(13,Math.ceil(ht/220))):Math.max(11,Math.min(18,Math.ceil(ht/175)));
   const top=145,bottom=75,span=Math.max(250,ht-top-bottom);
   const activeBand=Math.min(count-2,Math.max(1,Math.floor(count*.57)));
   const nodes=real?[...wheels.slice(0,count-1),real]:wheels.slice(0,count);
   const ordered=nodes.map((node,i)=>({node,band:i}));
   if(real){const k=ordered.findIndex(it=>it.node===real);const swap=ordered[activeBand].node;ordered[activeBand].node=real;ordered[k].node=swap;}
   wheels.forEach(node=>{node.hidden=true});
   for(const {node,band} of ordered){
    const y=top+(band+.22+rand()*.55)*span/count;
    const side=(band%2===0)?'left':'right';
    const edge=mobile?2+rand()*9:8+rand()*Math.min(55,Math.max(18,(vw-1020)/2));
    const size=mobile?11+rand()*9:13+rand()*17;
    const left=side==='left'?edge:vw-edge-size;
    node.hidden=false;node.style.top=Math.round(y)+'px';
    node.style.left=Math.round(Math.max(1,left))+'px';
    node.style.width=Math.round(size)+'px';node.style.height=Math.round(size)+'px';
    node.style.opacity=(.035+rand()*.075).toFixed(3);
    node.style.rotate=Math.round(-75+rand()*150)+'deg';
   }
  }
  scatter();
  window.addEventListener('resize',()=>{lastWidth=0;scatter()},{passive:true});
  window.addEventListener('load',()=>{lastHeight=0;scatter()},{once:true});
  if(window.ResizeObserver){
   const observer=new ResizeObserver(()=>{const h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);if(Math.abs(h-lastHeight)>65)scatter()});
   const main=document.querySelector('main');if(main)observer.observe(main);
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();