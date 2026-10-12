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
 const color=async(page,input,hex)=>{
  assert.equal(await page.locator('#'+input).getAttribute('type'),'color','Native color palette missing');
  await page.locator('#'+input).fill(hex);
  assert.equal(await page.locator('#'+input).inputValue(),hex,'Native color change failed');
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
   // Keep these three essential controls visible even after locking.
   const essential=await page.locator('#drawPanel').evaluate(panel=>{
    const els=[panel.querySelector('#drawColor'),
      panel.querySelector('[data-tool="eraser"]'),
      panel.querySelector('#clearDrawing')];
    if(!els.every(Boolean))return {present:false};
    const ready=els.every(el=>getComputedStyle(el).display!=='none');
    panel.classList.add('daily-finished');
    const finished=els.every(el=>getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().width>0);
    const overflow=document.documentElement.scrollWidth>innerWidth+2;
    panel.classList.remove('daily-finished');
    return {present:true,ready,finished,overflow};
   });
   assert.deepEqual(essential,{present:true,ready:true,finished:true,overflow:false},
    'Color, Eraser and Clear must remain on the compact panel at '+width+'px');
   // Force one true edge-to-edge divider across the visible circle.
   await page.locator('#drawing').evaluate(canvas=>{
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,200,200);ctx.beginPath();ctx.strokeStyle='#000000';
    ctx.lineWidth=6;ctx.moveTo(100,0);ctx.lineTo(100,200);ctx.stroke();
   });
   // A native color palette suspends drawing until it is committed.
   // Synthetic pointer event avoids opening a real OS picker in headless CI.
   assert.equal(await page.locator('#drawColorModal').count(),0,'Custom picker modal must be removed');
   await page.locator('#drawColor').evaluate(input=>input.dispatchEvent(
    new PointerEvent('pointerdown',{bubbles:true,pointerId:92,pointerType:'mouse',button:0})));
   const before=await pixel(page,'drawing',150,100);
   await page.locator('#drawing').evaluate(canvas=>{
    const b=canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointerdown',{
     pointerId:92,pointerType:'mouse',button:0,bubbles:true,
     clientX:b.left+b.width*.75,clientY:b.top+b.height*.5
    }));
   });
   assert.deepEqual(await pixel(page,'drawing',150,100),before,
    'Drawing continued while native color palette was active at '+width+'px');
   await color(page,'drawColor','#ee3344');
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
   assert.equal(await page.locator('#pixelDrawMode').inputValue(),'stationary',
    'Pixel Studio spin setting must reflect the main wheel on first open');
   const originalToolbarBox=await page.locator('.pixel-studio-tools').boundingBox();
   await page.locator('#pixelDrawMode').selectOption('spin');
   assert.equal(await page.locator('#drawMode').inputValue(),'spin',
    'Changing Pixel Studio to Spin must immediately update the wheel setting');
   assert.equal(await page.locator('#pixelDrawMode').inputValue(),'spin',
    'Pixel Studio must retain the newly selected spin mode');
   const spinToolbarBox=await page.locator('.pixel-studio-tools').boundingBox();
   assert.ok(Math.abs(originalToolbarBox.y-spinToolbarBox.y)<=1&&
    Math.abs(originalToolbarBox.height-spinToolbarBox.height)<=1,
    'Changing spin mode must not shift or resize the Pixel Studio tool row');
   assert.ok(await page.locator('#pixelDrawMode').isVisible(),
    'Pixel Studio spin selector must remain visible at '+width+'px');
   assert.ok(await page.locator('#pixelExit').isVisible(),
    'Pixel Studio Exit must remain visible at '+width+'px');
   const spinPosition=await page.evaluate(()=>{
    const box=selector=>document.querySelector(selector).getBoundingClientRect();
    return {color:box('#pixelColor').right,mode:box('#pixelDrawMode').left,
      undo:box('#pixelUndo').left,headerMode:!!document.querySelector('.pixel-header-actions #pixelDrawMode')};
   });
   assert.equal(spinPosition.headerMode,false,'Spin selector must not occupy the Pixel Studio header');
   assert.ok(spinPosition.mode>=spinPosition.color-2&&spinPosition.mode<=spinPosition.undo+2,
    'Spin selector must follow Color before Undo in the Pixel Studio toolbar');
   const pixelRowLayout=await page.evaluate(()=>{
    const rect=selector=>document.querySelector(selector).getBoundingClientRect();
    const y=selector=>rect(selector).top+rect(selector).height/2;
    const tools=rect('.pixel-studio-tools'),modal=rect('.pixel-studio-card');
    return {
     colorY:y('.pixel-studio-tools .native-paint-picker'),
     modeY:y('#pixelDrawMode'),undoY:y('#pixelUndo'),clearY:y('#pixelClear'),
     pencilY:y('.pixel-tool[data-pixel-tool="pen"]'),
     headerHasOnlyExit:document.querySelectorAll('.pixel-header-actions button,.pixel-header-actions select').length===1,
     modeInsideTools:!!document.querySelector('.pixel-studio-tools #pixelDrawMode'),
     overflow:document.documentElement.scrollWidth-innerWidth,
     toolsRight:tools.right,modalRight:modal.right
    };
   });
   assert.ok(pixelRowLayout.headerHasOnlyExit&&pixelRowLayout.modeInsideTools,
    'Only Exit belongs in the Pixel Studio header; Spin belongs alongside tools');
   if(width>=768){
    const rowRects=await page.locator('.pixel-studio-tools').evaluate(row=>{
     const rs=[...row.children].map(el=>el.getBoundingClientRect());
     const box=row.getBoundingClientRect();
     return {top:Math.max(...rs.map(r=>r.top))-Math.min(...rs.map(r=>r.top)),
      right:Math.max(...rs.map(r=>r.right)),rowRight:box.right,
      height:box.height};
    });
    assert.ok(rowRects.top<=7&&rowRects.right<=rowRects.rowRight+1&&rowRects.height<=52,
     'Pixel Studio toolbar must stay on one row, with Clear visible at '+width+'px');
   }

   assert.ok(pixelRowLayout.overflow<=2&&pixelRowLayout.toolsRight<=pixelRowLayout.modalRight+1,
    'Pixel Studio tool row must stay inside the modal on '+width+'px');
   assert.ok(Math.abs(pixelRowLayout.colorY-pixelRowLayout.modeY)<=7,
    'Color and Spin must be side by side rather than on separate lines on '+width+'px');
   if(width<=390){
    assert.ok(Math.abs(pixelRowLayout.modeY-pixelRowLayout.undoY)<=7&&
     Math.abs(pixelRowLayout.undoY-pixelRowLayout.clearY)<=7,
     'Narrow phone layout should keep Spin, Undo and Clear together on one row');
   }else{
    assert.ok(Math.abs(pixelRowLayout.pencilY-pixelRowLayout.modeY)<=7&&
     Math.abs(pixelRowLayout.modeY-pixelRowLayout.undoY)<=7&&
     Math.abs(pixelRowLayout.undoY-pixelRowLayout.clearY)<=7,
     'Pixel Studio Pencil through Clear must all fit on one toolbar row');
   }

   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),
    'New Pixel Studio control causes horizontal overflow at '+width+'px');
   assert.equal((await pixel(page,'pixelCanvas',150,100))[0],238,
    'Opening Pixel Studio lost existing main drawing');
   await color(page,'pixelColor','#3366ee');
   await page.locator('.pixel-tool[data-pixel-tool="fill"]').click();
   await point(page,'pixelCanvas',50,100);
   assert.deepEqual((await pixel(page,'pixelCanvas',50,100)).slice(0,3),[51,102,238],
    'Pixel fill failed inside visible circle');
   assert.equal((await pixel(page,'pixelCanvas',0,0))[3],0,
    'Pixel fill leaked into invisible corners');
   assert.equal(await page.locator('#pixelRecentSwatches button').count(),2,
    'Both surfaces should share run-scoped recent colors');
   await page.locator('#pixelColor').evaluate(input=>input.dispatchEvent(
    new PointerEvent('pointerdown',{bubbles:true,pointerId:93,pointerType:'mouse',button:0})));
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
   await color(page,'pixelColor','#3366ee');
   await page.locator('#pixelExit').click();
   assert.equal(await page.locator('#drawMode').inputValue(),'spin',
    'Exit must preserve Spin selected inside Pixel Studio');
   assert.equal((await pixel(page,'drawing',50,100))[2],238,
    'Exit discarded edits instead of saving them to the wheel');
   await page.locator('#pixelStudioBtn').click();
   assert.equal(await page.locator('#pixelDrawMode').inputValue(),'spin',
    'Reopening Pixel Studio must reflect Spin saved by Exit');
   await page.locator('#pixelDrawMode').selectOption('stationary');
   assert.equal(await page.locator('#drawMode').inputValue(),'stationary',
    'Changing back to Don’t spin must synchronize the main selector');
   assert.equal((await pixel(page,'pixelCanvas',50,100))[2],238,
    'Reopening Studio did not restore the last saved drawing');
   // Exit and Escape both commit automatically; no separate save button.
   await page.locator('.pixel-tool[data-pixel-tool="pen"]').click();
   await point(page,'pixelCanvas',160,110);
   const blueNear=async id=>page.locator('#'+id).evaluate(canvas=>{
    const d=canvas.getContext('2d').getImageData(152,102,16,16).data;
    let count=0;for(let i=0;i<d.length;i+=4)
     if(d[i]===51&&d[i+1]===102&&d[i+2]===238&&d[i+3]===255)count++;
    return count;
   });
   assert.ok(await blueNear('pixelCanvas')>0,'Pixel pen did not draw at requested point');
   await page.locator('#pixelExit').click();
   assert.equal(await page.locator('#drawMode').inputValue(),'stationary',
    'Exit must preserve Don’t spin selected inside Pixel Studio');
   assert.ok(await blueNear('drawing')>0,'Exit did not save new pixel paint');
   // Main and Studio must be fully two-way editable before the first spin.
   await color(page,'drawColor','#26a269');
   await page.locator('.drawing-tool[data-tool="pen"]').click();
   await point(page,'drawing',170,100);
   assert.equal((await pixel(page,'drawing',170,100))[1],162,'Main pen did not edit saved Studio drawing');
   await page.locator('.drawing-tool[data-tool="eraser"]').click();
   await point(page,'drawing',170,100);
   assert.equal((await pixel(page,'drawing',170,100))[3],0,
    'Eraser must clear transparency, not leave opaque white paint');
   await page.locator('#undoDrawing').click();
   assert.equal((await pixel(page,'drawing',170,100))[1],162,'Undo must restore erased pixels');
   await page.locator('#redoDrawing').click();
   assert.equal((await pixel(page,'drawing',170,100))[3],0,'Redo must erase again');
   await page.locator('#undoDrawing').click();
   await page.locator('#drawMode').selectOption('spin');
   await page.locator('#pixelStudioBtn').click();
   assert.equal(await page.locator('#pixelDrawMode').inputValue(),'spin',
    'Main wheel spin setting must be shown when Studio opens');
   assert.equal((await pixel(page,'pixelCanvas',170,100))[1],162,
    'Main drawing update missing when Studio reopens');
   assert.equal(await page.locator('#pixelRecentSwatches button').count(),3,
    'Recent colors should include colors from both drawing modes');
   // Escape must commit a fresh, previously unsaved Studio stroke, not
   // merely preserve what was already on the main canvas.
   await color(page,'pixelColor','#bb44aa');
   await page.locator('.pixel-tool[data-pixel-tool="pen"]').click();
   await point(page,'pixelCanvas',145,125);
   const pinkCount=async id=>page.locator('#'+id).evaluate(canvas=>{
    const d=canvas.getContext('2d').getImageData(141,121,8,8).data;
    let count=0;for(let i=0;i<d.length;i+=4)
     if(d[i]===187&&d[i+1]===68&&d[i+2]===170&&d[i+3]===255)count++;
    return count;
   });
   assert.ok(await pinkCount('pixelCanvas')>0,'Fresh Studio stroke did not paint');
   assert.equal(await page.locator('#pixelClose').count(),0,'Extra Pixel Studio Save / Done button must be removed');
   // First Escape dismisses the color chooser, not the editor or artwork.
   await page.locator('#pixelColor').evaluate(input=>input.dispatchEvent(
    new PointerEvent('pointerdown',{bubbles:true,pointerId:96,pointerType:'mouse',button:0})));
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#pixelStudioModal').isVisible(),true,
    'Escape while choosing a color unexpectedly closed Pixel Studio');
   assert.ok(await pinkCount('pixelCanvas')>0,'Dismissing color chooser deleted unsaved artwork');
   // The next Escape leaves Studio and must commit that stroke to the wheel.
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#pixelStudioModal').isVisible(),false,
    'Esc should safely save and exit Studio');
   assert.equal(await page.locator('#drawMode').inputValue(),'spin',
    'Escape must preserve the spin choice saved inside Pixel Studio');
   assert.equal((await pixel(page,'drawing',170,100))[1],162,'Escape lost the earlier drawing');
   assert.ok(await pinkCount('drawing')>0,'Escape erased fresh unsaved Pixel Studio artwork');
   await page.locator('#clearDrawing').click();
   assert.equal((await pixel(page,'drawing',170,100))[3],0,'Clear must empty the active drawing');
   assert.deepEqual(errors,[],'Browser errors at '+width+'px');
   console.log('PASS circular fills, protected picker, recent colors, Exit/Escape, two-way editing '+width+'px');
   cases++;
   await context.close();
  }
  console.log('DRAWING_EDITOR_BROWSER_PASS '+cases+' responsive scenarios');
 }finally{
  await browser.close();
  await new Promise(done=>server.close(done));
 }
})().catch(err=>{console.error('DRAWING_EDITOR_BROWSER_FAIL',err);process.exitCode=1});
