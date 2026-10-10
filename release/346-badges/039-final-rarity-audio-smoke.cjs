/* Regression: all seven final rarity audio cues and no premature run-completion sound. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const game=fs.readFileSync(path.resolve(__dirname,'../../game.js'),'utf8');
const a=game.indexOf('function sound(kind,tier=null){'),b=game.indexOf('\nfunction pop(',a);
const c=game.indexOf('function resolve(s,serverReply=null){'),d=game.indexOf('\nfunction hideDrawPlaceholder(',c);
assert.ok(a>=0&&b>a&&c>=0&&d>c,'Actual sound and resolve functions must exist');
const soundSource=game.slice(a,b),resolveSource=game.slice(c,d);
const notesStart=game.indexOf('const CRILO_FINAL_RARITY_NOTES=');
const notesEnd=game.indexOf('\nlet lastFinalAnimationMs=',notesStart);
assert.ok(notesStart>=0&&notesEnd>notesStart,'Missing shared sound and animation timeline');
const notesSource=game.slice(notesStart,notesEnd);
assert.ok(resolveSource.indexOf('if(spins<=0){')>=0&&
 resolveSource.indexOf("sound('final',rarity().color)")>resolveSource.indexOf('if(spins<=0){')&&
 resolveSource.indexOf('endRun();')>resolveSource.indexOf("sound('final',rarity().color)"),
 'Final rarity cue must happen only in confirmed zero-spins completion');
const recorded=[];
const ac={
 currentTime:10,state:'running',destination:{},
 createOscillator(){
  const o={type:'sine',frequency:{setValueAtTime:n=>{o.pitch=n;},
   exponentialRampToValueAtTime:n=>{o.target=n;}},connect(){},
   start(t){recorded.push({pitch:o.pitch,target:o.target||o.pitch,type:o.type,time:t})},stop(){}};
  return o;
 },
 createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};},
 createDynamicsCompressor(){return{threshold:{value:0},knee:{value:0},
  ratio:{value:0},attack:{value:0},release:{value:0},connect(){}};}
};
const buildSound=(p,storage)=>new Function('window','profile','localStorage',notesSource+'\n'+soundSource+'\nreturn sound;')(
 {AudioContext:function(){return ac;}},p,storage);
const play=buildSound({sound_enabled:true},{getItem:()=>null});
const motifs=new Set();
for(const tier of ['trash','common','uncommon','rare','epic','anomaly','mythic']){
 recorded.length=0;play('final',tier);
 const sequence=JSON.stringify(recorded.map(v=>[v.pitch,v.target,v.type]));
 assert.ok(recorded.length>=2,'No sound for '+tier);
 assert.ok(!motifs.has(sequence),'Duplicate sound for '+tier);
 assert.ok(recorded[0].time>=10.2,'Result sound should follow landing noise');
 motifs.add(sequence);
}
assert.equal(motifs.size,7);
recorded.length=0;
buildSound({sound_enabled:false},{getItem:()=>null})('final','epic');
assert.equal(recorded.length,0,'Profile mute should work');
buildSound({sound_enabled:true},{getItem:()=> 'off'})('final','epic');
assert.equal(recorded.length,0,'Site mute should work');
function simulate(type,spins=0,rarityColor='epic'){
 const calls=[],fns=[
 'let guestRun=false,score=25,spins=arguments[0],multiplier=1,upgrades=0,doubles=0,ducks=0,totalSpins=1,numbersLanded=0,extraSpins=0,runProbability=1,bestRollPoints=0,bestRollLabel=\'\';',
 'let segments=[{type:\'num\',base:2},{type:\'duck\'},{type:\'upgrade\'},{type:\'double\'},{type:\'spins\'}];let results=[];',
 'const guestOwnsDaily=()=>true,guestSaveOrPause=()=>true;',
 'const sound=(kind,tier)=>arguments[1].push({kind,tier}),playFinalScoreWave=tier=>arguments[1].push({kind:\'wave\',tier});',
 'const $=()=>({textContent:\'\',disabled:false}),fmt=n=>String(n),pop=()=>{},bump=()=>{},update=()=>{},addNumbers=()=>{};',
 'const addDuck=()=>{ducks++;return{};},DuckWorld={playSound:()=>{}},outcomeProbability=()=>.1,label=s=>s.type,recordBest=()=>{};',
 'const rarity=()=>({color:arguments[2]}),endRun=()=>arguments[1].push({kind:\'endRun\'});',
 resolveSource,'resolve({type:arguments[3],base:2});',
 'return{spins,score,results,extraSpins,ducks,upgrades,doubles};'
 ].join('\n');
 return {state:new Function(fns)(spins,calls,rarityColor,type),calls};
}
for(const kind of ['duck','double','upgrade','spins']){
 const {state,calls}=simulate(kind);
 assert.ok(state.spins>0,kind+' must give another spin');
 assert.equal(calls.some(x=>x.kind==='final'),false,kind+' cannot play finishing sound');
 assert.equal(calls.some(x=>x.kind==='endRun'),false,kind+' cannot finish game');
}
assert.equal(simulate('num',3).calls.some(x=>x.kind==='final'),false);
const completed=simulate('num',0,'mythic');
assert.deepEqual(completed.calls.filter(x=>x.kind==='final'||x.kind==='wave'||x.kind==='endRun')
 .map(x=>x.kind),['final','wave','endRun']);
assert.equal(completed.calls.find(x=>x.kind==='final').tier,'mythic');
assert.equal(completed.calls.find(x=>x.kind==='wave').tier,'mythic');
console.log('PASS: seven distinct rarity cues, all mute switches respected.');
console.log('PASS: Duck, ×2, Upgrade and +2 suppress premature final sound.');
console.log('PASS: final numeric landing triggers exactly one classified cue.');
