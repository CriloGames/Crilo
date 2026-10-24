import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1200,height:850}});
const errors=[];
page.on('pageerror',err=>errors.push(err.message));
page.on('console',msg=>{if(msg.type()==='error')console.log('Browser console:',msg.text().slice(0,500))});
try {
 const response=await page.goto('http://127.0.0.1:4173/secrets-3d-preview.html',{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(response?.status(),200);
 await page.waitForFunction(()=>window.__nothing3DPreview?.ready===true,{timeout:30000});
 const state=await page.evaluate(()=>({
  meshes:window.__nothing3DPreview.meshCount,
  engine:window.__nothing3DPreview.engine,
  canvas:document.querySelector('#stage canvas')?.getBoundingClientRect()?.toJSON(),
  stage:document.querySelector('#stage')?.getBoundingClientRect()?.toJSON()
 }));
 assert.equal(state.engine,'three.js');
 assert(state.meshes>=330,'Detailed physical model is too simple: '+state.meshes+' meshes');
const intricacy=await page.evaluate(()=>({
 detailed:window.__nothing3DPreview.detailMeshCount,
 activeControls:window.__nothing3DPreview.interactiveDetailCount,
 state:window.__nothing3DPreview.detailState()
}));
assert(intricacy.detailed>=230,'The secondary precision-machinery model did not initialize');
assert(intricacy.activeControls>=7,'Not enough separately raycastable mechanical controls');
assert.deepEqual(errors,[],'New 3D detail module emitted runtime errors');
console.log('Detailed geometry: '+intricacy.detailed+' precision parts, '+intricacy.activeControls+' interactive mechanisms');
 assert(state.canvas.width>=900&&state.canvas.height>=400,'WebGL surface not sized');
 console.log('3D prototype loaded:',state.meshes,'real rendered meshes');
await page.evaluate(()=>{
 const p=window.__nothing3DPreview;
 for(let i=0;i<3;i++)p.clickAction('optic');
 p.clickAction('pressure');
 p.clickAction('lever');
 p.clickAction('latch');
 p.clickAction('eye');
 p.clickAction('underside');
 p.clickAction('hatch-latch');
});
const tactile=await page.evaluate(()=>window.__nothing3DPreview.detailState());
assert.equal(tactile.dialSteps,3,'The optical bezel should turn three detents');
assert(tactile.light&&tactile.needle&&tactile.lever&&tactile.service&&tactile.backEye&&tactile.underside&&tactile.topLatch,
 'The new 3D mechanics do not respond to individual interactions');
await page.screenshot({path:'test-results/3d-precision-details-desktop.png'});
console.log('All seven precision mechanisms respond to selections');
 await page.locator('#drawerFront').click();
 await page.waitForFunction(()=>window.__nothing3DPreview.frontOpen===true);
 await page.locator('#drawerRight').click();
 await page.waitForFunction(()=>window.__nothing3DPreview.sideOpen===true);
 await page.locator('#hatchTop').click();
 await page.waitForFunction(()=>window.__nothing3DPreview.topOpen===true);
 await page.waitForTimeout(1200);
 const braceLengths=await page.evaluate(()=>window.__nothing3DPreview.hatchBraceLengths);
 assert.equal(braceLengths.length,2,'The hatch must have two mechanical support braces');
 assert(braceLengths.every(n=>n>1.0),'The lid is not physically connected to its gas struts: '+braceLengths);
 await page.screenshot({path:'test-results/3d-physical-open-desktop.png'});
// Every opened compartment is actual spatial geometry, never a 2D overlay.
const positions=await page.evaluate(()=>({
 front:window.__nothing3DPreview.frontOpen,
 side:window.__nothing3DPreview.sideOpen,
 top:window.__nothing3DPreview.topOpen
}));
assert(positions.front&&positions.side&&positions.top);

 await page.locator('#drawerFront').click();
 await page.locator('#drawerRight').click();
 await page.locator('#hatchTop').click();
 assert.equal(await page.evaluate(()=>window.__nothing3DPreview.frontOpen),false);
 assert.equal(await page.evaluate(()=>window.__nothing3DPreview.sideOpen),false);
 assert.equal(await page.evaluate(()=>window.__nothing3DPreview.topOpen),false);
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(400);
 const mobile=await page.evaluate(()=>({width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,canvas:document.querySelector('canvas').getBoundingClientRect().width}));
 assert(mobile.width<=mobile.client+2,'Mobile prototype has horizontal overflow');
 assert(mobile.canvas<=mobile.client,'Mobile canvas wider than viewport');
 await page.locator('#drawerFront').click();
 await page.locator('#hatchTop').click();
 await page.waitForTimeout(1200);
 const mobileBraces=await page.evaluate(()=>window.__nothing3DPreview.hatchBraceLengths);
 assert(mobileBraces.every(n=>n>1.0),'The open mobile hatch lost its physical supports: '+mobileBraces);
 await page.screenshot({path:'test-results/3d-physical-open-mobile.png'});
 assert.deepEqual(errors,[],'Browser runtime errors');
 console.log('PASS: premium true 3D shell, '+state.meshes+' modeled parts, seven working micro-mechanisms, physical drawer and hinge animations, mobile viewport and no console errors.');
}finally{await browser.close()}
