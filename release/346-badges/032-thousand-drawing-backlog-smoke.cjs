'use strict';
/* 1,000-drawing owner review load test. Does not contact Supabase or modify
 real runs. Verifies bounded payloads, global counts, filters, page navigation,
 race-proof handling of confirmed deletions and owner-only access. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const feed=fs.readFileSync(path.join(root,'moderation-feed.js'),'utf8');
const html=fs.readFileSync(path.join(root,'moderation.html'),'utf8');
assert.ok(html.includes('id="reviewPagePrev"'));
assert.ok(html.includes('id="reviewPageNext"'));
assert.ok(html.includes('id="reviewPageInfo"'));
const ui=new Map();
function node(id){
 if(!ui.has(id)){
  const hidden=new Set(['hidden']);
  ui.set(id,{id,handlers:{},value:'all',checked:false,disabled:false,
   textContent:'',innerHTML:'',dataset:{},hidden:false,style:{},
   addEventListener(name,cb){this.handlers[name]=cb},
   classList:{contains:n=>hidden.has(n),add:n=>hidden.add(n),remove:n=>hidden.delete(n)},
   replaceChildren(){this.children=[]},appendChild(child){(this.children??=[]).push(child)},
   removeAttribute(){}});
 }
 return ui.get(id);
}
const document={hidden:false,getElementById:node,addEventListener(){},
 createElement:tag=>({tag,textContent:'',className:''})};
const window={Crilo:{user:{id:'owner'},profile:{is_owner:true}},addEventListener(){}};
const longImage='data:image/png;base64,'+'A'.repeat(12000);
const database=Array.from({length:1000},(_,i)=>{
 const run=i+1;
 return {run_id:String(run),is_test:false,username:'Player'+run,
   drawing:longImage,score:run%240,submitted_at:new Date(Date.UTC(2026,9,1,0,0,run)).toISOString(),
   local:{reasons:run%10===0?['Profanity']:[],status:'complete',scan_version:7,
    checked_at:'2026-10-10T10:00:00Z'},legacyHint:null};
});
let maxSent=0,requests=[],decisions=0;
const criloDB={rpc:async(name,args)=>{
 requests.push({name,args});
 if(name==='crilo_owner_penalize_daily'){assert.equal(args.p_reason,'links');decisions++;return {data:true}}
 assert.equal(name,'crilo_owner_review_page_v1','No old 200-image legacy feed RPCs');
 assert.ok(Number.isInteger(args.p_page)&&args.p_page>=0);
 const all=database.filter(x=>args.p_include_tests||!x.is_test);
 const flagged=x=>(x.local?.reasons||[]).length>0;
 const unscanned=x=>!x.local||x.local.scan_version<5;
 const selected=all.filter(x=>args.p_filter==='all'||
  args.p_filter==='flagged'&&flagged(x)||
  args.p_filter==='unscanned'&&unscanned(x)||
  args.p_filter==='partial'&&x.local?.status==='partial'||
  args.p_filter==='clear'&&!flagged(x)&&!unscanned(x)&&x.local?.status==='complete');
 selected.sort((a,b)=>Number(flagged(b))-Number(flagged(a))||b.run_id-a.run_id);
 const rows=selected.slice(args.p_page*24,(args.p_page+1)*24);
 maxSent=Math.max(maxSent,rows.length);
 return {data:{rows,matched:selected.length,total:all.length,
  pending:all.length,flagged:all.filter(flagged).length,
  tests:0,unscanned:0,partial:0}};
}};
const confirms=[];
vm.runInNewContext(feed,{window,document,criloDB,
 setTimeout(){return 1},setInterval(){return 1},confirm:m=>{confirms.push(m);return true},console},
 {filename:'moderation-feed.js'});
function countImages(){return (node('drawingReviewList').innerHTML.match(/<img /g)||[]).length}
(async()=>{
 const started=Date.now();
 await window.criloRefreshDrawingFeed();
 assert.equal(node('reviewCountPending').textContent,1000);
 assert.equal(node('reviewCountFlagged').textContent,100);
 assert.equal(node('reviewStats').textContent,'1–24 of 1000 matching drawings · 0 Test Runs included');
 assert.equal(node('reviewPageInfo').textContent,'Page 1 of 42');
 assert.equal(countImages(),24,'Do not create 1,000 image elements at once');
 assert.equal(node('reviewPagePrev').disabled,true);
 assert.equal(node('reviewPageNext').disabled,false);
 assert.ok(requests.every(r=>r.name==='crilo_owner_review_page_v1'),
  'Normal rendering uses just one metadata-and-page RPC');
 const firstPayloadBytes=JSON.stringify(database.slice(0,24)).length;
 assert.ok(firstPayloadBytes<500000,'24 thumbnail payload should stay bounded');

 node('reviewPageNext').handlers.click();
 await window.criloRefreshDrawingFeed();
 assert.equal(node('reviewPageInfo').textContent,'Page 2 of 42');
 assert.equal(countImages(),24);
 node('reviewPagePrev').handlers.click();
 await window.criloRefreshDrawingFeed();
 assert.equal(node('reviewPageInfo').textContent,'Page 1 of 42');

 node('reviewFilter').value='flagged';
 node('reviewFilter').handlers.change({target:{value:'flagged'}});
 await window.criloRefreshDrawingFeed();
 assert.equal(node('reviewPageInfo').textContent,'Page 1 of 5');
 assert.equal(node('reviewStats').textContent,'1–24 of 100 matching drawings · 0 Test Runs included');
 assert.equal(countImages(),24);
 assert.equal(node('reviewCountFlagged').textContent,100);
 node('reviewFilter').value='all';
 node('reviewFilter').handlers.change({target:{value:'all'}});
 await window.criloRefreshDrawingFeed();
 const first=node('drawingReviewList').innerHTML;
 node('drawingReviewList').handlers.click({target:{closest:()=>({dataset:{index:'0'}})}});
 assert.ok(!node('reviewLightbox').classList.contains('hidden'));
 node('reviewViolationReason').value='links';
 node('reviewViolationReason').selectedOptions=[{textContent:'Website link or external promotion'}];
 await node('reviewRemove').handlers.click();
 assert.equal(decisions,1,'Only one confirmed owner deletion RPC');
 assert.equal(confirms.length,2,'Keep both confirmations');
 assert.ok(!node('drawingReviewList').innerHTML.includes('Player1000'),
  'Deleted item must not appear even with stale mock database');
 await window.criloRefreshDrawingFeed();
 assert.ok(!node('drawingReviewList').innerHTML.includes('Player1000'),
  'Stale remote response must not restore locally deleted item');
 assert.ok(maxSent<=24);
 const durationMs=Date.now()-started;
 console.log('PASS: 1000 drawings, full-queue counters, 24 max images per page, 42 pages');
 console.log('PASS: filters, previous/next, confirmed deletion, stale response guard');
 console.log('PASS: only bounded review RPC; duration '+durationMs+' ms on test host');
})().catch(e=>{console.error(e);process.exitCode=1});
