// Rotatable Nothing Here cube: verify puzzle reachability, combinations and actual browser UI.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const source=fs.readFileSync(new URL('../cube-secrets.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../secrets.html',import.meta.url),'utf8');
new Function(source);
const titles=[...source.matchAll(/^\s*\['([a-z-]+)','/gm)].map(x=>x[1]);
assert.equal(titles.length,60,'The authored discovery catalog changed');
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
assert.equal(await page.locator('.nc-structural-frame .nc-beam').count(),12,
 'The cube must have twelve real 3D perimeter beams');
assert.equal(await page.locator('.nc-structural-frame .nc-corner').count(),8,
 'The cube must have eight dimensional corner brackets');
assert.equal(await page.locator('.nc-structural-frame').evaluate(el=>getComputedStyle(el).transformStyle),
 'preserve-3d','The chassis is flat instead of a three-dimensional assembly');
const chassisDepth=await page.locator('.nc-beam-dtl').evaluate(el=>getComputedStyle(el).transform);
assert(chassisDepth!=='none'&&new DOMMatrixReadOnly(chassisDepth).m13!==0,
 'The front-to-back frame rail has not been rotated into actual depth');
for(const [bay,drawer] of [['ncDrawerBayA','ncDrawerA'],['ncDrawerBayB','ncDrawerB']]){
 assert.equal(await page.locator('#'+bay+' > #'+drawer).count(),1,
  'Drawer '+drawer+' must be physically mounted inside its face-specific bay');
 assert.equal(await page.locator('#'+bay+' > .nc-bay-cavity').count(),1,'Missing recessed drawer cavity');
 assert.equal(await page.locator('#'+bay+' > .nc-bay-track').count(),2,'Missing attached drawer runner rails');
}
assert.equal(await page.locator('#ncTopBay > #ncLid').count(),1,
 'Hatch must remain mounted to the same bay as its mechanical well');
assert.equal(await page.locator('#ncTopBay > .nc-top-recess').count(),1,
 'Missing fixed hatch recess');
assert.equal(await page.locator('#ncTopBay > .nc-top-hinge-bar').count(),1,
 'Missing physical top hinge bar');
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
fs.mkdirSync('test-results',{recursive:true});
const opening=await page.evaluate(()=>{
 const box=document.getElementById('ncCube').getBoundingClientRect(),
  world=document.getElementById('ncWorld').getBoundingClientRect();
 return {cubeTop:box.top,cubeBottom:box.bottom,worldTop:world.top,worldBottom:world.bottom};
});
assert(opening.cubeTop>=opening.worldTop-2&&opening.cubeBottom<=opening.worldBottom+2,
 'The opening cube is cut off by its stage');
await page.screenshot({path:'test-results/cube-opening-desktop.png'});
assert(await page.evaluate(()=>{
 const layer=document.querySelector('#criloAmbientWheels');
 return !layer||getComputedStyle(layer).display==='none';
}),'Unrelated site-wide floating wheel decorations clutter the white gallery');
await page.setViewportSize({width:390,height:844});
const openingMobile=await page.evaluate(()=>{
 const box=document.getElementById('ncCube').getBoundingClientRect(),
  world=document.getElementById('ncWorld').getBoundingClientRect();
 return {cubeTop:box.top,cubeBottom:box.bottom,worldTop:world.top,worldBottom:world.bottom,
  viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth};
});
assert(openingMobile.cubeTop>=openingMobile.worldTop-2&&openingMobile.cubeBottom<=openingMobile.worldBottom+2,
 'Opening cube is cropped on mobile');
assert(openingMobile.scroll<=openingMobile.viewport+2,'Opening scene scrolls sideways on mobile');
await page.screenshot({path:'test-results/cube-opening-mobile.png'});
await page.setViewportSize({width:1320,height:920});
assert.equal(await page.locator('.nc-tactile-screw').count(),4);
assert.equal(await page.locator('[data-hit^="vent-"]').count(),3);
assert.equal(await page.locator('.nc-inspection-controls button').count(),8);
assert(await page.locator('#ncViewReset').isVisible());
await page.locator('#ncZoomIn').click();
assert.equal((await page.evaluate(()=>window.CriloNothingHereCube.getView())).zoom,1.12);
await page.locator('#ncZoomIn').click();
assert.equal((await page.evaluate(()=>window.CriloNothingHereCube.getView())).zoom,1.24);
await page.locator('#ncZoomOut').click();
await page.locator('#ncPanMode').click();
assert.equal(await page.locator('#ncPanMode').getAttribute('aria-pressed'),'true');
await page.locator('#ncViewReset').click();
assert.equal((await page.evaluate(()=>window.CriloNothingHereCube.getView())).zoom,1);
await page.locator('#ncCubeZone').hover({position:{x:20,y:80}});
await page.mouse.wheel(0,-200);
await page.waitForFunction(()=>window.CriloNothingHereCube.getView().zoom>1);
const wheelZoom=await page.evaluate(()=>window.CriloNothingHereCube.getView().zoom);
assert(wheelZoom<=1.08,
 'Wheel zoom is still too sensitive: '+wheelZoom);
await page.locator('#ncViewReset').click();
assert.equal((await page.evaluate(()=>window.CriloNothingHereCube.getView())).zoom,1);
assert.equal(await page.locator('#ncPanMode').getAttribute('aria-pressed'),'false');
console.log('Dampened button/wheel zoom, pan toggle and reset work independently of gameplay');
// Drag via pointer and verify the rotation changes; keyboard buttons remain as alternative.
const zone=page.locator('#ncCubeZone');
const before=await page.locator('#ncCube').evaluate(el=>el.style.transform);
const bb=await zone.boundingBox();
await page.mouse.move(bb.x+bb.width*.28,bb.y+bb.height*.50);await page.mouse.down();
await page.mouse.move(bb.x+bb.width*.28+112,bb.y+bb.height*.50+55,{steps:12});await page.mouse.up();
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
await hit('front-screw-3');
for(const n of [0,1,2])await hit('front-screw-'+n);
assert.equal((await state()).screws.length,3,'Three real screws could not be removed');
assert((await state()).plateOpen,'The loosened faceplate failed to spring open');
assert(await page.locator('[data-item="cog"]').count(),'The hidden faceplate failed to provide the cog');
await hit('latch');
assert((await page.locator('#ncDrawerA').evaluate(el=>getComputedStyle(el).animationName)).includes('ncTrayAppear'),
 'Drawer did not start its physical rail-opening animation');
await page.waitForTimeout(760);
const trayTravel=await page.locator('#ncDrawerA').evaluate(el=>{
 const m=new DOMMatrixReadOnly(getComputedStyle(el).transform);
 return {out:m.m43,down:m.m42};
});
assert(trayTravel.out>9&&trayTravel.out<45&&trayTravel.down<35,
 'Key drawer separates too far from its rails: '+JSON.stringify(trayTravel));
await hit('drawer-a');
await page.waitForFunction(()=>window.CriloNothingHereCube.getState().pocket.includes('tooth'),null,{timeout:4000});
assert((await state()).pocket.includes('tooth'),'Drawer did not yield key teeth');
await rotate(0,-90);await hit('right-bolt-1');await hit('seam');await hit('drawer-b');
await page.waitForFunction(()=>window.CriloNothingHereCube.getState().pocket.includes('thread'),null,{timeout:4000});
assert((await state()).pocket.includes('thread'));
await rotate(-85,0);
for(const n of [0,1,2])await hit('hinge-'+n);
assert(await page.locator('[data-item="washer"]').count(),'The hinge washer was unreachable');
await hit('triangle',3);
const hatchGeometry=await page.locator('#ncLid').evaluate(el=>{
 const r=el.getBoundingClientRect(),bay=document.getElementById('ncTopBay').getBoundingClientRect();
 const m=new DOMMatrixReadOnly(getComputedStyle(el).transform);
 return {hingeHeight:bay.height,flapHeight:r.height,travelZ:m.m43};
});
assert(hatchGeometry.travelZ<30,'Top lid is detached from its hinge');
await hit('top-reed');
await page.waitForFunction(()=>window.CriloNothingHereCube.getState().pocket.includes('pipe'),null,{timeout:4000});
assert((await state()).pocket.includes('pipe'));
await rotate(85,0);await hit('hatch');await hit('foot');
assert((await state()).footChecked&&((await state()).seen.includes('underside-foot')),
 'The underside rubber foot did not expose its engraved clue');
assert((await state()).pocket.includes('ring'));
await rotate(0,90);
for(const n of [3,1,2])await hit('vent-'+n);
assert((await state()).ventOpen,'The engraved service sequence did not unlock the vent');
assert(await page.locator('[data-item="shim"]').count(),'The vent did not release its copper shim');
await hit('dent');
assert(await page.locator('#ncAnimatedMouse').evaluate(el=>el.classList.contains('nc-running')),
 'The clockwork mouse did not animate when freed');
assert(await page.locator('[data-thing="bag"]').isVisible(),'Mechanical mouse did not reveal bag');
await rotate(0,180);await hit('eye');
for(let i=0;i<3;i++)await hit('eye-ring');
assert((await state()).eyeRingTicks>=3,'Eye calibration dial did not advance');
await pocket('cog');await hit('eye');
assert((await state()).opticOpened,'Cog did not power the back-eye mechanism');
assert((await state()).pocket.includes('iris'),'Hidden eye did not release glass iris');
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
await use('washer','musicbox');
assert((await state()).clockHeart,'Hinge washer did not repair the tiny music box escapement');
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
await use('shim','machine');
assert((await state()).shimUsed,'The machine service panel did not accept the copper shim');
await thing('clock');await close();
await combine('prism','thread');await use('kite','cloud');
// The secondary puzzle chain must integrate with the established dog + clock story.
assert(await page.locator('[data-thing="elevator"]').isVisible(),'The collar tag and watch did not summon the miniature lift');
await thing('elevator');
assert((await page.locator('#ncModalTitle').textContent()).includes('elevator'));
await page.locator('[data-floor="2"]').click();
assert(!(await state()).floorFour,'An unrelated elevator floor revealed the fourth floor');
await page.locator('[data-floor="4"]').click();
assert((await state()).floorFour,'Fourth-floor lift never arrived');
assert(await page.locator('[data-item="lens"]').count(),'Elevator did not deliver its lens');
await close();
assert(await page.locator('[data-thing="moth"]').isVisible(),'The elevator did not release a clockwork moth');
await thing('moth');
assert(await page.locator('[data-item="stardust"]').count(),'Moth did not shed its dust');
assert(await page.locator('[data-thing="telescope"]').isVisible(),'The moon did not reveal a telescope');
await thing('telescope');
await use('lens','telescope');
assert((await state()).observed,'The telescope lens did not reveal the constellation');
await use('iris','telescope');
assert((await state()).secondSky,'The calibrated eye did not reveal a second celestial layer');
assert(await page.locator('[data-item="starmap"]').count(),'The constellation failed to produce a chart');
assert(await page.locator('#ncConstellation').evaluate(el=>getComputedStyle(el).transitionProperty.includes('opacity')),'The star scene lacks an animation');
await use('stardust','musicbox');
assert((await state()).dancer,'Moth dust did not activate the clockwork ballet');
assert(await page.locator('.nc-dancer-figure').count(),'The music box lacks its physical miniature dancer');
await use('starmap','elevator');
assert((await state()).train&&await page.locator('[data-thing="train"]').isVisible(),'Railway did not appear from the star chart');
await thing('train');
assert(await page.locator('[data-item="parcel"]').count(),'The train did not bring its tiny parcel');
await use('parcel','dog');
assert(await page.locator('[data-item="postcard"]').count(),'Dog did not sign for the parcel');
await rotate(0,0);
await use('postcard','cube');
assert((await state()).portal,'Postcard failed to turn the cube into a tiny landscape');
assert(await page.locator('body').evaluate(el=>el.classList.contains('nc-portal-view')));
// A separate physical logic chain begins with real hardware clues.
await rotate(0,0);
await hit('serial');
assert((await state()).serialRead,'The front serial plate was not interactive');
await rotate(0,90);
await hit('pressure',3);
assert((await state()).pressureReady&&await page.locator('[data-item="fork"]').count(),
 'The pressure gauge did not emit its tuning fork');
await rotate(0,0);
await use('fork','cube');
assert((await state()).resonance,'Tuning fork failed to resonate with the mechanical cube');
await rotate(0,-90);
await hit('shutter');
assert((await state()).serviceOpen&&await page.locator('[data-item="cylinder"]').count(),
 'The sound-operated service door did not reveal the wax cylinder');
await use('cylinder','musicbox');
assert((await state()).cylinderMounted&&await page.locator('[data-item="tape"]').count(),
 'The repaired music box did not print paper tape');
await use('tape','clock');
assert((await state()).tapeInserted&&await page.locator('[data-item="letter"]').count(),
 'The clock did not read the punched tape');
await use('letter','train');
assert((await state()).letterMailed&&await page.locator('[data-item="envelope"]').count(),
 'The miniature train failed to deliver a reply');
await use('envelope','door');
assert((await state()).doorReplied,'The mysterious door did not answer the letter');
const progress=await state();
const missing=titles.filter(id=>!progress.seen.includes(id));
console.log('CUBE QA',JSON.stringify({total:titles.length,found:progress.seen.length,missing,pocket:progress.pocket,errors},null,2));
assert.deepEqual(missing,[],'Some curated secrets cannot actually be discovered');
assert.deepEqual(errors,[],'Runtime errors while playing');
assert(progress.door&&progress.doorOpen&&progress.bagSolved&&progress.tree&&progress.moon);
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.CriloNothingHereCube?.getState().seen.length===60);
assert((await state()).floorFour&&(await state()).observed&&(await state()).dancer&&(await state()).portal&&(await state()).doorReplied,
 'Expanded miniature puzzle chain did not persist across refresh');
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
console.log('PASS: 60/60 discoveries, pressure dial, resonator shutter, punched-tape correspondence, zoom, mobile, all previous puzzles and saved progress.');
