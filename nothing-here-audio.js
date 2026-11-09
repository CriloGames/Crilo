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
  if(finalePlaying||!musicEnabled||!gestureReady||document.hidden)return false;
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
 let finaleMaster=null,finaleTimeout=null,finaleTimer=null,finalePlaying=false;
 let licensedFinale=null,licensedUnavailable=false,finaleClockStart=null;
 let finaleSynthClockStart=null;
 const licensedFinaleSrc='audio/nothing-here/finale-licensed.mp3?v=1';
 function ensureLicensedFinale(){
  if(!audioSupported||licensedUnavailable)return null;
  if(licensedFinale)return licensedFinale;
  const track=new Audio(licensedFinaleSrc);
  track.preload='auto';track.loop=false;track.volume=.75;
  track.addEventListener('error',()=>{
   licensedUnavailable=true;
   if(finalePlaying&&licensedFinale===track){
    licensedFinale=null;
    playFinale(134.699); // fall back to the original score, never silence
   }
  });
  licensedFinale=track;return track;
 }
 function activeFinaleAudio(){
  return personalFinale||(!licensedUnavailable?licensedFinale:null);
 }
 function getFinaleClock(){
  if(!finalePlaying)return null;
  const track=activeFinaleAudio();
  // When audio takes a moment to buffer/unlock, the cat must WAIT rather
  // than run ahead from performance.now and then snap back at the first beat.
  // The media playhead is always the authoritative clock while the licensed
  // recording exists (including its brief initial 0-second preload).
  if(track)return Number(track.currentTime)||0;
  // The fallback must follow actual Web Audio time, not wall-clock time.
  // AudioContext.currentTime freezes while suspended or interrupted.
  if(Number.isFinite(finaleSynthClockStart)&&fluteContext)
   return Math.max(0,fluteContext.currentTime-finaleSynthClockStart);
  return Number.isFinite(finaleClockStart)
   ?Math.max(0,(performance.now()-finaleClockStart)/1000):null;
 }
 // A personal soundtrack is a browser-local Blob URL. The uploaded file
 // never becomes a public asset, and is only decoded in this visitor's tab.
 let personalFinale=null,personalFinaleUrl=null,personalFinaleName='';
 function setPersonalFinaleFile(blob,name='Personal finale track'){
  if(blob!==null&&(!audioSupported||!URL.createObjectURL||!(blob instanceof Blob)))
   return false;
  stopFinale();
  if(personalFinaleUrl){URL.revokeObjectURL(personalFinaleUrl);personalFinaleUrl=null;}
  personalFinale=null;personalFinaleName='';
  if(blob){
   personalFinaleUrl=URL.createObjectURL(blob);
   personalFinale=new Audio(personalFinaleUrl);
   personalFinale.preload='auto';
   personalFinale.loop=false;
   personalFinale.volume=.72;
   personalFinaleName=String(name||'Personal finale track');
  }
  return true;
 }

 function stopFinale(){
  if(licensedFinale){
   licensedFinale.pause();
   licensedFinale.onended=null;
   licensedFinale.muted=false;
   try{licensedFinale.currentTime=0}catch{}
  }
  finaleClockStart=null;finaleSynthClockStart=null;
  if(personalFinale){
   personalFinale.pause();
   personalFinale.onended=null;
   personalFinale.muted=false;
   try{personalFinale.currentTime=0}catch{}
  }
  if(finaleTimeout!==null){clearTimeout(finaleTimeout);finaleTimeout=null;}
  if(finaleTimer!==null){clearInterval(finaleTimer);finaleTimer=null;}
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
 // Unlock the synthesis context during the LAST actual puzzle click.
 // Starting the 134.7s score after a 4s unfolding delay otherwise loses
 // the user-gesture permission on browsers that suspend new audio contexts.
 function prepareFinale(){
  if(!sfxEnabled)return false;
  // Prime browser-local media during the genuine finishing/replay click,
  // allowing sound to begin only when the unfolding animation completes.
  const song=personalFinale||ensureLicensedFinale();
  if(song){
   try{
    song.pause();
    song.currentTime=0;
    song.muted=true;
    song.play()?.catch?.(()=>{});
   }catch(error){console.warn('Finale preload:',error?.message||error);}
   return true;
  }
  const Engine=window.AudioContext||window.webkitAudioContext;
  if(!Engine)return false;
  try{
   if(!fluteContext||fluteContext.state==='closed')fluteContext=new Engine();
   if(fluteContext.state==='suspended')fluteContext.resume()?.catch?.(()=>{});
   return true;
  }catch{return false}
 }
 // An original electronic celebration timed to the complete 134.699s
 // cat show. The commercial W&W "OIIA OIIA" song is NOT bundled; a licensed
 // synchronized music file can be substituted by the game's owner later.
 function playFinale(durationSeconds=134.699){
  if(!sfxEnabled||document.hidden)return false;
  const selected=personalFinale||ensureLicensedFinale();
  if(selected){
   // The licensed MP3 is the DEFAULT finale soundtrack for every player;
   // visitors may still override it with a private personal selection.
   // Its audio currentTime is authoritative for the 150 BPM 3D animation.
   const clip=selected;
   if(music&&!music.paused){music.pause();music.volume=0;}
   try{
    clip.currentTime=0;
    clip.volume=.72;
    clip.muted=false;
    finaleClockStart=performance.now();
    finaleSynthClockStart=null;
    finalePlaying=true;latestEffect='finale';
    clip.onended=()=>{
     if(clip!==activeFinaleAudio())return;
     finalePlaying=false;
     if(musicEnabled&&gestureReady&&!document.hidden)startMusic();
    };
    if(clip.paused)clip.play()?.catch?.(error=>{
     if(clip!==activeFinaleAudio())return;
     console.warn('Finale MP3 playback:',error?.message||error);
     if(clip===licensedFinale){
      licensedUnavailable=true;licensedFinale=null;
      finalePlaying=false;playFinale(durationSeconds); // original synth backup
     }else finalePlaying=false;
    });
    return true;
   }catch(error){
    console.warn('Unable to start personal finale:',error?.message||error);
    finalePlaying=false;
    return false;
   }
  }
  const Engine=window.AudioContext||window.webkitAudioContext;
  if(!Engine)return false;
  try{
   if(!fluteContext||fluteContext.state==='closed')fluteContext=new Engine();
   if(fluteContext.state==='suspended')fluteContext.resume()?.catch?.(()=>{});
   stopFinale();
   if(music&&!music.paused){music.pause();music.volume=0;}
   const ctx=fluteContext,now=ctx.currentTime+.055;
   const duration=Math.min(180,Math.max(1,Number(durationSeconds)||134.699));
   const master=ctx.createGain();
   master.gain.setValueAtTime(.0001,now);
   master.gain.exponentialRampToValueAtTime(.35,now+.15);
   master.connect(ctx.destination);
   finaleClockStart=performance.now();
   finaleSynthClockStart=now;
   finaleMaster=master;finalePlaying=true;latestEffect='finale';
   // Match the 150-BPM animation and licensed track. The previous 136-BPM
   // backup could never stay on beat with the duck's 150-BPM choreography.
   const beat=60/150,half=beat/2;
   const riff=[0,3,7,10,12,7,3,5,7,10,14,12,10,7,5,3,
               0,5,7,12,10,7,5,3,7,12,15,14,12,10,7,5];
   const roots=[82.407,65.406,73.416,61.735,82.407,69.296,73.416,61.735];
   function note(freq,t,len,vol,wave='triangle',slide=0){
    const osc=ctx.createOscillator(),env=ctx.createGain();
    osc.type=wave;
    osc.frequency.setValueAtTime(freq*(1+slide),t);
    if(slide)osc.frequency.exponentialRampToValueAtTime(freq,t+Math.min(.1,len*.4));
    env.gain.setValueAtTime(.0001,t);
    env.gain.exponentialRampToValueAtTime(vol,t+.008);
    env.gain.setTargetAtTime(.0001,t+len*.53,Math.max(.015,len*.15));
    osc.connect(env).connect(master);
    osc.start(t);osc.stop(t+len+.1);
   }
   let next=0;
   function schedule(){
    if(!finalePlaying||finaleMaster!==master)return;
    const horizon=ctx.currentTime+.85;
    while(now+next*half<horizon&&next*half<duration){
     const t=next*half,at=now+t,bar=Math.floor(next/8),step=next%8;
     const root=roots[bar%roots.length];
     const intro=t<26,quiet=t>=60&&t<80||t>=88&&t<102;
     const drop=t>=26&&t<60||t>=108&&t<132;
     const level=intro?.57:quiet?.46:drop?1:.76;
     if(step%2===0){
      note(71,at,.22,.088*level,'sine',1);
      note(root/2,at,.32,.060*level,'sawtooth');
     }else note(970,at,.036,.010*level,'triangle');
     if(step===2||step===6){
      note(196,at,.085,.027*level,'triangle',.2);
      note(360,at+.012,.064,.007*level,'triangle');
     }
     if(!intro||t>12){
      const f=root*4*Math.pow(2,riff[next%riff.length]/12);
      note(f,at,.172,.026*level,step%4===0?'triangle':'sine',.018);
      if(step===0||step===4)
       note(root*2*Math.pow(2,[0,5,7,3][bar%4]/12),at,.53,
        .019*level,'triangle');
     }
     if(drop&&step===7)note(root*8,at,.095,.013,'sawtooth');
     next++;
    }
   }
   // Finish after the AUDIO duration, not after 134.699 wall-clock seconds.
   // A suspended context otherwise ends the score early after tab switching.
   const advance=()=>{
    if(finaleMaster!==master)return;
    schedule();
    if(ctx.currentTime<now+duration)return;
    master.gain.setTargetAtTime(.0001,ctx.currentTime,.07);
    if(finaleTimer!==null){clearInterval(finaleTimer);finaleTimer=null;}
    finaleMaster=null;finalePlaying=false;finaleTimeout=null;
    finaleSynthClockStart=null;
    setTimeout(()=>{try{master.disconnect()}catch{}},450);
    if(musicEnabled&&gestureReady&&!document.hidden)startMusic();
   };
   advance();finaleTimer=setInterval(advance,85);
   return true;
  }catch(error){
   console.warn('Cat finale audio unavailable:',error?.message||error);
   stopFinale();return false;
  }
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
  play,toneFor,playFluteNote,prepareFinale,playFinale,stopFinale,getFinaleClock,action,setSfx,setMusic,setPersonalFinaleFile,
  getState:()=>({
   sfxEnabled,musicEnabled,latestEffect,finalePlaying,musicCreated:!!music,
   personalFinaleReady:!!personalFinale,personalFinaleName,
   licensedFinaleReady:!!licensedFinale&&!licensedUnavailable,
   licensedFinalePlaying:!!licensedFinale&&!licensedFinale.paused&&!licensedFinale.muted,
   finaleSeconds:getFinaleClock(),
   personalFinalePlaying:!!personalFinale&&!personalFinale.paused&&!personalFinale.muted,
   musicPlaying:!!music&&!music.paused,
   musicLoop:music?.loop??true,soundFileCount:Object.keys(files).length,
   oggSupported:oggOk
  })
 };
})();
