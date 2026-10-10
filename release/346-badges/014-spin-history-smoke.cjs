/* Read-only profile spin history regression; no browser or database writes. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const src=fs.readFileSync(path.join(root,'spin-history.js'),'utf8');
const css=fs.readFileSync(path.join(root,'spin-history.css'),'utf8');
const html=fs.readFileSync(path.join(root,'profile.html'),'utf8');
assert.ok(html.indexOf('id="spinHistoryHeading"')<html.indexOf('How Much Was the Domain?'));
assert.match(html,/spin-history\.js\?v=2/);
assert.match(html,/spin-history\.css\?v=1/);
for(const rarity of ['trash','common','uncommon','rare','epic','anomaly','mythic']){
 assert.ok(css.includes('.spin-history-item[data-rarity="'+rarity+'"]'),'Missing color '+rarity);
}
function run(id,values,date='2026-10-09'){
 return {id,user_id:'player',created_at:new Date(Date.UTC(2026,9,10-id)).toISOString(),
  daily_period:date,score:values.length,spins:values.length,
  results:values.map(points=>({type:'num',points})),is_test:false};
}
const bands=[
 {key:'trash',max:6},{key:'common',max:24},{key:'uncommon',max:48},
 {key:'rare',max:92},{key:'epic',max:141},{key:'anomaly',max:300},
 {key:'mythic',max:Infinity}
];
async function scenario(name,runs,counts,{expectLegacy=false,expectMore=false}={}){
 const elements=new Map(),calls=[],listeners={};
 function element(id){
  if(elements.has(id))return elements.get(id);
  const obj={id,innerHTML:'',textContent:'',disabled:false,hidden:false,
   handlers:{},classList:{add(){},remove(){}},
   addEventListener(name,fn){this.handlers[name]=fn},
   insertAdjacentHTML(where,value){assert.equal(where,'beforeend');this.innerHTML+=value}};
  elements.set(id,obj);return obj;
 }
 const sorted=runs.slice().sort((a,b)=>b.created_at.localeCompare(a.created_at));
 const db={from(table){
  assert.equal(table,'daily_runs');
  const filters={};
  const query={fields:'',select(fields){query.fields=fields;return query},
   eq(key,val){filters[key]=val;return query},
   order(){return query},
   range(start,end){
    calls.push({start,end,fields:query.fields,...filters});
    const found=sorted.filter(x=>x.user_id===filters.user_id&&x.is_test===filters.is_test);
    const rows=found.slice(start,end+1);
    return Promise.resolve({data:query.fields==='spins'?rows.map(x=>({spins:x.spins})):rows,error:null});
   }};
  return query;
 }};
 const ctx={document:{getElementById:element},
  window:{addEventListener(name,cb){listeners[name]=cb},CriloRarity:{scoreBands:bands}},
  Crilo:{user:{id:'player'},esc:x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')},
  criloDB:db,location:{search:''},URLSearchParams,console};
 vm.runInNewContext(src,ctx,{filename:'spin-history.js'});
 async function flush(){for(let i=0;i<30;i++)await Promise.resolve();}
 await flush();
 const entryCount=()=> (element('spinHistoryList').innerHTML.match(/<article class="spin-history-item/g)||[]).length;
 assert.equal(entryCount(),counts[0],name+' initial 5');
 assert.ok(calls.every(c=>c.user_id==='player'&&c.is_test===false),name+' privacy filter');
 for(let i=1;i<counts.length;i++){
  assert.equal(element('spinHistoryPager').hidden,false,name+' load button before '+i);
  await element('spinHistoryMore').handlers.click();
  assert.equal(entryCount(),counts[i],name+' after page '+i);
 }
 assert.equal(element('spinHistoryPager').hidden,!expectMore,name+' pager end');
 const official=runs.filter(x=>x.user_id==='player'&&!x.is_test);
 const expectedTotal=official.reduce((n,r)=>n+(Number(r.spins)||0),0);
 assert.equal(element('spinHistoryCount').textContent,
  expectedTotal+' spin'+(expectedTotal===1?'':'s')+' total',
  name+' lifetime count must not depend on loaded pages');
 assert.ok(calls.some(c=>c.fields==='spins'),name+' must independently fetch lifetime spins');
 const expectedReal=official.reduce((n,r)=>n+(r.results?.length||0),0);
 const shouldDuck=expectedReal>5&&!expectMore; // Duck appears only after reaching the final page.
 assert.equal(element('spinHistoryEnd').hidden,!shouldDuck,name+' duck end');
 assert.equal((element('spinHistoryList').innerHTML.match(/data-rarity="mythic"/g)||[]).length>0,
  runs.some(r=>r.score>=301),name+' mythic rarity') ;
 if(expectLegacy)assert.ok(element('spinHistoryList').innerHTML.includes('individual spins were not saved'));
 console.log('PASS '+name+': '+entryCount()+' history records, '+calls.length+' DB fetches, duck='+shouldDuck);
}
(async()=>{
 await scenario('zero official runs',[],[0]);
 await scenario('four spins',[run(1,[1,2,3,4])],[4]);
 await scenario('five spins',[run(1,[1,2,3,4,5])],[5]);
 await scenario('six spins',[run(1,[1,2,3,4,5,6])],[5,6]);
 await scenario('multi-run page boundary',Array.from({length:12},(_,i)=>run(i+1,[30,30,30])),
  [5,10,15,20,25,30,35,36]);
 const legacy={id:90,user_id:'player',created_at:'2026-09-01T00:00:00Z',
  daily_period:'2026-08-31',score:864,spins:11,results:null,is_test:false};
 await scenario('legacy saved Daily and excluded Test Run',[
  run(1,[1,1,1,1,1,10,10,10,10,10,10]),legacy,
  {...run(3,[301]),is_test:true}
 ],[5,10,12],{expectLegacy:true});
 const many=Array.from({length:501},(_,i)=>run(i+1,[1]));
 await scenario('501 official Dailies total across two 500-row chunks',
  [...many,{...run(999,[1,1,1]),is_test:true}],[5],{expectMore:true});
})().catch(err=>{console.error(err);process.exitCode=1});
