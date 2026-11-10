import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
// Run the actual browser audio module in a minimal mocked AudioContext.
// No wall-clock timers are allowed to make the soundtrack or duck advance.
const original=readFileSync(new URL("../nothing-here-audio.js",import.meta.url),"utf8");
const starts=[];let audioContext=null,wallMs=0;
let trackAudibleSignal=true,activityAnalyser=null;
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
 createMediaStreamSource(){return {connect(){return this}}}
 createAnalyser(){
  activityAnalyser={
   fftSize:1024,
   getByteTimeDomainData(data){data.fill(trackAudibleSignal?136:128)}
  };
  return activityAnalyser;
 }
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
audio.setMusic(true);
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
assert.equal(audio.getFinaleClock(),null,
 "A suspended soundtrack MUST NOT authorize duck spinning");
audioContext.state="running";
assert(Math.abs(audio.getFinaleClock()-1)<.005,
 "The score must resume at its exact earlier beat");
audioContext.currentTime=5.1;
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
assert.equal(audio.getFinaleClock(),null,
 "Music Off must freeze the duck instead of advancing in silence");
audio.setMusic(true);
assert(audio.getState().finalePlaying&&audio.getState().finaleMusicAudible,
 "Re-enabling Music must unmute the continuing finale");
assert(Math.abs(audio.getFinaleClock()-2)<.06,
 "Unmuting music must not restart its beat");
audio.stopFinale();
assert(!audio.getState().finalePlaying,"Stop should still end the score");
console.log("PASS: silent/suspended synth freezes duck, resumes on actual 150-BPM clock");
const oldCount=starts.length;
audio.startWindUp();
audio.syncWindUp(0);
audio.syncWindUp(3.23);
audio.syncWindUp(7.83);
audio.syncWindUp(9.43);
assert(audio.getState().windUpActive&&
 audio.getState().windUpNoteCount===21&&
 audio.getState().windUpLastBeatSpacing===.4,
 "Original wind-up must have 21 notes leading to the 150 BPM beat");
assert(starts.length>oldCount,
 "Wind-up synth failed to schedule audible bell notes");
const windUpPlayed=starts.length;
audio.setMusic(false);
audio.syncWindUp(9.5);
assert.equal(starts.length,windUpPlayed,
 "Wind-up kept generating notes when Music was off");
const requestsBeforeWindUpToggle=finaleRequests;
audio.setMusic(true);
assert(audio.getState().windUpActive&&
 finaleRequests===requestsBeforeWindUpToggle,
 "Enabling Music mid-opening must join wind-up, not start the finale MP3");
audio.stopWindUp();
assert(!audio.getState().windUpActive,
 "Wind-up must finish BEFORE licensed soundtrack begins");
console.log("PASS: original accelerated mechanical intro joins 150 BPM, obeys Music toggle");

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
assert(track&&track.muted&&track.paused&&
 mediaAudio.getFinaleClock()===null,
 "Initial Music Off must keep the MP3 paused AND duck stationary");
track.currentTime=23.64;
const mediaStartCount=track.playCalls;
buttons.ncMusicToggle.click();
assert(!track.muted&&!track.paused&&
 track.playCalls===mediaStartCount+1&&track.currentTime===23.64,
 "Turning Music on must resume the MP3 at the saved beat");
buttons.ncSfxToggle.click();
assert(!track.muted&&!track.paused&&mediaAudio.getFinaleClock()===23.64,
 "Turning Sounds off must not affect active Music or the MP3 time");
buttons.ncMusicToggle.click();
assert(track.muted&&track.paused&&mediaAudio.getFinaleClock()===null&&
 track.currentTime===23.64,
 "Music Off must PAUSE the MP3, hold the duck and preserve its beat");
buttons.ncSfxToggle.click();
assert(track.muted&&track.paused,
 "Sounds On must not restart the muted soundtrack");
buttons.ncMusicToggle.click();
assert(!track.muted&&!track.paused&&track.currentTime===23.64&&
 track.playCalls===mediaStartCount+2,
 "Re-enabling Music must RESUME at the exact preserved song beat");
assert.equal(buttons.ncMusicToggle.attributes["aria-pressed"],"true",
 "Music button must display the correct audible state during finale");
mediaAudio.stopFinale();
assert(track.paused,"Stopping the finale must still pause the MP3");
console.log("PASS: real MP3 halts on silence, resumes on original beat, independent Sounds");

// A non-invasive stream meter also stops the duck during actual SILENT
// passages inside an MP3 even while audio.currentTime continues advancing.
Track.prototype.captureStream=function(){
 return {getAudioTracks(){return [{}]}};
};
const meterAudio=makeTrackAudio(Track,window,mediaDocument,
 {getItem(){return null},setItem(){}},{now:()=>wallMs},
 ()=>0,()=>{},()=>0,()=>{},()=>0,()=>{});
meterAudio.setMusic(true);
assert(meterAudio.playFinale(134.699),"Meter source must play");
const metered=Track.instances.at(-1);
metered.currentTime=18.5;
assert(activityAnalyser&&meterAudio.getFinaleClock()===18.5,
 "Real soundtrack audio must authorize spinning");
trackAudibleSignal=false;
wallMs+=630;
metered.currentTime=19.13;
assert(meterAudio.getFinaleClock()===null&&
 meterAudio.getState().finaleQuietSection,
 "Duck must stop spinning during sustained quiet MP3 passages");
trackAudibleSignal=true;
metered.currentTime=19.4;
assert(meterAudio.getFinaleClock()===19.4&&
 !meterAudio.getState().finaleQuietSection,
 "Duck must rejoin the real playback beat after a musical rest");
meterAudio.stopFinale();
console.log("PASS: 520ms silent MP3 passage freezes spin; next sound resumes on audio.currentTime");
