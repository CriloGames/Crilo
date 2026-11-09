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
}
const timers=new Map();let next=0;let finaleEndedEvents=0;
const window={AudioContext,addEventListener(){},
 dispatchEvent(event){
  if(event.type==="nothing-here-finale-ended")finaleEndedEvents++;
  return true;
 }};
const document={hidden:false,readyState:"complete",
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
console.log("PASS: fallback 150 BPM, audio clock remains still while buffered/suspended, correct ending");
