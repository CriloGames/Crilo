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
 '  // Capture the actual 3D room, not the blurred stage-intro modal.',
 '  if(el.overlay)el.overlay.hidden=true;',
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
 '  // Check deep intersections between INDEPENDENT object assemblies.',
 '  // Touching frame supports and decorations inside one assembly are intentional.',
 '  const assemblies=[];',
 '  group.traverse(root=>{',
 '   if(!root.userData.qaRole||!root.visible)return;',
 '   const parts=[];',
 '   root.traverse(mesh=>{',
 '    if(!mesh.isMesh||!mesh.visible||mesh.userData.decorative)return;',
 '    if(!["BoxGeometry","CylinderGeometry","SphereGeometry","ConeGeometry","LatheGeometry"].includes(mesh.geometry?.type))return;',
 '    const mat=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;',
 '    if(mat?.transparent&&mat.opacity<.9)return;',
 '    const box=new THREE.Box3().setFromObject(mesh);',
 '    if(box.isEmpty())return;',
 '    parts.push({box,type:mesh.geometry.type});',
 '   });',
 '   if(parts.length)assemblies.push({role:root.userData.qaRole,parts});',
 '  });',
 '  const contacts=[];',
 '  for(let a=0;a<assemblies.length;a++)for(let b=a+1;b<assemblies.length;b++){',
 '   const A=assemblies[a],B=assemblies[b];',
 '   for(const u of A.parts)for(const v of B.parts){',
 '    if(!u.box.intersectsBox(v.box))continue;',
 '    const dx=Math.min(u.box.max.x,v.box.max.x)-Math.max(u.box.min.x,v.box.min.x);',
 '    const dy=Math.min(u.box.max.y,v.box.max.y)-Math.max(u.box.min.y,v.box.min.y);',
 '    const dz=Math.min(u.box.max.z,v.box.max.z)-Math.max(u.box.min.z,v.box.min.z);',
 '    if(Math.min(dx,dy,dz)<.085||dx*dy*dz<.008)continue;',
 '    contacts.push({a:A.role,b:B.role,depth:+Math.min(dx,dy,dz).toFixed(3),',
 '     volume:+(dx*dy*dz).toFixed(3),types:u.type+"/"+v.type});',
 '   }',
 '  }',
 '  contacts.sort((a,b)=>b.volume-a.volume);',
 '  renderer.render(scene,camera);',
 '  return {level,meshes,decorative,textured,invalid,wireframe,',
 '    triangles:renderer.info.render.triangles,',
 '    target:!!cupGroup,physicsBodies:physicsBodies.length,',
 '    overlayHidden:!!el.overlay?.hidden,',
 '    intersectionCount:contacts.length,intersections:contacts.slice(0,12)};',
 ' },',
 " animated:()=>{",
 "  const staticParts=[];",
 "  group.traverse(node=>{",
 "   const role=node.userData.qaRole;",
 "   if(!role||role===\"moving-gate\"||!node.visible)return;",
 "   node.traverse(mesh=>{",
 "    if(!mesh.isMesh||!mesh.visible||mesh.userData.decorative)return;",
 "    if(![\"BoxGeometry\",\"CylinderGeometry\",\"SphereGeometry\",\"ConeGeometry\",\"LatheGeometry\"].includes(mesh.geometry?.type))return;",
 "    const mat=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;",
 "    if(mat?.transparent&&mat.opacity<.90)return;",
 "    staticParts.push({role,mesh});",
 "   });",
 "  });",
 "  const gates=obstacles.filter(o=>o.type===\"barrier\").map(o=>o.obj);",
 "  const cupShell=cupGroup?.children.find(o=>o.geometry?.type===\"LatheGeometry\");",
 "  const hits=[];",
 "  for(const t of [0,.35,.75,1.25,1.8,2.6,3.5,4.8]){",
 "   tickObstacles(t*1000);group.updateMatrixWorld(true);",
 "   const movers=[];",
 "   for(const gate of gates)gate.traverse(mesh=>{",
 "    if(mesh.isMesh&&!mesh.userData.decorative&&mesh.geometry?.type===\"BoxGeometry\")",
 "     movers.push({role:\"moving-gate\",mesh});",
 "   });",
 "   if(cupShell)movers.push({role:\"moving-cup\",mesh:cupShell});",
 "   for(const moved of movers){",
 "    const a=new THREE.Box3().setFromObject(moved.mesh);",
 "    for(const fixed of staticParts){",
 "     if(moved.role===\"moving-cup\"&&fixed.role===\"goal-station\")continue;",
 "     const b=new THREE.Box3().setFromObject(fixed.mesh);",
 "     if(!a.intersectsBox(b))continue;",
 "     const dx=Math.min(a.max.x,b.max.x)-Math.max(a.min.x,b.min.x);",
 "     const dy=Math.min(a.max.y,b.max.y)-Math.max(a.min.y,b.min.y);",
 "     const dz=Math.min(a.max.z,b.max.z)-Math.max(a.min.z,b.min.z);",
 "     if(Math.min(dx,dy,dz)<.085||dx*dy*dz<.008)continue;",
 "     hits.push({time:t,a:moved.role,b:fixed.role,volume:+(dx*dy*dz).toFixed(3)});",
 "     if(hits.length>=50)break;",
 "    }",
 "    if(hits.length>=50)break;",
 "   }",
 "   if(hits.length>=50)break;",
 "  }",
 "  tickObstacles(0);renderer.render(scene,camera);",
 "  return hits;",
 " }",
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
const levels=Array.from({length:50},(_,i)=>i+1);
const screenshotLevels=new Set([1,2,3,4,5,6,7,8,9,10,17,28,39,50]);
const records=[],errors=[],clearanceFailures=[];
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
  assert(result.overlayHidden,'Intro overlay obscures screenshot: level '+n);
  assert(result.triangles>100,'3D scene did not render: level '+n);
  // Seated people naturally intersect their chair cushions. All other
  // independent solid assemblies must remain spatially separate.
  const unintended=result.intersections.filter(i=>!
   ((i.a==='colleague'&&i.b==='chair')||
    (i.a==='chair'&&i.b==='colleague')));
  if(unintended.length)clearanceFailures.push({level:n,contacts:unintended});
  const animated=await page.evaluate(()=>window.__pongVisual.animated());
  if(!screenshotLevels.has(n)){
   records.push({...result,animatedContacts:animated,screenshot:null});
   continue;
  }
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
  records.push({...result,animatedContacts:animated,colors:colors.size,screenshot:filename});
 }
 await page.close();
}finally{
 await browser.close();
 fs.writeFileSync(path.join(folder,'report.json'),
  JSON.stringify({records,errors,clearanceFailures},null,2));
}
assert.deepEqual(errors,[],'Browser exceptions');
assert.deepEqual(clearanceFailures,[],
 'Independent 3D assemblies clip: '+JSON.stringify(clearanceFailures));
console.log(JSON.stringify({
 passed:records.length,levels,errors,
 animatedSummary:records.filter(r=>r.animatedContacts?.length).map(r=>({level:r.level,contacts:r.animatedContacts.slice(0,6)})),
 intersectionSummary:records.map(r=>({
  level:r.level,count:r.intersectionCount,top:r.intersections.slice(0,3)
 })).filter(x=>x.count>0)
},null,2));
