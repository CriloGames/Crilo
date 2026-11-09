/* Optional Nothing Here fullscreen, including inventory and puzzle dialogs.
 * Request fullscreen from a user gesture; iOS/browser-restricted engines
 * receive a reversible full-viewport layout instead of a dead button.
 */
(()=>{
 "use strict";
 const button=document.getElementById("ncFullscreenToggle");
 const body=document.body;
 if(!button||!body)return;
 const label=button.querySelector(".nc-fullscreen-label");
 let savedScrollY=0;
 const nativeActive=()=>document.fullscreenElement===body||
  document.webkitFullscreenElement===body;
 const fallbackActive=()=>body.classList.contains("nc-pseudo-fullscreen");
 const active=()=>nativeActive()||fallbackActive();
 function sync(){
  const on=active();
  button.setAttribute("aria-pressed",String(on));
  button.setAttribute("aria-label",on?
   "Exit Nothing Here fullscreen":"Play Nothing Here in fullscreen");
  button.title=on?"Exit fullscreen (Esc)":"Play in fullscreen";
  if(label)label.textContent=on?"Exit fullscreen":"Fullscreen";
  // The physical renderer observes #stage size and resizes its camera.
  // This event also gives non-Three.js responsive controls a chance to
  // refresh after the browser finishes its fullscreen transition.
  requestAnimationFrame(()=>window.dispatchEvent(new Event("resize")));
 }
 function useFallback(){
  if(fallbackActive())return;
  savedScrollY=window.scrollY;
  body.classList.add("nc-pseudo-fullscreen");
  document.documentElement.classList.add("nc-pseudo-fullscreen-root");
  body.scrollTop=0;
  sync();
 }
 function clearFallback(){
  if(!fallbackActive())return;
  body.classList.remove("nc-pseudo-fullscreen");
  document.documentElement.classList.remove("nc-pseudo-fullscreen-root");
  window.scrollTo(0,savedScrollY);
  sync();
 }
 async function enter(){
  if(active())return;
  const request=body.requestFullscreen||body.webkitRequestFullscreen;
  if(typeof request==="function"&&document.fullscreenEnabled!==false){
   try{
    // Calling this directly from the click handler retains user activation.
    await request.call(body);
    sync();
    return;
   }catch(error){
    console.info("Nothing Here: native fullscreen unavailable; using viewport mode.",error);
   }
  }
  useFallback();
 }
 async function exit(){
  if(fallbackActive()){clearFallback();return;}
  if(!nativeActive())return;
  const end=document.exitFullscreen||document.webkitExitFullscreen;
  if(typeof end==="function"){
   try{await end.call(document);}
   catch(error){console.warn("Nothing Here could not exit native fullscreen.",error);}
  }
  sync();
 }
 button.addEventListener("click",()=>{
  if(active())void exit();else void enter();
 });
 document.addEventListener("fullscreenchange",sync);
 document.addEventListener("webkitfullscreenchange",sync);
 // Native fullscreen uses the browser's Escape key. In CSS fallback mode
 // it must be wired explicitly without intercepting other puzzle keys.
 document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&fallbackActive()){
   event.preventDefault();clearFallback();
  }
 });
 window.addEventListener("pagehide",clearFallback);
 sync();
})();
