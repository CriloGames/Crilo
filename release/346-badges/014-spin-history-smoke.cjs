/* Personal Daily leaderboard regression. Read-only fixtures; no live writes. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const src=fs.readFileSync(path.join(root,'spin-history.js'),'utf8');
const css=fs.readFileSync(path.join(root,'spin-history.css'),'utf8');
const html=fs.readFileSync(path.join(root,'profile.html'),'utf8');
assert.ok(html.indexOf('id="spinHistoryHeading"')<html.indexOf('How Much Was the Domain?'));
assert.match(html,/spin-history\.js\?v=7/);
assert.match(html,/spin-history\.css\?v=6/);
assert.match(html,/Your completed Daily runs, newest first/);
for(const rarity of ['trash','common','uncommon','rare','epic','anomaly','mythic'])
 assert.ok(css.includes('.spin-history-item[data-rarity="'+rarity+'"]'),'Missing tier '+rarity);
assert.match(css,/border:4px solid #17191e/);
assert.ok(!src.includes('results.map'),'History must render Dailies, not spin events');

const bands=[{key:'trash',max:6},{key:'common',max:24},{key:'uncommon',max:48},
 {key:'rare',max:92},{key:'epic',max:141},{key:'anomaly',max:300},{key:'mythic',max:Infinity}];
function run(id,spins=3,opts={}){
 return {id,user_id:'player',is_test:false,daily_period:'2026-10-'+String(11-id%10).padStart(2,'0'),
  created_at:new Date(Date.UTC(2026,9,11-id%10)).toISOString(),
  score:spins*3,spins,upgrades:1,doubles:0,ducks:2,results:Array.from({length:spins},()=>({type:'duck'})),
  verified_spin_session_id:'verified',drawing:null,...opts};
}
async function scenario(name,runs,pages,{more=false}={}){
 const elements=new Map(),calls=[],listeners={};
 function element(id){
  if(elements.has(id))return elements.get(id);
  const obj={id,innerHTML:'',textContent:'',disabled:false,hidden:false,
   handlers:{},classList:{add(){},remove(){}},setAttribute(){},
   addEventListener(event,fn){this.handlers[event]=fn},
   insertAdjacentHTML(where,value){assert.equal(where,'beforeend');this.innerHTML+=value}};
  elements.set(id,obj);return obj;
 }
 const db={from(table){
  assert.equal(table,'daily_runs');
  const filters={};let fields='';
  const q={select(x){fields=x;return q},eq(k,v){filters[k]=v;return q},
   order(){return q},range(a,b){
    calls.push({a,b,fields,...filters});
    const items=runs.filter(x=>x.user_id===filters.user_id&&x.is_test===filters.is_test)
      .sort((a,b)=>String(b.daily_period).localeCompare(String(a.daily_period))||
        String(b.created_at).localeCompare(String(a.created_at))||b.id-a.id);
    const rows=items.slice(a,b+1);
    return Promise.resolve({data:fields==='spins'?rows.map(x=>({spins:x.spins})):rows,error:null});
   }};
  return q;
 }};
 const ctx={document:{getElementById:element},window:{addEventListener(k,fn){listeners[k]=fn},CriloRarity:{scoreBands:bands}},
  Crilo:{user:{id:'player'},esc:x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')},
  criloDB:db,location:{search:''},URLSearchParams,console};
 vm.runInNewContext(src,ctx,{filename:'spin-history.js'});
 async function flush(){for(let i=0;i<40;i++)await Promise.resolve()}
 await flush();
 const history=()=>element('spinHistoryList').innerHTML;
 const count=()=> (history().match(/<article class="spin-history-item"/g)||[]).length;
 const official=runs.filter(x=>x.user_id==='player'&&!x.is_test);
 const total=official.reduce((sum,row)=>sum+Number(row.spins||0),0);
 const label=total.toLocaleString('en-US')+' spin'+(total===1?'':'s')+' total';
 assert.equal(count(),pages[0],name+' initial Daily cards');
 assert.equal(element('spinHistoryCount').textContent,label,name+' lifetime spin count');
 assert.ok(calls.every(c=>c.user_id==='player'&&c.is_test===false),name+' excludes owner Test Runs');
 assert.ok(calls.some(c=>c.fields.includes('score,spins')&&c.fields.includes('drawing')),name+' must use Daily scores and art');
 assert.ok(!history().includes('DUCK!')&&!history().includes('Landed '),name+' must not render spin events');
 assert.ok(!history().includes('Badge earned'),name+' must not render achievements');
 if(count())assert.ok(history().includes('blank-wheel.svg'),name+' blank artwork must be blank');
 for(let i=1;i<pages.length;i++){
  assert.equal(element('spinHistoryPager').hidden,false,name+' should show Load More');
  await element('spinHistoryMore').handlers.click();
  await flush();
  assert.equal(count(),pages[i],name+' page '+i);
  assert.equal(element('spinHistoryCount').textContent,label);
 }
 assert.equal(element('spinHistoryPager').hidden,!more,name+' pager state');
 assert.ok(calls.some(c=>c.fields==='spins'),name+' independent lifetime count');
 console.log('PASS '+name+': '+count()+' Dailies / '+total+' lifetime spins');
}
(async()=>{
 await scenario('zero Dailies',[],[0]);
 await scenario('one 10-spin Daily',[run(1,10,{score:23})],[1]);
 await scenario('five daily runs',Array.from({length:5},(_,i)=>run(i+1)),[5]);
 await scenario('six daily runs',Array.from({length:6},(_,i)=>run(i+1)),[5,6]);
 await scenario('twelve daily runs',Array.from({length:12},(_,i)=>run(i+1)),[5,10,12]);
 await scenario('legacy Daily preserved, Test Run excluded',[
  run(1,10,{score:23,verified_spin_session_id:null,drawing:'data:image/png;base64,Zm9v'}),
  run(2,4),run(3,3,{is_test:true})
 ],[2]);
 await scenario('501 Dailies counted beyond first 500',Array.from({length:501},(_,i)=>run(i+1,1)),[5],{more:true});
 await scenario('1001 Dailies counted beyond 1000',Array.from({length:1001},(_,i)=>run(i+1,1)),[5,10],{more:true});
})().catch(error=>{console.error(error);process.exitCode=1});
