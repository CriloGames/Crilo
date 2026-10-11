'use strict';
/* Site sound contract: zero network downloads, sound-toggle compliance,
   no passive autoplay, safe click delegation and all website entry points. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('site-sounds.js','utf8');
new Function(code);
const primary=['index.html','leaderboard.html','ducks.html','badge-sets.html',
 'friends.html','profile.html','settings.html','support.html','beetle-tricks.html',
 'privacy.html','terms.html','owner-analytics.html','moderation.html'];
for(const path of primary){
 const html=fs.readFileSync(path,'utf8');
 assert.match(html,/site-sounds\.js\?v=1/,path+' missing site audio');
 assert.equal((html.match(/site-sounds\.js\?v=1/g)||[]).length,1,path+' has duplicate audio scripts');
}
assert.match(fs.readFileSync('domain/index.html','utf8'),/\.\.\/site-sounds\.js\?v=1/);
assert.doesNotMatch(fs.readFileSync('shape-of-sound.html','utf8'),/site-sounds\.js/,
 'The musical playground must not overlay synthetic UI clicks on its instruments');
assert.match(code,/window\.CriloSFX=Object\.freeze/);
assert.match(code,/const SPECS=Object\.freeze/);
assert.ok(!/fetch\(|XMLHttpRequest|\.mp3|\.wav|\.ogg/i.test(code),
 'All site audio must be synthesized, not network-fetched');
const events={},elements={};
let notes=0,created=0,started=0,storeValue='on';
class FakeElement {
 constructor(selectors){this.selectors=selectors}
 matches(query){return query.split(',').some(x=>this.selectors.includes(x.trim()))}
 closest(query){return this.matches(query)?this:null}
}
class FakeAudio {
 constructor(){created++;this.currentTime=0;this.state='running';this.destination={}}
 createDynamicsCompressor(){
  return {threshold:{},knee:{},ratio:{},attack:{},release:{},connect(){}};
 }
 createGain(){
  return {gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};
 }
 createOscillator(){
  notes++;
  return {frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},
   connect(){},start(){started++},stop(){}};
 }
 resume(){return Promise.resolve()}
}
const fakeWindow={AudioContext:FakeAudio,localStorage:{getItem:()=>storeValue},Crilo:{profile:{sound_enabled:true}}};
const fakeDocument={hidden:false,
 getElementById:()=>null,
 addEventListener:(name,fn)=>{events[name]=fn}};
vm.runInNewContext(code,{document:fakeDocument,window:fakeWindow,Element:FakeElement});
const sound=fakeWindow.CriloSFX;
assert.equal(created,0,'Creating the site script must not initialize audio');
assert.equal(notes,0,'No passive autoplay on startup');
assert.equal(sound.enabled(),true);
for(const kind of ['tap','nav','tab','open','close','toggle','palette','badge',
 'peek','copy','save','friend','notice','wheel','expand','success','error']){
 const old=notes;
 assert.equal(sound.play(kind),true,'Sound missing '+kind);
 assert.ok(notes>old,'Silent cue '+kind);
}
assert.equal(sound.types.length,17);
const before=notes;
storeValue='off';
assert.equal(sound.enabled(),false);
assert.equal(sound.play('badge'),false);
assert.equal(notes,before,'Muted site must not create any oscillators');
storeValue='on';fakeWindow.Crilo.profile.sound_enabled=false;
assert.equal(sound.play('nav'),false,'Server-backed setting must mute site sound');
assert.equal(notes,before);
fakeWindow.Crilo.profile.sound_enabled=true;
fakeDocument.hidden=true;
assert.equal(sound.play('tab'),false,'Background tabs should never sound');
fakeDocument.hidden=false;
const duck=new FakeElement(['.duck-unlocked','[role="button"]']);
const mini=new FakeElement(['.mini-wheel','button']);
const tab=new FakeElement(['.leader-tab','button']);
const spin=new FakeElement(['#spinButton','button']);
const beetle=new FakeElement(['#bugBeetle','button']);
const action=e=>events.click({isTrusted:true,defaultPrevented:false,target:e});
for(const target of [duck,spin,beetle]){
 const old=notes;action(target);assert.equal(notes,old,'Existing bespoke sound must not receive an overlay');
}
action(mini);assert.ok(notes>before,'Mini wheel should have a unique cue');
const afterWheel=notes;action(tab);assert.ok(notes>afterWheel,'Tabs should have a cue');
action(tab);
assert.ok(notes<=afterWheel+6,'Duplicate immediate clicks should be throttled');
assert.equal(sound.play('not-a-real-cue'),false);
console.log('SITE_SOUND_SMOKE_PASS 17 audio motifs, 14 entry points, no autoplay, muted and dedicated-audio isolation');
