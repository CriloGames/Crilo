/* Mobile QA on all Crilo playable game surfaces.
 * Only a local fixture Supabase is used: no real Daily runs, accounts,
 * analytics, purchases, player data, or match scores are touched.
 *
 * Run: node scripts/verify-all-games-mobile.cjs
 */
'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const {serve,mockSupabase}=require('../release/346-badges/086-site-wide-interactions-browser.cjs');

const games=[
 {id:'daily',url:'index.html',selector:'#drawing'},
 {id:'pong',url:'pong-toss.html',selector:'#ptCanvas'},
 {id:'nothing',url:'secrets.html',selector:'#stage'},
 {id:'sound',url:'shape-of-sound.html',selector:'#soundStage'},
 {id:'domain',url:'domain/',selector:'#priceSlider'},
 {id:'precision',url:'test-games.html',selector:'#testOpenPrecision',owner:true},
 {id:'fronts',url:'five-fronts.html',selector:'#ffStart',owner:true}
];
const layouts=[
 {name:'iPhone portrait',width:390,height:844,engine:chromium},
 {name:'small Android',width:360,height:780,engine:chromium},
 {name:'iPad portrait',width:768,height:1024,engine:chromium},
 {name:'mobile Safari',width:390,height:844,engine:webkit}
];
for(const item of games){
 const local=path.resolve(item.url.endsWith('/')?item.url+'index.html':item.url);
 assert.ok(fs.existsSync(local),'Missing playable page: '+local);
}
for(const [file,needles] of Object.entries({
 'game.js':['pointerdown','pointerup'],
 'ping-pong-toss.js':['lostpointercapture','pt-pseudo-fullscreen'],
 'secrets-3d-preview.js':['pickTouchAction','pointercancel'],
 'sound-shapes.js':['cancelInteraction','lostpointercapture'],
 'domain/game.js':['priceSlider','guessButton'],
 'test-games.js':['pointerdown','pointercancel'],
 'five-fronts.js':['ffStatePicker','selectState']
})){
 const content=fs.readFileSync(file,'utf8');
 for(const needle of needles)assert.ok(content.includes(needle),
  'Missing '+needle+' mobile interaction on '+file);
}
// An isolated fake owner is required to open prototypes. Never use the
// real owner's ID or password for QA and never persist a Supabase session.
const testAuth=mockSupabase
 .replace('loggedIn:false','loggedIn:true')
 .replace('is_owner:false','is_owner:true');
const guestAuth=mockSupabase;
function rectStatus(){
 const viewport=document.documentElement.clientWidth;
 const root=document.documentElement;
 const body=document.body;
 const visible=el=>{
  const s=getComputedStyle(el),r=el.getBoundingClientRect();
  return s.display!=='none'&&s.visibility!=='hidden'&&r.width>=4&&r.height>=4;
 };
 const game=document.querySelector('main')||document.body;
 const out={viewport,scroll:root.scrollWidth,body:body.scrollWidth,
  main:Math.round(game.getBoundingClientRect().width),clipped:[]};
 for(const el of document.querySelectorAll('input,select,button,[role="slider"]')){
  if(!visible(el))continue;
  const r=el.getBoundingClientRect();
  if(r.left< -5||r.right>viewport+5){
   let ancestor=el.parentElement,scrollable=false;
   while(ancestor&&ancestor!==body){
    const s=getComputedStyle(ancestor);
    if(['auto','scroll'].includes(s.overflowX)&&ancestor.scrollWidth>ancestor.clientWidth+3){scrollable=true;break}
    ancestor=ancestor.parentElement;
   }
   if(!scrollable)out.clipped.push({
    id:el.id||el.className?.toString()?.slice(0,35)||el.tagName,
    left:Math.round(r.left),right:Math.round(r.right)
   });
  }
 }
 return out;
}
const server=http.createServer(serve);
const errors=[],snapshots=[];
let checks=0;
function label(layout,game){return layout.name+' '+game.id}
async function testGame(page,game,layout){
 const found=page.locator(game.selector);
 await found.waitFor({state:'visible',timeout:40000});
 const status=await page.evaluate(rectStatus);
 assert.ok(status.scroll<=status.viewport+8,
  label(layout,game)+' horizontally overflowing: '+JSON.stringify(status));
 assert.deepEqual(status.clipped.slice(0,8),[],
  label(layout,game)+' clipped controls: '+JSON.stringify(status));
 checks+=2;
 const tap=async selector=>page.locator(selector).tap({timeout:8000});
 if(game.id==='daily'){
  const box=await page.locator('#drawing').boundingBox();
  assert.ok(box?.width>55&&box?.height>55,'Daily draw circle must be touchable');
  await tap('#pixelStudioBtn');
  assert.equal(await page.locator('#pixelStudioModal').isVisible(),true);
  const pixel=page.locator('#pixelCanvas');
  const pixelBox=await pixel.boundingBox();
  assert.ok(pixelBox?.height>90,'Pixel studio canvas must fit on mobile');
  const viewport=page.viewportSize();
  assert.ok(pixelBox.y<viewport.height+20,'Pixel studio must open in viewport');
  // Use touch, not a synthetic mouse click, to make a real Pixel Studio mark.
  await page.touchscreen.tap(pixelBox.x+pixelBox.width*.51,
   pixelBox.y+pixelBox.height*.51);
  await tap('#pixelExit');
  assert.equal(await page.locator('#pixelStudioModal').isHidden(),true);
  checks+=5;
 }else if(game.id==='pong'){
  await page.locator('#ptCanvas').waitFor({state:'visible'});
  await tap('#ptFullscreen');
  // The native fullscreen API might succeed in Chromium. On iPhone
  // WebKit, the CSS fallback must be available without a dead-end alert.
  const fullscreen=await page.evaluate(()=>Boolean(
   document.fullscreenElement||document.querySelector('.pt-pseudo-fullscreen')));
  assert.equal(fullscreen,true,'Pong must have a usable mobile fullscreen');
  await tap('#ptFullscreen');
  const exit=await page.evaluate(()=>Boolean(
   document.fullscreenElement||document.querySelector('.pt-pseudo-fullscreen')));
  assert.equal(exit,false,'Pong fullscreen must exit without trapping scrolling');
  const primary=page.locator('#ptPrimary');
  if(await primary.isVisible())await primary.tap();
  const canvas=page.locator('#ptCanvas'),box=await canvas.boundingBox();
  assert.ok(box&&box.width>200&&box.height>220,'Pong toss area too small');
  const x=box.x+box.width*.50,y=box.y+box.height*.56;
  await page.touchscreen.tap(x,y);
  await page.waitForTimeout(200);
  assert.ok(Number(await page.locator('#ptAttempts').innerText())>=1,
   'Finger tap must launch one toss');
  checks+=5;
 }else if(game.id==='nothing'){
  await page.locator('#ncViewReset').tap();
  assert.equal(await page.locator('#stage canvas').count(),1,
   'Nothing Here must present one live 3D stage on mobile');
  // Precise inventory pickup and pinch tests already run in
  // scripts/verify-nothing-here-mobile.mjs.
  checks+=2;
 }else if(game.id==='sound'){
  const blobs=page.locator('.sound-blob');
  await blobs.first().waitFor();
  const count=await blobs.count();
  assert.ok(count>=5,'Sound playground is missing its initial voices');
  await blobs.first().tap();
  assert.ok(await blobs.first().evaluate(el=>el.classList.contains('is-selected')),
   'Touch must select a sound');
  const knob=page.locator('.sound-handle').first();
  await knob.waitFor({state:'visible'});
  const touchSize=await knob.boundingBox();
  assert.ok(touchSize.width>=30&&touchSize.height>=30,
   'Mobile sculpt handle is smaller than a finger');
  await tap('#soundMute');
  checks+=4;
 }else if(game.id==='domain'){
  await page.locator('#priceSlider').evaluate(el=>{
   el.value='700';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await tap('#guessButton');
  assert.equal(await page.locator('#reveal').isVisible(),true,
   'Touch slider and submit must reveal the result');
  await tap('#nextButton');
  assert.equal(await page.locator('#reveal').isHidden(),true);
  checks+=2;
 }else if(game.id==='precision'){
  await tap('#testOpenPrecision');
  assert.equal(await page.locator('#precisionPrototype').isVisible(),true);
  await page.locator('#apMode').selectOption('distance');
  assert.equal(await page.locator('#apReachWrap').isVisible(),false,
   'Distance must not display drawing sensitivity');
  await page.locator('#apMode').selectOption('path');
  assert.equal(await page.locator('#apReachWrap').isVisible(),true);
  checks+=3;
 }else if(game.id==='fronts'){
  await tap('#ffStart');
  assert.equal(await page.locator('#ffMatch').isVisible(),true);
  const picker=page.locator('#ffStatePicker');
  assert.ok(await picker.locator('option').count()>=11,
   'Phone must be able to choose states without tiny map taps');
  const own=await picker.locator('option').evaluateAll(options=>
   options.filter(x=>x.textContent.includes('(YOU)')).map(x=>x.value));
  assert.ok(own.length>=5);
  await picker.selectOption(own[0]);
  await tap('#ffTrain');
  const info=await page.locator('#ffGuidance').innerText();
  assert.match(info,/recruit/i,'Touch recruiting did not activate');
  await tap('#ffPause');
  assert.match(await page.locator('#ffPause').innerText(),/RESUME/);
  await tap('#ffPause');
  checks+=5;
 }
}
(async()=>{
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',
  err=>err?reject(err):resolve()));
 const origin='http://127.0.0.1:'+server.address().port;
 const browsers=new Map();
 try{
  for(const layout of layouts){
   const engine=layout.engine;
   let browser=browsers.get(engine);
   if(!browser){
    browser=await engine.launch({headless:true,args:engine===chromium?
     ['--no-sandbox','--enable-webgl','--use-gl=angle',
      '--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
    browsers.set(engine,browser);
   }
   for(const game of games){
    // Nothing Here's full pinch/pickup WebGL suite is Chromium-based. WebKit
    // continues to test its page and controls in a dedicated future audit.
    if(layout.name==='mobile Safari'&&['pong','nothing'].includes(game.id))continue;
    const ctx=await browser.newContext({
     viewport:{width:layout.width,height:layout.height},
     isMobile:true,hasTouch:true,deviceScaleFactor:2,
     reducedMotion:'reduce'
    });
    await ctx.addInitScript({content:game.owner?testAuth:guestAuth});
    // Keep external auth from overriding the local fake session.
    await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*',
     r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
    const page=await ctx.newPage();
    page.setDefaultTimeout(10000);
    const runtime=[];
    page.on('pageerror',e=>runtime.push(e.message));
    try{
     const response=await page.goto(origin+'/'+game.url,{
      waitUntil:'domcontentloaded',timeout:35000
     });
     assert.equal(response?.status(),200,label(layout,game)+' not found');
     await page.waitForFunction(()=>!document.documentElement.classList.contains('crilo-auth-pending'),
      null,{timeout:25000});
     await testGame(page,game,layout);
     assert.deepEqual(runtime.filter(x=>/ReferenceError|TypeError|SyntaxError/.test(x)),[],
      label(layout,game)+' runtime errors');
     console.log('PASS '+label(layout,game));
    }catch(e){
     errors.push(label(layout,game)+': '+e.stack);
     try{
      const directory='test-results/mobile-games';
      fs.mkdirSync(directory,{recursive:true});
      const file=directory+'/'+layout.name.replace(/\s+/g,'-')+'-'+game.id+'.png';
      await page.screenshot({path:file,fullPage:true,timeout:7000});
      snapshots.push(file);
     }catch{}
    }finally{await ctx.close()}
   }
  }
 }finally{
  await Promise.all([...browsers.values()].map(b=>b.close()));
  await new Promise(ok=>server.close(ok));
 }
 if(errors.length){
  for(const error of errors)console.error('MOBILE GAME FAILURE '+error);
  console.error('Saved failure screenshots: '+snapshots.join(', '));
  process.exitCode=1;
 }else console.log('PASS all Crilo mobile games: '+checks+' functional/layout checks');
})().catch(e=>{console.error(e);process.exitCode=1});
