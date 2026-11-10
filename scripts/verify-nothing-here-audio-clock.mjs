import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
// Run the actual browser audio module in a minimal mocked AudioContext.
// No wall-clock timers are allowed to make the soundtrack or duck advance.
const original=readFileSync(new URL("../nothing-here-audio.js",import.meta.url),"utf8");
const starts=[];let audioContext=null,wallMs=0;
class Param{
 constructor(){this.value=0;}
 setValueAtTime(v){this.value=v}
 exponentialRampToValueAtTime(){}
 setTargetAtTime(){}
 cancelScheduledValues(){}
}
class Gain{
 constructor(){this.gain=new Param()}
 connect(){return this}
 disconnect(){}
}
class Osc{
 constructor(){this.frequency=new Param()}
 connect(){return this}
 start(t){starts.push(t)}
 stop(){}
}
class AudioContext{
 constructor(){audioContext=this;this.currentTime=0;this.state="running";this.destination={}}
 createGain(){return new Gain()}
 createOscillator(){return new Osc()}
 resume(){this.state="running";return Promise.resolve()}
 suspend(){this.state="suspended";return Promise.resolve()}
}
const timers=new Map();let next=0;let finaleEndedEvents=0;
let finaleActive=false,finaleRequests=0,finaleMutedEvents=0;
const window={AudioContext,addEventListener(){},
 dispatchEvent(event){
  if(event.type==="nothing-here-finale-ended")finaleEndedEvents++;
  if(event.type==="nothing-here-finale-audio-request")finaleRequests++;
  if(event.type==="nothing-here-finale-audio-muted")finaleMutedEvents++;
  return true;
 }};
const document={hidden:false,readyState:"complete",
 body:{classList:{contains(name){return finaleActive&&name==="nc-finale-active"}}},
 addEventListener(){},getElementById(){return null}};
const create=new Function("window","document","localStorage","performance",
 "setInterval","clearInterval","setTimeout","clearTimeout",
 "requestAnimationFrame","cancelAnimationFrame",
 original+";return window.NothingHereAudio;");
const audio=create(window,document,
 {getItem(){return null},setItem(){}},{now:()=>wallMs},
 (cb)=>{const id=++next;timers.set(id,cb);return id},
 id=>timers.delete(id),()=>null,()=>{},()=>null,()=>{});
assert(audio.playFinale(5),"Synth fallback did not start");
assert.equal(audio.getFinaleClock(),0);
assert(audioContext,"Web Audio was not initialized");
audioContext.currentTime=1.055;wallMs=120000;
for(const cb of [...timers.values()])cb();
assert(Math.abs(audio.getFinaleClock()-1)<.005,
 "Two minutes of wall time incorrectly advanced one second of music");
assert.equal(audio.getState().finalePlaying,true);
const unique=[...new Set(starts.map(t=>+t.toFixed(5)))].sort((a,b)=>a-b);
assert(unique.length>=10);
assert(Math.abs(unique[1]-unique[0]-.2)<.00001,
 "Fallback hi-hats are not on the 150 BPM half-beat");
assert(Math.abs(unique[2]-unique[0]-.4)<.00001,
 "Fallback kick beat interval is not 400ms at 150 BPM");
audioContext.state="suspended";
wallMs=700000;
for(const cb of [...timers.values()])cb();
assert.equal(audio.getState().finalePlaying,true,
 "Wall time ended music while AudioContext was suspended");
assert(Math.abs(audio.getFinaleClock()-1)<.005,
 "The duck progressed when the context was suspended");
audioContext.state="running";audioContext.currentTime=5.1;
for(const cb of [...timers.values()])cb();
assert.equal(audio.getState().finalePlaying,false);
assert.equal(audio.getFinaleClock(),null);
assert.equal(finaleEndedEvents,1,
 "The visual duck must be notified exactly when backup audio ends");
// Regression: a player who completed the cube with audio off can enable
// either toggle in the open finale. It must request the duck soundtrack,
// never create the menu loop, and join the existing beat when unmuted.
finaleActive=true;
audio.setSfx(false);
audio.setMusic(true);
assert.equal(finaleRequests,1,
 "Turning Music on during the finale failed to request its soundtrack");
assert(!audio.getState().musicCreated,
 "Finale audio toggle created the ordinary background-music loop");
assert(audio.playFinale(5,2),"Turning Music on should allow a late finale start");
assert(Math.abs(audio.getFinaleClock()-2)<.06,
 "Late finale audio failed to join the duck's existing beat");
assert(audio.getState().finaleMusicAudible,
 "Music On must unmute the synthesized finale");
audio.setSfx(true);
audio.setMusic(false);
assert(audio.getState().finalePlaying&&!audio.getState().finaleMusicAudible,
 "Music Off must mute the finale regardless of the Sounds preference");
audio.setSfx(false);
assert(audio.getState().finalePlaying&&finaleMutedEvents===0,
 "Sounds must not terminate the duck's independent music clock");
assert(Math.abs(audio.getFinaleClock()-2)<.06,
 "Muting must not reset the soundtrack playhead");
audio.setMusic(true);
assert(audio.getState().finalePlaying&&audio.getState().finaleMusicAudible,
 "Re-enabling Music must unmute the continuing finale");
assert(Math.abs(audio.getFinaleClock()-2)<.06,
 "Unmuting music must not restart its beat");
audio.stopFinale();
assert(!audio.getState().finalePlaying,"Stop should still end the score");
console.log("PASS: stable 150 BPM clock; Music toggles audible score independently of Sounds");

// Exercise the actual HTMLAudioElement route as well as the synth fallback.
// Music Off must mute, not pause/reseek; on/off rapidly must never restart.
class Track{
 constructor(src=""){
  this.src=src;this.paused=true;this.muted=false;this.volume=1;
  this.currentTime=0;this.readyState=4;this.ended=false;
  this.listeners={};this.playCalls=0;this.pauseCalls=0;
  Track.instances.push(this);
 }
 canPlayType(){return "probably"}
 addEventListener(type,cb){(this.listeners[type]??=[]).push(cb)}
 emit(type){for(const cb of this.listeners[type]||[])cb()}
 play(){
  this.playCalls++;this.paused=false;this.emit("playing");
  return Promise.resolve();
 }
 pause(){this.pauseCalls++;this.paused=true;this.emit("pause")}
 load(){}
}
Track.instances=[];
const makeTrackAudio=new Function("Audio","window","document","localStorage",
 "performance","setInterval","clearInterval","setTimeout","clearTimeout",
 "requestAnimationFrame","cancelAnimationFrame",
 original+";return window.NothingHereAudio;");
// Drive the real button click listeners, not just the exported setter.
function button(){
 const listeners={};
 return {
  attributes:{},classList:{toggle(){}},
  setAttribute(k,v){this.attributes[k]=v},
  querySelector(){return {textContent:""}},
  addEventListener(type,cb){listeners[type]=cb},
  click(){listeners.click?.()}
 };
}
const buttons={ncMusicToggle:button(),ncSfxToggle:button()};
const mediaDocument={...document,getElementById:id=>buttons[id]??null};
const mediaAudio=makeTrackAudio(Track,window,mediaDocument,
 {getItem(){return null},setItem(){}},{now:()=>wallMs},
 ()=>0,()=>{},()=>0,()=>{},()=>0,()=>{});
const clipState0=mediaAudio.getState();
assert(!clipState0.musicEnabled,"Fresh visitor starts with Music Off");
assert(mediaAudio.playFinale(134.699),"Muted finale must start its timeline");
const track=Track.instances.find(x=>x.src.includes("finale-licensed.mp3"));
assert(track&&track.muted&&!track.paused,
 "Initial music-off finale must run the correct MP3 silently");
track.currentTime=23.64;
const mediaStartCount=track.playCalls;
buttons.ncMusicToggle.click();
assert(!track.muted&&track.playCalls===mediaStartCount&&track.currentTime===23.64,
 "Turning Music on must unmute without restarting the real MP3");
buttons.ncSfxToggle.click();
assert(!track.muted&&!track.paused&&mediaAudio.getFinaleClock()===23.64,
 "Turning Sounds off must not affect active Music or the MP3 time");
buttons.ncMusicToggle.click();
assert(track.muted&&!track.paused&&mediaAudio.getFinaleClock()===23.64,
 "Music Off must mute without pausing or seeking the MP3");
buttons.ncSfxToggle.click();
assert(track.muted&&!track.paused,
 "Sounds On must not inadvertently turn the soundtrack on");
buttons.ncMusicToggle.click();
assert(!track.muted&&track.currentTime===23.64&&
 track.playCalls===mediaStartCount,"Re-enabling Music must preserve the exact song beat");
assert.equal(buttons.ncMusicToggle.attributes["aria-pressed"],"true",
 "Music button must display the correct audible state during finale");
mediaAudio.stopFinale();
assert(track.paused,"Stopping the finale must still pause the MP3");
console.log("PASS: real MP3 Music On/Off, Sounds independence, zero restart/seek drift");
