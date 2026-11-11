import assert from "node:assert/strict";
import {statSync,readFileSync} from "node:fs";
import {CAT_REFERENCE_DURATION,CAT_MUSIC_BPM,CAT_BEAT_SECONDS,
 CAT_SPIN_BEATS,CAT_SCENES,CAT_POSE_CUTS,CAT_YAW_TURN_RATES,sceneAt,motionAt,referenceLumaAt
} from "../secrets-3d-finale-timeline.js";
assert.equal(CAT_REFERENCE_DURATION,134.699);
assert.equal(CAT_MUSIC_BPM,150);
assert.equal(CAT_BEAT_SECONDS,.4);
assert.equal(CAT_SPIN_BEATS,8);
const audio=new URL("../audio/nothing-here/finale-licensed.mp3",import.meta.url);
const bytes=statSync(audio).size;
assert(bytes>1_000_000,"Licensed complete MP3 missing from the public build: "+bytes);
const head=readFileSync(audio).subarray(0,3).toString("ascii");
assert(head==="ID3"||head.charCodeAt(0)===255,
 "The installed file is not an MP3");
for(let i=1;i<CAT_SCENES.length;i++)
 assert(CAT_SCENES[i][0]>CAT_SCENES[i-1][0],"Scene cuts not chronological");
assert.equal(sceneAt(3).name,"green");
assert.equal(sceneAt(30).name,"nebula");
// Audio-driven timing is measured from the actual installed MP3's 45–170Hz
// transient peaks (by scripts/audit-nothing-here-audio-beats.py), not a
// mathematically perfect beat grid. The visual cue must START AT the real
// attack: audio.currentTime already owns video playback timing.
const introAttacks=[1.64,4.38,8.04,11.26,14.43,17.62,20.81];
const introStarts=CAT_POSE_CUTS.filter(([,mode])=>mode==="loaf").slice(0,7)
 .map(([time])=>time);
assert.equal(introStarts.length,introAttacks.length);
for(let i=0;i<introStarts.length;i++){
 const lead=introAttacks[i]-introStarts[i];
 assert(Math.abs(lead)<.011,
  "Opening duck must not anticipate the MP3 attack at "+introAttacks[i]+
  "s by "+lead.toFixed(3)+"s");
}
// The character, its tiny bob and the first lighting accents MUST use
// the same decoded audio attack, not three slightly different clocks.
// The 4.38s kick in particular is ~60ms early relative to the global grid.
for(const attack of introAttacks){
 const before=motionAt(attack-.012),at=motionAt(attack),
  after=motionAt(attack+.055);
 assert(!before.spinning&&before.spinRadians===0,
  "Premature opening spin before the MP3 attack at "+attack);
 assert(at.spinning&&at.poseStart===attack&&at.spinRadians===0,
  "Opening yaw must begin at (never ahead of) the MP3 attack "+attack);
 assert(at.beatPulse>.99&&at.beatPhase<.001&&after.spinRadians>.20,
  "Duck yaw, bounce and lighting are not locked to the same audible kick "+
   attack+": "+JSON.stringify({at,after}));
}
// Later bass drops are also measured from the full 134.7s MP3.
// Previously the mascot could begin 130–180ms before the actual kick.
for(const attack of [62.40,68.31,75.03,104.00]){
 const before=motionAt(attack-.012),at=motionAt(attack),
  after=motionAt(attack+.06);
 assert(!before.spinning&&before.spinRadians===0,
  "Late mascot spin anticipated the actual musical drop at "+attack);
 assert(at.spinning&&at.poseStart===attack&&at.spinRadians===0&&
  at.beatPulse>.99&&after.spinRadians>.2,
  "Late spin, bounce and lighting are not locked to the recorded kick at "+
  attack+": "+JSON.stringify({before,at,after}));
}
console.log("PASS: 4 late musical drops start spinning ON recorded bass attacks");
// Sweep every 60Hz frame over the ENTIRE finale, catching reversed yaw,
// discontinuities, premature cut changes and unreasonably fast turns.
// Angle may reset to zero only at an authored front-facing pose cut.
let maxObservedRps=0,minObservedRps=Infinity,comparedFrames=0;
for(let t=0;t<CAT_REFERENCE_DURATION-1/60;t+=1/60){
 const a=motionAt(t),b=motionAt(t+1/60);
 if(!a.spinning){
  assert(a.spinRadians===0,
   "Cat rotated during the front-facing hold at "+t);
 }
 if(a.spinning&&b.spinning){
  const rps=(b.spinRadians-a.spinRadians)/(2*Math.PI/60);
  assert(rps>0&&rps<8,
   "The spin reversed or whipped unnaturally between two video frames: "+
    JSON.stringify({time:t,rps}));
  maxObservedRps=Math.max(maxObservedRps,rps);
  minObservedRps=Math.min(minObservedRps,rps);
  comparedFrames++;
 }
}
assert(comparedFrames>5500&&maxObservedRps<8&&minObservedRps>0,
 "Full soundtrack spin sweep was not sampled correctly");
console.log("PASS: all 7 early cues align yaw/bounce/lights and full "+
 comparedFrames+"-frame music sweep keeps forward-only yaw");
for(const [time,mode] of CAT_POSE_CUTS.slice(1,16)){
 if(mode==="front")
  assert(motionAt(time).beatPhase<.001,
   "Duck front-facing rest should settle on 150-BPM beat "+time);
}
assert(motionAt(14.44).bob>.045&&motionAt(14.64).bob<.01,
 "Duck bobbing must bounce on the same beat as music, not at an unrelated rate");
assert.equal(motionAt(30.44).revolutionsPerSecond,5,
 "Red-section duck should spin exactly twice per 150 BPM beat");
assert(Math.abs((motionAt(30.84).spinRadians-
 motionAt(30.44).spinRadians)-4*Math.PI)<.0001,
 "Red-section spin angle drifts between musical downbeats");
assert(!motionAt(29.20).spinning&&!motionAt(29.60).spinning&&
 !motionAt(30.30).spinning&&!motionAt(30.439).spinning&&
 motionAt(30.44).spinning&&motionAt(30.60).spinning&&
 sceneAt(30.44).name==="nebula",
 "Duck must hold still through the quiet 29–30s break and spin only after the music returns");
assert(Math.min(motionAt(30.44).beatPhase,
 1-motionAt(30.44).beatPhase)<.01,
 "Red-nebula spin cue must hit a 150 BPM beat, not the middle of a beat");
assert.equal(sceneAt(38).name,"tunnel");
assert.equal(sceneAt(61).name,"white");
assert.equal(sceneAt(68).name,"redstars");
assert.equal(sceneAt(76).name,"bluerays");
assert.equal(sceneAt(83).name,"green");
assert.equal(sceneAt(90).name,"white");
assert.equal(sceneAt(91).name,"ice");
assert.equal(sceneAt(112).name,"tunnel");
assert.equal(sceneAt(122).name,"laser");
assert.equal(sceneAt(121).scene,9);
assert.equal(sceneAt(126).name,"digital");
assert.equal(sceneAt(134).name,"green");
assert(CAT_POSE_CUTS.length>=40,"Video-wide standing/loaf pose cuts missing");
assert.equal(sceneAt(102).name,"redstars");
assert.equal(sceneAt(88).name,"ice");
assert(referenceLumaAt(59.5)>.85&&referenceLumaAt(80)<.15,
 "Video-derived white-out and near-black exposure are lost");
// Verify the real 30fps source: standing holds alternate with swift
// left-to-right Y-axis spins, never an X-axis barrel roll.
const front=[.2,1.2,3.15,4.0,6.4,60.5,61.2,65,67,68,70.5,73];
const tumbling=[1.9,2.4,4.9,5.3,8.5,14.9,18.5,34.2,37.7,65.5,68.5,69,71.5,114.2];
for(const t of front)assert(!motionAt(t).spinning,
 "The cat should be facing forward (NOT spinning) at "+t);
for(const t of tumbling)assert(motionAt(t).spinning,
 "The cat should be spinning at "+t);
assert(motionAt(2.0).sideways>.8&&motionAt(2.0).spinAxis==="y"&&
 motionAt(2.0).spinMode==="rapid",
 "The first fast horizontal yaw spin from the reference is missing");
assert(motionAt(34.2).spinAxis==="y"&&
 motionAt(34.2).sourceRevolutionsPerSecond>=5.8&&
 motionAt(34.2).beatLockedRotation,
 "The high-energy spin must retain its source intensity AND lock to beats");
assert.equal(CAT_YAW_TURN_RATES[0][1],6);
assert.equal(motionAt(2.0).sourceRevolutionsPerSecond,6);
assert.equal(motionAt(8.2).sourceRevolutionsPerSecond,5);
// Two complete yaw revolutions per 400ms musical beat, with an audible
// acceleration on each downbeat. Five-to-six-rps independent spinning
// made the duck drift in orientation relative to the soundtrack.
for(const [a,b] of [[1.64,2.04],[4.44,4.84],[30.44,30.84],
 [36.84,37.24],[108.84,109.24]]){
 const diff=motionAt(b).spinRadians-motionAt(a).spinRadians;
 assert(Math.abs(diff-4*Math.PI)<.0001,
  "Duck did not complete exactly two turns on the 150 BPM beat: "+
   JSON.stringify({a,b,diff}));
}
const angleAdvance=t=>motionAt(t+.018).spinRadians-motionAt(t).spinRadians;
assert(angleAdvance(1.64)>angleAdvance(1.83)*1.30,
 "Duck's fast angular acceleration should visibly land on each musical kick");
for(const [time,mode] of CAT_POSE_CUTS.slice(1)){
 if(mode!=="front"||time<=.01)continue;
 const before=motionAt(time-.0001);
 if(!before.spinning)continue;
 const phase=Math.abs(Math.atan2(Math.sin(before.spinRadians),
  Math.cos(before.spinRadians)));
 assert(phase<.03,
  "Duck must settle face-on before every musical hold: "+time);
}
// Smooth acceleration changes at 33s must never teleport the cat.
const before=motionAt(32.999).spinRadians;
const after=motionAt(33.001).spinRadians;
assert(Math.abs(after-before)<.15&&after>before,
 "Changing from nebula to tunnel abruptly jumps the cat orientation");
for(const t of [.4,1.2,16.4,35.2,71.4,117.2]){
 const a=motionAt(t),b=motionAt(t+CAT_BEAT_SECONDS);
 assert(b.beatIndex===a.beatIndex+1,
  "Spinning-cat beat index drifts from the soundtrack at "+t);
}
assert(motionAt(33.0).flash>.9,
 "The transition into the first neon tunnel has no hard white flash");
assert(motionAt(108.84).spinning&&motionAt(119.4).spinning,
 "The closing high-energy section must keep tumbling");
const flashes=Array.from({length:210},(_,i)=>motionAt(33+i*.04).flash);
assert(flashes.filter(x=>x>.5).length>=4,
 "The neon section should visibly strobe on multiple musical downbeats");
console.log("PASS: authorized MP3, beat-locked horizontal yaw, "+
 "front holds, soundtrack-timed scene cuts and hard-white flashes");
