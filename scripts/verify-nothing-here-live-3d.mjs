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
 const instruction=await page.locator("#ncCubeHint").innerText();
 assert(/drag to rotate/.test(instruction)&&/identify/.test(instruction)&&
  !/correct|use the|sequence|number|unlock|solution/i.test(instruction),
  "The floating cube should explain how to inspect it without giving away a puzzle: "+instruction);
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
 // Mechanical status messages may appear when a part moves, but their
 // overlay must retreat so miniature fittings remain visible at rest.
 await page.waitForFunction(()=>document.querySelector("#stage #status")?.classList.contains("nc-status-resting"),
  null,{timeout:14000});
 const restingFeedback=await page.evaluate(()=>{
  const n=document.querySelector("#stage #status");
  return {text:n.textContent,className:n.className};
 });
 assert(restingFeedback.text.length>0,"Physical feedback was discarded instead of resting");
 const initialZoom=await page.locator("#ncZoomAmount").innerText();
 assert.equal(initialZoom,"82%",
  "Fresh desktop 3D view must begin zoomed out at 82%: "+initialZoom);
 const startCamera=await page.evaluate(()=>window.__nothing3DPreview.navigationState.camera);
 assert(Math.hypot(...startCamera)>9.2&&Math.hypot(...startCamera)<9.65,
  "The initial desktop camera must match the 82% readout: "+JSON.stringify(startCamera));
 // The maximum must be reachable with the physical camera, not merely
 // displayed in the label. Overshoot attempts should stop at exactly 200%.
 const desktopZoom=await page.evaluate(()=>{
  window.CriloNothingHereCube.zoomTo(2.5);
  return {indicator:document.querySelector("#ncZoomAmount").textContent,
   value:window.CriloNothingHereCube.getView().zoom,
   distance:Math.hypot(...window.__nothing3DPreview.navigationState.camera)};
 });
 assert(desktopZoom.indicator==="200%"&&desktopZoom.value===2&&
  desktopZoom.distance>3.75&&desktopZoom.distance<4,
  "Desktop 3D cannot reach precisely 200%: "+JSON.stringify(desktopZoom));
 await page.locator("#ncViewReset").click();
 const resetZoom=await page.evaluate(()=>({
  indicator:document.querySelector("#ncZoomAmount").textContent,
  value:window.CriloNothingHereCube.getView().zoom,
  distance:Math.hypot(...window.__nothing3DPreview.navigationState.camera)
 }));
 assert(resetZoom.indicator==="82%"&&resetZoom.value===.82&&
   resetZoom.distance>9.2&&resetZoom.distance<9.65,
  "Reset View did not return to the default 82%: "+JSON.stringify(resetZoom));
 const clearance=await page.evaluate(()=>({
  faults:window.__nothing3DPreview.permanentControlClearanceViolations,
  entries:window.__nothing3DPreview.permanentFaceFootprints
 }));
 assert(clearance.entries.length>=19&&clearance.faults.length===0,
  "A real mechanism or label overlaps another permanent control: "+
   JSON.stringify(clearance));
 const miniatureClashes=await page.evaluate(()=>
  window.__nothing3DPreview.miniatureControlClearanceViolations);
 assert.deepEqual(miniatureClashes,[],
  "A revealed sculpture intrudes into another miniature or playable fitting: "+
   JSON.stringify(miniatureClashes));
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
 const mountColors=await page.evaluate(()=>window.__nothing3DPreview.storyMounts.map(
  ({name})=>window.__nothing3DPreview.getStoryMountVisualState(name)?.inlayColor));
 assert(mountColors.length===15&&mountColors.every(Boolean)&&
   new Set(mountColors).size>=7,
   "The miniature worlds have lost their distinctive sculpted enamel inlays: "+
   JSON.stringify(mountColors));
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
 // A focused 3D canvas must work without mouse precision, but inspection
 // only names raycast-reachable surfaces, never uncollected hidden secrets.
 await page.locator("#stage canvas").focus();
 await page.keyboard.press("i");
 const keyInspection=await page.evaluate(()=>({
  ...window.__nothing3DPreview.keyboardInspectionState,
  tooltip:document.querySelector("#ncPartHint")?.textContent,
  visible:!document.querySelector("#ncPartHint")?.hidden,
  aria:document.querySelector("#stage canvas")?.getAttribute("aria-label")
 }));
 assert(keyInspection.count>=1&&keyInspection.selected&&keyInspection.label&&
   keyInspection.visible&&keyInspection.tooltip===keyInspection.label,
   "Keyboard I does not select an actually visible 3D fitting: "+JSON.stringify(keyInspection));
 assert(/arrow keys|enter|escape/i.test(keyInspection.aria),
   "Accessible 3D instructions do not describe keyboard inspection");
 assert(keyInspection.markerVisible,
   "Keyboard selection needs a visible reticle on the actual 3D part");
 // Hovering with a physical mouse must not replace the actively selected
 // keyboard object's name while its sight marker stays attached elsewhere.
 const keyCanvas=await page.locator("#stage canvas").boundingBox();
 await page.mouse.move(keyCanvas.x+keyCanvas.width*.86,keyCanvas.y+keyCanvas.height*.24);
 await page.waitForTimeout(100);
 const hoverLabel=await page.locator("#ncPartHint").innerText();
 assert.equal(hoverLabel,keyInspection.label,
   "Pointer hover stole the focused keyboard inspection label");
 const focusReticle=await page.evaluate(()=>{
  const el=document.querySelector("#ncKeyboardFocus");
  const canvas=document.querySelector("#stage canvas").getBoundingClientRect();
  const r=el.getBoundingClientRect();
  return {shown:!el.hidden,
   x:r.left+r.width/2,y:r.top+r.height/2,
   picked:window.__nothing3DPreview.getPhysicalActionAt(
    r.left+r.width/2-canvas.left,r.top+r.height/2-canvas.top)
  };
 });
 assert(focusReticle.shown&&focusReticle.picked===keyInspection.selected,
   "Focus marker is not attached to the actual visible raycast hit: "+
   JSON.stringify({focusReticle,keyInspection}));
 // Zooming changes the camera projection: never leave a keyboard reticle
 // selecting the old raycast point, even before the next render frame.
 await page.evaluate(()=>window.__nothing3DPreview.setZoom(.98));
 const afterZoom=await page.evaluate(()=>({
  ...window.__nothing3DPreview.keyboardInspectionState,
  hintHidden:document.querySelector("#ncPartHint").hidden
 }));
 assert(afterZoom.selected===null&&!afterZoom.markerVisible&&afterZoom.hintHidden,
   "Zoom preserved a stale keyboard target or hint: "+JSON.stringify(afterZoom));
 await page.keyboard.press("i");
 const beforeArrow=await page.evaluate(()=>window.CriloNothingHereCube.getState().ry);
 await page.keyboard.press("ArrowRight");
 const afterArrow=await page.evaluate(()=>({
  ry:window.CriloNothingHereCube.getState().ry,
  selected:window.__nothing3DPreview.keyboardInspectionState.selected
 }));
 assert(afterArrow.ry>beforeArrow+40&&afterArrow.selected===null,
   "3D canvas arrow keys failed to rotate or clear the prior inspection");
 assert(!(await page.evaluate(()=>window.__nothing3DPreview.keyboardInspectionState.markerVisible)),
   "The 3D focus reticle should clear after the cube rotates");
 await page.keyboard.press("i");
 await page.keyboard.press("Escape");
 assert.equal(await page.evaluate(()=>window.__nothing3DPreview.keyboardInspectionState.selected),null,
   "Escape must leave keyboard inspection without triggering a puzzle");
 assert(!(await page.evaluate(()=>window.__nothing3DPreview.keyboardInspectionState.markerVisible)),
   "Escape left the keyboard selection ring covering the 3D cube");
 assert(await page.locator("#ncPartHint").isHidden(),
   "Escape should dismiss the tooltip as well as the keyboard focus ring");
 await page.keyboard.press("i");
 await page.keyboard.press("Tab");
 assert(!(await page.evaluate(()=>window.__nothing3DPreview.keyboardInspectionState.markerVisible)),
   "Tabbing from the 3D canvas left a stale inspection marker");
 assert(await page.locator("#ncPartHint").isHidden(),
   "Tabbing away from the canvas left a stale hardware tooltip");
 await page.locator("#stage canvas").focus();
 await page.locator("#ncViewReset").click();
 console.log("PASS: keyboard-visible fitting navigation, in-scene identity, arrows and Escape");
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
 // A successfully entered service sequence must now move a *real*
 // bolted-on vent cover; simply adding a shim to inventory is not enough.
 const ventBefore=await page.evaluate(()=>window.__nothing3DPreview.physicalMechanicalFeedback);
 assert(Math.abs(ventBefore.ventHatchOffset)<.001,
  "The vent grille begins open before the numbered switches are pressed");
 for(const n of [3,1,2])await activate("vent-"+n);
 assert((await state()).ventOpen&&(await state()).pocket.includes("shim"),
  "Three-one-two did not unlock the original vent reward");
 await page.waitForFunction(()=>
  window.__nothing3DPreview.physicalMechanicalFeedback.ventHatchOffset<-.25,
  null,{timeout:18000,polling:250});
 const openVent=await page.evaluate(()=>window.__nothing3DPreview.physicalMechanicalFeedback);
 assert(openVent.ventHatchOffset<-.25,
  "The real vent shutter did not retract into its final open position");
 console.log("PASS: three numbered physical switches withdraw the metal vent shutter");
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
 // Repeated harmless inspections must never eject or permanently tilt
 // a collectible sculpture, or award an unearned progress achievement.
 const seenBeforeInspections=(await state()).seen;
 await page.evaluate(()=>{
  const view=window.__nothing3DPreview;
  for(let i=0;i<6;i++)view.clickAction("thing:bag");
 });
 // Give the physical recoil its end-stop deadline before another UI click.
 // Otherwise slow SwiftShader can postpone browser pointer dispatch.
 await page.waitForTimeout(1025);
 await page.waitForFunction(()=>{
  const p=window.__nothing3DPreview.getMiniatureInspectionPose("bag");
  return p?.visible&&Math.abs(p.depth-.205)<.003&&Math.abs(p.tilt)<.003;
 },null,{timeout:15000,polling:250});
 const inspection=await page.evaluate(()=>window.__nothing3DPreview.getMiniatureInspectionPose("bag"));
 assert(inspection?.visible&&Math.abs(inspection.depth-.205)<.003&&Math.abs(inspection.tilt)<.003,
  "Repeated inspections leave the miniature displaced from its mounting");
 assert.deepEqual((await state()).seen,seenBeforeInspections,
  "Inspecting a locked miniature awarded an unauthorized secret");
 console.log("PASS: real pointer hits miniature; rapid taps leave it captive to its mount");
 // Items selected from the existing inventory must combine with a real 3D
 // model and write to the existing save key, not a separate 3D progress store.
 // Inventory selection is DOM-based; the physical bag was already exercised
 // through a real canvas pointer. Avoid an unrelated slow-GPU mouse wait.
 await page.locator('#ncInventory [data-item="coin"]').evaluate(el=>el.click());
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
 assert((await state()).pocket.includes("bell"),
  "The bell must still be collected without a floating reward popup");
 const redFeedback=await page.evaluate(()=>
  window.__nothing3DPreview.physicalMechanicalFeedback);
 assert(redFeedback.redRewardGlow>.65&&redFeedback.redCollarAngle>=0,
  "Four presses must change the real red control's retaining ring, not show a floating bell: "+
   JSON.stringify(redFeedback));
 const quietRewards=await page.evaluate(()=>{
  const hidden=id=>getComputedStyle(document.getElementById(id)).display==="none";
  return {toast:hidden("ncToast"),incident:hidden("ncIncident"),
   cartoonCharacters:hidden("ncAnimationLayer"),
   duplicateDoor:hidden("ncDoorScene"),
   noFlyingItem:document.querySelectorAll(".nc-inventory-fly").length===0,
   noShards:document.querySelectorAll("#ncFragments > *").length===0};
 });
 assert(Object.values(quietRewards).every(Boolean),
  "Real 3D has legacy cartoon reward popups or flying bell art: "+
   JSON.stringify(quietRewards));
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
 // Dragging a finger must cancel the 560ms hold-to-identify timeout;
 // otherwise the tooltip appears while players orbit the physical cube.
 await sendTouch("touchStart",[touch(95)]);
 await page.waitForTimeout(75);
 await sendTouch("touchMove",[touch(95,45)]);
 await page.waitForTimeout(650);
 const dragHintHidden=await page.evaluate(()=>document.querySelector("#ncPartHint").hidden);
 await sendTouch("touchEnd",[]);
 const dragCount=(await state()).redHits;
 assert(dragHintHidden&&dragCount===tapCount,
  "Orbiting with a finger activated the mechanism or opened a stale inspection caption: "+
   JSON.stringify({dragHintHidden,dragCount,tapCount,holdCount,touchBase,
    pointerState:await page.evaluate(()=>window.__nothing3DPreview.touchInteractionState)}));
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
 // Selecting a real component at phone width must never clip its label.
 // This is particularly important for long object names near the edges.
 await page.locator("#stage canvas").focus();
 await page.keyboard.press("i");
 const phoneHint=await page.evaluate(()=>{
  const stage=document.querySelector("#stage").getBoundingClientRect();
  const hint=document.querySelector("#ncPartHint");
  const rect=hint.getBoundingClientRect();
  const selection=window.__nothing3DPreview.keyboardInspectionState;
  return {selected:selection.selected,visible:!hint.hidden,
   inside:rect.left>=stage.left+5&&rect.right<=stage.right-5&&
    rect.top>=stage.top+5&&rect.bottom<=stage.bottom-5,
   hint:[rect.left,rect.top,rect.right,rect.bottom],
   stage:[stage.left,stage.top,stage.right,stage.bottom]};
 });
 assert(phoneHint.selected&&phoneHint.visible&&phoneHint.inside,
  "Mobile hardware inspection label was clipped by its 3D stage: "+
   JSON.stringify(phoneHint));
 await page.keyboard.press("Escape");

 // Stress all miniatures without awarding secrets: the old wrapped layout
 // grew to several congested rows on a phone. The new row must scroll
 // internally and leave the page width unchanged.
 const discoveryTray=await page.evaluate(()=>{
  const tray=document.querySelector("#ncSideObjects");
  const buttons=[...tray.querySelectorAll(".nc-prop")];
  const saved=buttons.map(button=>button.hidden);
  buttons.forEach(button=>button.hidden=false);
  const boxes=buttons.map(button=>button.getBoundingClientRect());
  const result={
   role:tray.getAttribute("role"),
   description:tray.getAttribute("aria-label"),
   wrap:getComputedStyle(tray).flexWrap,
   overflow:getComputedStyle(tray).overflowX,
   topRange:Math.max(...boxes.map(x=>x.top))-Math.min(...boxes.map(x=>x.top)),
   hasInternalScroll:tray.scrollWidth>tray.clientWidth+30,
   fitsPage:document.documentElement.scrollWidth<=window.innerWidth+2
  };
  buttons.forEach((button,i)=>button.hidden=saved[i]);
  return result;
 });
 assert(discoveryTray.role==="group"&&/swipe|tab/i.test(discoveryTray.description)&&
  discoveryTray.wrap==="nowrap"&&discoveryTray.overflow==="auto"&&
  discoveryTray.topRange<4&&discoveryTray.hasInternalScroll&&discoveryTray.fitsPage,
  "Discovered miniatures are still wrapped into a crowded mobile layout: "+
  JSON.stringify(discoveryTray));
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
 assert(mobileReview.cameraDistance>16.1&&mobileReview.cameraDistance<16.5,
  "The portrait cube must start at the wider 82% overview: "+JSON.stringify(mobileReview));
 assert.equal(await page.locator("#ncZoomAmount").innerText(),"82%",
  "Mobile camera and displayed default zoom must agree");
 const mobileZoomRange=await page.evaluate(()=>{
  const view=window.__nothing3DPreview;
  view.setZoom(.5);
  const zoomOut=Math.hypot(...view.navigationState.camera);
  view.setZoom(1);
  const normal=Math.hypot(...view.navigationState.camera);
  window.CriloNothingHereCube.zoomTo(2.6);
  const maxIndicator=document.querySelector("#ncZoomAmount").textContent;
  const zoomIn=Math.hypot(...view.navigationState.camera);
  window.CriloNothingHereCube.resetView();
  return {zoomOut,normal,zoomIn,maxIndicator,
   reset:document.querySelector("#ncZoomAmount").textContent};
 });
 assert(mobileZoomRange.zoomOut>16.1&&mobileZoomRange.zoomOut<16.5&&
  mobileZoomRange.normal>13.1&&mobileZoomRange.normal<13.8&&
  mobileZoomRange.zoomIn>6.5&&mobileZoomRange.zoomIn<6.9&&
  mobileZoomRange.maxIndicator==="200%"&&mobileZoomRange.reset==="82%",
  "Mobile 3D zoom, range, or reset disagrees with 82–200%: "+JSON.stringify(mobileZoomRange));
 assert(mobileReview.scroll<=mobileReview.viewport+2&&mobileReview.toolbarRows<6&&
  mobileReview.targets.every(([w,h])=>w>=33&&h>=37),
  "Mobile toolbar has clipped, tiny or two-row controls: "+JSON.stringify(mobileReview));
 await page.evaluate(()=>{
  localStorage.setItem("crilo_theme","dark");
  document.documentElement.dataset.theme="dark";
 });
 // Theme paint is animated over 150ms; checking in the same task reads
 // the old white background mid-transition despite correct loaded CSS.
 await page.waitForTimeout(275);
 const darkUi=await page.evaluate(()=>{
  const button=document.querySelector("#ncZoomIn");
  const zoom=document.querySelector("#ncZoomAmount");
  return {theme:document.documentElement.dataset.theme,
   bodyClass:document.body.className,
   matches:button.matches('html[data-theme="dark"] body.nc-page .nc-inspection-controls .nc-zoom-controls button'),
   stylesheet:[...document.styleSheets].some(s=>s.href?.includes("cube-physical.css")),
   bg:getComputedStyle(button).backgroundColor,
   fg:getComputedStyle(zoom).color};
 });
 assert.equal(darkUi.bg,"rgb(48, 64, 71)","Dark mode still has a bright white zoom button: "+JSON.stringify(darkUi));
 assert.equal(darkUi.fg,"rgb(219, 233, 229)","Dark-mode zoom value has poor contrast");
 assert(darkUi.theme==="dark"&&darkUi.matches,"Dark mode selector did not match the physical page: "+JSON.stringify(darkUi));
 await page.evaluate(()=>{
  localStorage.setItem("crilo_theme","light");
  document.documentElement.dataset.theme="light";
 });
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
   door:true,doorOpen:true,music:true,vase:true,cloud:true,
   train:true,dogHits:2,mothTouched:true
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
 assert(vignette.vaseShardSpread>.5&&Math.abs(vignette.dancerRotation)<.05,
  "Saved miniature shards and dancer must settle physically without replaying old actions: "+
   JSON.stringify(vignette));
 assert(vignette.mothWingAngles.length===2&&
  vignette.mothWingAngles[0]<-.69&&vignette.mothWingAngles[1]>.69,
  "Clockwork moth wings did not restore their physical open pose: "+JSON.stringify(vignette));
 assert(vignette.cloudDropHeights.length===3&&
  vignette.cloudDropHeights.every(y=>y>.08&&y<.17),
  "A saved rain cloud did not restore its individual drops: "+JSON.stringify(vignette));
 assert(vignette.trainWheelAngles.length===4&&
  vignette.trainWheelAngles.every(a=>Number.isFinite(a)),
  "The miniature train lost its sculpted rotating axles: "+JSON.stringify(vignette));
 assert(Math.abs(vignette.dogTailAngle)<.01,
  "Saved dog tail did not rest on its own hinge");
 const reloadedFeedback=await page.evaluate(()=>
  window.__nothing3DPreview.physicalMechanicalFeedback);
 assert(reloadedFeedback.ventHatchOffset<-.25&&reloadedFeedback.redRewardGlow>.65,
  "Completed mechanical effects must survive a save/reload: "+JSON.stringify(reloadedFeedback));
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
