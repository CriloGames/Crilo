'use strict';
/* No model downloads, no real worker, no Supabase calls or player data changes.
 Verify mobile / low-memory owner pages don't automatically run heavy AI. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),scanner=fs.readFileSync(path.join(root,'moderation-feed-scanner.js'),'utf8');
function scenario(navigatorInfo,expectedPaused){
 const widgets=new Map(),timers=[];
 const el=id=>{
  if(!widgets.has(id))widgets.set(id,{id,textContent:'',checked:id==='showOwnerTests'?false:true,
   disabled:false,handlers:{},setAttribute(){},addEventListener(type,handler){this.handlers[type]=handler}});
  return widgets.get(id);
 };
 const doc={hidden:false,getElementById:el,addEventListener(){}};
 let created=0,calls=0;
 const win={Crilo:{user:{id:'owner'},profile:{is_owner:true}},addEventListener(){}};
 const CriloDB={rpc:async()=>{calls++;throw Error('Network calls not allowed in initialization')}};
 class FakeWorker{constructor(){created++}terminate(){}}
 vm.runInNewContext(scanner,{window:win,document:doc,navigator:navigatorInfo,
  Worker:FakeWorker,criloDB:CriloDB,console,
  setTimeout(fn,ms){timers.push({fn,ms});return timers.length},
  clearTimeout(){}});
 win.CriloLocalSafety.start();
 assert.equal(created,0,'No worker should start before the scheduled scan');
 assert.equal(calls,0,'Opening page cannot fetch 1000 scans immediately');
 if(expectedPaused){
  assert.equal(el('reviewToggleScan').textContent,'Resume scanning');
  assert.ok(el('reviewScanStatus').textContent.includes('paused'));
  assert.ok(!timers.some(x=>x.ms===1600),
   'Mobile must not schedule an automatic initial scan');
  el('reviewToggleScan').handlers.click();
  assert.equal(el('reviewToggleScan').textContent,'Pause scanning',
   'Owner can opt in to scans');
 }else{
  assert.equal(el('reviewToggleScan').textContent,'');
  assert.ok(timers.some(x=>x.ms===1600),
   'Desktop can schedule its first background scan');
 }
}
scenario({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',maxTouchPoints:5},true);
scenario({userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)',maxTouchPoints:5},true);
scenario({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',maxTouchPoints:5},true);
scenario({userAgent:'Mozilla/5.0 (X11; Linux x86_64)',deviceMemory:2},true);
scenario({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',maxTouchPoints:0,deviceMemory:8},false);
assert.ok(scanner.includes("new Worker('moderation-scan-worker.js?v=10')"));
assert.ok(scanner.includes('if(document.hidden)'), 'Hidden tabs must stop scanning');
assert.ok(scanner.includes('stopActive()'), 'Manual pause must release worker');
assert.ok(scanner.includes("p_limit:1"),'Only one queued image at a time');
console.log('PASS: iPhone, iPad, touch-Mac and low-memory devices do not auto-scan');
console.log('PASS: desktop scans remain automatic; mobile owner can opt in; queue remains serial');
