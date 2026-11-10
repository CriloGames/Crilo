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
 // The opening/unfolded finale is not the lobby: never play the box loop
 // over the duck soundtrack or while the duck is waiting for sound.
 function finaleSceneActive(){
  return document.body?.classList?.contains('nc-finale-active')===true;
 }
 function pauseLobbyMusic(){
  if(!music)return;
  if(music._fadeFrame)cancelAnimationFrame(music._fadeFrame);
  music.pause();music.volume=0;
 }
 function requestFinaleAudio(){
  window.dispatchEvent(new Event('nothing-here-finale-audio-request'));
 }
 // Music controls both the mechanical intro and the finale score.
 // Muting stops the playback transport WITHOUT seeking, so the mascot
 // cannot keep dancing over silence. Music On resumes at that same beat.
 function syncFinaleMusicVolume(){
  const audible=musicEnabled&&!document.hidden;
  for(const track of [licensedFinale,personalFinale]){
   if(track)track.muted=!audible;
  }
  if(finaleMaster&&fluteContext){
   const now=fluteContext.currentTime;
   finaleMaster.gain.cancelScheduledValues(now);
   finaleMaster.gain.setTargetAtTime(audible?.35:.0001,now,.025);
  }
  if(windUpMaster&&fluteContext){
   const now=fluteContext.currentTime;
   windUpMaster.gain.cancelScheduledValues(now);
   windUpMaster.gain.setTargetAtTime(audible?.20:.0001,now,.025);
  }
 }
 function startMusic(){
  if(finaleSceneActive()||finalePlaying||!musicEnabled||
   !gestureReady||document.hidden)return false;
  const song=ensureMusic();if(!song)return false;
  if(song._fadeFrame)cancelAnimationFrame(song._fadeFrame);
  // Only start after a user gesture; modern browsers block page-load audio.
  if(song.paused){
   song.volume=.12;
   const promise=song.play();
   promise?.then?.(()=>{
    // A fast On→Off click can beat the browser's asynchronous play()
    // permission/decoding promise. Never restart muted music afterward.
    if(!musicEnabled||document.hidden||finaleSceneActive()||finalePlaying){
     song.pause();song.volume=0;return;
    }
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
  if(musicEnabled)gestureReady=true;
  if(finaleSceneActive()){
   pauseLobbyMusic();
   syncFinaleMusicVolume();
   if(windUpActive){
    // Start at the CURRENT box animation time, not the opening again.
    if(musicEnabled)syncWindUp(windUpSeconds);
   }else if(finalePlaying){
    // Music Off freezes the actual playback position: do not continue
    // silently and then jump ahead on the next Music On click.
    const clip=activeFinaleAudio();
    if(musicEnabled){
     if(finaleMaster&&fluteContext?.state==="suspended")
      fluteContext.resume()?.catch?.(()=>{});
     if(clip?.paused&&!clip.ended)
      clip.play()?.catch?.(()=>{});
    }else{
     if(clip&&!clip.paused)clip.pause();
     finaleMediaStarted=false;
     if(finaleMaster&&fluteContext?.state==="running")
      fluteContext.suspend()?.catch?.(()=>{});
    }
   }else if(musicEnabled)requestFinaleAudio();
   return;
  }
  if(musicEnabled)startMusic();
  else pauseLobbyMusic();
 }
 function setSfx(on){
  sfxEnabled=!!on;save(keySfx,sfxEnabled);
  if(!sfxEnabled){
   for(const a of active){a.pause();a.currentTime=0}
   active.clear();
   // The music score has its own switch and clock. A Sounds click must
   // NEVER stop its MP3, reset the duck, or suspend its audio clock.
   if(!finalePlaying&&!windUpActive&&fluteContext?.state==="running")
    fluteContext.suspend().catch(()=>{});
  }
  syncUi();
  if(sfxEnabled&&!finaleSceneActive())play('select');
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
 let finaleMediaStarted=false;
 let finaleSynthClockStart=null;
 // Music-box style mechanical wind-up: original notes/ticks (E minor),
 // accelerating into the following soundtrack's 150 BPM pulse.
 const windUpBeats=[0,.82,1.52,2.14,2.71,3.23,3.71,4.17,
  4.6,5.02,5.43,5.83,6.23,6.63,7.03,7.43,7.83,8.23,8.63,9.03,9.43];
 const windUpNotes=[329.63,392,493.88,587.33,659.25,587.33,493.88,
  392,329.63,392,493.88,587.33,659.25,783.99,739.99,659.25,
  587.33,659.25,739.99,783.99,987.77];
 let windUpActive=false,windUpSeconds=0,windUpNext=0,windUpMaster=null;
 function stopWindUp(){
  windUpActive=false;windUpNext=0;
  if(windUpMaster&&fluteContext){
   windUpMaster.gain.cancelScheduledValues(fluteContext.currentTime);
   windUpMaster.gain.setTargetAtTime(.0001,fluteContext.currentTime,.03);
  }
  windUpMaster=null;
 }
 function startWindUp(){
  stopWindUp();
  windUpActive=true;windUpSeconds=0;
  syncWindUp(0);
  return true;
 }
 function windUpBell(ctx,at,freq,strength){
  const chime=ctx.createOscillator(),gain=ctx.createGain();
  chime.type="triangle";
  chime.frequency.setValueAtTime(freq,at);
  gain.gain.setValueAtTime(.0001,at);
  gain.gain.exponentialRampToValueAtTime(strength,at+.009);
  gain.gain.setTargetAtTime(.0001,at+.11,.09);
  chime.connect(gain).connect(windUpMaster);
  chime.start(at);chime.stop(at+.52);
  // Restrained upper partial gives the music a winding metal-tooth sound
  // without sampling or recreating another artist's melody.
  const upper=ctx.createOscillator(),upperGain=ctx.createGain();
  upper.type="sine";upper.frequency.setValueAtTime(freq*2.01,at);
  upperGain.gain.setValueAtTime(.0001,at);
  upperGain.gain.exponentialRampToValueAtTime(strength*.16,at+.01);
  upperGain.gain.setTargetAtTime(.0001,at+.072,.039);
  upper.connect(upperGain).connect(windUpMaster);
  upper.start(at);upper.stop(at+.31);
 }
 function syncWindUp(seconds){
  if(!windUpActive)return false;
  windUpSeconds=Math.max(0,Math.min(9.68,Number(seconds)||0));
  if(!musicEnabled||document.hidden)return false;
  const Engine=window.AudioContext||window.webkitAudioContext;
  if(!Engine)return false;
  try{
   if(!fluteContext||fluteContext.state==="closed")
    fluteContext=new Engine();
   if(fluteContext.state==="suspended")
    fluteContext.resume()?.catch?.(()=>{});
   const ctx=fluteContext;
   if(!windUpMaster){
    windUpMaster=ctx.createGain();
    windUpMaster.gain.setValueAtTime(.0001,ctx.currentTime);
    windUpMaster.connect(ctx.destination);
   }
   const fade=1-Math.max(0,Math.min(1,(windUpSeconds-9.02)/.66));
   windUpMaster.gain.setTargetAtTime(.20*fade+.0001,ctx.currentTime,.04);
   // Skip old notes if Music was enabled halfway through the reveal.
   while(windUpNext<windUpBeats.length&&
    windUpBeats[windUpNext]<windUpSeconds-.06)windUpNext++;
   while(windUpNext<windUpBeats.length&&
    windUpBeats[windUpNext]<=windUpSeconds+.13){
    const idx=windUpNext++,time=windUpBeats[idx];
    const at=ctx.currentTime+Math.max(.018,time-windUpSeconds);
    const intensity=.35+.65*(idx/(windUpBeats.length-1));
    windUpBell(ctx,at,windUpNotes[idx],.17*intensity);
    // Ratchet ticks mark the gear's acceleration toward the 150 BPM drop.
    windUpBell(ctx,at+.055,1568,.025*intensity);
    if(idx===0||idx===8||idx===15)
     windUpBell(ctx,at,164.81,.065*intensity);
   }
   return true;
  }catch(error){
   console.warn("Wind-up cue unavailable:",error?.message||error);
   return false;
  }
 }
 const licensedFinaleSrc='audio/nothing-here/finale-licensed.mp3?v=1';
 function ensureLicensedFinale(){
  if(!audioSupported||licensedUnavailable)return null;
  if(licensedFinale)return licensedFinale;
  const track=new Audio(licensedFinaleSrc);
  track.preload='auto';track.loop=false;track.volume=.75;
  track.addEventListener('playing',()=>{
   finaleMediaStarted=!track.seeking;
  });
  track.addEventListener('seeking',()=>{finaleMediaStarted=false;});
  track.addEventListener('seeked',()=>{
   if(finalePlaying&&!track.paused)finaleMediaStarted=true;
  });
  track.addEventListener('waiting',()=>{finaleMediaStarted=false;});
  track.addEventListener('pause',()=>{finaleMediaStarted=false;});
  track.addEventListener('error',()=>{
   licensedUnavailable=true;
   if(finalePlaying&&licensedFinale===track){
    licensedFinale=null;
    playFinale(134.699,track.currentTime||0); // fall back to the original score, never silence
   }
  });
  licensedFinale=track;return track;
 }
 function activeFinaleAudio(){
  return personalFinale||(!licensedUnavailable?licensedFinale:null);
 }
 function getFinaleClock(){
  // No audible soundtrack means NO advancing duck/music-video clock.
  // This includes Music Off, tab hidden, buffering and a suspended synth.
  if(!finalePlaying||!musicEnabled||document.hidden)return null;
  const track=activeFinaleAudio();
  // When audio takes a moment to buffer/unlock, the cat must WAIT rather
  // than run ahead from performance.now and then snap back at the first beat.
  // The media playhead is always the authoritative clock while the licensed
  // recording exists (including its brief initial 0-second preload).
  if(track)return track.ended||track.paused||track.muted||
   track.seeking||track.readyState<3||!finaleMediaStarted?null:
   Number(track.currentTime)||0;
  // The fallback must follow actual Web Audio time, not wall-clock time.
  // AudioContext.currentTime freezes while suspended or interrupted.
  if(Number.isFinite(finaleSynthClockStart)&&
   fluteContext?.state==="running")
   return Math.max(0,fluteContext.currentTime-finaleSynthClockStart);
  return null;
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
   personalFinale.addEventListener('playing',()=>{
    finaleMediaStarted=!personalFinale.seeking;
   });
   personalFinale.addEventListener('seeking',()=>{finaleMediaStarted=false;});
   personalFinale.addEventListener('seeked',()=>{
    if(finalePlaying&&!personalFinale.paused)finaleMediaStarted=true;
   });
   personalFinale.addEventListener('waiting',()=>{finaleMediaStarted=false;});
   personalFinale.addEventListener('pause',()=>{finaleMediaStarted=false;});
   personalFinaleName=String(name||'Personal finale track');
  }
  return true;
 }

 function stopFinale(){
  stopWindUp();
  finaleMediaStarted=false;
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
  // Always prime muted media during the user's finishing click, including
  // when Music is Off. Silent playback keeps the 3D show synchronized.
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
 function playFinale(durationSeconds=134.699,startAtSeconds=0){
  // The wind-up yields cleanly to the first actual musical note.
  stopWindUp();
  // Music Off must NOT run the media silently: the choreography holds
  // until Music is enabled, then plays from its preserved exact position.
  if(document.hidden)return false;
  const offset=Math.max(0,Math.min(134.599,
   Number(startAtSeconds)||0));
  const selected=personalFinale||ensureLicensedFinale();
  if(selected){
   // The licensed MP3 is the DEFAULT finale soundtrack for every player;
   // visitors may still override it with a private personal selection.
   // Its audio currentTime is authoritative for the 150 BPM 3D animation.
   const clip=selected;
   if(music&&!music.paused){music.pause();music.volume=0;}
   try{
    // Enabling sound mid-performance should JOIN the duck at its current
    // beat, not start an unrelated song from the beginning.
    clip.currentTime=offset;
    // A buffered silent preload may already be playing. Otherwise
    // wait for the real 'playing' event before advancing the duck.
    finaleMediaStarted=!clip.paused&&!clip.seeking&&clip.readyState>=3;
    clip.volume=.72;
    clip.muted=!musicEnabled;
    finaleClockStart=performance.now();
    finaleSynthClockStart=null;
    finalePlaying=true;latestEffect='finale';
    syncFinaleMusicVolume();
    clip.onended=()=>{
     if(clip!==activeFinaleAudio())return;
     finalePlaying=false;
     // Notify the same frame the last audible sample finishes, not when
     // Three.js happens to paint another frame several ticks later.
     window.dispatchEvent(new Event('nothing-here-finale-ended'));
     if(musicEnabled&&gestureReady&&!document.hidden)startMusic();
    };
    if(musicEnabled&&clip.paused)clip.play()?.catch?.(error=>{
     if(clip!==activeFinaleAudio())return;
     console.warn('Finale MP3 playback:',error?.message||error);
     if(clip===licensedFinale){
      licensedUnavailable=true;licensedFinale=null;
      finalePlaying=false;playFinale(durationSeconds,offset); // synth backup, same beat
     }else finalePlaying=false;
    });
    if(!musicEnabled&&!clip.paused)clip.pause();
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
   const ctx=fluteContext,anchor=ctx.currentTime+.055;
   const duration=Math.min(180,Math.max(1,Number(durationSeconds)||134.699));
   const now=anchor-Math.min(offset,duration-.10);
   const master=ctx.createGain();
   master.gain.setValueAtTime(.0001,anchor);
   master.gain.exponentialRampToValueAtTime(musicEnabled?.35:.0001,anchor+.15);
   master.connect(ctx.destination);
   finaleClockStart=performance.now();
   finaleSynthClockStart=now;
   finaleMaster=master;finalePlaying=true;latestEffect='finale';
   syncFinaleMusicVolume();
   // Freeze the synth transport while muted; starting it silently would
   // make the duck leap several beats when the Music button is enabled.
   if(!musicEnabled&&ctx.state==="running")
    ctx.suspend()?.catch?.(()=>{});
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
   // Seek the synthesized fallback to the same musical beat when a
   // listener turns audio on after the duck has already begun dancing.
   let next=Math.max(0,Math.ceil((anchor-now)/half));
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
    window.dispatchEvent(new Event('nothing-here-finale-ended'));
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
  if(document.hidden){
   if(music)music.pause();
   // Preserve the soundtrack position rather than silently advancing
   // while the browser renders no frames in a hidden tab.
   const clip=activeFinaleAudio();
   if(finalePlaying&&clip&&!clip.paused)clip.pause();
   finaleMediaStarted=false;
  }
  if(finalePlaying){
   syncFinaleMusicVolume();
   if(!document.hidden&&musicEnabled){
    const clip=activeFinaleAudio();
    if(clip?.paused&&!clip.ended)clip.play()?.catch?.(()=>{});
    if(finaleMaster&&fluteContext?.state==="suspended")
     fluteContext.resume()?.catch?.(()=>{});
   }
  }else if(!document.hidden&&musicEnabled&&gestureReady&&
   !windUpActive)startMusic();
 });
 window.addEventListener('pagehide',()=>{stopFinale();if(music)music.pause()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
 else bind();
 window.NothingHereAudio={
  play,toneFor,playFluteNote,prepareFinale,playFinale,stopFinale,getFinaleClock,action,setSfx,setMusic,setPersonalFinaleFile,pauseLobbyMusic,
  startWindUp,syncWindUp,stopWindUp,
  getState:()=>({
   sfxEnabled,musicEnabled,latestEffect,finalePlaying,
   windUpActive,windUpSeconds,windUpNext,windUpNoteCount:windUpBeats.length,
   finaleMusicAudible:finalePlaying&&musicEnabled&&!document.hidden&&
    Number.isFinite(getFinaleClock()),
   finaleSceneActive:finaleSceneActive(),musicCreated:!!music,
   personalFinaleReady:!!personalFinale,personalFinaleName,
   licensedFinaleReady:!!licensedFinale&&!licensedUnavailable,
   finaleMediaStarted,
   licensedFinalePlaying:!!licensedFinale&&!licensedFinale.paused&&!licensedFinale.muted,
   finaleSeconds:getFinaleClock(),
   finaleEnded:!!activeFinaleAudio()?.ended,
   personalFinalePlaying:!!personalFinale&&!personalFinale.paused&&!personalFinale.muted,
   musicPlaying:!!music&&!music.paused,
   musicLoop:music?.loop??true,soundFileCount:Object.keys(files).length,
   oggSupported:oggOk
  })
 };
})();
