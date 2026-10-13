'use strict';
const http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
(async()=>{
 const server=http.createServer(serve);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const base='http://127.0.0.1:'+server.address().port;
 let scenarios=0;
 try{
  for(const width of [320,390,768,1280]){
   for(const theme of ['light','dark']){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    await context.addInitScript({content:mockSupabase});
    await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
     r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
    await context.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>Boolean(document.querySelector('#drawMode')?.onchange),{timeout:10000});
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);
    const main=page.locator('#drawMode'),pixel=page.locator('#pixelDrawMode');
    const values=await page.evaluate(()=>['drawMode','pixelDrawMode'].map(id=>[...document.getElementById(id).options].map(o=>[o.value,o.textContent])));
    assert.deepEqual(values[0],values[1],'Menus must show identical wording');
    assert.equal(await main.inputValue(),'stationary');
    assert.equal(await pixel.inputValue(),'stationary');
    await main.selectOption('spin');
    assert.equal(await pixel.inputValue(),'spin','Main must update Pixel Studio');
    await page.locator('#pixelStudioBtn').click();
    await page.locator('#pixelStudioModal:not(.hidden)').waitFor({timeout:5000});
    const layout=await page.evaluate(()=>{
     const box=document.querySelector('#pixelStudioModal .pixel-studio-tools');
     const select=document.querySelector('#pixelDrawMode');
     const style=getComputedStyle(select);
     const mainStyle=getComputedStyle(document.querySelector('#drawMode'));
     const r=select.getBoundingClientRect();
     return {
      overflowing:box.scrollWidth>box.clientWidth+2,
      labelsFit:select.scrollWidth<=select.clientWidth+2,
      width:r.width,
      cssBorder:style.borderStyle===mainStyle.borderStyle,
      font:parseFloat(style.fontSize),
      visible:r.left>=0&&r.right<=innerWidth+2,
      mainBorder:mainStyle.borderRadius,
      pixelBorder:style.borderRadius
     };
    });
    assert.equal(layout.overflowing,false,'Pixel tools must fit without overflow: '+width+' '+theme);
    assert.equal(layout.visible,true,'Selector cannot extend offscreen');
    assert.equal(layout.labelsFit,true,'Selector must not clip full option label');
    assert.equal(layout.cssBorder,true,'Main and Pixel use same border treatment');
    assert.equal(layout.mainBorder,layout.pixelBorder,'Same rounded formatting');
    if(width<700)assert.ok(layout.font>=16,'iPhone controls must prevent focus zoom');
    await pixel.selectOption('stationary');
    assert.equal(await main.inputValue(),'stationary','Pixel Studio must update main immediately');
    await pixel.selectOption('spin');
    await page.locator('#pixelExit').click();
    assert.equal(await main.inputValue(),'spin','Close keeps selected mode');
    assert.equal(await pixel.inputValue(),'spin');
    const pageWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    assert.ok(pageWidth<=width+2,'No page horizontal overflow: '+width+' '+theme);
    assert.deepEqual(errors,[],'Runtime errors: '+width+' '+theme);
    scenarios++;
    await context.close();
   }
  }
  console.log('CENTER_MODE_PARITY_BROWSER_PASS '+scenarios+' mode changes and responsive layouts');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(error=>{console.error('CENTER_MODE_PARITY_BROWSER_FAIL',error);process.exitCode=1});