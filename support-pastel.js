/* Chromatic Drift — decoration only, no accounts, tracking or payments.
   Tiny pointer parallax on desktop, never on touch or reduced-motion devices. */
(function(){
 'use strict';
 const scene=document.getElementById('dreamscape');
 if(!scene)return;
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 const pointer=window.matchMedia('(hover: hover) and (pointer: fine)');
 let frame=0,nextX=0,nextY=0;
 function render(){
   frame=0;
   if(motion.matches||!pointer.matches)return;
   scene.style.setProperty('--px',nextX.toFixed(1)+'px');
   scene.style.setProperty('--py',nextY.toFixed(1)+'px');
 }
 function move(event){
   if(motion.matches||!pointer.matches)return;
   nextX=((event.clientX/window.innerWidth)-.5)*15;
   nextY=((event.clientY/window.innerHeight)-.5)*15;
   if(!frame)frame=window.requestAnimationFrame(render);
 }
 window.addEventListener('pointermove',move,{passive:true});
 function reset(){
   if(frame)window.cancelAnimationFrame(frame);
   frame=0;nextX=0;nextY=0;
   scene.style.setProperty('--px','0px');
   scene.style.setProperty('--py','0px');
 }
 if(motion.addEventListener)motion.addEventListener('change',reset);
 if(pointer.addEventListener)pointer.addEventListener('change',reset);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)reset()});
})();
