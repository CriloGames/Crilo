'use strict';
/* Interactive real-Chromium test for wheel drawing and Pixel Studio.
 * Synthetic Supabase only; never writes to player accounts. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
(async()=>{
 const server=http.createServer(serve);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let cases=0;
 const paintedPixels=async(page,id)=>page.locator('#'+id).evaluate(canvas=>{
   const data=canvas.getContext('2d').getImageData(0,0,200,200).data;
   let count=0;
   for(let i=3;i<data.length;i+=4)if(data[i])count++;
   return count;
 });
 async function exercise(page,selector,studio){
  const canvas=page.locator(selector);
  const box=await canvas.boundingBox();
  assert.ok(box&&box.width>40,'Drawing area missing: '+selector);
  const cx=box.x+box.width/2,cy=box.y+box.height/2;
  const insideX=cx+Math.min(12,box.width*.1);
  const outsideX=studio?box.x+box.width+15:cx+box.width*.6;
  const outsideY=studio?cy:cy+box.height*.6;
  const canvasId=studio?'pixelCanvas':'drawing';
  await page.mouse.move(cx,cy);await page.mouse.down();
  await page.mouse.move(insideX,cy);
  const started=await paintedPixels(page,canvasId);
  assert.ok(started>0,'Pointerdown and first stroke must paint');
  // Mouse button remains held: travel beyond the real drawing boundary.
  await page.mouse.move(outsideX,outsideY);
  const left=await paintedPixels(page,canvasId);
  await page.mouse.move(cx,cy);
  assert.equal(await paintedPixels(page,canvasId),left,
   'Returning after exit without new pointerdown must not join or resume the line');
  await page.mouse.up();
  await page.mouse.move(insideX,cy);
  assert.equal(await paintedPixels(page,canvasId),left,
   'An ordinary hover must never paint');
  // A deliberate new press must start a new stroke.
  await page.mouse.move(cx-Math.min(18,box.width*.12),cy);
  await page.mouse.down();
  await page.mouse.move(cx,cy+Math.min(15,box.height*.12));
  assert.ok(await paintedPixels(page,canvasId)>left,'Fresh pointerdown did not restart drawing');
  await page.mouse.up();
  // The active pointer must be cancelled by blur with the button still down.
  await page.mouse.move(cx,cy);await page.mouse.down();
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  const beforeBlur=await paintedPixels(page,canvasId);
  await page.mouse.move(cx+10,cy+10);
  assert.equal(await paintedPixels(page,canvasId),beforeBlur,
   'Window blur must cancel active drawing');
  await page.mouse.up();
  cases++;
  console.log('PASS '+selector+' pointer exit, re-entry, release and blur');
 }
 try{
  for(const width of [390,768,1280]){
   const context=await browser.newContext({viewport:{width,height:850}});
   await context.addInitScript({content:mockSupabase.replace('loggedIn:false','loggedIn:true')});
   await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
    r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:15000});
   await page.waitForFunction(()=>window.Crilo?.user&&document.querySelector('#drawing')?.width===200);
   await exercise(page,'#drawing',false);
   await page.locator('#pixelStudioBtn').click();
   await page.locator('#pixelCanvas').waitFor({state:'visible'});
   await exercise(page,'#pixelCanvas',true);
   await page.locator('#pixelClose').click();
   assert.deepEqual(errors,[],'Runtime error on '+width+'px: '+errors.join('; '));
   await context.close();
  }
  console.log('DRAWING_POINTER_BOUNDARY_PASS '+cases+' browser scenarios');
 }finally{
  await browser.close();
  await new Promise(done=>server.close(done));
 }
})().catch(error=>{console.error('DRAWING_POINTER_BOUNDARY_FAIL',error);process.exitCode=1});
