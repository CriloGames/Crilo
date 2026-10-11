/* Read-only personal Daily history regressions, including the owner's five
 * official Dailies (43 underlying spins), older pagination, and isolated Tests. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const src=fs.readFileSync(path.join(root,'spin-history.js'),'utf8');
const css=fs.readFileSync(path.join(root,'spin-history.css'),'utf8');
const html=fs.readFileSync(path.join(root,'profile.html'),'utf8');
assert.match(html,/spin-history\.js\?v=8/);
assert.match(html,/spin-history\.css\?v=7/);
assert.match(html,/id="spinHistorySpinCount"/);
assert.match(html,/id="spinHistoryEndLabel"/);
assert.match(html,/Your completed Daily runs, newest first/);
for(const rarity of ['trash','common','uncommon','rare','epic','anomaly','mythic'])
 assert.ok(css.includes('.spin-history-item[data-rarity="'+rarity+'"]'),'Missing tier '+rarity);
assert.match(css,/border:4px solid #17191e/);
assert.ok(!src.includes('results.map'),'History must show Dailies, not badges or spin events');
const bands=[{key:'trash',max:6},{key:'common',max:24},{key:'uncommon',max:48},
 {key:'rare',max:92},{key:'epic',max:141},{key:'anomaly',max:300},{key:'mythic',max:Infinity}];
function run(id,spins=3,opts={}){
 return {id,user_id:'owner',is_test:false,daily_period:'2026-10-'+String(10-id%10).padStart(2,'0'),
  created_at:new Date(Date.UTC(2026,9,10-id%10)).toISOString(),score:spins*3,spins,
  upgrades:1,doubles:0,ducks:2,verified_spin_session_id:'verified',
  drawing:null,results:Array.from({length:spins},()=>({type:'duck'})),...opts};
}
async function scenario(name,allRows,pages,expected={}) {
 const elements=new Map(),calls=[];
 const node=id=>{
  if(elements.has(id))return elements.get(id);
  const obj={id,disabled:false,hidden:false,style:{},handlers:{},
   classList:{add(){},remove(){}},setAttribute(){},
   addEventListener(type,cb){this.handlers[type]=cb},
   insertAdjacentHTML(pos,part){assert.equal(pos,'beforeend');this.innerHTML+=part}};
  let text='',inner='';
  Object.defineProperties(obj,{
   textContent:{get:()=>text,set:value=>{text=String(value);inner='';}},
   innerHTML:{get:()=>inner,set:value=>{inner=String(value);text=inner.replace(/<[^>]*>/g,'');}}
  });
  elements.set(id,obj);return obj;
 };
 const db={from(table){
  assert.equal(table,'daily_runs');
  const filters={};let fields='';
  const q={select(x){fields=x;return q},eq(k,v){filters[k]=v;return q},
   order(){return q},range(a,b){
    calls.push({a,b,fields,...filters});
    const rows=allRows.filter(x=>x.user_id===filters.user_id&&x.is_test===filters.is_test)
      .sort((x,y)=>String(y.daily_period).localeCompare(String(x.daily_period))||
       String(y.created_at).localeCompare(String(x.created_at))||y.id-x.id)
      .slice(a,b+1);
    return Promise.resolve({data:fields==='spins,daily_period'?
       rows.map(x=>({spins:x.spins,daily_period:x.daily_period})):rows,error:null});
   }};return q;
 }};
 const ctx={document:{getElementById:node},
  window:{CriloRarity:{scoreBands:bands},addEventListener(){}},
  Crilo:{user:{id:'owner'},esc:v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')},
  criloDB:db,location:{search:''},URLSearchParams,console};
 vm.runInNewContext(src,ctx,{filename:'spin-history.js'});
 async function flush(){for(let i=0;i<180;i++)await Promise.resolve()}
 await flush();
 const htmlRows=()=>node('spinHistoryList').innerHTML;
 const count=()=> (htmlRows().match(/<article class="spin-history-item"/g)||[]).length;
 const official=allRows.filter(x=>x.user_id==='owner'&&x.is_test===false);
 const spins=official.reduce((t,row)=>t+Math.max(0,Number(row.spins)||0),0);
 const total=official.length;
 assert.equal(count(),pages[0],name+' first page must show three or fewer Dailies');
 assert.equal(node('spinHistoryCount').textContent,total.toLocaleString('en-US')+
   ' Dail'+(total===1?'y':'ies')+' completed',name+' count Dailies, not individual spins');
 assert.ok(node('spinHistorySpinCount').textContent.includes(spins.toLocaleString('en-US')+' wheel spin'),name+' correct separate spins');
 assert.ok(node('spinHistorySpinCount').textContent.includes('Test Runs excluded'),name+' owner Test Runs remain excluded');
 assert.ok(calls.every(c=>c.user_id==='owner'&&c.is_test===false),name+' query privacy filter');
 assert.ok(calls.some(c=>c.fields.includes('score,spins')&&c.fields.includes('drawing')),name+' preserves saved wheel art');
 assert.ok(calls.some(c=>c.fields==='spins,daily_period'),name+' counts actual Dailies');
 assert.ok(!htmlRows().includes('Badge earned')&&!htmlRows().includes('DUCK!'),name+' only completed Daily cards');
 if(pages.length>1){
  assert.equal(node('spinHistoryPager').hidden,false,name+' older-Dailies control required');
  assert.ok(node('spinHistoryMore').innerHTML.includes('SHOW '),name+' older-control label must not stick on LOADING');
 }
 for(let i=1;i<pages.length;i++){
  assert.equal(node('spinHistoryPager').hidden,false,name+' pager expected at '+i);
  await node('spinHistoryMore').handlers.click();
  await flush();
  assert.equal(count(),pages[i],name+' revealed page '+i);
 }
 assert.equal(node('spinHistoryPager').hidden,!(expected.hasMore??false),name+' final pager visibility');
 assert.equal(node('spinHistoryEnd').hidden,(expected.hasMore??false)||total===0,name+' meaningful end-of-history message');
 if(!(expected.hasMore??false)&&total){
  assert.ok(node('spinHistoryEndLabel').textContent.includes('All '+total.toLocaleString('en-US')+' saved Daily'),
   name+' clearly says how many saved Dailies exist');
 }
 if(official[0]?.drawing)assert.ok(htmlRows().includes(official[0].drawing),name+' saved drawing unchanged');
 if(official.some(row=>!row.drawing))assert.ok(htmlRows().includes('blank-wheel.svg'),name+' blank wheel unchanged');
 console.log('PASS '+name+' '+count()+' of '+total+' Dailies; '+spins+' spins');
}
(async()=>{
 await scenario('zero Dailies',[],[0]);
 await scenario('one Daily',[run(1,10)],[1]);
 await scenario('two Dailies',[run(1,7),run(2,8)],[2]);
 await scenario('owner five Dailies: 43 official spins, two isolated Tests',[
  run(0,7,{daily_period:'2026-10-10',score:17}),
  run(1,10,{daily_period:'2026-10-09',score:42}),
  run(2,7,{daily_period:'2026-10-08',score:24,verified_spin_session_id:null}),
  run(3,8,{daily_period:'2026-10-07',score:15,verified_spin_session_id:null}),
  run(4,11,{daily_period:'2026-10-06',score:864,verified_spin_session_id:null}),
  run(101,5,{is_test:true,daily_period:'2026-10-10'}),
  run(102,8,{is_test:true,daily_period:'2026-10-09'})
 ],[3,5]);
 await scenario('eight Dailies',[...Array(8)].map((_,i)=>run(i+1)),[3,8]);
 await scenario('twelve Dailies',[...Array(12)].map((_,i)=>run(i+1)),[3,8,12]);
 await scenario('legacy art and Test excluded',[
  run(1,6,{verified_spin_session_id:null,drawing:'data:image/png;base64,Zm9v'}),
  run(2,2,{is_test:true})
 ],[1]);
 await scenario('501+ Dailies counted beyond first DB page',
  Array.from({length:501},(_,i)=>run(i+1,1)),[3,8],{hasMore:true});
 await scenario('1001+ Dailies counted beyond two DB pages',
  Array.from({length:1001},(_,i)=>run(i+1,1)),[3,8],{hasMore:true});
})().catch(e=>{console.error(e);process.exitCode=1});
