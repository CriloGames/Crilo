'use strict';
/* A completed official Daily must populate the Play HUD from daily_runs, not
   from the untouched local score of zero. No real credentials or DB calls. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'game.js'),'utf8');
const start=source.indexOf('function update(){');
const end=source.indexOf('// The music and visual letter pops',start);
const recapStart=source.indexOf('function showDailyRecap(');
const recapEnd=source.indexOf('function renderResult(',recapStart);
const loaded=source.indexOf('async function checkPlayed(){');
const stop=source.indexOf('function open(id)',loaded);
assert.ok(start>=0&&end>start&&recapStart>=0&&recapEnd>recapStart&&loaded>=0&&stop>loaded,
 'Real score-update and Daily restoration functions must be present');
const list=()=>({items:new Set(),add(v){this.items.add(v)},remove(v){this.items.delete(v)},
 contains(v){return this.items.has(v)},toggle(v,enabled){enabled?this.add(v):this.remove(v)}});
const mk=()=>({textContent:'',hidden:false,dataset:{},classList:list(),
 attrs:{},setAttribute(k,v){this.attrs[k]=v}});
const ids=['score','wheelScorePanel','scoreTier','scoreTierHint','scoreTierText',
 'spins','level','duckCount','playedPanel','playedText','spinButton',
 'message','dailyCompleteDetails','completedDailyScore','completedDailyRarity',
 'completedDailyCountdown','ownerCompleteRecap','ownerCompleteScore','ownerCompleteNext',
 'resultNextCountdown'];
const nodes=Object.fromEntries(ids.map(k=>[k,mk()]));
const eyebrow=mk(),playedHeading=mk();
nodes.wheelScorePanel.querySelector=s=>s==='.wheel-score-eyebrow'?eyebrow:null;
nodes.playedPanel.querySelector=s=>s==='strong'?playedHeading:null;
let drawCount=0,lockCount=0,beginCount=0,panelMode='',queryCount=0;
let guestSaved=null;
const saved={score:69,spins:7,upgrades:2,doubles:1,ducks:2,drawing:null,daily_period:'2026-10-12'};
const query={
 select(columns){assert.match(columns,/score,spins,upgrades,doubles,ducks/);return this},
 eq(){return this},
 async maybeSingle(){queryCount++;return{data:{...saved},error:null}}
};
const sandbox={
 window:{CriloRarity:{scoreBands:[
 {key:'trash',max:6},{key:'common',max:24},{key:'uncommon',max:48},
 {key:'rare',max:92},{key:'epic',max:141},{key:'anomaly',max:300},
 {key:'mythic',max:Infinity}]}},
 $:id=>nodes[id]||null,fmt:n=>String(Number(n)||0),
 drawWheel(){drawCount++},lockDrawing(){lockCount++},
 setDrawingPanelMode(mode){panelMode=mode},
 guestDailyRecord(){return guestSaved},
 beginRun(){beginCount++},
 Crilo:{dailyPeriod(){return'2026-10-12'}},
 criloDB:{
  async rpc(name){assert.equal(name,'crilo_my_daily_penalty');return{data:null,error:null}},
  from(name){assert.equal(name,'daily_runs');return query}
 }
};
const setup=`let user={id:'signed-in-user'},profile={is_owner:false};
let officialRun=null,started=false,isTest=false,guestRun=false;
let results=[],score=0,spins=5,multiplier=1,ducks=0;`;
const code=setup+'\n'+source.slice(start,end)+'\n'+
 source.slice(recapStart,recapEnd)+'\n'+source.slice(loaded,stop)+
 ';({update,checkPlayed,setState(v){'+
 'if("started" in v)started=v.started;'+
 'if("user" in v)user=v.user;'+
 'if("profile" in v)profile=v.profile;'+
 'if("isTest" in v)isTest=v.isTest;'+
 'if("guestRun" in v)guestRun=v.guestRun;'+
 'if("officialRun" in v)officialRun=v.officialRun;'+
 'if("results" in v)results=v.results;'+
 'if("score" in v)score=v.score;'+
 'if("spins" in v)spins=v.spins;'+
 'if("multiplier" in v)multiplier=v.multiplier;'+
 'if("ducks" in v)ducks=v.ducks;'+
 '},getSaved(){return officialRun},showDailyRecap,syncDailyCountdown})';
const api=vm.runInNewContext(code,sandbox);
(async()=>{
 api.update();
 assert.equal(nodes.score.textContent,'0');
 assert.equal(nodes.wheelScorePanel.dataset.rarity,'unrevealed');
 assert.equal(nodes.scoreTierHint.hidden,false);
 await api.checkPlayed();
 assert.equal(queryCount,1,'Saved official Daily must be fetched once');
 assert.equal(lockCount,1,'Completed Daily drawing must stay locked');
 assert.equal(panelMode,'complete');
 assert.equal(nodes.playedText.textContent,'Your result is saved. You’re all set for today.');
 assert.equal(nodes.dailyCompleteDetails.classList.contains('hidden'),false);
 assert.equal(nodes.completedDailyScore.textContent,'69');
 assert.equal(nodes.completedDailyRarity.textContent,'RARE');
 assert.equal(nodes.completedDailyRarity.dataset.rarity,'rare');
 assert.equal(nodes.message.classList.contains('hidden'),true,
  'Logged-in complete result should not display guest signup messaging');
 assert.equal(nodes.score.textContent,'69','Wheel score must match saved Daily');
 assert.equal(eyebrow.textContent,'DAILY SCORE');
 assert.equal(nodes.wheelScorePanel.dataset.rarity,'rare');
 assert.equal(nodes.scoreTierText.textContent,'RARE');
 assert.equal(nodes.scoreTier.hidden,false);
 assert.equal(nodes.scoreTierHint.hidden,true,'Do not prompt a new spin on completed Daily');
 assert.equal(nodes.spins.textContent,0,'Completed Daily has no remaining spins');
 assert.equal(nodes.level.textContent,'×9','Two saved upgrades must restore displayed values');
 assert.equal(nodes.duckCount.textContent,2);
 assert.equal(api.getSaved().score,69);
 api.syncDailyCountdown('01:23:45');
 assert.equal(nodes.completedDailyCountdown.textContent,'01:23:45');
 assert.equal(nodes.ownerCompleteNext.textContent,'Next Daily in 01:23:45');
 assert.equal(nodes.resultNextCountdown.textContent,'01:23:45');
 api.setState({profile:{is_owner:true}});
 api.showDailyRecap(saved,'official');
 assert.equal(nodes.ownerCompleteRecap.classList.contains('hidden'),false,
  'Owner should see official Daily score beside private Test Run choice');
 assert.equal(nodes.ownerCompleteScore.textContent,'69 points · RARE');
 api.setState({profile:{is_owner:false}});
 api.showDailyRecap({score:0,blocked:true},'blocked');
 assert.equal(nodes.dailyCompleteDetails.classList.contains('hidden'),true,
  'Removed Dailies must not show a celebratory score recap');
 assert.equal(nodes.ownerCompleteRecap.classList.contains('hidden'),true);
 api.showDailyRecap(saved,'official');
 api.showDailyRecap(null);
 assert.equal(nodes.dailyCompleteDetails.classList.contains('hidden'),true,
  'Starting a different run must clear the previous recap');
 api.setState({isTest:true,started:true,score:7,spins:3,multiplier:2,ducks:1,
  results:[{type:'num'}]});
 api.update();
 assert.equal(nodes.score.textContent,'7','Owner Test Run must not inherit Daily score');
 assert.equal(eyebrow.textContent,'CURRENT SCORE');
 assert.equal(nodes.spins.textContent,3);
 api.setState({isTest:false,started:true,officialRun:null,score:0,spins:5,
  multiplier:1,ducks:0,results:[]});
 api.update();
 assert.equal(nodes.score.textContent,'0','New Daily must start at zero');
 assert.equal(nodes.scoreTierHint.hidden,false,'New Daily must keep neutral unrevealed tier');
 api.setState({started:false,officialRun:{score:0,upgrades:0,ducks:0}});
 api.update();
 assert.equal(nodes.wheelScorePanel.dataset.rarity,'trash',
  'A valid saved zero-point Daily is completed, not unrevealed');
 api.setState({officialRun:{score:0,blocked:true},results:[]});
 api.update();
 assert.equal(nodes.wheelScorePanel.dataset.rarity,'unrevealed',
  'Moderation-blocked Dailies must not reveal a removed score');
 // Completed guest progress is explicitly labeled, never treated as an
 // official leaderboard entry or shown as an untouched starting score.
 guestSaved={status:'complete',score:12,state:{upgrades:1,ducks:3}};
 api.setState({user:null,officialRun:null,started:false,guestRun:false,
  isTest:false,results:[],score:0,spins:5,multiplier:1,ducks:0});
 api.update();
 assert.equal(nodes.score.textContent,'12');
 assert.equal(eyebrow.textContent,'GUEST SCORE');
 assert.equal(nodes.wheelScorePanel.dataset.rarity,'common');
 assert.equal(nodes.spins.textContent,0);
 assert.equal(nodes.level.textContent,'×3');
 assert.equal(nodes.duckCount.textContent,3);
 api.showDailyRecap(guestSaved,'guest');
 assert.equal(nodes.completedDailyScore.textContent,'12');
 assert.equal(nodes.completedDailyRarity.textContent,'COMMON');
 assert.equal(nodes.ownerCompleteRecap.classList.contains('hidden'),true);
 assert.ok(drawCount>=5);
 assert.equal(beginCount,0,'Restoring a saved Daily must not start a new run');
 assert.match(source,/officialRun=\{\.\.\.payload,is_test:false\};\s*update\(\)/,
  'Saving an official Daily must immediately update its completed HUD');
 console.log('RESTORED_DAILY_SCORE_PASS: official/guest score recaps, owner view, shared reset countdown, removed-run guard');
})().catch(error=>{console.error(error);process.exitCode=1});
