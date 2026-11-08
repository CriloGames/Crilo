import assert from "node:assert/strict";
import {statSync,readFileSync} from "node:fs";
import {CAT_REFERENCE_DURATION,CAT_MUSIC_BPM,CAT_BEAT_SECONDS,
 CAT_SPIN_BEATS,CAT_SCENES,sceneAt,motionAt
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
assert.equal(sceneAt(90).name,"ice");
assert.equal(sceneAt(112).name,"tunnel");
assert.equal(sceneAt(122).name,"kaleidoscope");
assert.equal(sceneAt(134).name,"white");
for(const t of [0,1.2,16,35,71.4,117]){
 const a=motionAt(t),b=motionAt(t+CAT_BEAT_SECONDS);
 assert(b.beatIndex===a.beatIndex+1,
  "Spinning-cat beat index drifts from the soundtrack at "+t);
 assert(Math.abs(motionAt(t+3.2).spinRadians-a.spinRadians-2*Math.PI)<1e-6,
  "Cat does not complete one turn per eight beats");
}
assert(motionAt(1.9).sideways>.8,
 "Cat never dips toward the reference's sideways loaf silhouette");
console.log("PASS: shipped authorized MP3, 150 BPM spin/roll and all timed scene cuts");
