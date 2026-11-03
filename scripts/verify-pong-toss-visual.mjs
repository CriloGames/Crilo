// WebGL smoke tests and screenshot archive for Pong Toss scene materials.
// Run with a local HTTP server on 127.0.0.1:4173.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import pngjs from 'pngjs';
import {chromium} from 'playwright';

const {PNG}=pngjs;
const rawJs=fs.readFileSync(new URL('../ping-pong-toss.js',import.meta.url),'utf8');
const rawHtml=fs.readFileSync(new URL('../pong-toss.html',import.meta.url),'utf8');
const marker='loadLevel(level);\nawait init();';
assert.equal(rawJs.split(marker).length,2,'Game init marker changed');
const hook=[
 'window.__pongVisual={',
 ' ready:()=>hasRenderer&&!!renderer&&!!scene&&!!camera&&!!group,',
 ' stage:(n)=>{',
 '  unlocked=50;loadLevel(n);group.updateMatrixWorld(true);',
 '  let meshes=0,decorative=0,textured=0,invalid=0,wireframe=0;',
 '  group.traverse(obj=>{',
 '   if(!obj.isMesh)return;meshes++;',
 '   if(obj.userData.decorative)decorative++;',
 '   for(const m of (Array.isArray(obj.material)?obj.material:[obj.material])){',
 '    if(m?.map)textured++;if(m?.wireframe)wireframe++;',
 '   }',
 '   const p=obj.geometry?.attributes?.position;',
 '   if(p)for(let i=0;i<p.count;i++){',
 '    if(!Number.isFinite(p.getX(i))||!Number.isFinite(p.getY(i))||',
 '       !Number.isFinite(p.getZ(i))){invalid++;break;}',
 '   }',
 '  });',
 '  renderer.render(scene,camera);',
 '  return {level,meshes,decorative,textured,invalid,wireframe,',
 '    triangles:renderer.info.render.triangles,',
 '    target:!!cupGroup,physicsBodies:physicsBodies.length};',
 ' }',
 '};'
].join('\n');
const game=rawJs.replace(marker,'loadLevel(level);\n'+hook+'\nawait init();');
const html=rawHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,m=>
 m.includes('ping-pong-toss.js')?m:'');
const folder=path.resolve('artifacts/pong-toss-visual');
fs.mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 '--enable-webgl','--disable-dev-shm-usage','--disable-gpu-sandbox'
]});
const levels=[1,2,3,4,5,6,7,8,9,10,17,28,39,50];
const records=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1160,height:780},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/pong-toss.html*',r=>r.fulfill({
  status:200,contentType:'text/html',body:html
 }));
 await page.route('**/ping-pong-toss.js*',r=>r.fulfill({
  status:200,contentType:'text/javascript',body:game
 }));
 await page.goto('http://127.0.0.1:4173/pong-toss.html',{
  waitUntil:'domcontentloaded',timeout:45000
 });
 await page.waitForFunction(()=>window.__pongVisual?.ready(),null,{timeout:90000});
 for(const n of levels){
  const result=await page.evaluate(n=>window.__pongVisual.stage(n),n);
  assert.equal(result.level,n);
  assert.equal(result.invalid,0,'Non-finite model vertices: level '+n);
  assert.equal(result.wireframe,0,'Wireframe artifacts: level '+n);
  assert(result.meshes>70,'Scene missing geometry: level '+n);
  assert(result.textured>=3,'Room maps missing: level '+n);
  assert(result.physicsBodies>10,'Physics meshes missing: level '+n);
  assert(result.target,'Goal missing: level '+n);
  assert(result.triangles>100,'3D scene did not render: level '+n);
  await page.waitForTimeout(120);
  const png=await page.screenshot({type:'png'});
  const image=PNG.sync.read(png),colors=new Set();
  for(let y=20;y<image.height;y+=21)for(let x=20;x<image.width;x+=21){
   const j=(y*image.width+x)*4;
   colors.add((image.data[j]<<16)|(image.data[j+1]<<8)|image.data[j+2]);
  }
  assert(colors.size>120,'Screenshot appears blank: level '+n);
  const filename='level-'+String(n).padStart(2,'0')+'.png';
  fs.writeFileSync(path.join(folder,filename),png);
  records.push({...result,colors:colors.size,screenshot:filename});
 }
 await page.close();
}finally{
 await browser.close();
 fs.writeFileSync(path.join(folder,'report.json'),
  JSON.stringify({records,errors},null,2));
}
assert.deepEqual(errors,[],'Browser exceptions');
console.log(JSON.stringify({passed:records.length,levels,errors},null,2));
