// Rotatable Nothing Here cube: verify puzzle reachability, combinations and actual browser UI.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const source=fs.readFileSync(new URL('../cube-secrets.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../secrets.html',import.meta.url),'utf8');
new Function(source);
const titles=[...source.matchAll(/^\s*\['([a-z-]+)','/gm)].map(x=>x[1]);
assert.equal(titles.length,31,'The authored discovery catalog changed');
assert.equal(new Set(titles).size,titles.length,'Duplicate discovery IDs');
assert(!html.includes('auth-first-paint.js'),'Game must not depend on auth loading');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1320,height:920}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const sdkMock=`window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:null},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
 signOut:async()=>({error:null})},
 rpc:async()=>({data:null,error:null})
})};`;
await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*',r=>r.fulfill({status:200,body:sdkMock,contentType:'application/javascript'}));
await page.addInitScript(()=>{
 if(!sessionStorage.getItem('nc_qa_seeded')){
  localStorage.removeItem('crilo_nothing_here_cube_v3');
  localStorage.setItem('crilo_nothing_here_playground_v2','{"found":["curious"]}');
  localStorage.setItem('crilo_nothing_here_secrets_v1','{"found":["moon"]}');
  sessionStorage.setItem('nc_qa_seeded','1');
 }
});
await page.goto('http://127.0.0.1:4173/secrets.html',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!!window.CriloNothingHereCube);
const bg=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
assert.equal(bg,'rgb(255, 255, 255)','Background should be pure white');
assert(await page.locator('#ncCube').isVisible(),'No 3D cube');
const cubeCss=await page.locator('#ncCube').evaluate(el=>getComputedStyle(el).transformStyle);
assert.equal(cubeCss,'preserve-3d','Cube faces are not actually three-dimensional');
assert.equal(await page.locator('.nc-face').count(),6);
const details=await page.evaluate(()=>({
 rails:document.querySelectorAll('.nc-drawer-rails i').length,
 screws:document.querySelectorAll('.nc-front-screws i').length,
 mechanisms:!!document.querySelector('.nc-top-well .nc-top-gear'),
 mouse:!!document.querySelector('#ncAnimatedMouse .nc-mouse-wheels'),
 squirrel:!!document.querySelector('#ncActionSquirrel .nc-run-body'),
 puppet:!!document.querySelector('#ncDog .nc-dog-paw'),
 css:[...document.styleSheets].some(s=>s.href?.includes('cube-motion.css'))
}));
assert.equal(details.rails,4,'Physical telescoping drawer rail components are missing');
assert.equal(details.screws,4,'Structural cube hardware is missing');
assert(details.mechanisms&&details.mouse&&details.squirrel&&details.puppet&&details.css,
 'Missing scene actors or the motion stylesheet');
assert.deepEqual(errors,[]);
console.log('Loaded clean real HTML with 6 physical 3D faces');
// Drag via pointer and verify the rotation changes; keyboard buttons remain as alternative.
const zone=page.locator('#ncCubeZone');
const before=await page.locator('#ncCube').evaluate(el=>el.style.transform);
const bb=await zone.boundingBox();
await page.mouse.move(bb.x+65,bb.y+60);await page.mouse.down();
await page.mouse.move(bb.x+155,bb.y+98,{steps:9});await page.mouse.up();
const after=await page.locator('#ncCube').evaluate(el=>el.style.transform);
assert.notEqual(after,before,'Drag did not rotate cube');
await page.locator('[data-rotate="right"]').click();
const rotate=async(rx,ry)=>page.evaluate(([x,y])=>window.CriloNothingHereCube.rotate(x,y),[rx,ry]);
const hit=async(name,count=1)=>{for(let i=0;i<count;i++){
 await page.locator('[data-hit="'+name+'"]').click({timeout:6500});
}};
const thing=async(name,count=1)=>{for(let i=0;i<count;i++)await page.locator('[data-thing="'+name+'"]').click({timeout:6500})};
const pocket=async(name)=>page.locator('[data-item="'+name+'"]').click({timeout:6000});
const combine=async(a,b)=>{await pocket(a);await pocket(b)};
const use=async(a,b)=>{await pocket(a);await thing(b)};
const close=async()=>{await page.locator('#ncModalClose').click();assert(await page.locator('#ncModal').evaluate(el=>el.hidden))};
const state=async()=>page.evaluate(()=>window.CriloNothingHereCube.getState());
// The cube contains hidden compartments in several different faces.
await rotate(0,0);await hit('dot',4);
await hit('latch');
assert((await page.locator('#ncDrawerA').evaluate(el=>getComputedStyle(el).animationName)).includes('ncTrayAppear'),
 'Drawer did not start its physical rail-opening animation');
await hit('drawer-a');
assert((await state()).pocket.includes('tooth'),'Drawer did not yield key teeth');
await rotate(0,-90);await hit('seam');await hit('drawer-b');
assert((await state()).pocket.includes('thread'));
await rotate(-85,0);await hit('triangle',3);await hit('top-reed');
assert((await state()).pocket.includes('pipe'));
await rotate(85,0);await hit('hatch');
assert((await state()).pocket.includes('ring'));
await rotate(0,90);await hit('dent');
assert(await page.locator('#ncAnimatedMouse').evaluate(el=>el.classList.contains('nc-running')),
 'The clockwork mouse did not animate when freed');
assert(await page.locator('[data-thing="bag"]').isVisible(),'Mechanical mouse did not reveal bag');
await rotate(0,180);await hit('eye');
assert((await state()).seen.includes('eye'));
await combine('ring','tooth');
assert((await state()).pocket.includes('key'));
await use('key','bag');
assert(await page.locator('#ncModal').isVisible());
for(let i=0;i<2;i++)await page.locator('[data-dial="0"]').click();
for(let i=0;i<3;i++)await page.locator('[data-dial="2"]').click();
assert((await state()).bagSolved,'The false-bottom bag puzzle could not be solved');
await close();
await combine('reed','pipe');
assert((await state()).pocket.includes('flute'),'The flute recipe failed');
await pocket('flute');
assert.equal(await page.locator('#ncModalTitle').textContent(),'The flute');
for(const n of [2,1,3])await page.locator('[data-note="'+n+'"]').click();
assert(await page.locator('#ncDoorScene').isVisible(),'Flute melody did not make door appear');
assert(await page.locator('#ncDoorScene').evaluate(el=>el.classList.contains('nc-arriving')),
 'The flute-summoned door failed to animate into view');
// Dog / squirrel / vase chain is one causally linked sequence.
await thing('door');
assert(await page.locator('#ncDog').isVisible(),'Door did not reveal dog');
await thing('dog',3);
assert(await page.locator('#ncImpactWave').evaluate(el=>el.classList.contains('nc-running')),
 'The bark produced no expanding shockwave');
assert(await page.locator('#ncActionSquirrel').evaluate(el=>el.classList.contains('nc-running')),
 'The fleeing squirrel had no choreographed run');
assert(await page.locator('[data-thing="vase"]').evaluate(el=>el.classList.contains('nc-shattering')),
 'The vase did not physically topple');
const afterBark=await state();
assert(afterBark.barked&&afterBark.vase&&afterBark.squirrel,'Dog did not cause squirrel and vase collision');
assert(afterBark.pocket.includes('acorn')&&afterBark.pocket.includes('spring'));
assert(afterBark.seen.includes('bark')&&afterBark.seen.includes('squirrel'));
await use('treat','dog');assert((await state()).pocket.includes('tag'));
// Secondary intertwined causes: acorn grows, spring makes weather,
// weather grows a tree, tree releases a paper bird.
await use('acorn','pot');await use('spring','musicbox');
assert(await page.locator('[data-thing="cloud"]').isVisible());
await thing('cloud');await use('raindrop','pot');
assert(await page.locator('[data-thing="pot"]').evaluate(el=>el.classList.contains('nc-sprouting')),
 'The tree did not grow through an articulated animation');
assert((await state()).tree,'The cloud did not water the planted acorn');
assert((await state()).pocket.includes('bird'));
await rotate(0,0);
await pocket('bird');
await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
await page.locator('#ncOfferingTarget').click({timeout:7500});
assert((await state()).moon,'Bird did not reveal the moon inside the cube');
// Other independent paths: coin machine sugar and thread prism kite.
await use('coin','machine');await use('sugar','cup');
await thing('clock');await close();
await combine('prism','thread');await use('kite','cloud');
const progress=await state();
const missing=titles.filter(id=>!progress.seen.includes(id));
console.log('CUBE QA',JSON.stringify({total:titles.length,found:progress.seen.length,missing,pocket:progress.pocket,errors},null,2));
assert.deepEqual(missing,[],'Some curated secrets cannot actually be discovered');
assert.deepEqual(errors,[],'Runtime errors while playing');
assert(progress.door&&progress.doorOpen&&progress.bagSolved&&progress.tree&&progress.moon);
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.CriloNothingHereCube?.getState().seen.length===31);
assert(await page.locator('#ncDoorScene').isVisible(),'Summoned door did not persist');
assert(await page.locator('#ncDog').isVisible(),'Opened door did not persist');
assert((await state()).pocket.includes('tag'));
const old=await page.evaluate(()=>({
 v1:JSON.parse(localStorage.getItem('crilo_nothing_here_secrets_v1')).found,
 v2:JSON.parse(localStorage.getItem('crilo_nothing_here_playground_v2')).found
}));
assert.deepEqual(old.v1,['moon']);assert.deepEqual(old.v2,['curious']);
// Theme behavior, mobile scrolling, accessible controls.
await page.evaluate(()=>localStorage.setItem('crilo_theme','dark'));
await page.reload({waitUntil:'domcontentloaded'});
assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(255, 255, 255)');
await page.setViewportSize({width:390,height:844});
const mobile=await page.evaluate(()=>{
 const viewport=document.documentElement.clientWidth;
 const exceeding=[...document.querySelectorAll('*')].filter(el=>{
  const r=el.getBoundingClientRect();
  return r.width&&r.right>viewport+2&&!/position:fixed/.test(el.getAttribute('style')||'');
 }).slice(0,14).map(el=>({tag:el.tagName,classes:String(el.className).slice(0,75),right:Math.round(el.getBoundingClientRect().right)}));
 return {width:document.documentElement.scrollWidth,viewport,exceeding};
});
console.log('MOBILE GEOMETRY',JSON.stringify(mobile));
assert(mobile.width<=mobile.viewport+2,'Mobile has horizontal overflow');
await page.locator('[data-rotate="up"]').click();
assert(await page.locator('#ncCube').isVisible());
await page.locator('#ncJournalBtn').click();
assert((await page.locator('#ncModalTitle').textContent()).includes('Strange'));
await page.keyboard.press('Escape');
assert(await page.locator('#ncModal').evaluate(el=>el.hidden),'Escape failed to close journal');
fs.mkdirSync('test-results',{recursive:true});
await page.screenshot({path:'test-results/cube-mobile.png',fullPage:true});
await page.setViewportSize({width:1320,height:920});
await page.screenshot({path:'test-results/cube-desktop.png',fullPage:true});
// Simulate CDN auth outage: the game remains functional without its SDK.
const outage=await browser.newPage();
await outage.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*',r=>r.abort());
await outage.goto('http://127.0.0.1:4173/secrets.html',{waitUntil:'domcontentloaded'});
await outage.waitForFunction(()=>!!window.CriloNothingHereCube);
assert(await outage.locator('#ncCube').isVisible());
await outage.locator('[data-rotate="left"]').click();
await outage.close();
await browser.close();
console.log('PASS: detailed six-sided 3D cube; articulated rails; animated mouse, flute-door, dog bark, squirrel, shattering vase and growing tree; 31 secrets; persistence; mobile; dark header.');
