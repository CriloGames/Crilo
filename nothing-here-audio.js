/* Nothing Here — licensed mechanical SFX and independent lobby music.
 * Every imported sound is CC0. See NOTHING-HERE-AUDIO-CREDITS.md.
 * No sound plays before an actual user gesture. Music starts muted/off
 * for new visitors, and respects browser autoplay restrictions.
 */
(()=>{
 'use strict';
 const keySfx='crilo_nothing_here_sfx_v1';
 const keyMusic='crilo_nothing_here_music_v1';
 const source='https://raw.githubusercontent.com/blancmathis/Super_Bash_Folds/1028a3b739ef54efdcbe5a2ef0ad1714fe569c47/public/assets/audio/open/';
 const local='audio/nothing-here/';
 const files={
  click:'menu-move.ogg',select:'menu-confirm.ogg',
  release:'menu-back.ogg',pickup:'item-pickup.ogg',
  reveal:'item-spawn.ogg',tap:'hit-light.ogg',
  gear:'hit-medium.ogg',impact:'hit-heavy.ogg',
  latch:'grab.ogg',drawer:'land.ogg',
  discovery:'ready.ogg'
 };
 const levels={click:.22,select:.22,release:.19,pickup:.27,reveal:.22,
  tap:.22,gear:.22,impact:.21,latch:.24,drawer:.21,discovery:.22};
 const get=(key,def)=>{try{return localStorage.getItem(key)??def}catch{return def}};
 const save=(key,on)=>{try{localStorage.setItem(key,on?'on':'off')}catch{}};
 let sfxEnabled=get(keySfx,'on')!=='off';
 let musicEnabled=get(keyMusic,'off')==='on';
 let music=null,gestureReady=false,lastCue='',lastAt=0,latestEffect='';
 const active=new Set();
 const audioSupported=typeof Audio!=='undefined';
 const oggOk=audioSupported&&new Audio().canPlayType?.('audio/ogg; codecs="vorbis"')!=='';
 const soundSrc=(kind,remote=false)=>remote?
  source+'sfx/'+files[kind]:local+'sfx/'+files[kind];
 const musicSrc=remote=>remote?
  source+'music/menu-loop.ogg':local+'music/menu-loop.ogg';
 function fallback(el,remoteSource){
  let remote=false;
  el.addEventListener('error',()=>{
   if(!remote){remote=true;el.src=remoteSource;el.load()}
  });
  return el;
 }
 const samples={};
 function sample(kind){
  if(!audioSupported||!files[kind])return null;
  if(!samples[kind]){
   const a=fallback(new Audio(soundSrc(kind)),soundSrc(kind,true));
   a.preload='auto';
   samples[kind]=a;
  }
  return samples[kind];
 }
 function fadeMusic(target,duration=300){
  if(!music)return;
  const element=music;
  if(element._fadeFrame)cancelAnimationFrame(element._fadeFrame);
  const begin=performance.now(),initial=element.volume;
  const step=now=>{
   const t=Math.min(1,(now-begin)/duration);
   element.volume=initial+(target-initial)*t;
   if(t<1)element._fadeFrame=requestAnimationFrame(step);
   else if(!target){element.pause()}
  };
  element._fadeFrame=requestAnimationFrame(step);
 }
 function ensureMusic(){
  if(!audioSupported)return null;
  if(!music){
   music=fallback(new Audio(musicSrc(false)),musicSrc(true));
   music.loop=true;music.preload='none';music.volume=0;
  }
  return music;
 }
 function syncUi(){
  const s=document.getElementById('ncSfxToggle');
  const m=document.getElementById('ncMusicToggle');
  if(s){
   s.setAttribute('aria-pressed',String(sfxEnabled));
   s.setAttribute('aria-label',sfxEnabled?'Turn off sound effects':'Turn on sound effects');
   const value=s.querySelector('.nc-audio-state');if(value)value.textContent=sfxEnabled?'On':'Off';
   s.classList.toggle('nc-audio-disabled',!sfxEnabled);
  }
  if(m){
   m.setAttribute('aria-pressed',String(musicEnabled));
   m.setAttribute('aria-label',musicEnabled?'Turn off background music':'Turn on background music');
   const value=m.querySelector('.nc-audio-state');if(value)value.textContent=musicEnabled?'On':'Off';
   m.classList.toggle('nc-audio-disabled',!musicEnabled);
  }
 }
 function startMusic(){
  if(!musicEnabled||!gestureReady||document.hidden)return false;
  const song=ensureMusic();if(!song)return false;
  if(song._fadeFrame)cancelAnimationFrame(song._fadeFrame);
  // Only start after a user gesture; modern browsers block page-load audio.
  if(song.paused){
   song.volume=.12;
   const promise=song.play();
   promise?.then?.(()=>fadeMusic(.20,650)).catch?.(()=>{
    // Keep the control enabled: another gesture can unlock it.
    song.pause();
   });
  }else fadeMusic(.20,260);
  return true;
 }
 function setMusic(on){
  musicEnabled=!!on;save(keyMusic,musicEnabled);syncUi();
  if(musicEnabled){gestureReady=true;startMusic()}
  else fadeMusic(0,200);
 }
 function setSfx(on){
  sfxEnabled=!!on;save(keySfx,sfxEnabled);
  if(!sfxEnabled){
   for(const a of active){a.pause();a.currentTime=0}
   active.clear();
  }
  syncUi();
  if(sfxEnabled)play('select');
 }
 function play(kind='click'){
  if(!sfxEnabled||document.hidden||!files[kind]||!audioSupported)return false;
  // Fast mouse clicks and repeated logical events should not layer loudly.
  const now=performance.now();
  if(kind===lastCue&&now-lastAt<65)return false;
  lastAt=now;lastCue=kind;latestEffect=kind;
  try{
   const base=sample(kind);if(!base)return false;
   const a=base.cloneNode(true);
   a.preload='auto';a.volume=levels[kind]||.20;
   let usedRemote=base.src===soundSrc(kind,true);
   a.addEventListener('error',()=>{
    if(!usedRemote){usedRemote=true;a.src=soundSrc(kind,true);a.play().catch(()=>{})}
   },{once:true});
   active.add(a);
   a.addEventListener('ended',()=>active.delete(a),{once:true});
   a.play().catch(()=>active.delete(a));
   return true;
  }catch{return false}
 }
 function toneFor(freq){
  const n=Number(freq);
  if(!Number.isFinite(n))return play('tap');
  if(n<270)return play('impact');
  if(n<445)return play('gear');
  if(n<610)return play('select');
  if(n<745)return play('reveal');
  return play('discovery');
 }
 function action(name){
  if(!name)return false;
  if(name.startsWith('pickup:'))return play('pickup');
  if(name.startsWith('thing:')||name.startsWith('flute-note-'))return play('tap');
  if(/(?:drawer|front|side)/.test(name))return play('drawer');
  if(/(?:screw|hinge|eye-ring|optic|pressure)/.test(name))return play('gear');
  if(/(?:latch|shutter|triangle|hatch|seam)/.test(name))return play('latch');
  if(/(?:vent|dot|serial|eye|dent)/.test(name))return play('click');
  return play('tap');
 }
 function bind(){
  document.getElementById('ncSfxToggle')?.addEventListener('click',()=>setSfx(!sfxEnabled));
  document.getElementById('ncMusicToggle')?.addEventListener('click',()=>setMusic(!musicEnabled));
  syncUi();
 }
 function gesture(){
  gestureReady=true;
  if(musicEnabled)startMusic();
 }
 document.addEventListener('pointerdown',gesture,{passive:true});
 document.addEventListener('keydown',gesture);
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden){if(music)music.pause()}
  else if(musicEnabled&&gestureReady)startMusic();
 });
 window.addEventListener('pagehide',()=>{if(music)music.pause()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
 else bind();
 window.NothingHereAudio={
  play,toneFor,action,setSfx,setMusic,
  getState:()=>({
   sfxEnabled,musicEnabled,latestEffect,musicCreated:!!music,
   musicPlaying:!!music&&!music.paused,
   musicLoop:music?.loop??true,soundFileCount:Object.keys(files).length,
   oggSupported:oggOk
  })
 };
})();
