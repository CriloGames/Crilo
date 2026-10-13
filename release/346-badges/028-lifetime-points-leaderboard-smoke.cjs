'use strict';
/* Simulated leaderboard rendering plus server-side aggregate contract.
 No official runs or player records modified. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const script=fs.readFileSync(path.join(root,'leaderboard.js'),'utf8');
const page=fs.readFileSync(path.join(root,'leaderboard.html'),'utf8');
const profile=fs.readFileSync(path.join(root,'profile.js'),'utf8');
assert.match(page,/data-tab="points">TOTAL POINTS/);
assert.match(page,/leaderboard\.js\?v=52/);
assert.match(script,/if\(tab==='points'\)\{await loadTotalPoints\(revision\);return\}/);
assert.match(script,/crilo_total_points_leaders/);
assert.match(profile,/total_points\?\?s\.total_score/);
const outputs=new Map();
const get=id=>{
 if(!outputs.has(id))outputs.set(id,{innerHTML:'',textContent:'',style:{},
  dataset:{},classList:{add(){},remove(){}},addEventListener(){}});
 return outputs.get(id);
};
let called=0,fromCalled=0;
const db={rpc:async(name,args)=>{
 called++;assert.equal(name,'crilo_total_points_leaders');
 assert.equal(args.p_limit,100);
 return {data:[
  {user_id:'u1',username:'Winner',name_color:'#222222',total_points:1000,official_runs:30},
  {user_id:'u2',username:'Friend',name_color:'#222222',total_points:800,official_runs:10},
  {user_id:'u3',username:'Friend Two',name_color:'#222222',total_points:800,official_runs:12}
 ],error:null};
 },from(table){
  fromCalled++;
  assert.equal(table,'profiles','Client must never aggregate daily_runs for lifetime points');
  return {select(columns){
   assert.equal(columns,'id,name_letter_colors');
   return {in(key,ids){
    assert.equal(key,'id');assert.equal(ids.length,3);
    return Promise.resolve({data:[],error:null});
   }};
  }};
 }};
const win={addEventListener(){},CriloNameColors:{paint(el,p){el.textContent=p?.username||'Crilo player'},markup(p){return String(p?.username||'Crilo player')}}},document={
 getElementById:get,querySelectorAll:()=>[]};
const Crilo={profile:{is_owner:false},esc:x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;')};
const modified=script.replace(/load\(\)\}\)\(\);\s*$/,
 'window.__auditLoadTotalPoints=loadTotalPoints;})();');
assert.notEqual(modified,script,'Could not expose lifetime leaderboard loader');
vm.runInNewContext(modified,{window:win,document,Crilo,criloDB:db,console,
 encodeURIComponent,Number,Map,Math});
(async()=>{
 await win.__auditLoadTotalPoints(0);
 assert.equal(called,1);
 assert.equal(fromCalled,1,'One profile color read is allowed; Daily rows must not be queried');
 assert.equal(get('bestScore').textContent,'1,000');
 assert.equal(get('bestHeading').textContent,'ALL-TIME POINTS LEADER');
 assert.match(get('bestStats').textContent,/official Dailies played · lifetime points/);
 assert.ok(!('scoreRarity' in get('bestScore').dataset));
 const html=get('leaderList').innerHTML;
 assert.match(html,/Winner/);
 assert.match(html,/Friend Two/);
 assert.equal((html.match(/class="leader-row crilo-lifetime-points-row"/g)||[]).length,3);
 assert.match(html,/>🥇<\/div>/);
 assert.match(html,/>🥈<\/div>/);
 assert.doesNotMatch(html,/data-score-rarity/);
 assert.match(html,/30 official Dailies played/);
 assert.match(html,/>800<\/div><small class="leader-total-units">pts<\/small>/);
 console.log('PASS: public all-time official points, ties, per-player aggregation, no rarity or client run paging');
})().catch(e=>{console.error(e);process.exitCode=1});
