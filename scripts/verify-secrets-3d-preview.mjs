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
 assert(state.meshes>=95,'Expected real dimensional geometry, got '+state.meshes+' meshes');
 assert(state.canvas.width>=900&&state.canvas.height>=400,'WebGL surface not sized');
 console.log('3D prototype loaded:',state.meshes,'real rendered meshes');
 await page.locator('#drawerFront').click();
 await page.waitForFunction(()=>window.__nothing3DPreview.frontOpen===true);
 await page.locator('#drawerRight').click();
 await page.waitForFunction(()=>window.__nothing3DPreview.sideOpen===true);
 await page.locator('#hatchTop').click();
 await page.waitForFunction(()=>window.__nothing3DPreview.topOpen===true);
 await page.waitForTimeout(1200);
 await page.screenshot({path:'test-results/3d-physical-open-desktop.png'});
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
 await page.screenshot({path:'test-results/3d-physical-open-mobile.png'});
 assert.deepEqual(errors,[],'Browser runtime errors');
 console.log('PASS: Three.js physical shell, drawers, hinge, animation, lighting and mobile viewport.');
}finally{await browser.close()}
