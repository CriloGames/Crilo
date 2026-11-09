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
 motionAt(34.2).revolutionsPerSecond>=5.8,
 "The neon tunnel should retain the fast horizontal spin");
assert.equal(CAT_YAW_TURN_RATES[0][1],6);
assert(Math.abs(motionAt(2.0).revolutionsPerSecond-6)<.01&&
 Math.abs(motionAt(8.2).revolutionsPerSecond-5)<.01,
 "Frame-measured intro (6rps) and middle (5rps) speeds missing");
// The first video pose repeats every five source frames at 30fps.
const d0=motionAt(1.6).spinRadians;
const d1=motionAt(1.6+5/30).spinRadians;
assert(Math.abs((d1-d0)-2*Math.PI)<.0001,
 "The first spin must turn 360 degrees in five 30fps frames");
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
console.log("PASS: authorized MP3, source-sampled 5-6rps horizontal yaw, "+
 "front holds, soundtrack-timed scene cuts and hard-white flashes");
