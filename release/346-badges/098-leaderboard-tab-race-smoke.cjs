/* Leaderboard tab switching race regression. No live accounts or writes.
 * A late response from a previously selected tab must not repaint the page. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('leaderboard.js','utf8');
const page=fs.readFileSync('leaderboard.html','utf8');
assert.match(page,/leaderboard\.js\?v=47/);
assert.match(src,/revision!==loadRevision/);
assert.match(src,/href="profile\.html\?id=/);
function deferred(){
 let resolve;const promise=new Promise(r=>{resolve=r});
 return {promise,resolve};
}
async function scenario(name,fromTab,toTab){
 const elements=new Map(),buttons=new Map(),requests={daily:[],ducks:[],badges:[],points:[]};
 function el(id){
  if(!elements.has(id)){
   const classes=new Set();
   elements.set(id,{id,dataset:{},style:{},innerHTML:'',textContent:'',src:'',alt:'',
    classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
    addEventListener(){},querySelector(){return null}});
  }
  return elements.get(id);
 }
 for(const id of ['today','week','all','points','records','badges','ducks']){
  const button={dataset:{tab:id},attrs:{},handlers:{},classList:{add(){},remove(){}},
   setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]??null},
   addEventListener(type,fn){this.handlers[type]=fn},
   click(){this.handlers.click()}};
  buttons.set(id,button);
 }
 function query(table){
  const filters=[],props={};let isDucks=false;
  const q={
   select(s){isDucks=table==='daily_runs'&&s.startsWith('user_id,ducks');return q},
   eq(...args){filters.push(args);return q},not(){return q},
   gte(){return q},order(){return q},limit(){return q},
   range(){
    const d=deferred();requests.ducks.push(d);
    return d.promise;
   },
   in(){return Promise.resolve({data:[],error:null})},
   then(ok,fail){
    const d=deferred();requests.daily.push(d);return d.promise.then(ok,fail);
   }
  };
  return q;
 }
 function rpc(key){
  const d=deferred();
  (key==='crilo_gameplay_badge_leaders'?requests.badges:requests.points).push(d);
  return d.promise;
 }
 const ctx={window:{addEventListener(){},CriloRarity:{scoreBands:[]}},
   document:{getElementById:el,querySelectorAll:q=>q==='.leader-tab'?[...buttons.values()]:[]},
   Crilo:{esc:x=>String(x??''),dailyPeriod:()=> '2026-10-11',profile:null},
   criloDB:{from:query,rpc},Date,Number,Map,Set,Math,encodeURIComponent,
   prompt(){},confirm(){return false},alert(){},console};
 vm.runInNewContext(src,ctx,{filename:'leaderboard.js'});
 async function flush(){for(let i=0;i<50;i++)await Promise.resolve()}
 await flush();
 assert.equal(buttons.get('today').getAttribute('aria-pressed'),'true',
   name+' initial category should be announced as active');
 function click(tab){buttons.get(tab).click();
  for(const [key,item] of buttons){
   assert.equal(item.getAttribute('aria-pressed'),key===tab?'true':'false',
    name+' active category announcement for '+key);
  }
 }
 function answer(tab){
  if(tab==='badges')return {data:[
   {user_id:'badge-user',gameplay_badges:5,username:'BadgeWinner',name_color:'#334455'}
  ],error:null};
  if(tab==='points')return {data:[
   {user_id:'points-user',total_points:40,official_runs:4,username:'PointWinner',name_color:'#123456'}
  ],error:null};
  if(tab==='ducks')return {data:[
   {user_id:'duck-user',ducks:3,daily_period:'2026-10-11',score:10,spins:5,upgrades:0,doubles:0,verified_spin_session_id:'proof'}
  ],error:null};
  return {data:[{id:1,user_id:'run-user',score:29,spins:6,upgrades:1,doubles:0,ducks:1,drawing:null,daily_period:'2026-10-11',verified_spin_session_id:'proof'}],error:null};
 }
 function queueFor(tab){return requests[tab==='today'||tab==='week'||tab==='all'||tab==='records'?'daily':tab]}
 if(fromTab!=='today'){
  // Initial Today request is intentionally abandoned before it resolves.
  click(fromTab);
 }else{
  assert.equal(requests.daily.length,1);
 }
 await flush();
 const first=queueFor(fromTab).at(-1);
 assert.ok(first,name+' first request was not initiated');
 click(toTab);
 await flush();
 const second=queueFor(toTab).at(-1);
 assert.ok(second,name+' second request was not initiated');
 second.resolve(answer(toTab));
 await flush();
 const expected=el('leaderList').innerHTML;
 const expectedHeading=el('bestHeading').textContent;
 assert.ok(expected.length>0,name+' current category failed to render');
 first.resolve(answer(fromTab));
 await flush();
 assert.equal(el('leaderList').innerHTML,expected,name+' stale category overwrote current list');
 assert.equal(el('bestHeading').textContent,expectedHeading,name+' stale category overwrote heading');
 if(toTab==='badges')assert.match(expected,/href="profile\.html\?id=badge-user"/,'Badge collector name should open Statistics');
}
(async()=>{
 await scenario('Today → Badges','today','badges');
 await scenario('Today → Points','today','points');
 await scenario('Badges → Today','badges','today');
 await scenario('Today → Ducks','today','ducks');
 await scenario('Ducks → Badges','ducks','badges');
 console.log('LEADERBOARD_TAB_RACE_PASS: five delayed-response switch cases');
})().catch(error=>{console.error(error);process.exitCode=1});
