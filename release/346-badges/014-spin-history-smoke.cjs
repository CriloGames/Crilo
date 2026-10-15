'use strict';
/* Mock-only Statistics history checks; all live rows remain untouched. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const js=fs.readFileSync('spin-history.js','utf8');
const html=fs.readFileSync('profile.html','utf8');
const css=fs.readFileSync('spin-history.css','utf8');
const sql=fs.readFileSync('release/346-badges/168-grouped-statistics-spin-history.sql','utf8');
assert.match(html,/spin-history\.js\?v=12/);
assert.match(html,/spin-history\.css\?v=9/);
assert.match(html,/highest score each day/i);
assert.match(js,/crilo_grouped_spin_history/);
assert.match(js,/spin-history-expand/);
assert.match(js,/spin-history-wheel/);
assert.match(css,/\.spin-history-subrun/);
assert.match(sql,/UNION ALL/);
assert.match(sql,/public\.crilo_bonus_runs/);
assert.match(sql,/s\.finished_at IS NOT NULL/);
assert.match(sql,/s\.score=b\.score/);
assert.match(sql,/crilo_hidden_bonus_leaderboard_runs/);
assert.match(sql,/NULL::text AS drawing/);
assert.match(sql,/d\.is_test=false/);
assert.match(sql,/jsonb_agg/);
assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.crilo_grouped_spin_history\(uuid,integer,integer\) TO anon,authenticated/);
assert.ok(!js.includes('results.map'),'Outcomes are not Spin History entries');
for(const rarity of ['trash','common','uncommon','rare','epic','anomaly','mythic'])
 assert.ok(css.includes('.spin-history-item[data-rarity="'+rarity+'"]'));

function makeDay(i,bonus=false){
 const date=new Date(Date.UTC(2026,9,15)-i*86400000).toISOString().slice(0,10);
 const official={id:'o-'+i,source:'official',slot:0,score:100+i,spins:5,upgrades:0,doubles:0,ducks:0,
  drawing:i===0?'data:image/png;base64,Zm9v':null};
 const bonus1={id:'b1-'+i,source:'bonus',slot:1,score:740,spins:8,upgrades:1,doubles:0,ducks:0,drawing:null};
 const bonus2={id:'b2-'+i,source:'bonus',slot:2,score:2100,spins:11,upgrades:0,doubles:2,ducks:2,drawing:null};
 const runs=bonus?[bonus2,bonus1,official]:[official];
 return {daily_period:date,run_count:runs.length,best:runs[0],runs};
}
async function check(label,days,expected){
 const nodes=new Map(),calls=[];
 function el(id){
  if(nodes.has(id))return nodes.get(id);
  let inner='',txt='';
  const node={hidden:false,disabled:false,dataset:{},style:{},handlers:{},attrs:{},
   classList:{add(){},remove(){}},
   setAttribute(k,v){this.attrs[k]=v},addEventListener(k,fn){this.handlers[k]=fn},
   insertAdjacentHTML(p,str){assert.equal(p,'beforeend');inner+=str},
   querySelector(){return{textContent:''}}};
  Object.defineProperties(node,{
   innerHTML:{get:()=>inner,set:v=>{inner=String(v);txt=inner.replace(/<[^>]+>/g,'')}},
   textContent:{get:()=>txt,set:v=>{txt=String(v);inner=''}}
  });
  nodes.set(id,node);return node;
 }
 const ctx={document:{getElementById:el},
  window:{CriloRarity:{scoreBands:[{max:1000,key:'common'},{max:Infinity,key:'mythic'}]},addEventListener(){}},
  location:{search:''},URLSearchParams,Intl,Date,Number,Math,console,
  Crilo:{user:{id:'owner'},esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')},
  criloDB:{rpc:async(name,args)=>{
   assert.equal(name,'crilo_grouped_spin_history');assert.equal(args.p_user,'owner');calls.push(args);
   return{data:{days:days.slice(args.p_offset,args.p_offset+args.p_limit),
    total_dailies:days.length,official_dailies:days.length,official_spins:days.length*5,
    bonus_runs:days.reduce((sum,day)=>sum+day.runs.filter(x=>x.source==='bonus').length,0)},error:null};
  }}
 };
 vm.runInNewContext(js,ctx,{filename:'spin-history.js'});
 const flush=async()=>{for(let i=0;i<100;i++)await Promise.resolve()};
 await flush();
 const count=()=> (el('spinHistoryList').innerHTML.match(/<article class="spin-history-item"/g)||[]).length;
 assert.equal(count(),Math.min(3,days.length),label+' first page');
 assert.equal(el('spinHistoryCount').textContent,days.length+' Dail'+(days.length===1?'y':'ies')+' completed');
 assert.match(el('spinHistorySpinCount').textContent,/Test Runs excluded/);
 assert.ok(calls.every(c=>c.p_user==='owner'&&c.p_limit<=5));
 if(expected==='bonus'){
  const body=el('spinHistoryList').innerHTML;
  assert.match(body,/View all 3 runs/);
  assert.match(body,/Bonus Run 1/);
  assert.match(body,/Bonus Run 2/);
  assert.match(body,/Official Daily/);
  assert.equal((body.match(/class="spin-history-subrun"/g)||[]).length,3);
  assert.equal((body.match(/class="spin-history-best-mark"/g)||[]).length,1);
  assert.match(body,/data:image\/png;base64,Zm9v/,'Official artwork preserved');
  assert.equal((body.match(/src="blank-wheel.svg"/g)||[]).length,3,'Bonus artwork remains private');
 }
 if(days.length>3){
  await el('spinHistoryMore').handlers.click();await flush();
  assert.equal(count(),Math.min(8,days.length),label+' older-page count');
 }
 assert.equal(el('spinHistoryPager').hidden,days.length<=8);
 console.log('GROUPED_HISTORY_CASE_PASS '+label);
}
(async()=>{
 await check('zero Dailies',[],'');
 await check('one Official Daily',[makeDay(0)],'');
 await check('three attempts grouped into one Daily',[makeDay(0,true)],'bonus');
 await check('five Official Dailies',[...Array(5)].map((_,i)=>makeDay(i)),'');
 await check('1001 historical Daily groups',[...Array(1001)].map((_,i)=>makeDay(i)),'');
 console.log('GROUPED_SPIN_HISTORY_SMOKE_PASS');
})().catch(err=>{console.error(err);process.exitCode=1});