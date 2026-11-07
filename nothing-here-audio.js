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
   promise?.then?.(()=>{
    // A fast On→Off click can beat the browser's asynchronous play()
    // permission/decoding promise. Never restart muted music afterward.
    if(!musicEnabled||document.hidden){song.pause();song.volume=0;return;}
    fadeMusic(.20,650);
   }).catch?.(()=>{
    // Keep the control enabled: another gesture can unlock it.
    song.pause();
   });
  }else fadeMusic(.20,260);
  return true;
 }
 function setMusic(on){
  musicEnabled=!!on;save(keyMusic,musicEnabled);syncUi();
  if(musicEnabled){gestureReady=true;startMusic()}
  else if(music){
   // Off means silent immediately, including while a fade is underway.
   if(music._fadeFrame)cancelAnimationFrame(music._fadeFrame);
   music.pause();music.volume=0;
  }
 }
 function setSfx(on){
  sfxEnabled=!!on;save(keySfx,sfxEnabled);
  if(!sfxEnabled){
   for(const a of active){a.pause();a.currentTime=0}
   active.clear();
   // The handcrafted flute uses Web Audio rather than a sampled element.
   // Suspending it makes the effects toggle truly mute both sound engines.
   stopFinale();
   if(fluteContext?.state==="running")fluteContext.suspend().catch(()=>{});
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
    if(!usedRemote&&sfxEnabled&&!document.hidden){
     usedRemote=true;a.src=soundSrc(kind,true);a.play().catch(()=>active.delete(a));
    }
   },{once:true});
   active.add(a);
   a.addEventListener('ended',()=>active.delete(a),{once:true});
   a.play().catch(()=>active.delete(a));
   return true;
  }catch{return false}
 }
 let fluteContext=null;
 let finaleMaster=null,finaleTimeout=null,finalePlaying=false;
 function stopFinale(){
  if(finaleTimeout!==null){clearTimeout(finaleTimeout);finaleTimeout=null;}
  if(finaleMaster&&fluteContext){
   const now=fluteContext.currentTime;
   finaleMaster.gain.cancelScheduledValues(now);
   finaleMaster.gain.setTargetAtTime(.0001,now,.04);
  }
  finaleMaster=null;finalePlaying=false;
 }
 // A new, original electronic completion cue (not YouTube audio or an
 // imitation of any recording). Synthesis uses no external music assets.
 // It uses the existing sound-effects preference so default players hear
 // the ending, but a user who muted Sounds never hears surprise playback.
 function playFinale(){
  if(!sfxEnabled||document.hidden)return false;
  const Engine=window.AudioContext||window.webkitAudioContext;
  if(!Engine)return false;
  try{
   if(!fluteContext||fluteContext.state==='closed')fluteContext=new Engine();
   if(fluteContext.state==='suspended')fluteContext.resume()?.catch?.(()=>{});
   stopFinale();
   // Do not layer the lobby loop under the ending.
   if(music&&!music.paused){music.pause();music.volume=0;}
   const ctx=fluteContext,now=ctx.currentTime+.018;
   const master=ctx.createGain();
   master.gain.setValueAtTime(.0001,now);
   master.gain.exponentialRampToValueAtTime(.42,now+.16);
   master.connect(ctx.destination);
   finaleMaster=master;finalePlaying=true;latestEffect='finale';
   const beat=.46,half=beat/2;
   const note=(frequency,at,length,level,wave,fade=.035)=>{
    const oscillator=ctx.createOscillator(),envelope=ctx.createGain();
    oscillator.type=wave;
    oscillator.frequency.setValueAtTime(frequency,at);
    oscillator.frequency.exponentialRampToValueAtTime(frequency*.992,at+length);
    envelope.gain.setValueAtTime(.0001,at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0002,level),at+.012);
    envelope.gain.setTargetAtTime(.0001,at+length*.65,fade);
    oscillator.connect(envelope).connect(master);
    oscillator.start(at);oscillator.stop(at+length+.07);
   };
   // Sixteen syncopated beats: a little victory dance for the unfolding cube.
   // Distinct original pitches/chord movement, no sampled melody.
   const melody=[659.25,783.99,1046.5,987.77,783.99,659.25,587.33,783.99,
    698.46,880,1046.5,880,783.99,698.46,659.25,523.25,
    783.99,987.77,1174.66,1046.5,987.77,783.99,698.46,783.99,
    880,1046.5,1318.51,1174.66,1046.5,880,783.99,1046.5];
   const bass=[164.81,130.81,146.83,174.61,164.81,196,174.61,130.81];
   for(let i=0;i<melody.length;i++){
    const t=now+i*half;
    note(melody[i],t,half*.85,.075,i%4===0?'triangle':'sine');
    if(i%4===0)note(melody[i]/2,t,half*1.5,.022,'triangle');
    if(i%4===2)note(310,t,.06,.018,'triangle');
   }
   for(let i=0;i<16;i++){
    const t=now+i*beat;
    note(bass[Math.floor(i/2)%bass.length],t,beat*.72,.068,'sawtooth',.06);
    note(72,t,.095,.072,'sine',.025); // soft rhythmic low drum
    note(740,t+half,.045,.009,'triangle',.008);
   }
   const end=now+16*beat;
   master.gain.setValueAtTime(.42,end-.55);
   master.gain.exponentialRampToValueAtTime(.0001,end+.25);
   finaleTimeout=setTimeout(()=>{
    finaleTimeout=null;finaleMaster=null;finalePlaying=false;
    try{master.disconnect()}catch{}
    if(musicEnabled&&gestureReady&&!document.hidden)startMusic();
   },Math.ceil((end+.3-ctx.currentTime)*1000));
   return true;
  }catch{stopFinale();return false;}
 }
 function playFluteNote(number){
  if(!sfxEnabled||document.hidden)return false;
  const notes=[523.25,659.26,783.99];
  const frequency=notes[number-1];
  if(!frequency)return false;
  try{
   const Engine=window.AudioContext||window.webkitAudioContext;
   if(!Engine)return play('select');
   if(!fluteContext||fluteContext.state==='closed')fluteContext=new Engine();
   if(fluteContext.state==='suspended')fluteContext.resume()?.catch?.(()=>{});
   const t=fluteContext.currentTime;
   const voice=fluteContext.createGain();
   voice.gain.setValueAtTime(.0001,t);
   voice.gain.exponentialRampToValueAtTime(.065,t+.062);
   voice.gain.exponentialRampToValueAtTime(.036,t+.19);
   voice.gain.exponentialRampToValueAtTime(.0001,t+.53);
   voice.connect(fluteContext.destination);
   // A soft wooden flute timbre from a fundamental plus faint overtones.
   for(const [ratio,volume] of [[1,1],[2,.18],[3,.055]]){
    const oscillator=fluteContext.createOscillator();
    oscillator.type='sine';
    oscillator.frequency.setValueAtTime(frequency*ratio,t);
    oscillator.frequency.setValueAtTime(frequency*ratio*1.006,t+.14);
    const tone=fluteContext.createGain();tone.gain.value=volume;
    oscillator.connect(tone).connect(voice);
    oscillator.start(t);oscillator.stop(t+.56);
   }
   latestEffect='flute';
   return true;
  }catch{return play('select')}
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
 window.addEventListener('pagehide',()=>{stopFinale();if(music)music.pause()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
 else bind();
 window.NothingHereAudio={
  play,toneFor,playFluteNote,playFinale,stopFinale,action,setSfx,setMusic,
  getState:()=>({
   sfxEnabled,musicEnabled,latestEffect,finalePlaying,musicCreated:!!music,
   musicPlaying:!!music&&!music.paused,
   musicLoop:music?.loop??true,soundFileCount:Object.keys(files).length,
   oggSupported:oggOk
  })
 };
})();
