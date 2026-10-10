/* Browserless regression, isolated mock work. Never touches live players or DB. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../..');
const scanner=fs.readFileSync(path.join(base,'moderation-feed-scanner.js'),'utf8');
const workerSource=fs.readFileSync(path.join(base,'moderation-scan-worker.js'),'utf8');
const feed=fs.readFileSync(path.join(base,'moderation-feed.js'),'utf8');

async function workerTest(){
 const responses=[];
 let blankFixture=false;
 const self={postMessage:x=>responses.push(x)};
 class FakeOffscreenCanvas {
  constructor(w,h){this.width=w;this.height=h}
  getContext(){return {fillRect(){},drawImage(){},
   getImageData:()=>{
    const data=new Uint8ClampedArray(this.width*this.height*4);
    data.fill(255);
    if(!blankFixture){
     for(let i=0;i<this.width*this.height/8;i++){
      const j=i*4;data[j]=0;data[j+1]=0;data[j+2]=0;
     }
    }
    return {data};
   }}}
  async convertToBlob(){return {type:'image/png'}}
 }
 const environment={
  self,OffscreenCanvas:FakeOffscreenCanvas,Uint8ClampedArray,
  fetch:async()=>({ok:true,blob:async()=>({})}),
  createImageBitmap:async()=>({width:100,height:100,close(){}}),
  importScripts:(src)=>{
   if(src.includes('jsQR'))self.jsQR=()=>({data:'https://example.com'});
   else if(src.includes('tesseract'))self.Tesseract={createWorker:async()=>({recognize:async()=>({data:{text:'fuck https://example.com'}})})};
   else throw Error('Unexpected third-party library '+src);
  },
  console
 };
 vm.runInNewContext(workerSource,environment,{filename:'moderation-scan-worker.js'});
 await self.onmessage({data:{type:'scan',id:5,drawing:'data:image/png;base64,QUJD',checkVisual:false}});
 const result=responses.find(x=>x.type==='result');
 assert.ok(result,'Worker did not report completion');
 assert.equal(result.id,5);
 assert.equal(result.qrFound,true);
 assert.equal(result.ocrText,'fuck https://example.com');
 assert.equal(result.stages.qr,'done');
 assert.equal(result.stages.ocr,'done');
 assert.equal(result.stages.visual,'skipped');
 assert.equal(result.errors.length,0);
 blankFixture=true;
 await self.onmessage({data:{type:'scan',id:6,drawing:'data:image/png;base64,QUJD',checkVisual:true}});
 const blank=responses.find(x=>x.type==='result'&&x.id===6);
 assert.equal(blank.blank,true,'Uniform drawing should be recognized as nearly blank');
 assert.equal(blank.stages.qr,'skipped_blank');
 assert.equal(blank.stages.ocr,'skipped_blank');
 assert.equal(blank.stages.visual,'skipped_blank');
 assert.deepEqual(Array.from(blank.errors),[],'Blank checks must not be errors');
 console.log('PASS: dedicated worker decoded QR + OCR and skipped expensive work for blank drawings');
}
async function schedulerTest(){
 const listeners={};
 const ui=new Map(),calls=[];
 function node(id){
  if(!ui.has(id))ui.set(id,{id,handlers:{},checked:id==='reviewVisualEnabled',disabled:false,
   textContent:'',dataset:{},value:'',setAttribute(){},addEventListener(type,fn){this.handlers[type]=fn}});
  return ui.get(id);
 }
 const window={Crilo:{user:{id:'owner'},profile:{is_owner:true}},
  addEventListener(type,fn){listeners[type]=fn},criloRefreshDrawingFeed:async()=>{}};
 const document={hidden:false,getElementById:node,addEventListener(type,fn){listeners['document:'+type]=fn}};
 let useTest=false,blankResult=false,harmlessLowScore=false,workersCreated=0,terminated=0;
 class MockWorker{
  constructor(path){assert.ok(path.includes('moderation-scan-worker'));workersCreated++}
  postMessage({id,checkVisual}){
   this.onmessage({data:{type:'progress',id,step:'ocr',detail:'Reading text'}});
   this.onmessage({data:blankResult?
    {type:'result',id,blank:true,qrFound:false,ocrText:'',shapeSuspected:false,
     stages:{qr:'skipped_blank',ocr:'skipped_blank',shape:'skipped_blank',visual:'skipped_blank'},
     visualResults:[],errors:[]}:
     harmlessLowScore?
     {type:'result',id,blank:false,qrFound:false,ocrText:'hello',shapeSuspected:false,
      stages:{qr:'done',ocr:'done',shape:'done',visual:'done'},
      visualResults:[{label:'A harmless smiley face doodle',score:0.00195244}],errors:[]}:
    {type:'result',id,blank:false,qrFound:true,ocrText:'fuck https://example.com',
     stages:{qr:'done',ocr:'done',shape:checkVisual?'done':'skipped',
      visual:checkVisual?'done':'skipped'},
     visualResults:[],errors:[]}});
  }
  terminate(){terminated++}
 }
 const db={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='crilo_owner_local_scan_jobs_v5')return {data:[{run_id:useTest?'test-uuid':'123',
   is_test:useTest,drawing:'data:image/png;base64,QUJD'}]};
  if(name==='crilo_owner_local_scan_save_v5')return {data:true};
  throw Error('Unexpected RPC '+name);
 }};
 const timers=new Map();let n=0;
 const setTimeout=(fn)=>{timers.set(++n,fn);return n};
 const clearTimeout=id=>timers.delete(id);
 vm.runInNewContext(scanner,{window,document,Worker:MockWorker,criloDB:db,
  setTimeout,clearTimeout,console},{filename:'moderation-feed-scanner.js'});
 window.CriloLocalSafety.start();
 await window.criloScanPendingDrawings();
 assert.equal(calls.filter(x=>x.name==='crilo_owner_local_scan_save_v5').length,1,
  'One official scan should be saved');
 const payload=calls.find(x=>x.name==='crilo_owner_local_scan_save_v5').args;
 assert.deepEqual(Array.from(payload.p_reasons),['QR code','Profanity','Website or link']);
 assert.equal(payload.p_is_test,false);
 assert.ok(node('reviewScanStatus').textContent.includes('Checked 1 drawing'));
 useTest=true;
 await window.criloScanPendingDrawings();
 assert.equal(calls.filter(x=>x.name==='crilo_owner_local_scan_save_v5').length,1,
  'Do not scan owner Test Runs unless explicitly included');
 node('showOwnerTests').checked=true;
 await window.criloScanPendingDrawings();
 assert.equal(calls.filter(x=>x.name==='crilo_owner_local_scan_save_v5').length,2);
 assert.equal(calls.filter(x=>x.name==='crilo_owner_local_scan_save_v5')[1].args.p_is_test,true,
  'An Owner Test Run must be identified as a Test Run');
 const queuedBefore=calls.filter(x=>x.name==='crilo_owner_local_scan_jobs_v5').length;
 await window.criloScanSpecificDrawing({run_id:'direct-owner-test',is_test:true,
   drawing:'data:image/png;base64,QUJD'});
 const direct=calls.filter(x=>x.name==='crilo_owner_local_scan_save_v5').at(-1).args;
 assert.equal(direct.p_run_id,'direct-owner-test',
  'Manual rescan must evaluate the selected drawing, not the next queue item');
 assert.equal(direct.p_is_test,true,'Owner Test Run must retain isolation when rescanned');
 assert.equal(calls.filter(x=>x.name==='crilo_owner_local_scan_jobs_v5').length,queuedBefore,
  'Targeted rescan must not fetch the unrelated backlog');

 blankResult=true;
 await window.criloScanSpecificDrawing({run_id:'blank-safe-test',is_test:true,
   drawing:'data:image/png;base64,QUJD'});
 const blankSaved=calls.filter(x=>x.name==='crilo_owner_local_scan_save_v5').at(-1).args;
 assert.equal(blankSaved.p_run_id,'blank-safe-test');
 assert.deepEqual(Array.from(blankSaved.p_reasons),[],
  'Blank drawing must have no suggestion');
 assert.equal(blankSaved.p_visual_label,'Blank or nearly blank drawing');
 assert.equal(blankSaved.p_error,null,'A skipped blank image must not be an incomplete check');

 blankResult=false;
 harmlessLowScore=true;
 await window.criloScanSpecificDrawing({run_id:'harmless-low-vision',is_test:true,
   drawing:'data:image/png;base64,QUJD'});
 const harmless=calls.filter(x=>x.name==='crilo_owner_local_scan_save_v5').at(-1).args;
 assert.deepEqual(Array.from(harmless.p_reasons),[],
  'Low ML similarity without an actual signal is not an abuse flag');
 assert.equal(harmless.p_error,null,
  'Low ML similarity alone must not mark a fully scanned drawing incomplete');
 assert.equal(harmless.p_visual_score,0.00195244);

 node('reviewToggleScan').handlers.click();
 assert.ok(node('reviewScanStatus').textContent.includes('Paused'));
 assert.ok(terminated>0,'Pausing should free worker resources');
 window.Crilo.profile.is_owner=false;
 const callsBefore=calls.length;
 await window.criloScanPendingDrawings();
 assert.equal(calls.length,callsBefore,'Nonowners may not read review queue');
 console.log('PASS: one-at-a-time background scans, local flags, Test Run separation, pause and owner restriction');
}
async function feedTest(){
 let items=[];
 const el=new Map();
 function node(id){
  if(!el.has(id)){
   const flag=new Set(['hidden']);
   el.set(id,{id,handlers:{},checked:false,textContent:'',value:'all',disabled:false,hidden:false,
    innerHTML:'',dataset:{},addEventListener(x,fn){this.handlers[x]=fn},
    classList:{contains:x=>flag.has(x),add:x=>flag.add(x),remove:x=>flag.delete(x)},
    replaceChildren(){this.children=[]},appendChild(x){(this.children??=[]).push(x)},removeAttribute(){}});
  }
  return el.get(id);
 }
 const doc={hidden:false,getElementById:node,addEventListener(){},createElement:type=>({type,textContent:''})};
 const w={Crilo:{user:{id:'owner'},profile:{is_owner:true}},addEventListener(){}};
 const image='data:image/png;base64,QUJD';
 const data=[{run_id:'11',is_test:false,username:'Tester',drawing:image,score:15,submitted_at:'2026-10-10T09:00:00Z'},
  {run_id:'ca712ad4-a0bf-47a6-8e0b-46a4128bfcaf',is_test:true,username:'Owner',drawing:image,score:88,submitted_at:'2026-10-10T08:00:00Z'}];
 const scans=[{run_id:'11',is_test:false,reasons:['QR code'],status:'complete',scan_version:5,checked_at:'2026-10-10T10:00:00Z'},
   {run_id:'ca712ad4-a0bf-47a6-8e0b-46a4128bfcaf',is_test:true,reasons:[],status:'complete',scan_version:5,checked_at:'2026-10-10T10:01:00Z'}];
 const db={rpc:async(name)=>{
  if(name==='crilo_owner_drawing_feed')return {data};
  if(name==='crilo_owner_local_scan_report')return {data:scans};
  return {data:[]};
 }};
 vm.runInNewContext(feed,{window:w,document:doc,criloDB:db,
  setTimeout(){},setInterval(){},confirm:()=>true,console},
  {filename:'moderation-feed.js'});
 await w.criloRefreshDrawingFeed();
 const before=node('drawingReviewList').innerHTML;
 assert.ok(before.includes('QR code'));
 assert.ok(!before.includes('Owner'));
 assert.equal(node('reviewCountPending').textContent,1);
 assert.equal(node('reviewCountFlagged').textContent,1);
 assert.equal(node('reviewCountUnscanned').textContent,0);
 node('drawingReviewList').innerHTML='SENTINEL';
 await w.criloRefreshDrawingFeed();
 assert.equal(node('drawingReviewList').innerHTML,'SENTINEL',
  'Identical feed must avoid expensive image DOM redraws');
 node('showOwnerTests').checked=true;
 await w.criloRefreshDrawingFeed();
 assert.ok(node('drawingReviewList').innerHTML.includes('crilo-review-test-tag'),
  'Owner Test Runs should keep a separate test tag near username');
 const testRow=node('drawingReviewList').innerHTML.split('data-index="1"')[1]||'';
 assert.ok(testRow.includes('>NO FLAGS</span>'),
  'Scanned clean Owner Test Run must show NO FLAGS in status');
 assert.ok(!testRow.includes('>OWNER TEST</span>'),
  'Owner Test Run must never displace the scan-result status');
 assert.ok(node('drawingReviewList').innerHTML.includes('>REVIEW SUGGESTED</span>'),
  'Flagged official run must still show its scan result');
 node('drawingReviewList').handlers.click({target:{closest:()=>({dataset:{index:'1'}})}});
 assert.equal(node('reviewRemove').disabled,true,'Never delete a Test Run as an official Daily');
 assert.equal(node('reviewBan').disabled,true,'Never ban accounts via Test Run moderation');
 assert.equal(node('reviewApprove').disabled,true,'Test Run is only for inspection');
 node('reviewClose').handlers.click();
 // Regression for the actual 3:33 AM false negative: an extremely low
 // visual score from an earlier scan must NOT be shown as NO FLAGS.
 scans[1].visual_score=0.00195244;
 scans[1].visual_label='No strong category match';
 scans[1].checked_at='2026-10-10T10:02:00Z';
 await w.criloRefreshDrawingFeed();
 const updated=node('drawingReviewList').innerHTML;
 assert.ok(!updated.includes('Visual result uncertain'),
  'Low image similarity alone must never generate a review suggestion');
 const safeRow=updated.split('data-index="1"')[1]||'';
 assert.ok(safeRow.includes('>NO FLAGS</span>'),
  'A scanned clean Owner Test Run with a low score must show NO FLAGS');
 assert.equal((updated.match(/>REVIEW SUGGESTED<\/span>/g)||[]).length,1,
  'Only the genuinely QR-flagged drawing should request review');
 scans[1].scan_version=4;
 scans[1].checked_at='2026-10-10T10:03:00Z';
 await w.criloRefreshDrawingFeed();
 const oldScan=node('drawingReviewList').innerHTML.split('data-index="1"')[1]||'';
 assert.ok(oldScan.includes('>NEEDS RESCAN</span>'),
  'A clean result from an outdated scanner must not be presented as final');
 assert.equal(node('reviewCountUnscanned').textContent,1,
  'Older scans should be counted as needing checking');
 scans[1].scan_version=5;
 scans[1].checked_at='2026-10-10T10:04:00Z';
 await w.criloRefreshDrawingFeed();
 assert.ok(node('drawingReviewList').innerHTML.split('data-index="1"')[1].includes('>NO FLAGS</span>'),
  'Current scanner returning no reasons is allowed to show NO FLAGS');

 console.log('PASS: clear counters, owner Test Run filtering and zero redundant thumbnail redraws');
}
(async()=>{
 await workerTest();await schedulerTest();await feedTest();
})().catch(e=>{console.error(e);process.exitCode=1});