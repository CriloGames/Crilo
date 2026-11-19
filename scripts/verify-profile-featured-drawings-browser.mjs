/* Five featured profile drawings: real Chromium owner/visitor/phone regression.
 * Valid images are generated only as test fixtures, never stored in user data. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pageHTML=await readFile(path.join(root,'profile.html'),'utf8');
const imageCSS=await readFile(path.join(root,'profile-featured-drawings.css'),'utf8');
const imageJS=await readFile(path.join(root,'profile-featured-drawings.js'),'utf8');
assert.ok(pageHTML.indexOf('id="statsGrid"')<pageHTML.indexOf('id="featuredDrawings"'));
assert.ok(pageHTML.indexOf('id="featuredDrawings"')<pageHTML.indexOf('<h2>Featured badges</h2>'));
assert.ok(pageHTML.includes('profile-featured-drawings.css?v=2'));
assert.match(imageCSS,/\.profile-drawing-slot\.has-drawing img\{/);
assert.match(imageCSS,/\.profile-drawing-choice img\{/);
assert.match(imageCSS,/\.profile-drawing-preview img\{/);
assert.ok(pageHTML.includes('profile-featured-drawings.js?v=1'));
assert.match(imageCSS,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
assert.match(imageCSS,/@media\(max-width:480px\)/);
assert.match(imageJS,/crilo_set_profile_featured_drawing/);
assert.match(imageJS,/crilo_profile_featured_drawings/);
assert.match(imageJS,/crilo_my_featured_drawing_choices/);
new Function(imageJS);

const png=(seed)=>{
 // Write a standards-compliant 28x28 PNG; five different drawings.
 const w=28,h=28,scan=Buffer.alloc(h*(w*4+1));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const index=y*(w*4+1)+1+x*4,paint=(x+y+seed)%6<3;
  scan[index]=paint?45+seed*22:239;
  scan[index+1]=paint?120+seed*12:239;
  scan[index+2]=paint?195-seed*16:249;
  scan[index+3]=255;
 }
 const crc32=data=>{
  let crc=0xffffffff;
  for(const byte of data){crc^=byte;for(let k=0;k<8;k++)
   crc=(crc&1)?(crc>>>1)^0xedb88320:crc>>>1}
  return (crc^0xffffffff)>>>0;
 };
 const chunk=(type,data)=>{
  const tag=Buffer.from(type),len=Buffer.alloc(4),sum=Buffer.alloc(4);
  len.writeUInt32BE(data.length);sum.writeUInt32BE(crc32(Buffer.concat([tag,data])));
  return Buffer.concat([len,tag,data,sum]);
 };
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
 return 'data:image/png;base64,'+Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]),
  chunk('IHDR',ihdr),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))
 ]).toString('base64');
};
const artworks=Array.from({length:8},(_,i)=>({
 source:i%2?'bonus':'official',
 run_id:i%2?'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'):String(100+i),
 daily_period:'2026-11-'+String(18-i).padStart(2,'0'),
 score:250+i*25,drawing:png(i)
}));
const selected=new Map([[1,artworks[0]],[3,artworks[2]]]);
const counts={read:0,choices:0,saves:0,visitorWrites:0};
function call(id,name,args){
 if(name==='crilo_profile_featured_drawings'){
  counts.read++;
  if(args.p_user!=='owner')return {data:[],error:null};
  return {data:[...selected].map(([slot,d])=>({...d,slot})),error:null};
 }
 if(name==='crilo_my_featured_drawing_choices'){
  if(id!=='owner')return {data:null,error:{message:'Unauthorized'}};
  counts.choices++;
  return {data:artworks.slice(args.p_offset,args.p_offset+args.p_limit),error:null};
 }
 if(name==='crilo_set_profile_featured_drawing'){
  if(id!=='owner'){counts.visitorWrites++;return {data:null,error:{message:'Unauthorized'}}}
  const p=args.p_position;
  if(!Number.isInteger(p)||p<1||p>5)return {data:null,error:{message:'Invalid slot'}};
  if(args.p_run_id===null)selected.delete(p);
  else{
   const choice=artworks.find(d=>d.source===args.p_source&&d.run_id===args.p_run_id);
   if(!choice)return {data:null,error:{message:'Unknown artwork'}};
   for(const [slot,d] of selected)if(d.source===choice.source&&d.run_id===choice.run_id)selected.delete(slot);
   selected.set(p,choice);
  }
  counts.saves++;
  return {data:true,error:null};
 }
 return {data:null,error:{message:'Unexpected RPC '+name}};
}
const httpServer=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const full=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!full.startsWith(root+path.sep))throw Error('Outside root');
  const data=await readFile(full);
  const type=full.endsWith('.html')?'text/html':full.endsWith('.css')?'text/css':
   full.endsWith('.js')?'text/javascript':'application/octet-stream';
  res.writeHead(200,{'Content-Type':type});res.end(data);
 }catch{res.writeHead(404);res.end('Missing')}
});
const port=await new Promise(resolve=>httpServer.listen(0,'127.0.0.1',()=>resolve(httpServer.address().port)));
const url='http://127.0.0.1:'+port+'/profile.html';
let browser;
async function setup(context,id,loc){
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('__featuredRpc',(name,args)=>call(id,name,args));
 await page.addInitScript(viewer=>{
  window.Crilo={authResolved:true,user:{id:viewer},esc:x=>String(x)};
  window.criloDB={rpc:(name,args)=>window.__featuredRpc(name,args)};
 },id);
 await page.route('**/*.js*',route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop();
  if(name==='profile-featured-drawings.js')return route.continue();
  return route.fulfill({status:200,contentType:'text/javascript',body:''});
 });
 await page.route('https://cdn.jsdelivr.net/**',route=>
  route.fulfill({status:200,contentType:'text/javascript',body:''}));
 await page.goto(loc,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('.profile-drawing-slot').length===5,null,{timeout:10000});
 return {page,errors};
}
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const desktop=await browser.newContext({viewport:{width:1120,height:900}});
 const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
 const owner=await setup(desktop,'owner',url),visitor=await setup(desktop,'visitor',url+'?id=owner');
 assert.equal(await owner.page.locator('.profile-drawing-slot.has-drawing').count(),2);
 assert.equal(await owner.page.locator('.profile-drawing-slot').count(),5);
 assert.equal(await visitor.page.locator('.profile-drawing-slot.has-drawing').count(),2);
 assert.equal(await visitor.page.locator('button.profile-drawing-slot').count(),2,
  'Visitors must not be able to open empty slot pickers');
 async function checkCircle(selector,where){
  const shape=await owner.page.locator(selector).first().evaluate(el=>{
   const css=getComputedStyle(el),bounds=el.getBoundingClientRect();
   return {width:bounds.width,height:bounds.height,radius:css.borderRadius,fit:css.objectFit};
  });
  assert.ok(Math.abs(shape.width-shape.height)<2,where+' must have a square image box: '+JSON.stringify(shape));
  assert.equal(shape.radius,'50%',where+' must clip the gray square corners');
  assert.equal(shape.fit,'cover',where+' must fill the wheel');
 }
 await checkCircle('.profile-drawing-slot.has-drawing img','Featured slot');
 const layout=await owner.page.evaluate(()=>{
  const box=id=>document.getElementById(id).getBoundingClientRect();
  return {stats:box('statsGrid').bottom,art:box('featuredDrawings').top,
   badges:box('featuredBadges').top}
 });
 assert.ok(layout.art>=layout.stats&&layout.badges>layout.art,
  'Drawings must sit directly under statistics and above featured badges');
 const opening=owner.page.locator('.profile-drawing-slot[data-slot="2"]');
 await opening.click();
 await owner.page.locator('#featuredDrawingPicker').waitFor({state:'visible'});
 assert.equal(await owner.page.locator('.profile-drawing-choice').count(),8);
 assert.equal(await owner.page.locator('.profile-drawing-choice:disabled').count(),2,
  'Artwork already featured elsewhere must be disabled');
 await checkCircle('.profile-drawing-choice img','Picker thumbnail');
 await owner.page.locator('.profile-drawing-choice[data-choice-index="1"]').click();
 await owner.page.locator('#fdPickerSave').click();
 await owner.page.waitForFunction(()=>
  document.querySelector('.profile-drawing-slot[data-slot="2"].has-drawing')!==null);
 assert.equal(selected.get(2).run_id,artworks[1].run_id);
 await visitor.page.reload({waitUntil:'domcontentloaded'});
 await visitor.page.waitForFunction(()=>
  document.querySelectorAll('.profile-drawing-slot.has-drawing').length===3);
 const selectedSlot=visitor.page.locator('.profile-drawing-slot[data-slot="2"]');
 await selectedSlot.click();
 assert.equal(await visitor.page.locator('#featuredDrawingPreview[open]').count(),1);
 const img=visitor.page.locator('#fdPreviewImage');
 await img.evaluate(el=>el.decode());
 assert.ok(await img.evaluate(el=>el.naturalWidth>0),'Featured artwork must render as an image');
 const previewShape=await img.evaluate(el=>{
  const r=el.getBoundingClientRect(),c=getComputedStyle(el);
  return {w:r.width,h:r.height,radius:c.borderRadius,fit:c.objectFit};
 });
 assert.ok(Math.abs(previewShape.w-previewShape.h)<2,'Expanded image must be circular');
 assert.equal(previewShape.radius,'50%','Expanded image must hide gray square corners');
 assert.equal(previewShape.fit,'cover');
 await visitor.page.locator('#fdPreviewClose').click();
 assert.equal(counts.visitorWrites,0,'Visitors must never call the drawing mutation RPC');
 await owner.page.locator('.profile-drawing-slot[data-slot="2"]').click();
 await owner.page.locator('#fdPickerClear').click();
 await owner.page.waitForFunction(()=>
  document.querySelector('.profile-drawing-slot[data-slot="2"].is-empty')!==null);
 assert.ok(!selected.has(2),'Remove from slot must clear just that selection');
 const phone=await setup(mobile,'owner',url);
 assert.equal(await phone.page.locator('.profile-drawing-slot').count(),5);
 const metrics=await phone.page.evaluate(()=>({
  scrollWidth:document.documentElement.scrollWidth,viewport:window.innerWidth,
  cards:[...document.querySelectorAll('.profile-drawing-slot')].map(e=>({
   x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,
   width:e.getBoundingClientRect().width
  }))
 }));
 assert.ok(metrics.scrollWidth<=metrics.viewport+3,
  'Featured drawing gallery causes mobile overflow: '+JSON.stringify(metrics));
 assert.equal(metrics.cards[0].y,metrics.cards[1].y,'Phone must show two images per row');
 const mobileShape=await phone.page.locator('.profile-drawing-slot.has-drawing img').first().evaluate(el=>{
  const r=el.getBoundingClientRect(),style=getComputedStyle(el);
  return {w:r.width,h:r.height,radius:style.borderRadius};
 });
 assert.ok(Math.abs(mobileShape.w-mobileShape.h)<2,'Mobile wheel must be circular');
 assert.equal(mobileShape.radius,'50%');
 await phone.page.locator('.profile-drawing-slot[data-slot="5"]').click();
 assert.equal(await phone.page.locator('#featuredDrawingPicker[open]').count(),1);
 assert.deepEqual(owner.errors,[],'Owner browser exceptions');
 assert.deepEqual(visitor.errors,[],'Visitor browser exceptions');
 assert.deepEqual(phone.errors,[],'Phone browser exceptions');
 await mkdir(path.join(root,'test-results'),{recursive:true});
 await owner.page.screenshot({path:path.join(root,'test-results','featured-drawings-desktop.png')});
 await phone.page.locator('#fdPickerClose').click();
 await phone.page.screenshot({path:path.join(root,'test-results','featured-drawings-mobile.png')});
 console.log('PASS Featured Drawings: circular wheel images in profile cards, picker, full preview and on mobile; existing save/remove and responsive layout.');
}finally{
 await browser?.close();
 await new Promise(resolve=>httpServer.close(resolve));
}
