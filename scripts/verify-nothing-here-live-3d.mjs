// Verify that the default real 3D scene is actually the 60-secret game,
// not an unrelated prototype. The existing save key and story stay canonical.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../cube-secrets.js",import.meta.url),"utf8");
const catalogText=source.split("const catalog=[")[1]?.split("];")[0]||"";
const sixtySecrets=[...catalogText.matchAll(/^\s*\['([^']+)',/gm)].map(match=>match[1]);
assert.equal(sixtySecrets.length,60,"Unexpected change to the original 60-secret catalog");
assert.equal(new Set(sixtySecrets).size,60,"Duplicate discovery ids would corrupt save migration");
// Audit the actual mystery graph, not just the final saved-state counter:
// every original reward needs an awarding action or a valid craft recipe,
// and every physical pickup must have a readable glyph and inventory name.
const catalogSet=new Set(sixtySecrets);
const namesText=source.split("const names={")[1]?.split("const glyphs=")[0]||"";
const glyphText=source.split("const glyphs={")[1]?.split("const recipe=")[0]||"";
const itemIds=new Set([...namesText.matchAll(/\b([a-z][a-z0-9_]*):'/g)].map(m=>m[1]));
const glyphIds=new Set([...glyphText.matchAll(/\b([a-z][a-z0-9_]*):'/g)].map(m=>m[1]));
assert.equal(itemIds.size,32,"An existing pocket item disappeared from the canonical catalog");
assert.deepEqual([...glyphIds].sort(),[...itemIds].sort(),
 "Some collectible has no corresponding visual inventory glyph");
const directAwards=new Set([...source.matchAll(/\bbloom\('([^']+)'/g)].map(m=>m[1]));
const recipeText=source.split("const recipe={")[1]?.split("const sorted=")[0]||"";
const craftedAwards=new Set();
for(const [,left,right,product,award] of recipeText.matchAll(/'([a-z]+)\+([a-z]+)':\['([^']+)','([^']+)'/g)){
 for(const name of [left,right,product])assert(itemIds.has(name),
  "Craft recipe references an unknown inventory item: "+name);
 assert(catalogSet.has(award),"Craft recipe references an unknown secret: "+award);
 craftedAwards.add(award);
}
assert.equal(craftedAwards.size,3,"A key original combination or secret has disappeared");
for(const id of sixtySecrets)assert(directAwards.has(id)||craftedAwards.has(id),
 "Unreachable secret: "+id+" has no awarding event or crafting rule");
for(const [,item] of source.matchAll(/\b(?:gain|spend)\('([^']+)'/g))
 assert(itemIds.has(item),"A puzzle uses an item not defined in the pocket: "+item);
console.log("PASS: all 60 award paths, 32 named pocket objects, and three craft recipes are consistent");
// The object names may aid orientation, but puzzle solutions must NOT be
// supplied as hover text, engravings, or automatic journal hints.
for(const file of ["secrets-3d-details.js","secrets-3d-game-hotspots.js"]){
 const code=readFileSync(new URL("../"+file,import.meta.url),"utf8");
 assert(!/THREE TAPS|TAP 3×|SVC\\s+3-1-2/.test(code),
  "A machine engraving gives away a mechanical puzzle before its hidden clue is found: "+file);
}
assert(!source.includes("function nextHint()"),"Journal must not surface unrequested solutions");
assert(!source.includes("node.classList.toggle('nc-receptive'"),
 "The inventory must not automatically illuminate compatible puzzle targets");
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:[
 "--enable-webgl","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"
]});
const page=await browser.newPage({viewport:{width:1280,height:860}});
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
page.on("console",msg=>{
 if(msg.type()==="error" && !msg.text().includes("supabase"))errors.push(msg.text().slice(0,280));
});
// Simulate the database reads triggered by the account notification header
// during auth-ready checks. They are unrelated to secret progression.
const mock=`window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:null},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
 signOut:async()=>({error:null})},
 rpc:async()=>({data:null,error:null}),
 from:()=>({select(){return this},eq(){return this},order(){return this},
  limit:async()=>({data:[],error:null}),
  in:async()=>({data:[],error:null}),
  maybeSingle:async()=>({data:null,error:null})})
})};`;
await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*',
r=>r.fulfill({status:200,body:mock,contentType:"application/javascript"}));
await page.addInitScript(()=>{
 if(!sessionStorage.getItem("nc_live_3d_seeded")){
  localStorage.removeItem("crilo_nothing_here_cube_v3");
  sessionStorage.setItem("nc_live_3d_seeded","1");
 }
});
try{
 await page.goto("http://127.0.0.1:4173/secrets.html",{waitUntil:"domcontentloaded",timeout:30000});
 await page.waitForFunction(()=>document.body.classList.contains("nc-physical-ready")&&window.__nothing3DPreview?.ready,{timeout:60000});
 // Capture a true WebGL reference BEFORE interactions. Even if a later
 // puzzle regression fails, visual QA can inspect the precise rendered box.
 try{
  await page.screenshot({
   path:"test-results/live-3d-first-load.png",timeout:60000
  });
 }catch(e){console.warn("Initial WebGL screenshot unavailable",String(e).slice(0,220))}
 const initial=await page.evaluate(()=>({
 state:window.CriloNothingHereCube.getState(),
 meshes:window.__nothing3DPreview.meshCount,
 controls:window.__nothing3DPreview.gameControls,
 visible:getComputedStyle(document.querySelector("#stage")).visibility,
 blockers:window.__nothing3DPreview.solidShellBlockerCount,
 floating:window.__nothing3DPreview.floatingScene,
 plinth:window.__nothing3DPreview.pedestalMeshCount,
 mounts:window.__nothing3DPreview.storyMounts,
 pedestalSupports:window.__nothing3DPreview.pedestalSupportLengths.length
 }));
 assert.equal(initial.visible,"visible");
 const perf=await page.evaluate(()=>window.__nothing3DPreview.performanceMode);
 assert(typeof perf.rendererName==="string"&&Number.isFinite(perf.pixelRatio),
   "Adaptive 3D renderer did not report its active quality profile");
 if(perf.softwareGL){
  assert(perf.constrainedDevice&&!perf.shadows&&perf.pixelRatio<=.86,
   "Headless SwiftShader must avoid high-resolution soft shadows: "+JSON.stringify(perf));
 }
 console.log("Adaptive WebGL quality:",JSON.stringify(perf));
 const initialZoom=await page.locator("#ncZoomAmount").innerText();
 assert(Math.abs(Number(initialZoom.replace("%",""))-100)<=2,
  "Fresh desktop mode must frame the real 3D box at 100%, not a hidden mobile camera preset: "+initialZoom);
 const startCamera=await page.evaluate(()=>window.__nothing3DPreview.navigationState.camera);
 assert(Math.hypot(...startCamera)<8.5,
  "The initial desktop cube was incorrectly framed at mobile camera distance: "+JSON.stringify(startCamera));
 assert(initial.meshes>300,"Live stage is not rendering actual physical geometry");
 const pickStats=await page.evaluate(()=>window.__nothing3DPreview.raycastTargets);
 assert.equal(pickStats.total,pickStats.unique,"Duplicate raycast targets waste mouse/touch time");
 assert((await page.evaluate(()=>window.__nothing3DPreview.physicalScenePose.liftLampLevel))<.15,
  "The correct elevator floor must not be illuminated before discovery");
 assert(initial.blockers>=15,"Physical casing is missing face occluders");
 assert(initial.floating&&initial.plinth===0&&initial.pedestalSupports===0,
   "Nothing Here must float without a stand, a floor or mechanical supports");
 assert.equal(initial.mounts.length,15,"All miniature scenes must remain in the floating version");
 assert(initial.mounts.every(p=>["frontFace","backFace","leftFace","rightFace","topFace","bottomFace"].includes(p.face)),
   "A miniature is still mounted outside the rotating cube");
 assert.equal(new Set(initial.mounts.map(p=>p.name)).size,15,
   "A miniature was lost or duplicated when removing the pedestal");
 const navigation=await page.evaluate(()=>window.__nothing3DPreview.navigationState);
 assert(navigation.panEnabled,"A floating cube should allow drag-to-move as well as orbit rotation");
 // Real mouse input: pan the floating cube, cross the mobile breakpoint,
 // then animate back to center. Resizing must not wipe a player's view.
 const cubeCanvas=await page.locator("#stage canvas").boundingBox();
 assert(cubeCanvas&&cubeCanvas.width>100,"Missing physical inspection canvas");
 const cx=cubeCanvas.x+cubeCanvas.width*.5,cy=cubeCanvas.y+cubeCanvas.height*.5;
 // Test the primary, discoverable Move toggle first, using a real drag.
 await page.locator("#ncPanMode").click();
 assert((await page.evaluate(()=>window.__nothing3DPreview.navigationState)).panMode,
   "The Move button must configure the actual 3D OrbitControls");
 await page.mouse.move(cx,cy);
 await page.mouse.down({button:"left"});
 await page.mouse.move(cx+125,cy+45,{steps:12});
 await page.mouse.up({button:"left"});
 await page.waitForFunction(()=>
   Math.hypot(...window.__nothing3DPreview.navigationState.target)>.06,
   null,{timeout:25000});
 await page.locator("#ncPanMode").click();
 assert(!(await page.evaluate(()=>window.__nothing3DPreview.navigationState)).panMode,
   "Switching back must restore orbit rotation");
 assert((await page.evaluate(()=>window.__nothing3DPreview.navigationState)).rightPan,
   "Right-drag must stay a pan gesture when the default Rotate mode is selected");
 await page.waitForTimeout(800);
 const beforeResize=await page.evaluate(()=>window.__nothing3DPreview.navigationState.target);
 await page.setViewportSize({width:390,height:844});
 const afterResize=await page.evaluate(()=>window.__nothing3DPreview.navigationState.target);
 assert(Math.hypot(...afterResize.map((v,i)=>v-beforeResize[i]))<.25,
   "Mobile breakpoint snapped the cube back to its original position");
 await page.setViewportSize({width:1280,height:860});
 await page.locator("#ncViewReset").click();
 const recentered=await page.evaluate(()=>window.__nothing3DPreview.navigationState);
 assert(!recentered.cameraReturning&&Math.hypot(...recentered.target)<.05,
   "The real Reset View button did not immediately recenter the 3D orbit target: "+
    JSON.stringify(recentered));
 console.log("PASS: real Move-mode pointer drag, orbit-mode restoration, mobile resize continuity and camera reset");
 const hidden=await page.evaluate(()=>window.__nothing3DPreview.physicalClueVisibility);
 assert(Object.values(hidden).every(value=>!value),
   "Numerical inscriptions must start concealed under their physical covers");
 assert.match(await page.evaluate(()=>window.__nothing3DPreview.describeAction("latch")),/front drawer/i,
  "The live latch needs an understandable 3D label");
 assert.match(await page.evaluate(()=>window.__nothing3DPreview.describeAction("seam")),/side/i,
  "The side mechanism should identify itself");
 const neutralLabels=await page.evaluate(()=>
  ["triangle","hatch","eye-ring","vent-1","thing:bag-dial-0","cube-offer","latch"].map(
   name=>window.__nothing3DPreview.describeAction(name)));
 assert.equal(neutralLabels[0],"Brass triangle",
  "The triangle hover label should identify an object, not tell players how many presses solve it");
 assert(!/press|three times|tap|click to apply|try turning|loosen|use held item|rotate|visit floor/i.test(neutralLabels.join(" | ")),
  "Hover text is disclosing mechanical steps or compatible-item solutions: "+neutralLabels.join(" | "));
 const spatialPuzzles=await page.evaluate(()=>window.__nothing3DPreview.physicalPuzzleActions);
 for(const id of ["thing:bag-dial-0","thing:bag-dial-1","thing:bag-dial-2","thing:elevator-floor-4"])
  assert(spatialPuzzles.includes(id),"Missing real 3D puzzle button: "+id);
 for(const c of ["latch","seam","dot","dent","pressure","eye","eye-ring","vent-1","vent-2","vent-3","triangle","top-reed","foot","hatch","cube-offer","serial","shutter","right-bolt-1","hinge-0"]){
  assert(initial.controls.includes(c),"Missing physical target for original puzzle action: "+c);
 }
 assert(initial.controls.includes("cipher-strip"),
  "The secret symbol order needs a physical rear-face inspection target");
 for(const action of ["flute-note-1","flute-note-2","flute-note-3"])
  assert(initial.controls.includes(action),"Missing playable instrument key: "+action);
 assert.equal(await page.evaluate(()=>window.__nothing3DPreview.physicalFluteVisible),false,
  "A flute must not appear before its parts are found and combined");
 assert.equal(await page.evaluate(()=>window.__nothing3DPreview.revealedPhysicalCipher),false,
  "The secret combination must be hidden before the rear optic is calibrated");
 const activate=async name=>page.evaluate(action=>window.__nothing3DPreview.clickAction(action),name);
 const state=async()=>page.evaluate(()=>window.CriloNothingHereCube.getState());
 const latchMotion=await page.evaluate(()=>{
  const view=window.__nothing3DPreview;
  view.clickAction("latch");
  return {actuator:view.physicalActuatorDepths.latch,reduced:view.reducedMotion};
 });
 assert.equal((await state()).a,true,"Physical front catch did not unlock the original drawer (was mapped to the mouse)");
 if(!latchMotion.reduced){
  assert(latchMotion.actuator<-.007,"Brass latch did not physically depress: "+JSON.stringify(latchMotion));
  await page.waitForFunction(()=>window.__nothing3DPreview.drawerPositions.front>.02,
   null,{timeout:15000});

 }
 // Headless SwiftShader renders the highly detailed scene much more slowly
 // than desktop GPUs. Test the completed mechanical position, not whether
 // an arbitrary wall-clock sleep was long enough for requestAnimationFrame.
 try{
  await page.waitForFunction(()=>Math.abs(window.__nothing3DPreview.drawerPositions.front-.76)<.07,
   null,{timeout:22000});
 }catch(error){
  const diagnostics=await page.evaluate(()=>({
   position:window.__nothing3DPreview.drawerPositions,
   state:window.CriloNothingHereCube.getState().a,
   reducedMotion:window.__nothing3DPreview.reducedMotion
  }));
  throw new Error("Front drawer failed to reach mechanical stop: "+JSON.stringify(diagnostics),{cause:error});
 }
 assert.equal((await state()).a,true,"Drawer animation altered canonical progress");
 console.log("PASS: brass latch depressed, drawer extended and reached its end stop");
 await activate("side");
 assert.equal((await state()).b,true,"Physical side tray did not unlock original story");
 await activate("eye");
 assert.equal((await state()).back,true,"Real 3D eye must reveal the original eye clue, not merely move the calibration dial");
 assert((await page.evaluate(()=>window.__nothing3DPreview.physicalClueVisibility)).eyeNumber,
  "The eye must reveal its engraving ON the floating cube");
 await activate("right-bolt-1");
 assert((await page.evaluate(()=>window.__nothing3DPreview.physicalClueVisibility)).serviceNumber,
  "Removing the service bolt must uncover its genuine inscribed number");
 await activate("foot");
 assert((await page.evaluate(()=>window.__nothing3DPreview.physicalClueVisibility)).footNumber,
  "The folded-back foot must uncover the hidden underside inscription");
 await activate("service-latch");
 assert.equal((await state()).serviceOpen,false,"The sound-operated latch must remain locked until resonance");
 // The original 2D side-prop chain is now mirrored by fifteen
 // volumetric miniature figures on the physical stand.
 await activate("dent");
 assert.equal((await state()).mouse,true,"The 3D dent did not release the clockwork mouse");
 const worlds=await page.evaluate(()=>({
  all:window.__nothing3DPreview.physicalStoryObjects,
  visible:window.__nothing3DPreview.visiblePhysicalStoryObjects
 }));
 assert.equal(worlds.all.length,15,"Missing modeled 3D story props");
 assert(worlds.visible.includes("bag")&&worlds.visible.includes("machine"),
  "The mouse did not physically reveal its bag and vending machine");
 await page.waitForFunction(()=>{
  const v=window.__nothing3DPreview.getStoryMountVisualState("bag");
  return v?.visible&&Math.abs(v.scale-1)<.035&&Math.abs(v.depth-.27)<.035;
 },null,{timeout:30000,polling:250});
 console.log("PASS: new miniature discovery emerges and settles on its bolted shelf");
 const chipHeight=await page.locator('#ncSideObjects [data-thing="bag"]').evaluate(el=>el.getBoundingClientRect().height);
 assert(chipHeight>20&&chipHeight<70,
  "3D mode should keep an accessible compact story-object label, not a duplicate flat cartoon: "+chipHeight);
 // Exercise a real projected pointer click on the sculpted handbag, rather
 // than merely invoking an internal click API.
 const handbag=await page.evaluate(()=>window.__nothing3DPreview.projectPhysicalStoryObject("bag"));
 assert(handbag&&handbag.x>10&&handbag.x<1280&&handbag.y>10&&handbag.y<860,
  "The sculpted handbag has no usable visible canvas projection: "+JSON.stringify(handbag));
 assert.equal(handbag.pick,"thing:bag",
  "The 3D bag is hidden behind the box or its hit region is unreachable: "+JSON.stringify(handbag));
 const bagBefore=await page.locator("#ncNarrator").innerText();
 await page.locator("#stage canvas").click({position:{x:handbag.x,y:handbag.y},timeout:30000});
 if(!(await page.locator("#ncNarrator").innerText()).includes("bag is locked"))
  console.log("BAG POINTER DIAGNOSTIC",JSON.stringify({
   projection:handbag,prior:bagBefore,
   after:await page.locator("#ncNarrator").innerText(),
   view:await page.evaluate(()=>({state:window.CriloNothingHereCube.getState(),miniatures:window.__nothing3DPreview.visiblePhysicalStoryObjects}))
  }));
 assert.equal(await page.evaluate(()=>window.__nothing3DPreview.lastClickedAction),
  "thing:bag","Canvas pointer click did not dispatch to the sculpted handbag");
 assert.equal((await state()).bagOpen,false,
  "Clicking the locked bag without its key must not bypass the puzzle");
 // Delayed automatic pickups can occur in the same second; testing the
 // actual last dispatched mesh selection avoids mistaking a later caption
 // update for an ignored click.
 console.log("PASS: actual physical-pointer raycast activates the sculpted bag");
 // Items selected from the existing inventory must combine with a real 3D
 // model and write to the existing save key, not a separate 3D progress store.
 await page.locator('#ncInventory [data-item="coin"]').click();
 assert.equal((await state()).selected,"coin");
 await activate("thing:machine");
 let selectedState=await state();
 assert(selectedState.seen.includes("machine")&&selectedState.pocket.includes("sugar"),
  "Coin into 3D vending machine failed the canonical inventory recipe");
 assert(!selectedState.pocket.includes("coin"),"The 3D machine duplicated a spent coin");
 console.log("PASS 3D miniature world: fifteen modeled actors, visible state, inventory recipe and machine discovery");
 await page.screenshot({path:"test-results/live-3d-miniature-world.png",timeout:60000});
 const triangleMotion=await page.evaluate(()=>{
  const view=window.__nothing3DPreview;
  view.clickAction("triangle");
  return {depth:view.physicalActuatorDepths.triangle,reduced:view.reducedMotion};
 });
 if(!triangleMotion.reduced)
  assert(triangleMotion.depth<-.007,"Triangle should depress into its brass spring housing: "+JSON.stringify(triangleMotion));
 for(let i=0;i<2;i++)await activate("triangle");
 assert.equal((await state()).top,true,"Three physical lid taps did not open original hatch");
 await activate("hatch");
 assert.equal((await state()).top,true);
 await activate("hatch-latch"); // An additional metal control still routes to the real triangle.
 await activate("dot");await activate("dot");await activate("dot");await activate("dot");
 assert.equal((await state()).redHits,4,"Red-dot sequence lost state parity");
 // Real users click meshes, not the programmatic inspection API. Project a
 // raised 3D button into the actual canvas and exercise pointer raycasting.
 const button=await page.evaluate(()=>window.__nothing3DPreview.projectGameControl("dot"));
 assert(button&&button.x>0&&button.y>0,
  "Red button does not have a visible projected position");
 await page.locator("#stage canvas").click({position:{x:button.x,y:button.y},timeout:30000});
 assert.equal((await state()).redHits,5,
  "Clicking a visible physical red button did not trigger the original puzzle");
 // Exercise real Chrome touch input. Hand-built PointerEvents are not
 // active browser pointers and make OrbitControls.setPointerCapture throw.
 const touchSession=await page.context().newCDPSession(page);
 await touchSession.send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:2});
 const touchPoint=await page.evaluate(()=>{
  const v=window.__nothing3DPreview;
  const rect=document.querySelector("#stage canvas").getBoundingClientRect();
  const pos=v.projectGameControl("dot");
  return {x:rect.left+pos.x,y:rect.top+pos.y};
 });
 assert(Number.isFinite(touchPoint.x)&&Number.isFinite(touchPoint.y),
  "The red button cannot be projected for touch QA");
 const touchBase=(await state()).redHits;
 const touch=(id,dx=0)=>({x:touchPoint.x+dx,y:touchPoint.y,id});
 const sendTouch=(type,touchPoints)=>touchSession.send("Input.dispatchTouchEvent",{type,touchPoints});
 // Observe the DOM immediately after the real pointerup listener finishes.
 // A separate Playwright round-trip on a throttled software GPU can arrive
 // AFTER the intentionally short post-release caption has expired.
 await page.evaluate(()=>{
  window.__nhCaptionAtRelease=null;
  document.querySelector("#stage canvas").addEventListener("pointerup",()=>{
   queueMicrotask(()=>{
    const el=document.querySelector("#ncPartHint");
    window.__nhCaptionAtRelease=!el.hidden&&/red button/i.test(el.textContent);
   });
  },{once:true});
 });
 await sendTouch("touchStart",[touch(91)]);
 await page.waitForTimeout(680);
 const holdHint=await page.evaluate(()=>{
  const el=document.querySelector("#ncPartHint");
  return !el.hidden&&/red button/i.test(el.textContent);
 });
 await sendTouch("touchEnd",[]);
 const heldCaption=await page.evaluate(()=>window.__nhCaptionAtRelease);
 const holdCount=(await state()).redHits;
 // Verify a normal fingertip tap BEFORE any pinch has moved the camera.
 // A frame between down/up reflects an actual tap, not back-to-back CDP
 // commands that can be coalesced by a CPU-bound software WebGL renderer.
 await sendTouch("touchStart",[touch(94)]);
 await page.waitForTimeout(140);
 await sendTouch("touchEnd",[]);
 const tapCount=(await state()).redHits;
 const touchTarget=await page.evaluate(()=>{
  const v=window.__nothing3DPreview;
  const rect=document.querySelector("#stage canvas").getBoundingClientRect();
  const p=v.projectGameControl("dot");
  return p?{pick:p.pick,hit:v.getPhysicalActionAt(p.x,p.y),x:rect.left+p.x,y:rect.top+p.y}:null;
 });
 await sendTouch("touchStart",[touch(92)]);
 await sendTouch("touchStart",[touch(92),touch(93,33)]);
 const pinchInProgress=await page.evaluate(()=>window.__nothing3DPreview.touchInteractionState.gesture);
 await sendTouch("touchEnd",[]);
 const pinchCount=(await state()).redHits;
 const touchIdle=await page.evaluate(()=>window.__nothing3DPreview.touchInteractionState);
 await touchSession.send("Emulation.setTouchEmulationEnabled",{enabled:false});
 await touchSession.detach();
 assert(holdHint&&heldCaption&&pinchInProgress&&holdCount===touchBase&&
  pinchCount===tapCount&&tapCount>=touchBase&&tapCount<=touchBase+1&&
  touchTarget?.pick==="dot"&&touchTarget?.hit==="dot"&&
  touchIdle.active===0&&!touchIdle.gesture,
  "Real touch inspection / multi-touch / 3D raycast regression: "+JSON.stringify({
   holdHint,heldCaption,pinchInProgress,touchBase,holdCount,tapCount,pinchCount,
   touchTarget,touchIdle
  }));
 // A software GPU may process a simulated 140ms press after its 560ms
 // long-hold deadline. Do not call this nondeterministic CDP timing a game
 // failure: we independently verified the actual 3D pointer click above.
 console.log("PASS: touch hold remains readable, pinch is non-activating, and the target raycasts");
 if(tapCount===touchBase)console.log("NOTE: software-WebGL synthetic short-tap timing was throttled; manual hardware touch QA remains");
 const gaugeMotion=await page.evaluate(()=>{
  const view=window.__nothing3DPreview;
  view.clickAction("pressure");
  return {needle:view.physicalMechanismState.needle,
   head:view.physicalActuatorDepths.pressure,reduced:view.reducedMotion};
 });
 assert(gaugeMotion.needle,"Pressure motion failed to advance the real needle");
 if(!gaugeMotion.reduced)assert(gaugeMotion.head<-.003,
  "Pressure knob does not move under the fingertip");
 for(let i=0;i<2;i++)await activate("pressure");
 await activate("optic");
 await activate("eye-ring");
 await activate("eye-ring");
 assert.equal(await page.evaluate(()=>window.__nothing3DPreview.revealedPhysicalCipher),true,
  "The copper cipher should emerge from behind the third calibration click");
 await activate("eye-ring");
 assert.equal((await state()).eyeRingTicks,3,
  "The fully calibrated iris must stop instead of rotating beyond its physical limit");
 const priorToReading=(await state()).seen.length;
 await activate("cipher-strip");
 assert.match(await page.locator("#ncNarrator").innerText(),/◇\s*·\s*○\s*·\s*☾/,
  "Inspecting the hidden brass strip must show the separate combination clue");
 assert.equal((await state()).seen.length,priorToReading,
  "Reading the decorative cipher must not grant duplicate secret rewards");
 const physical=await page.evaluate(()=>window.__nothing3DPreview.physicalMechanismState);
 assert(physical.needle&&physical.light&&physical.backEye,
   "Saved puzzle actions are not driving real pressure, optical and iris hardware");
 await activate("serial");
 await activate("front-screw-0");
 const withdrawing=await page.evaluate(()=>window.__nothing3DPreview.visibleFrontScrews);
 assert(withdrawing>=3,"Newly loosened screw should visibly unscrew before disappearing");
 for(const n of [1,2])await activate("front-screw-"+n);
 let s=await state();
 assert(s.screws.length===3,"Three physical faceplate screws did not reach the original backend");
 await activate("cube-offer");
 s=await state();
 assert(s.plateOpen,"The original faceplate did not open from the physical 3D receiver");
 assert(s.seen.includes("faceplate")&&s.seen.includes("pipe")&&s.seen.includes("drawer"),
  "Physical actions failed to award the existing discovery catalog");
 await page.waitForTimeout(1400);
 assert.equal(await page.evaluate(()=>window.__nothing3DPreview.visibleFrontScrews),1,
  "Extracted 3D screws remained visibly attached to the faceplate");
 const once=await state();
 assert(once.pocket.includes("tooth")&&once.pocket.includes("thread")&&once.pocket.includes("pipe"),
  "Existing automatic physical compartment item pickups stopped working");
 // Re-rendering the authoritative state must not eject keyboard users from
 // the pocket or silently lose selected tools.
 await page.locator('#ncInventory [data-item="tooth"]').focus();
 await activate("serial");
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.item),"tooth",
  "An unrelated mechanical event stole keyboard focus from the pocket");
 await page.locator('#ncInventory [data-item="tooth"]').click();
 assert.match(await page.locator("#ncPocketSelection").innerText(),/holding.*key teeth/i,
  "Selecting a pocket tool should identify what is being held");
 assert.equal((await state()).selected,"tooth",
  "Pocket selection failed to persist in canonical state");
 await page.locator("#ncUnselect").click();
 assert.equal((await state()).selected,null,
  "Putting an item down failed to clear held-item selection");
 assert(await page.locator("#ncPocketSelection").isHidden(),
  "The held-item chip remained onscreen after putting the item away");
 // The underside's visible physical button must not be wired to the TOP
 // triangle. It releases the ring and leaves the top secret untouched.
 const topCountBefore=(await state()).topHits;
 await activate("underside");
 assert((await state()).bottom===true&&((await state()).ringTaken===true),
   "The underside button must release the ring and add it to inventory");
 assert.equal((await state()).topHits,topCountBefore,
   "The underside control is incorrectly wired to the top lid");
 const collected=await page.evaluate(()=>window.__nothing3DPreview.physicalCollectiblesVisible);
 for(const name of ["tooth","thread","pipe","extraKey","extraThread"])
  assert.equal(collected[name],false,"Collected physical piece is still visible on the box: "+name);
 // Assemble the original key from actual collected objects and solve the
 // physical 3D bag wheels without an HTML modal or a parallel progress store.
 assert.equal((await page.evaluate(()=>window.__nothing3DPreview.physicalCollectiblesVisible)).ring,false,
 "Collected underside ring must physically disappear into inventory");
 await page.locator('#ncInventory [data-item="tooth"]').click();
 await page.locator('#ncInventory [data-item="ring"]').click();
 assert((await state()).pocket.includes("key"),"Original key recipe failed");
 await page.locator('#ncInventory [data-item="key"]').click();
 await activate("thing:bag");
 assert.equal((await state()).bagOpen,true,"3D bag cannot be unlocked with the original key");
 await page.waitForFunction(()=>window.__nothing3DPreview.physicalScenePose.bagCoverAngle < -1.3,
  null,{timeout:17000,polling:250});
 assert(await page.locator("#ncModal").isHidden(),"The 3D lock cover should not open a flat popup");
 // A real mouse must be able to turn each dial independently, not strike
 // the invisible whole-bag collider that formerly masked the tumblers.
 const dialPointer=await page.evaluate(()=>{
  const view=window.__nothing3DPreview;
  const pos=view.projectPhysicalPuzzleControl("thing:bag-dial-1");
  return pos?{...pos,hit:view.getPhysicalActionAt(pos.x,pos.y)}:null;
 });
 assert(dialPointer&&dialPointer.pick==="thing:bag-dial-1"&&dialPointer.hit==="thing:bag-dial-1",
  "Unlocked bag's middle dial is masked: "+JSON.stringify(dialPointer));
 await page.locator("#stage canvas").click({position:{x:dialPointer.x,y:dialPointer.y},timeout:30000});
 const clickedDial=await page.evaluate(()=>({
  action:window.__nothing3DPreview.lastClickedAction,
  state:window.CriloNothingHereCube.getState().bagDials,
  current:window.__nothing3DPreview.projectPhysicalPuzzleControl("thing:bag-dial-1"),
  visible:window.__nothing3DPreview.visiblePhysicalStoryObjects
 }));
 assert.equal(clickedDial.action,"thing:bag-dial-1",
  "Pointer release did not dispatch the dial selected on press: "+JSON.stringify(clickedDial));
 assert.equal(clickedDial.state[1],1,
  "The mouse click failed to turn the physical bag dial: "+JSON.stringify(clickedDial));
 for(let i=0;i<3;i++)await activate("thing:bag-dial-1");
 const wheelMotion=await page.evaluate(()=>{
  const view=window.__nothing3DPreview;
  const before=view.miniatureMechanismPose.bagDials[0];
  view.clickAction("thing:bag-dial-0");
  return {before,reduced:view.reducedMotion};
 });
 if(!wheelMotion.reduced)
  await page.waitForFunction(before=>window.__nothing3DPreview.miniatureMechanismPose.bagDials[0]>before+.02,
   wheelMotion.before,{timeout:20000,polling:250});
 for(const i of [0,2,2,2])await activate("thing:bag-dial-"+i);
 const bagSolved=await state();
 assert.deepEqual(bagSolved.bagDials,[2,0,3],"Physical bag wheel values diverged from the original code");
 assert(bagSolved.bagSolved&&bagSolved.pocket.includes("prism")&&bagSolved.seen.includes("bag-code"),
  "3D bag wheels did not award the original combination secret and inventory");
 // Physical models must be operable without blocking the stage with a
 // flat popup. The original accessible classic modal still exists.
 await activate("thing:bag");
 assert(await page.locator("#ncModal").isHidden(),
  "Physical bag should not open an obstructing 2D dialog");
 assert.match(await page.locator("#ncNarrator").innerText(),/false bottom|bag.*pocket/i);
 console.log("PASS: actual pointer turns the bag dial; three-dimensional combination and inventory work");
 // The next chapter must ALSO be a physical puzzle: build the flute from
 // found parts, play three 3D keys, and open the original door with no modal.
 await page.locator('#ncInventory [data-item="pipe"]').click();
 await page.locator('#ncInventory [data-item="reed"]').click();
 const instrument=await state();
 assert(instrument.pocket.includes("flute")&&instrument.seen.includes("flute"),
  "Original flute combination broke during the 3D migration");
 assert.equal(await page.evaluate(()=>window.__nothing3DPreview.physicalFluteVisible),true,
  "The crafted flute did not materialize in the physical top compartment");
 assert(await page.locator("#ncModal").isHidden(),"3D flute should not require a flat popup");
 const key=await page.evaluate(()=>{
  const view=window.__nothing3DPreview;
  const pos=view.projectGameControl("flute-note-2");
  return pos?{...pos,hit:view.getPhysicalActionAt(pos.x,pos.y)}:null;
 });
 assert(key&&key.pick==="flute-note-2"&&key.hit==="flute-note-2",
   "Crafted 3D flute keys are obscured or impossible to click: "+JSON.stringify(key));
 await page.locator("#stage canvas").click({position:{x:key.x,y:key.y},timeout:30000});
 assert.deepEqual((await state()).fluteNotes,[2],
   "The real pointer click on the second flute key didn't sound the original note");
 // Play the other two instrument keys through real pointer clicks as well.
 for(const n of [1,3]){
  const projected=await page.evaluate(n=>{
   const view=window.__nothing3DPreview;
   const pos=view.projectGameControl("flute-note-"+n);
   return pos?{...pos,hit:view.getPhysicalActionAt(pos.x,pos.y)}:null;
  },n);
  assert(projected&&projected.pick==="flute-note-"+n&&projected.hit==="flute-note-"+n,
   "Physical flute key "+n+" is unreachable by a pointer: "+JSON.stringify(projected));
  await page.locator("#stage canvas").click({position:{x:projected.x,y:projected.y},timeout:30000});
  assert.equal((await state()).fluteNotes.at(-1),n,"Pointer missed flute key "+n);
 }
 const melody=await state();
 assert(melody.door&&melody.seen.includes("door"),
  "Playing the original melody on the physical flute did not reveal the door");
 assert(melody.pocket.includes("flute"),
  "Playing the flute unexpectedly consumed or duplicated the instrument");
 assert(await page.locator("#ncModal").isHidden(),
  "Playing the 3D flute opened an obstructive classic dialog");
 // The same instrument must work with the keyboard without revealing the
 // solution sequence or requiring any on-screen modal.
 await page.locator("#stage canvas").focus();
 await page.keyboard.press("1");
 assert.equal((await state()).fluteNotes.at(-1),1,
  "Keyboard players cannot operate the physical flute's first key");
 assert.match(await page.locator("#stage canvas").getAttribute("aria-label"),/keys 1, 2 and 3/i,
  "The keyboard controls need an accessible name once the instrument exists");
 console.log("PASS: tactile physical flute, saved door discovery and keyboard access");
 assert(await page.locator("#ncCount").innerText()!=="0","Live discovery counter did not advance");
 assert.equal(await page.locator("#ncPhysicalToggle").getAttribute("aria-pressed"),"true");
 const original=await page.evaluate(()=>localStorage.getItem("crilo_nothing_here_cube_v3"));
 assert(original && JSON.parse(original).plateOpen,"3D progression was not stored in the existing save slot");
 console.log("PASS real 3D: physical geometry, 60-secret progression, 3 compartments, item pickup and saved faceplate.");
 // The accessibility/classic fallback must restore exactly the same run.
 // Under software WebGL the previous context may take time to release GPU
 // resources when switching into Classic. A navigation commit suffices; the
 // subsequent explicit readiness wait verifies the actual document.
 await page.goto("http://127.0.0.1:4173/secrets.html?classic=1",{
  waitUntil:"commit",timeout:90000
 });
 await page.waitForFunction(()=>!!window.CriloNothingHereCube,{timeout:30000});
 const classic=await page.evaluate(()=>window.CriloNothingHereCube.getState());
 assert(classic.plateOpen&&classic.a&&classic.b&&classic.top,"Classic view did not preserve the physical session");
 assert(await page.locator("#ncCube").isVisible(),"Classic 3D fallback is no longer available");
 const classicHeight=await page.locator('#ncSideObjects [data-thing="bag"]').evaluate(el=>el.getBoundingClientRect().height);
 assert(classicHeight>=100,"Classic fallback must preserve full illustrated props");
 assert.equal(await page.locator("#ncPhysicalToggle").getAttribute("aria-pressed"),"false");
 await page.evaluate(()=>window.CriloNothingHereCube.activatePhysicalThing("bag"));
 const bagDescription=await page.locator("#ncModalBody").innerText();
 assert(!/diamond\s*[·•-]\s*circle\s*[·•-]\s*moon/i.test(bagDescription),
  "Classic bag dialog still spoils the symbol solution");
 await page.locator("#ncModalClose").click();
 assert.equal(await page.locator('[data-hit="cipher-strip"]').getAttribute("hidden"),null,
  "Saved calibration must also expose the secret in the classic fallback");
 await page.evaluate(()=>window.CriloNothingHereCube.activatePhysical("cipher-strip"));
 assert.match(await page.locator("#ncNarrator").innerText(),/◇\s*·\s*○\s*·\s*☾/,
  "The classic accessible engraving did not reveal the relocated clue");
 // Mobile physical version still loads, and 3D controls remain available.
 await page.setViewportSize({width:390,height:844});
 await page.goto("http://127.0.0.1:4173/secrets.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>window.__nothing3DPreview?.ready&&document.body.classList.contains("nc-physical-ready"),{timeout:60000});
 assert.equal((await state()).plateOpen,true,"Mobile view lost the same saved run");
 const bounds=await page.locator("#stage canvas").boundingBox();
 assert(bounds&&bounds.width>200&&bounds.width<=390,"Real 3D mobile canvas does not fit viewport");
 const mobileReview=await page.evaluate(()=>{
  const v=window.__nothing3DPreview;
  const groups=[...document.querySelector(".nc-inspection-controls").children]
   .map(g=>g.getBoundingClientRect());
  const targets=[...document.querySelectorAll(".nc-inspection-controls button")]
   .map(b=>b.getBoundingClientRect());
  return {cameraDistance:Math.hypot(...v.navigationState.camera),
   scroll:document.documentElement.scrollWidth,
   viewport:document.documentElement.clientWidth,
   toolbarRows:Math.abs(groups[0].top-groups[1].top),
   targets:targets.map(r=>[r.width,r.height])};
 });
 assert(mobileReview.cameraDistance>11.5&&mobileReview.cameraDistance<14,
  "The portrait camera is cropping the entire cube: "+JSON.stringify(mobileReview));
 assert(mobileReview.scroll<=mobileReview.viewport+2&&mobileReview.toolbarRows<6&&
  mobileReview.targets.every(([w,h])=>w>=33&&h>=37),
  "Mobile toolbar has clipped, tiny or two-row controls: "+JSON.stringify(mobileReview));
 await page.evaluate(()=>document.documentElement.dataset.theme="dark");
 const darkUi=await page.evaluate(()=>({
  bg:getComputedStyle(document.querySelector("#ncZoomIn")).backgroundColor,
  fg:getComputedStyle(document.querySelector("#ncZoomAmount")).color
 }));
 assert.equal(darkUi.bg,"rgb(48, 64, 71)","Dark mode still has a bright white zoom button");
 assert.equal(darkUi.fg,"rgb(219, 233, 229)","Dark-mode zoom value has poor contrast");
 console.log("PASS: framed mobile overview, readable single-row controls and dark-mode contrast");
 // All sixty existing awards must survive a real saved v3 session, without
 // splitting player history into a second Three.js storage namespace.
 await page.evaluate(ids=>{
  const key="crilo_nothing_here_cube_v3";
  const original=JSON.parse(localStorage.getItem(key));
  Object.assign(original,{
   seen:ids,plateOpen:true,serviceOpen:true,pressureReady:true,
   pressureTicks:3,eyeRingTicks:20,screws:[0,1,2],hingePins:[0,1,2],
   watch:true,tag:true,floorFour:false,
   door:true,doorOpen:true,music:true,vase:true
  });
  localStorage.setItem(key,JSON.stringify(original));
 },sixtySecrets);
 await page.reload({waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>window.__nothing3DPreview?.ready&&document.body.classList.contains("nc-physical-ready"),{timeout:60000});
 const migrated=await state();
 assert.deepEqual(new Set(migrated.seen),new Set(sixtySecrets),"3D migration lost completed secrets");
 assert.equal(await page.locator("#ncCount").innerText(),"60","Journal did not restore all sixty discoveries");
 assert(migrated.plateOpen&&migrated.serviceOpen&&migrated.pressureTicks===3,
   "3D migration reset existing mechanical puzzle state");
 assert.equal(migrated.eyeRingTicks,3,
   "Legacy optical over-rotations must be normalized without losing saved discoveries");
 await page.waitForTimeout(770);
 const vignette=await page.evaluate(()=>window.__nothing3DPreview.physicalScenePose);
 assert(vignette.doorAngle<-.75&&vignette.musicLidAngle<-.70,
  "Previously opened miniature doors and music-box lids did not restore their 3D hinge poses: "+JSON.stringify(vignette));
 assert(vignette.shardsVisible&&!vignette.vaseWholeVisible&&vignette.shardCount===12,
  "A broken vase must restore as solid individual ceramic shards: "+JSON.stringify(vignette));
 const mechanism=await page.evaluate(()=>window.__nothing3DPreview.physicalMechanismState);
 assert(mechanism.needle&&mechanism.light&&mechanism.service,
   "Reloaded saved mechanics did not restore the real metal mechanism poses");
 // Face the miniature elevator and physically press floor four with a
 // real pointer, rather than advancing its puzzle state through an API.
 const liftMotion=await page.evaluate(()=>{
  const view=window.__nothing3DPreview;
  const before=view.miniatureMechanismPose.liftDoors[0];
  view.setRotation(-19,95);
  return {before,reduced:view.reducedMotion};
 });
 const floorPointer=await page.evaluate(()=>{
  const view=window.__nothing3DPreview;
  const pos=view.projectPhysicalPuzzleControl("thing:elevator-floor-4");
  return pos?{...pos,hit:view.getPhysicalActionAt(pos.x,pos.y)}:null;
 });
 assert(floorPointer&&floorPointer.pick==="thing:elevator-floor-4"&&floorPointer.hit==="thing:elevator-floor-4",
  "Physical elevator fourth-floor button is masked: "+JSON.stringify(floorPointer));
 await page.locator("#stage canvas").click({position:{x:floorPointer.x,y:floorPointer.y},timeout:30000});
 assert.equal(await page.evaluate(()=>window.__nothing3DPreview.lastClickedAction),
  "thing:elevator-floor-4","A real pointer failed to select elevator floor four");
 if(!liftMotion.reduced){
  // The pre-click resting depth is not a pressed depth. Check the physical
  // elevator doors after the actual click, even on throttled renderers.
  await page.waitForFunction(before=>window.__nothing3DPreview.miniatureMechanismPose.liftDoors[0]<before-.006,
   liftMotion.before,{timeout:20000,polling:250});
 }
 const fourthFloor=await state();
 assert(fourthFloor.floorFour&&fourthFloor.pocket.includes("lens"),
   "Physical elevator call button did not operate the original floor-four puzzle");
 assert((await page.evaluate(()=>window.__nothing3DPreview.physicalScenePose.liftLampLevel))>.5,
  "The physical arrival indicator should light up when the elevator unlocks");
 await activate("dot");
 assert.equal((await state()).seen.length,60,"Repeating completed puzzles must not duplicate awards");
 await page.screenshot({path:"test-results/live-3d-mobile-restored.png",timeout:60000});
 await page.goto("http://127.0.0.1:4173/secrets.html?classic=1",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>!!window.CriloNothingHereCube,{timeout:30000});
 assert.deepEqual(new Set((await state()).seen),new Set(sixtySecrets),"Classic fallback lost previously completed 3D secrets");
 // Only a server-verified owner profile may consume the one-time local
 // reset. A normal player must never lose their 60-secret save.
 await page.evaluate(()=>{
  window.Crilo.user={id:"test-regular-user"};
  window.Crilo.profile={id:"test-regular-user",is_owner:false};
  window.dispatchEvent(new CustomEvent("crilo-auth-ready"));
 });
 assert.equal((await state()).seen.length,60,"Normal player was incorrectly reset");
 await page.evaluate(()=>{
  window.Crilo.user={id:"test-owner-profile"};
  window.Crilo.profile={id:"test-owner-profile",is_owner:true};
  // Owner progress reset correctly reloads this document. Schedule its
  // auth event on the next browser task so evaluate can return before
  // navigation destroys the execution context on slower CI machines.
  setTimeout(()=>window.dispatchEvent(new CustomEvent("crilo-auth-ready")),0);
 });
 await page.waitForFunction(()=>localStorage.getItem("crilo_nothing_here_owner_reset_20261024_v1:test-owner-profile")==="done",{timeout:20000});
 await page.waitForFunction(()=>window.CriloNothingHereCube?.getState?.().seen?.length===0,{timeout:60000});
 assert.equal((await state()).pocket.length,0,"Owner reset did not clear inventory");
 console.log("PASS: owner-only browser reset, no change to ordinary players");
 console.log("PASS: all 60 legacy completions, restored physical mechanisms, no repeat rewards, classic compatibility");
 assert.equal(errors.length,0,"3D integration produced browser exceptions: "+errors.join(" | "));
 console.log("PASS: desktop, mobile, classic fallback, persisted 60-secret engine, and zero browser exceptions");
}finally{await browser.close()}
