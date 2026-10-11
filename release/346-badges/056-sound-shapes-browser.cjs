/* Real-browser Crilo Shape of Sound regression: desktop Chromium and mobile WebKit.
   Checks real layout, gestures, Web Audio, merging, undo, persistence, and checkout.
   No payment is made; tests always use a local server and synthetic events. */
'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const pathname=(req.url||'/').split('?')[0];
 const normalized=path.normalize(decodeURIComponent(pathname));
 const resolved=path.resolve(root,'.'+normalized);
 if(!resolved.startsWith(root+path.sep)||!fs.existsSync(resolved)||!fs.statSync(resolved).isFile()){
  res.writeHead(404);res.end('Not found');return;
 }
 res.writeHead(200,{'content-type':mime[path.extname(resolved)]||'text/plain; charset=utf-8'});
 fs.createReadStream(resolved).pipe(res);
});
function check(cond,msg){assert.ok(cond,msg)}
async function main(){
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',e=>e?reject(e):resolve()));
 const port=server.address().port,url='http://127.0.0.1:'+port+'/support.html';
 let runs=0;
 for(const scenario of [
  {name:'desktop-wide',engine:chromium,width:1440,height:900,touch:false},
  {name:'desktop-small',engine:chromium,width:1024,height:768,touch:false},
  {name:'laptop-narrow',engine:chromium,width:800,height:700,touch:false},
  {name:'iphone-se',engine:webkit,width:375,height:667,touch:true},
  {name:'iphone-portrait',engine:webkit,width:390,height:844,touch:true},
  {name:'iphone-large',engine:webkit,width:430,height:932,touch:true},
  {name:'iphone-landscape',engine:webkit,width:844,height:390,touch:true},
  {name:'ipad-portrait',engine:webkit,width:820,height:1180,touch:true},
  {name:'ipad-landscape',engine:webkit,width:1180,height:820,touch:true},
  {name:'android-portrait',engine:chromium,width:412,height:915,touch:true}
 ]){
  const browser=await scenario.engine.launch({headless:true,args:scenario.engine===chromium?['--no-sandbox','--autoplay-policy=no-user-gesture-required']:[]});
  const context=await browser.newContext({
   viewport:{width:scenario.width,height:scenario.height},deviceScaleFactor:1,
   isMobile:scenario.touch,hasTouch:scenario.touch
  });
  await context.addInitScript(()=>{
   window.__criloAudioVoices=0;
   const Ctor=window.AudioContext||window.webkitAudioContext;
   if(Ctor&&Ctor.prototype){
    const method=Ctor.prototype.createOscillator;
    Ctor.prototype.createOscillator=function(){
     const osc=method.apply(this,arguments),start=osc.start;
     osc.start=function(){window.__criloAudioVoices++;return start.apply(this,arguments)};
     return osc;
    };
   }
  });
  const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(7000);
  console.log('START '+scenario.name+' '+scenario.width+'x'+scenario.height);
  page.on('pageerror',e=>{if(/sound-shapes|sound|null|undefined|ReferenceError|SyntaxError/.test(e.message))errors.push(e.message)});
  // Keep the sound sandbox independent from Crilo auth and third-party CDNs.
  await page.route(/\/(?:app|supabase-config)\.js(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('.sound-blob').first().waitFor({state:'visible'});
  const layout=await page.evaluate(()=>{
   const stage=document.getElementById('soundStage').getBoundingClientRect();
   const blobs=[...document.querySelectorAll('.sound-blob')].map(el=>el.getBoundingClientRect());
   return {vw:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,
    stage:stage.toJSON(),blobs:blobs.map(r=>r.toJSON()),
    soundShown:getComputedStyle(document.getElementById('soundStage')).display,
    header:document.querySelector('.sound-heading h1').getBoundingClientRect().toJSON()};
  });
  check(layout.scrollWidth<=layout.vw+2,scenario.name+' horizontal overflow '+JSON.stringify(layout));
  check(layout.stage.width>Math.min(290,scenario.width*.7),scenario.name+' stage too narrow');
  check(layout.blobs.length===5,scenario.name+' expected five playable blobs');
  for(const r of layout.blobs){
   check(r.left>=layout.stage.left-2&&r.right<=layout.stage.right+2,
    scenario.name+' blob clipped horizontally at startup '+JSON.stringify({blob:r,stage:layout.stage}));
   check(r.top>=layout.stage.top-2&&r.bottom<=layout.stage.bottom+2,
    scenario.name+' blob clipped vertically at startup');
  }
  if(scenario.name==='iphone-portrait'||scenario.name==='desktop-wide'){
   const jpg=await page.screenshot({type:'jpeg',quality:50,fullPage:false});
   console.log('VISUAL_SCREENSHOT_B64 '+scenario.name+' '+jpg.toString('base64'));
  }
  const before=await page.evaluate(()=>window.__criloAudioVoices);
  if(scenario.touch)await page.locator('.sound-blob').first().tap();
  else await page.locator('.sound-blob').first().click();
  await page.waitForTimeout(100);
  const after=await page.evaluate(()=>window.__criloAudioVoices);
  check(after>before,scenario.name+' tap should play Web Audio, voices '+before+' -> '+after);
  check(await page.locator('#soundInspector').isVisible(),scenario.name+' inspector must open');
  const slider=page.locator('#soundStretch');
  await slider.evaluate(input=>{input.value='140';input.dispatchEvent(new Event('input',{bubbles:true}))});
  check((await page.locator('.sound-blob').first().boundingBox()).width>layout.blobs[0].width,scenario.name+' stretch should change width');
  const persisted=await page.evaluate(()=>localStorage.getItem('crilo_sound_shapes_v1'));
  check(!!persisted&&persisted.includes('1.4'),scenario.name+' scaled shape persisted');
  // Test real mouse drag and corresponding pointer behavior, including mobile touch pointer type.
  const boxes=await Promise.all([0,1].map(i=>page.locator('.sound-blob').nth(i).boundingBox()));
  const center=b=>({x:b.x+b.width/2,y:b.y+b.height/2});
  const start=center(boxes[0]),end=center(boxes[1]);
  if(scenario.touch){
   await page.evaluate(({start,end})=>{
    const source=document.querySelectorAll('.sound-blob')[0];
    source.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'touch',pointerId:11,isPrimary:true,clientX:start.x,clientY:start.y}));
    for(let i=1;i<=14;i++){
     const f=i/14;
     window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerType:'touch',pointerId:11,isPrimary:true,clientX:start.x+(end.x-start.x)*f,clientY:start.y+(end.y-start.y)*f}));
    }
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerType:'touch',pointerId:11,isPrimary:true,clientX:end.x,clientY:end.y}));
   },{start,end});
  }else{
   await page.mouse.move(start.x,start.y);await page.mouse.down();
   await page.mouse.move(end.x,end.y,{steps:18});await page.mouse.up();
  }
  check(await page.locator('.sound-blob').count()===4,scenario.name+' drop-to-merge failed');
  check(await page.locator('#soundSeparate').isEnabled(),scenario.name+' merged blob cannot split');
  await page.locator('#soundSeparate').click();
  check(await page.locator('.sound-blob').count()===5,scenario.name+' split failed');
  await page.locator('#soundAdd').click();
  check(await page.locator('.sound-blob').count()===6,scenario.name+' add failed');
  await page.locator('#soundPlayRoom').click();
  check((await page.locator('#soundPlayRoom').innerText()).includes('Stop'),scenario.name+' room playback failed');
  await page.waitForTimeout(250);
  await page.locator('#soundPlayRoom').click();
  await page.locator('#soundMute').click();
  check((await page.locator('#soundMute').innerText()).includes('off'),scenario.name+' mute toggle failed');
  await page.reload({waitUntil:'domcontentloaded'});
  check(await page.locator('.sound-blob').count()===6,scenario.name+' local restore failed');
  await page.locator('#soundReset').click();
  check(await page.locator('.sound-blob').count()===5,scenario.name+' reset failed');
  const gameBefore=await page.locator('.sound-blob').count();
  await page.locator('[data-amount="10"]').click();
  check(await page.locator('#supportPayLink').getAttribute('href')==='https://www.paypal.com/ncp/payment/ZK6WTGVE48JG4',scenario.name+' $10 checkout was changed');
  await page.locator('[data-amount="custom"]').click();
  check(await page.locator('#supportPayLink').getAttribute('href')==='https://www.paypal.com/ncp/payment/K7QJM2NVLKEYU',scenario.name+' custom checkout was changed');
  check(await page.locator('.sound-blob').count()===gameBefore,scenario.name+' tip selection affected the free game');
  check(!errors.length,scenario.name+' JavaScript errors: '+errors.join('; '));
  console.log('PASS '+scenario.name+' '+scenario.width+'x'+scenario.height+' — layout/tap/audio/stretch/merge/split/loop/mute/save/reset/PayPal');
  runs++;await context.close();await browser.close();
 }
 console.log('PASS: '+runs+' real rendered browser viewports; no purchases or user-data mutations.');
}
main().then(()=>server.close()).catch(e=>{console.error(e);server.close();process.exit(1)});
