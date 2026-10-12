'use strict';
/* Headless Chromium: no real auth or official Daily writes. */
const assert=require('node:assert/strict');
const http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const controls=[
 '#pixelStudioBtn','[data-tool="pen"]','[data-tool="fill"]',
 '[data-tool="eraser"]','#undoDrawing','#redoDrawing',
 '#drawMode','#drawColor','#clearDrawing'
];
(async()=>{
 const server=http.createServer(serve);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const width of [375,390,600,601,768,840,900,1280]){
   const context=await browser.newContext({viewport:{width,height:900}});
   await context.addInitScript({content:mockSupabase.replace('loggedIn:false','loggedIn:true')});
   await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,route=>
    route.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route(/^https:\/\/(?!crilo\.fun)/,route=>route.abort());
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:16000});
   await page.waitForFunction(()=>typeof window.lockDrawing==='function'&&
    typeof window.unlockDrawing==='function',{timeout:15000});
   const state=()=>page.evaluate(selectors=>{
    const panel=document.querySelector('#drawPanel');
    const rect=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}};
    const elements=selectors.map(selector=>document.querySelector(selector));
    return {
     present:elements.every(Boolean),
     visible:elements.map(el=>!!el&&getComputedStyle(el).display!=='none'&&
      getComputedStyle(el).visibility!=='hidden'&&el.getBoundingClientRect().width>0),
     disabled:elements.map(el=>!!el&&el.disabled),
     mode:document.querySelector('#drawMode').value,
     panel:rect(panel),copy:rect(panel.firstElementChild),
     tools:rect(panel.querySelector('.draw-actions')),
     overflow:document.documentElement.scrollWidth-innerWidth,
     selected:[...panel.querySelectorAll('.drawing-tool.active')].length
    };
   },controls);
   const ready=await state();
   if(width>840){
    const copyLines=await page.evaluate(()=>{
     const count=id=>{const range=document.createRange();
      range.selectNodeContents(document.getElementById(id));
      return range.getClientRects().length;};
     return {instructions:count('drawPanelDescription'),warning:count('drawSafetyNote')};
    });
    assert.deepEqual(copyLines,{instructions:1,warning:1},
     'Desktop Drawing Studio text must be exactly one line per message at '+width);
   }
   assert.ok(ready.present&&ready.visible.every(Boolean),
    'All nine active tools visible at '+width);
   assert.ok(ready.disabled.every(x=>!x),'All nine tools enabled before spin at '+width);
   assert.ok(ready.overflow<=2,'Active panel horizontal overflow at '+width);
   const toolbarPositions=()=>page.evaluate(()=>{
    const panel=document.querySelector('#drawPanel');
    const ids=['#pixelStudioBtn','[data-tool="pen"]','[data-tool="fill"]',
     '[data-tool="eraser"]','#undoDrawing','#redoDrawing','#clearDrawing',
     '#drawMode','.native-paint-picker','#drawRecentColors'];
    return {
     height:panel.getBoundingClientRect().height,
     viewportOverflow:document.documentElement.scrollWidth-innerWidth,
     positions:ids.map(id=>{
      const rect=document.querySelector(id).getBoundingClientRect();
      return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right};
     })
    };
   });
   const beforePaint=await toolbarPositions();
   assert.equal(await page.locator('#drawRecentColors').evaluate(el=>getComputedStyle(el).display),
    'flex','Five recent-color slots must be reserved before painting');
   assert.equal(await page.locator('#drawRecentSwatches .recent-color-empty-slot').count(),5,
    'Before painting, five placeholder slots must maintain toolbar geometry');
   assert.equal(await page.locator('#drawRecentSwatches button').count(),0,
    'Unpainted slots must not be clickable');
   const clearBefore=await page.locator('#clearDrawing').boundingBox();
   const modeBefore=await page.locator('#drawMode').boundingBox();
   if(width>840){
    const rows=await page.evaluate(()=>{
     const rect=id=>document.querySelector(id).getBoundingClientRect();
     const y=id=>rect(id).top;
     return {studio:y('#pixelStudioBtn'),pen:y('[data-tool="pen"]'),
      history:y('#undoDrawing'),mode:y('#drawMode'),
      color:y('.native-paint-picker'),clear:y('#clearDrawing'),
      recent:y('#drawRecentColors'),
      redoRight:rect('#redoDrawing').right,
      clearLeft:rect('#clearDrawing').left,
      clearRight:rect('#clearDrawing').right,
      modeLeft:rect('#drawMode').left,
      colorRight:rect('.native-paint-picker').right,
      recentLeft:rect('#drawRecentColors').left,
      firstGap:rect('.draw-toolbar-primary .draw-tool-group').left-rect('#pixelStudioBtn').right,
      secondGap:rect('.draw-toolbar-primary .draw-tool-group:last-child').left-
       rect('.draw-toolbar-primary .draw-tool-group').right};
    });
    assert.ok(Math.abs(rows.studio-rows.pen)<5&&Math.abs(rows.pen-rows.history)<5&&
     Math.abs(rows.mode-rows.color)<5&&Math.abs(rows.clear-rows.mode)<5&&
     Math.abs(rows.recent-rows.mode)<5,
     'Every control and reserved swatch slot must form one flat row at '+width);
    assert.ok(rows.clearLeft>=rows.redoRight-1&&
     rows.modeLeft>=rows.clearRight-1&&
     rows.recentLeft>=rows.colorRight-1,
     'Clear must follow Undo/Redo before the selector, with swatches after Color at '+width);
    assert.ok(rows.firstGap>=0&&rows.firstGap<=10&&
     rows.secondGap>=0&&rows.secondGap<=10,
     'Drawing tools must stay grouped with no large empty gaps at '+width);
   }
   await page.evaluate(()=>window.recordPaintColor('#ee7799'));
   assert.equal(await page.locator('#drawRecentSwatches button').count(),1,
    'The first painted color should replace exactly one placeholder');
   assert.equal(await page.locator('#drawRecentSwatches .recent-color-empty-slot').count(),4,
    'Four empty slots must remain after the first color');
   await page.evaluate(()=>{
    for(const hex of ['#112233','#223344','#334455','#445566','#556677','#667788','#778899'])
     window.recordPaintColor(hex);
   });
   assert.equal(await page.locator('#drawRecentSwatches button').count(),5,
    'Only the five most recently used colors should appear at '+width);
   assert.equal(await page.locator('#drawRecentSwatches .recent-color-empty-slot').count(),0,
    'Five filled slots should replace all placeholders');
   assert.equal(await page.locator('#pixelRecentSwatches button').count(),5,
    'Pixel Studio should use the same five most recent colors at '+width);
   const afterPaint=await toolbarPositions();
   assert.ok(Math.abs(afterPaint.height-beforePaint.height)<=1,
    'Adding saved colors must not change drawing panel height at '+width);
   for(let i=0;i<beforePaint.positions.length;i++){
    const a=beforePaint.positions[i],b=afterPaint.positions[i];
    assert.ok(Math.abs(a.x-b.x)<=1&&Math.abs(a.y-b.y)<=1&&
     Math.abs(a.width-b.width)<=1&&Math.abs(a.height-b.height)<=1,
     'Adding colors moved toolbar element '+i+' at '+width);
   }
   const colorRight=afterPaint.positions[9].right;
   const panelRight=await page.locator('#drawPanel').evaluate(el=>el.getBoundingClientRect().right);
   assert.ok(colorRight<=panelRight+1,
    'Reserved swatch area must remain inside Drawing Studio at '+width);
   assert.ok(afterPaint.viewportOverflow<=2,
    'Five saved colors may not cause horizontal page overflow at '+width);
   await page.evaluate(()=>window.resetRecentPaintColors());
   assert.equal(await page.locator('#drawRecentSwatches .recent-color-empty-slot').count(),5,
    'Reset should restore five inert color slots');
   const afterReset=await toolbarPositions();
   assert.ok(Math.abs(afterReset.height-beforePaint.height)<=1,
    'Resetting saved colors must not change panel height at '+width);

   const modeWidth=await page.locator('#drawMode').evaluate(el=>el.getBoundingClientRect().width);
   if(width>600)assert.ok(modeWidth<=125,'Mode selector has unwanted whitespace at '+width);
   else assert.ok(modeWidth<=158,'Native mobile mode selector should remain compact');
   if(width>840)assert.ok(ready.tools.x>=ready.copy.right-2,
    'Desktop editor should keep instructions left and controls right');
   else assert.ok(ready.tools.y>=ready.copy.bottom-2,
    'Phone/tablet editor should stack instructions over tools');
   await page.locator('#drawMode').selectOption('spin');
   await page.evaluate(()=>{
    document.body.classList.add('wheel-run-active','wheel-session-fit');
    window.lockDrawing();
   });
   const locked=await state();
   assert.ok(locked.visible.every(Boolean),'Nine controls must remain visible after first spin at '+width);
   assert.ok(locked.disabled.every(Boolean),'Nine controls must be disabled on first spin at '+width);
   assert.equal(locked.mode,'spin','Existing dropdown selection lost on lock');
   assert.equal(locked.selected,0,'A drawing tool still looks selected after first spin');
   assert.ok(locked.overflow<=2,'First-spin locked panel overflows at '+width);
   if(width>840)assert.ok(
    Math.abs((locked.copy.y+locked.copy.height/2)-(locked.tools.y+locked.tools.height/2))<=12,
    'Locked instructions and controls should be vertically centered together at '+width);
   else assert.ok(locked.tools.y>=locked.copy.bottom-2,
    'Locked tools should stack below instructions on phones at '+width);

   assert.ok(Math.abs(locked.panel.height-ready.panel.height)<75,
    'First-spin lock caused a large layout shift at '+width);
   await page.evaluate(()=>window.setDrawingPanelMode('complete'));
   const finished=await state();
   assert.ok(finished.visible.every(Boolean),
    'All nine finished tools must be visible at '+width);
   assert.ok(finished.disabled.every(Boolean),
    'Completed Daily must leave all nine tools disabled at '+width);
   assert.equal(finished.mode,'spin','Completed Daily changed selected drawMode');
   assert.ok(finished.overflow<=2,'Finished panel horizontal overflow at '+width);
   if(width>840)assert.ok(
    Math.abs((finished.copy.y+finished.copy.height/2)-(finished.tools.y+finished.tools.height/2))<=12,
    'Finished message and toolbar must share a centered row at '+width);
   else assert.ok(finished.tools.y>=finished.copy.bottom-2,
    'Completed Daily tools should stack below message on phones at '+width);

   assert.ok(Math.abs(finished.panel.height-ready.panel.height)<80,
    'Completed Daily should be approximately as compact as ready at '+width);
   await page.evaluate(()=>{
    document.body.classList.remove('wheel-run-active','wheel-session-fit');
    window.unlockDrawing();
   });
   const unlocked=await state();
   assert.ok(unlocked.disabled.every(x=>!x),
    'A new run must re-enable all nine controls at '+width);
   assert.equal(unlocked.mode,'spin','Unlock should retain the draw mode preference');
   const ring=await page.evaluate(()=>{
    const outer=document.querySelector('#wheelNeonOuter');
    const inner=document.querySelector('#wheelNeonInner');
    const paint=document.querySelector('#drawing');
    const bounds=paint.getBoundingClientRect();
    const top=document.elementFromPoint(bounds.left+bounds.width/2,bounds.top+bounds.height/2);
    return [outer,inner].map(el=>({
     animation:getComputedStyle(el).animationName,
     pointer:getComputedStyle(el).pointerEvents,
     transform:getComputedStyle(el).transform,
     mask:getComputedStyle(el,'::before').maskImage,
     glow:getComputedStyle(el,'::after').filter,
     opacity:getComputedStyle(el).opacity
    })).concat([{paintClickTarget:top===paint}]);
   });
   assert.ok(ring.slice(0,2).every(r=>r.animation==='criloWheelNeonColors'&&
    r.pointer==='none'&&r.transform==='none'&&r.mask!=='none'&&r.glow.includes('blur(')),
    'Neon must animate independently from the wheel, using a colored halo');
   assert.ok(ring[2].paintClickTarget,'Neon may not cover or steal canvas clicks');
   const lightOpacity=Number(ring[0].opacity);
   await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));
   const darkOpacity=Number(await page.locator('#wheelNeonOuter').evaluate(el=>getComputedStyle(el).opacity));
   assert.ok(darkOpacity<lightOpacity,'Dark mode must soften the outer neon');
   await page.emulateMedia({reducedMotion:'reduce'});
   const reduced=await page.locator('#wheelNeonOuter').evaluate(el=>getComputedStyle(el).animationName);
   assert.equal(reduced,'none','Reduced motion must stop neon animation');
   assert.deepEqual(errors,[],'Browser errors at '+width);
   await context.close();
  }
  console.log('COMPACT_DRAWING_NEON_BROWSER_PASS: nine tools, both lock states, all widths, themes and reduced motion');
 }finally{
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
 }
})().catch(err=>{console.error(err);process.exitCode=1});
