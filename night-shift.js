/* Crilo Night Shift: a free, self-contained flashlight scene.
   No purchases, accounts, analytics or external requests from the game. */
(function(){
 'use strict';
 const root=document.getElementById('nightShift');
 const scene=document.getElementById('nightScene');
 const tip=document.querySelector('.sound-page > .support-card');
 const mount=document.getElementById('nightTipMount');
 if(!root||!scene||!mount||!tip)return;
 // Keep the one existing, tested PayPal checkout. Never clone or edit URLs.
 mount.appendChild(tip);
 tip.classList.add('sound-tipbar');
 const intro=tip.querySelector('.support-intro');
 if(intro)intro.textContent='Crilo stays free. If you want to help make more little games, tips are optional.';
 const checkout=tip.querySelector('#supportPayLink');
 if(checkout)checkout.textContent='Tip with PayPal ↗';
 document.querySelector('.sound-game-divider')?.remove();
 document.querySelector('.sound-support-label')?.remove();
 const status=document.getElementById('nightStatus');
 const progress=document.getElementById('nightProgress');
 const lights=document.getElementById('nightLights');
 const replay=document.getElementById('nightReplay');
 const soundButton=document.getElementById('nightSoundToggle');
 const clues=[...root.querySelectorAll('[data-night-clue]')];
 const symbols=[...root.querySelectorAll('[data-night-wheel]')];
 const solved=new Set();
 let soundOn=false,lit=false,context=null,scareTimer=0;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const announce=message=>{status.textContent=message};
 function tone(type){
   if(!soundOn)return;
   try{
     const AC=window.AudioContext||window.webkitAudioContext;
     if(!AC)return;
     context=context||new AC();
     if(context.state==='suspended')context.resume().catch(()=>{});
     const now=context.currentTime;
     const o=context.createOscillator(),v=context.createGain();
     const notes={find:[440,520,.16,.027],danger:[154,80,.26,.035],power:[392,784,.5,.036],click:[230,190,.07,.016]};
     const [start,end,duration,volume]=notes[type]||notes.click;
     o.type=type==='danger'?'triangle':'sine';
     o.frequency.setValueAtTime(start,now);
     o.frequency.exponentialRampToValueAtTime(end,now+duration);
     v.gain.setValueAtTime(.0001,now);
     v.gain.exponentialRampToValueAtTime(volume,now+.02);
     v.gain.exponentialRampToValueAtTime(.0001,now+duration);
     o.connect(v);v.connect(context.destination);o.start(now);o.stop(now+duration+.02);
     o.onended=()=>{o.disconnect();v.disconnect()};
   }catch(_){/* The scene remains playable without audio. */}
 }
 function point(event){
   if(lit)return;
   const rect=scene.getBoundingClientRect();
   const x=clamp((event.clientX-rect.left)/Math.max(1,rect.width)*100,2,98);
   const y=clamp((event.clientY-rect.top)/Math.max(1,rect.height)*100,3,97);
   scene.style.setProperty('--beam-x',x+'%');
   scene.style.setProperty('--beam-y',y+'%');
 }
 scene.addEventListener('pointermove',point);
 scene.addEventListener('pointerdown',point);
 scene.addEventListener('focusin',event=>{
   const btn=event.target.closest('button');
   if(!btn)return;
   const r=btn.getBoundingClientRect();
   point({clientX:r.left+r.width/2,clientY:r.top+r.height/2});
 });
 function flicker(){
   if(lit)return;
   root.classList.remove('is-spooked');
   void root.offsetWidth;
   root.classList.add('is-spooked');
   clearTimeout(scareTimer);
   scareTimer=setTimeout(()=>root.classList.remove('is-spooked'),850);
 }
 function update(){
   progress.textContent='CLUES '+solved.size+' / '+clues.length;
   root.classList.toggle('wheel-ready',solved.size===clues.length);
 }
 clues.forEach(button=>button.addEventListener('click',()=>{
   if(lit)return;
   const id=button.dataset.nightClue;
   if(solved.has(id)){
     announce(id==='duck'?'That duck was facing the other way a moment ago…':'The screen shows only six symbols. Five are skulls.');
     tone('click');return;
   }
   solved.add(id);button.classList.add('is-found');
   button.setAttribute('aria-pressed','true');
   tone('find');update();
   if(id==='duck'){
     flicker();
     announce('A tiny squeak. The prize duck has moved. '+solved.size+' of 2 clues found.');
   }else{
     announce('SECURITY FEED: Five skulls. One star. '+solved.size+' of 2 clues found.');
   }
   if(solved.size===clues.length)announce('Both clues found. Try the glowing star on the broken wheel.');
 }));
 symbols.forEach(button=>button.addEventListener('click',()=>{
   if(lit)return;
   if(button.dataset.nightWheel==='safe'){
     if(solved.size!==clues.length){
       announce('The star flickers, but the wheel needs two clues first.');
       tone('click');return;
     }
     tone('power');reveal(false);return;
   }
   flicker();tone('danger');
   announce('A hollow click. Nothing happens. The wheel shudders, then goes still.');
 }));
 function reveal(skipped){
   if(lit)return;
   lit=true;root.classList.add('is-lit');root.classList.remove('is-spooked');
   mount.hidden=false;replay.hidden=false;
   lights.textContent='Lights are on ✓';
   lights.disabled=true;
   announce(skipped?'Lights on. The optional tip station is ready — no searching required.':'Power restored. The duck room is safe now. Optional tips are below.');
   progress.textContent='LIGHTS ON';
 }
 lights.addEventListener('click',()=>{tone('power');reveal(true)});
 replay.addEventListener('click',()=>{
   lit=false;solved.clear();
   clues.forEach(button=>{button.classList.remove('is-found');button.setAttribute('aria-pressed','false')});
   root.classList.remove('is-lit','is-spooked');
   mount.hidden=true;replay.hidden=true;lights.disabled=false;
   lights.textContent='Turn on lights · See tips';
   scene.style.setProperty('--beam-x','50%');scene.style.setProperty('--beam-y','52%');
   update();announce('Night shift restarted. Find the duck and monitor, then try the star.');
   root.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 });
 soundButton.addEventListener('click',()=>{
   soundOn=!soundOn;soundButton.setAttribute('aria-pressed',String(soundOn));
   soundButton.textContent=soundOn?'♫ Sound on':'♫ Sound off';
   if(soundOn)tone('find');
 });
 update();
})();
