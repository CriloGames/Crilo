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
 const self={postMessage:x=>responses.push(x)};
 class FakeOffscreenCanvas {
  constructor(w,h){this.width=w;this.height=h}
  getContext(){return {fillRect(){},drawImage(){},
   getImageData:()=>({data:new Uint8ClampedArray(this.width*this.height*4)})}}
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
 console.log('PASS: dedicated worker decoded QR + OCR without any UI-thread canvas use');
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
 let useTest=false,workersCreated=0,terminated=0;
 class MockWorker{
  constructor(path){assert.ok(path.includes('moderation-scan-worker'));workersCreated++}
  postMessage({id,checkVisual}){
   this.onmessage({data:{type:'progress',id,step:'ocr',detail:'Reading text'}});
   this.onmessage({data:{type:'result',id,qrFound:true,ocrText:'fuck https://example.com',
    stages:{qr:'done',ocr:'done',visual:checkVisual?'done':'skipped'},
    visualResults:[],errors:[]}});
  }
  terminate(){terminated++}
 }
 const db={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='crilo_owner_local_scan_jobs')return {data:[{run_id:useTest?'test-uuid':'123',
   is_test:useTest,drawing:'data:image/png;base64,QUJD'}]};
  if(name==='crilo_owner_local_scan_save')return {data:true};
  throw Error('Unexpected RPC '+name);
 }};
 const timers=new Map();let n=0;
 const setTimeout=(fn)=>{timers.set(++n,fn);return n};
 const clearTimeout=id=>timers.delete(id);
 vm.runInNewContext(scanner,{window,document,Worker:MockWorker,criloDB:db,
  setTimeout,clearTimeout,console},{filename:'moderation-feed-scanner.js'});
 window.CriloLocalSafety.start();
 await window.criloScanPendingDrawings();
 assert.equal(calls.filter(x=>x.name==='crilo_owner_local_scan_save').length,1,
  'One official scan should be saved');
 const payload=calls.find(x=>x.name==='crilo_owner_local_scan_save').args;
 assert.deepEqual(Array.from(payload.p_reasons),['QR code','Profanity','Website or link']);
 assert.equal(payload.p_is_test,false);
 assert.ok(node('reviewScanStatus').textContent.includes('Checked 1 drawing'));
 useTest=true;
 await window.criloScanPendingDrawings();
 assert.equal(calls.filter(x=>x.name==='crilo_owner_local_scan_save').length,1,
  'Do not scan owner Test Runs unless explicitly included');
 node('showOwnerTests').checked=true;
 await window.criloScanPendingDrawings();
 assert.equal(calls.filter(x=>x.name==='crilo_owner_local_scan_save').length,2);
 assert.equal(calls.filter(x=>x.name==='crilo_owner_local_scan_save')[1].args.p_is_test,true,
  'An Owner Test Run must be identified as a Test Run');
 const queuedBefore=calls.filter(x=>x.name==='crilo_owner_local_scan_jobs').length;
 await window.criloScanSpecificDrawing({run_id:'direct-owner-test',is_test:true,
   drawing:'data:image/png;base64,QUJD'});
 const direct=calls.filter(x=>x.name==='crilo_owner_local_scan_save').at(-1).args;
 assert.equal(direct.p_run_id,'direct-owner-test',
  'Manual rescan must evaluate the selected drawing, not the next queue item');
 assert.equal(direct.p_is_test,true,'Owner Test Run must retain isolation when rescanned');
 assert.equal(calls.filter(x=>x.name==='crilo_owner_local_scan_jobs').length,queuedBefore,
  'Targeted rescan must not fetch the unrelated backlog');

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
 const db={rpc:async(name)=>{
  if(name==='crilo_owner_drawing_feed')return {data};
  if(name==='crilo_owner_local_scan_report')return {data:[{run_id:'11',is_test:false,reasons:['QR code'],status:'complete',checked_at:'2026-10-10T10:00:00Z'}]};
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
  'Owner Test Runs should be explicitly labeled, even when unscanned');
 node('drawingReviewList').handlers.click({target:{closest:()=>({dataset:{index:'1'}})}});
 assert.equal(node('reviewRemove').disabled,true,'Never delete a Test Run as an official Daily');
 assert.equal(node('reviewBan').disabled,true,'Never ban accounts via Test Run moderation');
 assert.equal(node('reviewApprove').disabled,true,'Test Run is only for inspection');
 node('reviewClose').handlers.click();

 console.log('PASS: clear counters, owner Test Run filtering and zero redundant thumbnail redraws');
}
(async()=>{
 await workerTest();await schedulerTest();await feedTest();
})().catch(e=>{console.error(e);process.exitCode=1});