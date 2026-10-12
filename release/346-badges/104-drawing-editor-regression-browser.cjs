'use strict';
/* Pixel Studio and Daily drawing integration: real Chromium, read-only fake
   sign-in, no official spins, no score saves, no backend writes. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
(async()=>{
 const server=http.createServer(serve);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const pixel=async(page,id,x,y)=>page.locator('#'+id).evaluate((canvas,p)=>{
  return [...canvas.getContext('2d').getImageData(p.x,p.y,1,1).data];
 },{x,y});
 const point=async(page,id,x,y)=>{
  await page.locator('#'+id).scrollIntoViewIfNeeded();
  const rect=await page.locator('#'+id).boundingBox();
  assert.ok(rect,'Canvas '+id+' not shown');
  await page.mouse.click(rect.x+rect.width*x/200,rect.y+rect.height*y/200);
 };
 const color=async(page,button,hex)=>{
  await page.locator('#'+button).click();
  assert.ok(await page.locator('#drawColorModal').isVisible(),'Color picker missing');
  await page.locator('#colorPickerInput').fill(hex);
  await page.locator('#colorPickerDone').click();
 };
 let cases=0;
 try{
  for(const width of [390,768,1280]){
   const context=await browser.newContext({viewport:{width,height:860}});
   await context.addInitScript({content:mockSupabase.replace('loggedIn:false','loggedIn:true')});
   await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>
    r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
   const page=await context.newPage(),errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:16000});
   await page.waitForFunction(()=>window.Crilo?.user&&document.getElementById('drawing')?.width===200);
   // Force one true edge-to-edge divider across the visible circle.
   await page.locator('#drawing').evaluate(canvas=>{
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,200,200);ctx.beginPath();ctx.strokeStyle='#000000';
    ctx.lineWidth=6;ctx.moveTo(100,0);ctx.lineTo(100,200);ctx.stroke();
   });
   // Modal shields the canvas; tapping outside the picker dismisses it but
   // MUST NOT also leave a mark on the drawing underneath.
   await page.locator('#drawColorPickerBtn').click();
   const before=await pixel(page,'drawing',150,100);
   await point(page,'drawing',150,100);
   assert.deepEqual(await pixel(page,'drawing',150,100),before,
    'Canvas painted through color picker at '+width+'px');
   if(await page.locator('#drawColorModal').isVisible())
    await page.locator('#colorPickerDone').click();
   await color(page,'drawColorPickerBtn','#ee3344');
   await page.locator('.drawing-tool[data-tool="fill"]').click();
   await point(page,'drawing',150,100);
   assert.deepEqual((await pixel(page,'drawing',150,100)).slice(0,3),[238,51,68],
    'Main fill must color visible right side');
   assert.equal((await pixel(page,'drawing',50,100))[3],0,
    'Main fill leaked across visible border');
   assert.equal((await pixel(page,'drawing',0,0))[3],0,
    'Main flood fill painted invisible square corner');
   assert.equal(await page.locator('#drawRecentSwatches button').count(),1,
    'Main recent colors should show paint actually used');
   await page.locator('#pixelStudioBtn').click();
   await page.locator('#pixelCanvas').waitFor({state:'visible'});
   assert.equal((await pixel(page,'pixelCanvas',150,100))[0],238,
    'Opening Pixel Studio lost existing main drawing');
   await color(page,'pixelColorPickerBtn','#3366ee');
   await page.locator('.pixel-tool[data-pixel-tool="fill"]').click();
   await point(page,'pixelCanvas',50,100);
   assert.deepEqual((await pixel(page,'pixelCanvas',50,100)).slice(0,3),[51,102,238],
    'Pixel fill failed inside visible circle');
   assert.equal((await pixel(page,'pixelCanvas',0,0))[3],0,
    'Pixel fill leaked into invisible corners');
   assert.equal(await page.locator('#pixelRecentSwatches button').count(),2,
    'Both surfaces should share run-scoped recent colors');
   await page.locator('#pixelColorPickerBtn').click();
   const beforePicker=await pixel(page,'pixelCanvas',170,100);
   await page.locator('#pixelCanvas').evaluate(canvas=>{
    const b=canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointerdown',{
     pointerId:93,pointerType:'mouse',button:0,bubbles:true,
     clientX:b.left+b.width*.85,clientY:b.top+b.height*.5
    }));
   });
   assert.deepEqual(await pixel(page,'pixelCanvas',170,100),beforePicker,
    'Pixel Studio accepted a drawing event while color picker was open');
   await page.locator('#colorPickerDone').click();
   await page.locator('#pixelExit').click();
   assert.equal((await pixel(page,'drawing',50,100))[2],238,
    'Exit discarded edits instead of saving them to the wheel');
   await page.locator('#pixelStudioBtn').click();
   assert.equal((await pixel(page,'pixelCanvas',50,100))[2],238,
    'Reopening Studio did not restore the last saved drawing');
   // Done and Escape should also commit, not reset.
   await page.locator('.pixel-tool[data-pixel-tool="pen"]').click();
   await point(page,'pixelCanvas',160,110);
   await page.locator('#pixelClose').click();
   assert.equal((await pixel(page,'drawing',160,110))[2],238,'Done did not save new pixel paint');
   // Main and Studio must be fully two-way editable before the first spin.
   await color(page,'drawColorPickerBtn','#26a269');
   await page.locator('.drawing-tool[data-tool="pen"]').click();
   await point(page,'drawing',170,100);
   assert.equal((await pixel(page,'drawing',170,100))[1],162,'Main pen did not edit saved Studio drawing');
   await page.locator('#pixelStudioBtn').click();
   assert.equal((await pixel(page,'pixelCanvas',170,100))[1],162,
    'Main drawing update missing when Studio reopens');
   assert.equal(await page.locator('#pixelRecentSwatches button').count(),3,
    'Recent colors should include colors from both drawing modes');
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#pixelStudioModal').isVisible(),false,
    'Esc should safely save and exit Studio');
   assert.equal((await pixel(page,'drawing',170,100))[1],162,'Escape lost the drawing');
   assert.deepEqual(errors,[],'Browser errors at '+width+'px');
   console.log('PASS circular fills, protected picker, recent colors, Exit/Done/Escape, two-way editing '+width+'px');
   cases++;
   await context.close();
  }
  console.log('DRAWING_EDITOR_BROWSER_PASS '+cases+' responsive scenarios');
 }finally{
  await browser.close();
  await new Promise(done=>server.close(done));
 }
})().catch(err=>{console.error('DRAWING_EDITOR_BROWSER_FAIL',err);process.exitCode=1});
