/* Crilo's little sound garden — locally synthesized UI notes.
 * No downloads, analytics, timers, auto-play on page load, or sound on typing.
 * Existing Daily Wheel, duck squeaks, beetle and Shape of Sound audio stay independent. */
(() => {
 'use strict';
 let context=null,output=null,lastAt=-1,lastKind='';
 const SPECS=Object.freeze({
  tap:    [[520,0,.046,.014,'triangle',360]],
  nav:    [[440,0,.075,.019,'sine',520],[660,.065,.105,.014,'sine',720]],
  tab:    [[610,0,.045,.014,'triangle',490],[740,.058,.072,.013,'sine',810]],
  open:   [[392,0,.092,.017,'triangle',490],[588,.09,.13,.016,'sine',659]],
  close:  [[610,0,.075,.014,'sine',495],[410,.07,.09,.013,'triangle',350]],
  toggle: [[480,0,.066,.015,'triangle',540],[680,.07,.115,.017,'sine',810]],
  palette:[[710,0,.085,.015,'sine',790],[1070,.05,.07,.006,'sine',1150]],
  badge:  [[523,0,.17,.028,'triangle',590],[784,.11,.24,.028,'sine',880],[1047,.23,.36,.025,'sine',1175],[1568,.33,.31,.009,'sine',1700]],
  peek:   [[624,0,.09,.018,'sine',710],[935,.08,.16,.012,'sine',990]],
  copy:   [[780,0,.09,.022,'triangle',910],[1175,.09,.19,.018,'sine',1320]],
  save:   [[440,0,.11,.022,'triangle',510],[660,.105,.19,.021,'sine',740],[880,.19,.21,.014,'sine',940]],
  friend: [[493,0,.15,.021,'triangle',540],[659,.12,.16,.022,'sine',740],[988,.23,.23,.022,'sine',1109]],
  notice: [[784,0,.1,.015,'triangle',880],[1175,.09,.17,.013,'sine',1245]],
  wheel:  [[265,0,.17,.019,'triangle',460],[530,.10,.17,.015,'sine',710],[855,.23,.24,.019,'sine',1100]],
  expand: [[370,0,.085,.015,'triangle',435],[550,.08,.13,.016,'sine',640]],
  success:[[587,0,.12,.022,'sine',659],[783,.11,.19,.020,'sine',880],[1047,.23,.21,.018,'sine',1175]],
  error:  [[290,0,.14,.018,'triangle',220],[240,.10,.18,.016,'sine',200]]
 });
 const safeStore=() => {try{return window.localStorage?.getItem('crilo_sound')}catch{return null}};
 function enabled(){
  return safeStore()!=='off' && window.Crilo?.profile?.sound_enabled!==false;
 }
 function initialize(){
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)return false;
  if(!context||context.state==='closed'){
   context=new Audio();
   const comp=context.createDynamicsCompressor();
   comp.threshold.value=-21;comp.knee.value=18;comp.ratio.value=8;
   comp.attack.value=.005;comp.release.value=.16;
   const master=context.createGain();
   master.gain.value=.62;master.connect(comp);comp.connect(context.destination);
   output=master;
  }
  if(context.state==='suspended'){
   const resume=context.resume();
   resume?.catch?.(()=>{});
  }
  return true;
 }
 function play(kind='tap'){
  if(!Object.prototype.hasOwnProperty.call(SPECS,kind)||!enabled()||document.hidden)return false;
  try{
   if(!initialize())return false;
   const now=context.currentTime;
   // Prevent a double-fired touch+click from playing the same cue twice.
   if(kind===lastKind&&now-lastAt<.07)return false;
   lastKind=kind;lastAt=now;
   for(const [frequency,delay,duration,volume,wave,target] of SPECS[kind]){
    const oscillator=context.createOscillator();
    const gain=context.createGain();
    const at=now+delay;
    oscillator.type=wave;
    oscillator.frequency.setValueAtTime(frequency,at);
    if(target!==frequency)oscillator.frequency.exponentialRampToValueAtTime(Math.max(40,target),at+duration);
    oscillator.connect(gain);gain.connect(output);
    gain.gain.setValueAtTime(.0001,at);
    gain.gain.exponentialRampToValueAtTime(volume,at+Math.min(.014,duration/4));
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    oscillator.start(at);oscillator.stop(at+duration+.014);
   }
   return true;
  }catch{return false}
 }
 function getKind(target){
  if(!(target instanceof Element))return null;
  // These already make intentional, unique noises. Do not play over them.
  if(target.closest('#spinButton,#bugBeetle,.bug-beetle,.duck-unlocked,#duckUnlockArt,.duck-collection-card,.wheel-spin-control,[data-no-site-sfx]'))return null;
  const el=target.closest('button,a[href],summary,[role="button"],input[type="checkbox"],input[type="radio"],input[type="color"]');
  if(!el||el.matches(':disabled,[aria-disabled="true"]')||el.closest('[inert],.hidden'))return null;
  if(el.matches('input[type="color"]')||el.closest('[class*="avatar-color"],[class*="ink-swatch"],[class*="color-choice"],[class*="palette"]'))return 'palette';
  if(el.matches('.mini-wheel,[class*="spin-history-wheel"]'))return 'wheel';
  if(el.matches('.leader-tab,[role="tab"],[class*="filter-tab"],[class*="tab-btn"]'))return 'tab';
  if(el.matches('.badge-top-chip,.collection-tile,.featured-badge,[data-badge-key]'))return 'peek';
  if(el.matches('.accept,.friend-accept,[id*="acceptFriend"]'))return 'friend';
  if(el.matches('[id*="copy"],[id*="Copy"],[data-copy]'))return 'copy';
  if(el.matches('[id*="notification"],[id*="Notification"],#friendBellBtn'))return 'notice';
  if(el.matches('[id*="Close"],[id*="Cancel"],[aria-label*="Close"],[aria-label*="close"],[class*="modal-close"]'))return 'close';
  if(el.matches('summary,[aria-expanded="false"],[class*="accordion"],[class*="expander"]'))return 'expand';
  if(el.matches('[id*="theme"],[id*="Theme"],[id*="sound"],[id*="Sound"],[role="switch"],input[type="checkbox"],input[type="radio"]'))return 'toggle';
  if(el.matches('.avatar-symbol-option,[class*="avatar-choice"],[class*="featured-pick-option"]'))return 'palette';
  if(el.matches('a[href]'))return 'nav';
  if(el.matches('[aria-haspopup="dialog"],[data-modal],[id*="Open"],[id*="Edit"]'))return 'open';
  return 'tap';
 }
 function onAction(event){
  if(event.isTrusted===false||event.defaultPrevented)return;
  // Unlock a silent AudioContext during the actual SPIN interaction so
  // an earned-badge chime can play later after an asynchronous server save.
  if(event.target?.closest?.('#spinButton')){
   if(enabled())try{initialize()}catch{}
   return;
  }
  const kind=getKind(event.target);
  if(kind)play(kind);
 }
 document.addEventListener('click',onAction,{passive:true});
 const badgePanel=document.getElementById('newBadgePanel');
 if(badgePanel&&window.MutationObserver){
  let visible=badgePanel.open&&!badgePanel.classList.contains('hidden');
  new MutationObserver(()=>{
   const nowVisible=badgePanel.open&&!badgePanel.classList.contains('hidden');
   if(nowVisible&&!visible&&badgePanel.querySelector('.new-badge-item'))play('badge');
   visible=nowVisible;
  }).observe(badgePanel,{attributes:true,attributeFilter:['class','open']});
 }
 // Form-control changes made by dragging a color picker do not fire click
 // on all mobile browsers. They receive their own quiet preview chime.
 document.addEventListener('change',event=>{
  if(event.isTrusted && event.target?.matches?.('input[type="color"],input[type="range"]'))play('palette');
 });
 window.CriloSFX=Object.freeze({play,enabled,types:Object.freeze(Object.keys(SPECS))});
})();
