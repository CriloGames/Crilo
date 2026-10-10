/* Read-only Crilo leaderboard and beetle regression.
 * Uses fake DOM/audio and never touches live accounts or submissions.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'leaderboard.html'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const script=fs.readFileSync(path.join(root,'leaderboard.js'),'utf8');
const beetle=fs.readFileSync(path.join(root,'bug-beetle.js'),'utf8');
const rarityCode=fs.readFileSync(path.join(root,'rarity-system.js'),'utf8');
assert.match(html,/style\.css\?v=87/);
assert.match(html,/rarity-system\.js\?v=10"><\/script><script src="leaderboard-tabs\.js\?v=2"><\/script><script src="leaderboard\.js\?v=35/);
assert.match(index,/bug-beetle\\.js\\?v=9/);
assert.doesNotMatch(html,/ownerTools|previewToggle|previewBanner|OWNER TOOLS|Preview sample players/,
 'Owner Tools panel and sample-preview button must not render for any user');
assert.doesNotMatch(script,/previewRender|togglePreview|previewRows|previewToggle|ownerTools|previewBanner/,
 'Obsolete sample-preview logic must not remain in the leaderboard');
assert.match(css,/\.leader-score-actions\{display:flex/);
assert.match(css,/\.leader-row\.score-run-row\.owner-moderated/);
assert.match(css,/@media\(max-width:600px\)\{[\s\S]*?\.leader-row\.score-run-row \.leader-score-actions\{grid-column:2;grid-row:2/);
const rarityWorld={};
vm.runInNewContext(rarityCode,{window:rarityWorld});
const levels=Array.from(rarityWorld.CriloRarity.scoreBands,x=>x.key);
assert.deepEqual(levels,['trash','common','uncommon','rare','epic','anomaly','mythic']);
function mockNodes(){
 const nodes=new Map();
 const get=id=>{
  if(!nodes.has(id)){
   const set=new Set(['hidden']);
   nodes.set(id,{id,textContent:'',innerHTML:'',src:'',style:{},dataset:{},
    classList:{add:v=>set.add(v),remove:v=>set.delete(v),
     toggle:(v,on)=>{if(on)set.add(v);else set.delete(v)},contains:v=>set.has(v)},
    focus(){this.focused=true},addEventListener(){}});
  }
  return nodes.get(id);
 };
 return {nodes,get};
}
async function testBoard(){
 const {get}=mockNodes();
 const document={getElementById:get,querySelectorAll:()=>[]};
 const profile={is_owner:true};
 const crilo={profile,dailyPeriod:()=> '2026-10-10',esc:x=>String(x??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')};
 const window={CriloRarity:rarityWorld.CriloRarity,addEventListener(){}};
 const q={select(){return this},eq(){return this},order(){return this},
  limit(){return this},gte(){return this},
  then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};
 const db={from:()=>q};
 const context={window,document,Crilo:crilo,criloDB:db,Date,Map,Math,console,encodeURIComponent};
 const instrumented=script.replace(/\}\)\(\);\s*$/,
   '\nwindow.__qaBoard={render,renderDuckLeaders,renderBadgeLeaders,setTab:v=>{tab=v}};})();');
 assert.notEqual(instrumented,script,'Could not expose scoreboard QA functions');
 vm.runInNewContext(instrumented,context,{filename:'leaderboard.js'});
 const qa=window.__qaBoard;
 assert.ok(qa?.render,'Leaderboard renderer was not available');
 const samples=[
  {id:'one',user_id:'p1',score:60,spins:6,upgrades:0,doubles:0,ducks:0,drawing:'data:image/png;base64,AAAA',_source:'official'},
  {id:'two',user_id:'p2',score:24,spins:8,upgrades:0,doubles:0,ducks:0,drawing:null,_source:'official'},
  {id:'three',user_id:'p3',score:15,spins:5,upgrades:0,doubles:0,ducks:0,drawing:'data:image/png;base64,BBBB',_source:'official'},
  {id:'four',user_id:'p4',score:301,spins:7,upgrades:0,doubles:0,ducks:0,drawing:null,_source:'official'}
 ];
 const profiles=new Map(samples.map(r=>[r.user_id,{username:r.user_id,name_color:'#111'}]));
 qa.setTab('week');
 qa.render(samples,profiles);
 let list=get('leaderList').innerHTML;
 assert.equal(get('bestScore').dataset.scoreRarity,'rare','Hero final score must have Rare styling');
 for(const tier of ['rare','common','mythic'])assert.ok(list.includes('data-score-rarity="'+tier+'"'),'Missing '+tier+' color');
 assert.equal((list.match(/class="owner-remove-run"/g)||[]).length,4);
 const rows=list.split('<div class="leader-row score-run-row').slice(1);
 assert.equal(rows.length,4);
 for(const row of rows){
  const remove=row.indexOf('class="owner-remove-run"');
  const score=row.indexOf('class="leader-score"');
  const art=row.indexOf('class="mini-wheel"');
  assert.ok(remove>=0&&remove<score,'Remove must be LEFT of score in the same actions group');
  assert.ok(art===-1||score<art,'Artwork stays to the right of score');
 }
 qa.setTab('records');
 qa.render(samples,profiles);
 list=get('leaderList').innerHTML;
 assert.equal(get('bestScore').dataset.scoreRarity,undefined,'Spin totals are not score tiers');
 assert.ok(list.includes('class="leader-score-secondary" data-score-rarity="rare"'),'Record rows must show their actual colored score');
 profile.is_owner=false;
 qa.setTab('today');qa.render(samples,profiles);
 assert.doesNotMatch(get('leaderList').innerHTML,/owner-remove-run/,'Remove must remain owner-only');
 qa.renderBadgeLeaders([{user_id:'p1',count:42}],profiles);
 assert.equal(get('bestScore').dataset.scoreRarity,undefined,'Badge totals should not have score rarity');
 assert.doesNotMatch(get('leaderList').innerHTML,/data-score-rarity/);
 qa.renderDuckLeaders([{user_id:'p1',count:3}],profiles);
 assert.equal(get('bestScore').dataset.scoreRarity,undefined,'Duck totals should not have score rarity');
 assert.doesNotMatch(get('leaderList').innerHTML,/data-score-rarity/);
 console.log('PASS: score-only rarity colors, hero reset, records actual score, Remove before score, owner-only and artwork position.');
}
function testBeetle(){
 const {get}=mockNodes(),handlers={},st={muted:false,sounds:0,suspended:false};
 const track=get('bugBeetleTrack'),beetleElement=get('bugBeetle'),modal=get('bugReportModal');
 track.classList.add('walking'); modal.classList.add('hidden');
 for(const el of [beetleElement,modal,get('bugClose'),get('bugReportForm')])
  el.addEventListener=function(name,cb){handlers[el.id+':'+name]=cb};
 const document={getElementById:get,hidden:false,addEventListener(){}};
 class Audio{
  constructor(){st.sounds++;this.currentTime=0;this.destination={};this.state=st.suspended?'suspended':'running'}
  resume(){this.state='running';return Promise.resolve()}
  createBiquadFilter(){return{type:'',frequency:{value:0},connect(){}}}
  createOscillator(){return{type:'',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},
   connect(){},start(){st.chirps=(st.chirps||0)+1},stop(){}}}
  createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}
 }
 const window={AudioContext:Audio,Crilo:{profile:{sound_enabled:true}},
  localStorage:{getItem:()=>st.muted?'off':null},
  matchMedia:()=>({matches:false,addEventListener(){}})};
 const ctx={window,document,setTimeout:()=>0,Math,Date,console};
 vm.runInNewContext(beetle,ctx,{filename:'bug-beetle.js'});
 assert.equal(typeof handlers['bugBeetle:click'],'function');
 handlers['bugBeetle:click']();
 assert.equal(st.sounds,1,'Click creates an audio context once');
 assert.equal(st.chirps,6,'Beetle click plays six distinct local chirps');
 assert.equal(modal.classList.contains('hidden'),false,'Sound never blocks the bug report modal');
 st.muted=true;handlers['bugBeetle:click']();
 assert.equal(st.chirps,6,'Mute setting prevents sound');
 st.muted=false;window.Crilo.profile.sound_enabled=false;
 handlers['bugBeetle:click']();assert.equal(st.chirps,6,'Account mute prevents sound');
 console.log('PASS: six locally synthesized click trills, sound preferences, and functional report modal.');
}
(async()=>{await testBoard();testBeetle()})().catch(err=>{console.error(err);process.exitCode=1});
