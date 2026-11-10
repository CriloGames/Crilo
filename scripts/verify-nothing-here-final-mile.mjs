// Fast, independent final-mile regression. Seeds a legitimate 59/60 save
// so elevator, save migration, and the real 3D cat ending can be checked
// without replaying every earlier puzzle on a software WebGL runner.
// The full interactive walkthrough remains a separate REQUIRED CI job.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const logic=readFileSync(new URL("../cube-secrets.js",import.meta.url),"utf8");
const catalog=logic.split("const catalog=[")[1]?.split("];")[0]||"";
const sixty=[...catalog.matchAll(/^\s*\['([^']+)',/gm)].map(m=>m[1]);
assert.equal(sixty.length,60);
const pre=sixty.filter(x=>x!=="return-letter");
assert.equal(pre.length,59);
const browser=await chromium.launch({headless:true,args:[
 "--enable-webgl","--use-gl=angle","--use-angle=swiftshader",
 "--enable-unsafe-swiftshader"
]});
const page=await browser.newPage({viewport:{width:1000,height:720}});
const errors=[];
page.on("pageerror",err=>errors.push(err.message));
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
await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*",
 route=>route.fulfill({status:200,body:mock,contentType:"application/javascript"}));
const ready=()=>page.waitForFunction(()=>
 window.__nothing3DPreview?.ready&&
 document.body.classList.contains("nc-physical-ready"),
 null,{timeout:65000,polling:250});
const state=()=>page.evaluate(()=>window.CriloNothingHereCube.getState());
try{
 await page.goto("http://127.0.0.1:4173/secrets.html",{waitUntil:"domcontentloaded",timeout:45000});
 await page.evaluate(ids=>{
  const key="crilo_nothing_here_cube_v3";
  localStorage.setItem(key,JSON.stringify({
   seen:ids,
   pocket:["tag"],pendingPickups:[],
   a:true,b:true,top:true,bottom:true,back:true,mouse:true,
   bag:true,bagOpen:true,bagSolved:true,
   door:true,doorOpen:true,tag:true,serialRead:true,
   plateOpen:true,screws:[0,1,2],hingePins:[0,1,2],
   pressureReady:true,pressureTicks:3,
   ventOpen:true,serviceOpen:true,
   music:true,watch:true,vase:true,cloud:true,plant:true,tree:true,
   tapeInserted:true,shimUsed:true,refundRedeemed:true,
   floorFour:false,elevatorTagInserted:false,
   dogHits:2,mothTouched:true,
   dancer:true,train:true
  }));
 },pre);
 // Under concurrent software WebGL, waiting for DOMContentLoaded can block
 // on GPU work long after navigation already committed. The explicit ready()
 // gate below still verifies the real 3D page mounted successfully.
 await page.reload({waitUntil:"commit",timeout:90000});
 await ready();
 assert.equal((await state()).seen.length,59,"Saved 59/60 state was not restored");
 // At the very first frame, all optimized 3D ornaments belong to actual
 // hinged face roots, not to the cube's rigid world-space geometry.
 const batchBefore=await page.evaluate(()=>({
  attachment:window.__nothing3DPreview.finaleBatchAttachmentAudit,
  batching:window.__nothing3DPreview.batching,
  gussets:window.__nothing3DPreview.finaleGussetAudit
 }));
 assert(batchBefore.gussets.allFollowWall&&
  batchBefore.gussets.attached===8,
  "The 8 corner gussets are not all mounted to moving walls: "+
   JSON.stringify(batchBefore.gussets));
 assert(batchBefore.attachment.allFollowPanels&&
  batchBefore.attachment.total>0&&
  batchBefore.batching.artisan.coordinateSpace==="hinged-panel"&&
  batchBefore.batching.precision.coordinateSpace==="hinged-panel",
  "Original decorative geometry is not parented to its moving panel: "+
   JSON.stringify(batchBefore));
 const initial=await page.evaluate(()=>({
  ending:window.__nothing3DPreview.completionFinale,
  doors:window.__nothing3DPreview.miniatureMechanismPose.liftDoors,
  reader:window.__nothing3DPreview.physicalElevatorTagReaderState
 }));
 assert(initial.ending.phase==="idle"&&initial.doors.length===2,
  "Near-complete save must not start the finale or drop the lift");
 assert((await state()).pocket.includes("tag"),
  "An earned but unused collar tag disappeared during load");
 // Press through the same real 3D game action used by a pointer hit.
 await page.evaluate(()=>window.__nothing3DPreview.clickAction("thing:elevator-floor-4"));
 assert(!(await state()).floorFour,"Locked lift skipped the brass tag reader");
 await page.locator('#ncInventory [data-item="tag"]').click();
 assert(await page.evaluate(()=>window.CriloNothingHereCube
  .canUseSelectedWithAction("thing:elevator-keyway")),
  "Tag does not fit the physical keyway");
 await page.evaluate(()=>window.__nothing3DPreview.clickAction("thing:elevator-keyway"));
 assert((await state()).elevatorTagInserted,
  "The actual tag interaction failed to unlock the lift");
 const before=await page.evaluate(()=>
  window.__nothing3DPreview.miniatureMechanismPose.liftDoors[0]);
 await page.evaluate(()=>window.__nothing3DPreview.clickAction("thing:elevator-floor-4"));
 assert((await state()).floorFour,"Fourth-floor button failed to unlock after the tag");
 try{
  await page.waitForFunction(before=>
   window.__nothing3DPreview.miniatureMechanismPose.liftDoors[0]<before-.006,
   before,{timeout:8000,polling:250});
 }catch(error){
  const diag=await page.evaluate(()=>({
   game:window.CriloNothingHereCube.getState(),
   doors:window.__nothing3DPreview.miniatureMechanismPose.liftDoors,
   scene:window.__nothing3DPreview.physicalScenePose,
   reader:window.__nothing3DPreview.physicalElevatorTagReaderState,
   errors:document.querySelector("#status")?.textContent
  }));
  // SwiftShader can starve browser polling even after the physical
  // panels have reached their correct end stops. The diagnostic reads
  // the ACTUAL rendered door positions, so it still rejects a locked lift.
  const reached=diag.game.floorFour&&diag.doors?.length===2&&
   diag.doors[0]<before-.006&&diag.doors[1]>.111;
  if(!reached)throw new Error("Final-mile elevator physical movement diagnostics "+
   JSON.stringify({before,diag}),{cause:error});
 }
 const end=await page.evaluate(()=>window.__nothing3DPreview.miniatureMechanismPose.liftDoors);
 assert(end.length===2&&end[0]<-.111&&end[1]>.111,
  "Real elevator doors didn't travel apart: "+JSON.stringify(end));
 console.log("PASS: fast final-mile collar tag, locked lift and opening 3D carriage");
 // Do not simulate 60th discovery with a fake click. Restoring an already
 // completed legacy 60/60 save is a separate supported gameplay path.
 await page.evaluate(ids=>{
  const key="crilo_nothing_here_cube_v3";
  const s=JSON.parse(localStorage.getItem(key));
  s.seen=ids;
  localStorage.setItem(key,JSON.stringify(s));
 },sixty);
 // A software-rendered WebGL page can delay DOMContentLoaded even though
 // the new document is committed. Test the completed game using its real
 // scene-ready gate, not a browser event unrelated to puzzle readiness.
 await page.reload({waitUntil:"commit",timeout:90000});
 await ready();
 const finish=await page.evaluate(()=>window.__nothing3DPreview.completionFinale);
 const batchAfter=await page.evaluate(()=>window.__nothing3DPreview.finaleBatchAttachmentAudit);
 const gussetsAfter=await page.evaluate(()=>window.__nothing3DPreview.finaleGussetAudit);
 assert(gussetsAfter.allFollowWall&&gussetsAfter.attached===8,
  "Corner fittings no longer follow their panels after unfolding: "+
   JSON.stringify(gussetsAfter));
 assert(batchAfter.allFollowPanels&&
  batchAfter.total===batchBefore.attachment.total&&
  batchAfter.cubeAttached===0&&batchAfter.unassigned===0,
  "A baked ornament was left behind when the panel unfolded: "+
   JSON.stringify({batchBefore,batchAfter}));
 assert(finish.phase==="open"&&finish.replay&&
  Object.keys(finish.panels).length===6&&finish.originalFramePreserved&&
  finish.originalFramePieceCount>=20&&
  finish.originalFrameVisibleCount===finish.originalFramePieceCount&&
  finish.rigidCubeOrphanCount===0,
  "Completed save didn't reveal its actual unfolded T");
 assert(finish.reverseTexturedPanels===6&&
  finish.duck?.real3DDuck&&finish.duck.loadedModel&&
  finish.duck.postlude?.postludePhase==="egg"&&
  finish.duck.postlude.eggVisible&&finish.duck.postlude.eggClickable&&
  Math.abs(finish.cat.durationSeconds-134.699)<.001,
  "Completed finale lost its textured panels, 3D duck, or interactive egg");
 assert.deepEqual(new Set((await state()).seen),new Set(sixty),
  "Finale save migration lost earned secrets");
 // A completed save places the banner above the game. When the user scrolls
 // (including at large browser zoom), it must NEVER cover the sticky tabs.
 const headerHit=await page.evaluate(()=>{
  const header=document.querySelector(".crilo-game-topbar");
  const banner=document.querySelector("#ncFinaleBanner");
  const nav=header?.querySelector("nav a");
  if(!header||!banner||!nav)return {missing:true};
  const headerZ=Number(getComputedStyle(header).zIndex);
  const bannerZ=Number(getComputedStyle(banner).zIndex);
  window.scrollTo(0,banner.getBoundingClientRect().top+window.scrollY+15);
  const navBox=nav.getBoundingClientRect();
  const target=document.elementFromPoint(navBox.left+navBox.width/2,
   navBox.top+navBox.height/2);
  const clickable=!!target?.closest(".crilo-game-topbar");
  window.scrollTo(0,0);
  return {headerZ,bannerZ,clickable};
 });
 assert(!headerHit.missing&&headerHit.headerZ>headerHit.bannerZ&&
  headerHit.clickable,
  "Completion banner is painted above the sticky navigation: "+
   JSON.stringify(headerHit));
 console.log("PASS: completion banner cannot block sticky top navigation");
 // The fully modeled T now dissolves BEFORE the green light show begins.
 // At the first soundtrack beat no glass, fixtures or panels may linger
 // semi-transparent over the bright neon background.
 // The corner moon must disappear with the real 3D cube.
 await page.evaluate(()=>document.body.classList.add("nc-moon"));
 const fadeStages=[];
 for(const seconds of [0,.9,2.2]){
  const frame=await page.evaluate(t=>{
   const cat=window.__nothing3DPreview.seekFinaleFrame(t);
   const ending=window.__nothing3DPreview.completionFinale;
   return {cat,opacity:ending.netOpacity,done:ending.netFadeComplete,
    technique:ending.netFadeTechnique,
    alteredTransparency:ending.netAlteredTransparencyCount,
    aligned:ending.duckCenteredOverBox,
    moon:+getComputedStyle(document.querySelector(".nc-world"),"::after").opacity,
    moonClock:+document.body.style.getPropertyValue("--nh-finale-moon-opacity")};
  },seconds);
  assert(frame?.aligned&&frame.cat?.hoveringOverBox&&frame.cat.duck,
   "Cat must stay centered and hovering over the open box at "+seconds+"s: "+
    JSON.stringify(frame));
  fadeStages.push(frame);
 }
 assert(fadeStages.every(f=>f.opacity===0&&f.done&&
  f.technique==="opaque-solid-wipe"&&f.alteredTransparency===0),
  "The cube must be gone BEFORE neon, without leaving translucent parts: "+
   JSON.stringify(fadeStages));
 assert(fadeStages.every(f=>Math.abs(f.moon-f.opacity)<.025&&
  Math.abs(f.moonClock-f.opacity)<.025),
  "Moon and T-shaped box do not fade together: "+JSON.stringify(fadeStages));
 await page.evaluate(()=>document.body.classList.remove("nc-moon"));
 console.log("PASS: no transparent cube/ghost fixtures during neon duck music");
 // Inspect the ENTIRE 134.7s visual choreography, not just the start and
 // end. The actual rendered Three.js meshes and shader uniforms must change
 // at the same timestamp as the uploaded 1080p reference video.
 const visualSamples=[
  [0,"front",0],[2,"loaf",0],[4,"front",0],[8.5,"loaf",0],
  [29,"front",1],[29.45,"loaf",1],[30.5,"loaf",1],[34,"loaf",2],
  [40.5,"loaf",7],[48,"loaf",9],[55,"loaf",10],
  [60,"front",3],[65,"front",8],[65.5,"loaf",8],
  [68,"front",8],[68.5,"loaf",8],[70.5,"front",8],
  [76,"loaf",4],[78.15,"front",12],[79.3,"front",5],[84,"loaf",0],
  [90,"loaf",3],[91,"loaf",11],[97,"loaf",11],
  [102,"front",8],[104.5,"loaf",8],[108,"loaf",2],
  [116,"front",7],[123,"loaf",9],[129,"loaf",10],
  [131,"front",3],[133,"loaf",0]
 ];
 const renderResults=[];
 for(const [seconds,pose,backdrop] of visualSamples){
  const actual=await page.evaluate(time=>
   window.__nothing3DPreview.seekFinaleFrame(time),seconds);
  assert(actual&&actual.stageScene===backdrop,
   "Stage backdrop diverged from 1080p frame at "+seconds+"s: "+
    JSON.stringify(actual));
  const expected=pose==="loaf"?"spin":"still";
  assert(actual.active3DPose===expected&&actual.rendered3DPose===expected,
   "The same 3D duck did not follow the expected still/spin cue at "+
    seconds+"s: "+JSON.stringify(actual));
  assert(actual.volumetricLoaf&&actual.meshCount>0&&
   Math.abs(actual.stageFrameLuma-actual.referenceFrameLuma)<.002,
   "A real 3D pose or measured exposure was lost at "+seconds+"s");
  assert(actual.singleModelBothPoses&&actual.distinctCatModels===1&&
   actual.identitySwaps===0&&actual.duck&&actual.real3DDuck&&
   actual.mascotGeometry==="crilo-classic-duck-v1"&&
   actual.duckSource==="crilo-classic-original-3d"&&
   actual.catIdentity==="single-crilo-classic-duck",
   "The finale must have one original Crilo Classic duck, not cats or "+
    "swapping models: "+JSON.stringify({seconds,actual}));
  if(seconds===34||seconds===40.5||seconds===114.2){
   assert(actual.wormholeActive&&actual.wormholeForwardTravel>0,
    "The vortex must travel FORWARD in depth, not show a flat grid at "+
     seconds+"s: "+JSON.stringify(actual));
   assert(actual.unifiedDuckScale>.2,
    "The duck's single rig was collapsed or distorted in the wormhole");
  }
  if(pose==="loaf"){
   assert(Math.abs(actual.actualRotations.x)<.001&&
    Math.abs(actual.actualRotations.z)<.001&&
    actual.revolutionsPerSecond>=5&&
    actual.spinAxis==="y",
    "The loaf must spin left-right around Y at the video speed, never "+
     "barrel-roll around X or pinwheel around Z at "+seconds+"s: "+
     JSON.stringify(actual));
  }
  if(pose==="front")
   assert(Math.abs(actual.actualRotations.x)<.001&&
    Math.abs(actual.actualRotations.y)<.001&&
    Math.abs(actual.actualRotations.z)<.001&&
    actual.duckStopsFrontOnHold&&actual.frontFacingDuck&&
    Math.abs(actual.duckFacingYaw)<.001,
    "The duck must STOP and actually FACE THE PLAYER during every still hold at "+
     seconds+"s: "+JSON.stringify(actual));
  assert(actual.neckGeometry==="continuous-short-sculpt"&&
   actual.neckSeams===0&&actual.duckHeadOutlined&&actual.duckToesOutlined&&
   actual.duckTailOutlined&&actual.duckLegsOutlined&&
   actual.duckTailTopRidgeCount===2&&
   actual.duckFullTailContourCount===1&&
   actual.duckFullTailContoursAttached,
   "Duck must have ONE real continuous rounded-tail contour mesh visible "+
    "from any spin angle, plus the pointed feather—at "+seconds);
  assert(actual.spinGlowStrength===0&&!actual.spinGlowVisible,
   "The duck must have no glow during spins OR front-facing pauses");
  renderResults.push([seconds,pose,backdrop]);
  if(process.env.NH_CAPTURE_FINALE_SWEEP==="1"&&
   [0,2,34,68,91,123].includes(seconds)){
   await page.locator("#stage canvas").screenshot({
    path:"test-results/video-reference-"+String(seconds).padStart(3,"0")+".png",
    timeout:45000
   });
  }
 }
 // Stop exactly on the music cut, NOT in a permanent 1.12 radian
 // side profile. These still holds occur immediately AFTER distinct spins.
 for(const t of [2.84,6.04,9.24,12.44,15.64,18.84,26.84,36.04,58.95,
   63.84,66.33,69.78,72.78,77.82,84.75,100.12,115.78,130.82]){
  const duck=await page.evaluate(time=>
   window.__nothing3DPreview.seekFinaleFrame(time),t);
  assert(duck.duckStopsFrontOnHold&&duck.frontFacingDuck&&
   duck.active3DPose==="still"&&Math.abs(duck.duckFacingYaw)<.001,
   "A completed spin did not settle face-forward at "+t+"s: "+
    JSON.stringify(duck));
 }
 console.log("PASS: duck stops facing forward after each spinning section");
 const finalHold=await page.evaluate(()=>
  window.__nothing3DPreview.seekFinaleFrame(134.60));
 assert(finalHold.active3DPose==="still"&&finalHold.duckStopsFrontOnHold&&
  Math.abs(finalHold.duckFacingYaw)<.001,
  "Final duck must stop rotating before audio finishes, never dance in silence");
 const stageCases=[
  [34.25,2,true],[40.5,7,true],[47.2,9,true],[55.2,10,true],
  [59.7,3,false],[70.2,8,false],[79.5,5,false],
  [94.2,3,false],[130.98,3,false],[134.61,5,false]
 ];
 for(const [at,stage,hasLeds] of stageCases){
  const shot=await page.evaluate(t=>window.__nothing3DPreview.seekFinaleFrame(t),at);
  assert(shot.stageScene===stage&&shot.stageHasLedSquares===hasLeds,
   "Wrong stage/side LED design at "+at+"s: "+JSON.stringify(shot));
  if(process.env.NH_CAPTURE_FINALE_SWEEP==="1"&&
   [34.25,59.7,79.5,130.98,134.61].includes(at))
   await page.locator("#stage canvas").screenshot({
    path:"test-results/backdrop-"+at.toFixed(2)+".png",timeout:45000
   });
 }
 console.log("PASS: selected LED square scenes, colored former white/black cues and final still hold");
 // Post-music-only end card: the real single duck must first lay one
 // modeled egg, waddle off, and leave an actual accessible click target.
 const eggAtCrouch=await page.evaluate(()=>
  window.__nothing3DPreview.seekFinaleEgg(.70));
 assert(eggAtCrouch.postlude?.duckCrouching&&
  !eggAtCrouch.postlude.eggVisible,
  "The original duck must crouch IN PLACE before its egg appears");
 const eggAtLay=await page.evaluate(()=>
  window.__nothing3DPreview.seekFinaleEgg(1.2));
 assert(eggAtLay.postlude?.eggVisible&&!eggAtLay.postlude.eggClickable&&
  eggAtLay.postlude.eggScale>=.22&&eggAtLay.postlude.eggScale<.34&&
  eggAtLay.postlude.eggGrowProgress===0&&
  eggAtLay.postlude.sameDuck&&!eggAtLay.postlude.duckGone&&
  eggAtLay.postlude.duckCrouching&&
  eggAtLay.postlude.eggDropProgress>.15&&
  eggAtLay.postlude.eggDropProgress<1&&
  eggAtLay.postlude.eggAndDuckSameLane&&
  eggAtLay.postlude.eggUnderDuckTail&&
  eggAtLay.postlude.duckSideFacingToLay&&
  Math.abs(eggAtLay.postlude.eggHorizontalCenterOffset)<.02&&
  eggAtLay.postlude.duckHorizontalCenterOffset>.38&&
  eggAtLay.postlude.duckHorizontalCenterOffset<.8,
  "The duck must VISIBLY crouch and lay an egg in the CENTER, not "+
   "spawn it beside itself: "+JSON.stringify(eggAtLay.postlude));
 if(process.env.NH_CAPTURE_FINALE_SWEEP==="1")
  await page.locator("#stage canvas").screenshot({
   path:"test-results/egg-laying-center.png",timeout:45000
  });
 const laid=await page.evaluate(()=>
  window.__nothing3DPreview.seekFinaleEgg(1.55));
 assert(laid.postlude?.eggGrounded&&
  laid.postlude.eggDropProgress===1&&
  laid.postlude.eggAndDuckSameLane&&
  laid.postlude.eggUnderDuckTail&&
  laid.postlude.duckSideFacingToLay&&
  laid.postlude.eggScale<.35,
  "The egg must land clearly beneath the sideways duck's tail before walking");
 if(process.env.NH_CAPTURE_FINALE_SWEEP==="1")
  await page.locator("#stage canvas").screenshot({
   path:"test-results/egg-laid-on-ground.png",timeout:45000
  });
 const eggWalking=await page.evaluate(()=>
  window.__nothing3DPreview.seekFinaleEgg(2.5));
 assert(eggWalking.postlude?.duckWalkingAway&&
  eggWalking.postlude.eggScale>laid.postlude.eggScale&&
  eggWalking.postlude.eggScale<.6&&
  !eggWalking.postlude.eggClickable&&
  eggWalking.postlude.walkLegAngles.length===2&&
  Math.abs(eggWalking.postlude.walkLegAngles[0])>.08&&
  eggWalking.postlude.walkLegAngles[0]*eggWalking.postlude.walkLegAngles[1]<0,
  "The original duck must swing its attached feet while waddling away");
 const eggWaiting=await page.evaluate(()=>
  window.__nothing3DPreview.seekFinaleEgg(5.0));
 assert(eggWaiting.postlude?.postludePhase==="egg"&&
  eggWaiting.postlude.eggScale>=.99&&
  eggWaiting.postlude.eggGrowProgress===1&&
  eggWaiting.postlude.eggVisible&&eggWaiting.postlude.eggShaking&&
  eggWaiting.postlude.eggClickable&&eggWaiting.postlude.duckGone&&
  eggWaiting.postlude.eggHairlineCrackVisible,
  "The shaking 3D egg must wait for a deliberate player click");
 const eggWobbleLater=await page.evaluate(()=>
  window.__nothing3DPreview.seekFinaleEgg(5.19));
 assert(Math.abs(eggWobbleLater.postlude.eggWobble-
  eggWaiting.postlude.eggWobble)>.005,
  "The egg must physically wobble, not only report eggShaking=true");
 // A cracked egg should NOT instantly turn into two smoothly cut
 // hemispheres. Its fracture grows across the real shell, the jagged top
 // peels back, and two tiny pieces fall to rest beside the lower cup.
 const hairline=await page.evaluate(t=>
  window.__nothing3DPreview.seekFinaleEggCrack(t),.085);
 assert(hairline.postlude?.postludePhase==="cracking"&&
  hairline.postlude.eggCrackProgress>.25&&
  hairline.postlude.eggCrackProgress<.95&&
  !hairline.postlude.eggTopCapVisible,
  "Egg must show a developing surface crack BEFORE the shell separates: "+
   JSON.stringify(hairline.postlude));
 const openingShell=await page.evaluate(t=>
  window.__nothing3DPreview.seekFinaleEggCrack(t),.35);
 assert(openingShell.postlude?.eggJaggedSeamTeeth===40&&
  openingShell.postlude.eggShellThickness>.035&&
  openingShell.postlude.eggOpeningProgress>.25&&
  openingShell.postlude.eggBlackOutlineCount===2&&
  openingShell.postlude.eggBlackRimCount===2&&
  openingShell.postlude.eggBlackEdgeColor===0x17191e&&
  openingShell.postlude.eggCrackAnimationDuration<=1.1&&
  openingShell.postlude.eggTopCapTilt<-.20&&
  openingShell.postlude.eggTopCapVisible&&
  openingShell.postlude.eggLowerCupVisible&&
  openingShell.postlude.eggLowerShellStationary,
  "Top must hinge back around its irregular broken lip while the lower "+
   "cup stays on the floor: "+JSON.stringify(openingShell.postlude));
 if(process.env.NH_CAPTURE_FINALE_SWEEP==="1")
  await page.locator("#stage canvas").screenshot({
   path:"test-results/egg-jagged-opening.png",timeout:45000
  });
 const openedShell=await page.evaluate(t=>
  window.__nothing3DPreview.seekFinaleEggCrack(t),.9);
 assert(openedShell.postlude?.eggOpeningProgress===1&&
  openedShell.postlude.eggTopCapTilt< -2.1&&
  openedShell.postlude.eggFragmentCount===2&&
  openedShell.postlude.eggFragmentsRested&&
  openedShell.postlude.eggLowerShellStationary,
  "Broken shell cap and small chips must fall naturally, not float: "+
   JSON.stringify(openedShell.postlude));
 if(process.env.NH_CAPTURE_FINALE_SWEEP==="1")
  await page.locator("#stage canvas").screenshot({
   path:"test-results/egg-cracked-open.png",timeout:45000
  });
 // Restore the actual waiting egg to verify the real clickable control
 // and its normal end-card reveal still function after the visual sweep.
 await page.evaluate(()=>window.__nothing3DPreview.seekFinaleEgg(5.0));
 assert(await page.locator("#ncFinaleEgg").isVisible(),
  "Shaking egg has no accessible touch/keyboard hit target");
 const eggButton=page.locator("#ncFinaleEgg");
 await eggButton.hover();
 const eggUi=await page.evaluate(()=>{
  const b=document.getElementById("ncFinaleEgg");
  return {orangeRing:getComputedStyle(b).outlineStyle,
   centerX:parseFloat(b.style.left),
   labelText:b.textContent.trim()};
 });
 assert(eggUi.orangeRing==="none"&&
  Math.abs(eggUi.centerX-50)<5&&eggUi.labelText==="Tap the egg",
  "The old orange hover ring must be GONE and the final egg centered: "+
   JSON.stringify(eggUi));
 // Real keyboard modality makes :focus-visible apply; mouse hover
 // alone intentionally never draws another ring over the 3D egg.
 await page.keyboard.press("Tab");
 await eggButton.focus();
 assert(await eggButton.evaluate(b=>
  getComputedStyle(b.querySelector("span")).outlineStyle!=="none"),
  "Keyboard focus must remain visible on the egg's label");
 if(process.env.NH_CAPTURE_FINALE_SWEEP==="1")
  await page.locator("#stage canvas").screenshot({
   path:"test-results/egg-centered-final.png",timeout:45000
  });
 await eggButton.click({timeout:10000});
 await page.waitForFunction(()=>
  window.__nothing3DPreview.completionFinale.duck.postlude?.endMessageVisible,
  null,{timeout:5000,polling:100});
 const endingText=await page.locator("#ncFinaleEndCard").innerText();
 assert.match(endingText,/YOU FOUND/);
 assert.match(endingText,/SOMETHING[.]/);
 assert.match(endingText,/woah[.][.][.]/);
 assert.match(endingText,/THE END[.]/);
 assert(await page.locator("#ncFinaleEgg").isHidden(),
  "The egg stayed clickable after being cracked");
 console.log("PASS: duck lays egg, walks away, shaking egg clicks into final message");
 // Re-enter the music sweep before existing audio regression tests.
 await page.evaluate(()=>window.__nothing3DPreview.seekFinaleFrame(2));
 // Verify the actual audible 150 BPM beat grid, not a fixed
 // 5-video-frame rotation rate. Every .400s musical kick-to-kick interval
 // completes exactly TWO yaw turns, with a faster musical downbeat accent.
 const t0=await page.evaluate(t=>window.__nothing3DPreview.seekFinaleFrame(t),1.64);
 const kick=await page.evaluate(t=>window.__nothing3DPreview.seekFinaleFrame(t),1.68);
 const off=await page.evaluate(t=>window.__nothing3DPreview.seekFinaleFrame(t),1.84);
 const offEnd=await page.evaluate(t=>window.__nothing3DPreview.seekFinaleFrame(t),1.88);
 const tBeat=await page.evaluate(t=>window.__nothing3DPreview.seekFinaleFrame(t),2.04);
 assert(Math.abs(tBeat.actualRotations.y-t0.actualRotations.y-4*Math.PI)<.04&&
  kick.actualRotations.y-t0.actualRotations.y>
   (offEnd.actualRotations.y-off.actualRotations.y)*1.25,
  "Duck must complete full revolutions ON the soundtrack beat: "+
   JSON.stringify({t0,kick,off,offEnd,tBeat}));
 const strobePeak=await page.evaluate(t=>
  window.__nothing3DPreview.seekFinaleFrame(t),34.04);
 const strobeRest=await page.evaluate(t=>
  window.__nothing3DPreview.seekFinaleFrame(t),34.19);
 assert(strobePeak.sourceTimedHardStrobe>.85&&
  strobeRest.sourceTimedHardStrobe<.40,
  "Beat-synced strobe should make short hard white cuts, not slow glow: "+
   JSON.stringify({strobePeak:strobePeak.sourceTimedHardStrobe,
    strobeRest:strobeRest.sourceTimedHardStrobe}));
 // The old code used wall time when the MP3 buffered, letting the mascot
 // spin in silence. Simulate that condition with no finale audio running.
 const pending=await page.evaluate(()=>
  window.__nothing3DPreview.testFinalePendingAudio());
 assert(pending?.duck&&pending.waitingForSoundtrack&&
  !pending.soundtrackStarted&&
  !pending.spinBeforeMusic&&pending.actualRotations.y===0,
  "Duck spun before the music clock was allowed to start: "+
   JSON.stringify(pending));
 await page.waitForTimeout(320);
 const stillWaiting=await page.evaluate(()=>
  window.__nothing3DPreview.completionFinale.duck);
 assert(stillWaiting.waitingForSoundtrack&&!stillWaiting.soundtrackStarted&&
  !stillWaiting.spinBeforeMusic&&stillWaiting.actualRotations.y===0&&
  stillWaiting.elapsedSeconds===0,
  "Duck advanced its first spin while audio was buffering: "+
   JSON.stringify(stillWaiting));
 // A real MP3 may end between two render frames: the media playhead
 // returns null, but the show must still finish instead of running forever.
 await page.evaluate(()=>{
  const audio=window.NothingHereAudio;
  window.__finaleClockBeforeTest=audio.getFinaleClock;
  window.__finaleStateBeforeTest=audio.getState;
  audio.getFinaleClock=()=>2;
 });
 await page.waitForFunction(()=>
  window.__nothing3DPreview.completionFinale.duck.soundtrackStarted,
  null,{timeout:3500,polling:80});
 // The audio stopped BEFORE the song finished (Music Off, tab hidden,
 // or buffering). A mid-spin duck must immediately face front and hold
 // its timestamp, not keep turning while the speakers are silent.
 await page.evaluate(()=>{
  window.NothingHereAudio.getFinaleClock=()=>null;
  window.NothingHereAudio.getState=()=>
   ({finalePlaying:true,finaleEnded:false});
 });
 await page.waitForFunction(()=>{
  const duck=window.__nothing3DPreview.completionFinale.duck;
  return !duck.soundtrackStarted&&
   duck.elapsedSeconds>=1.99&&duck.elapsedSeconds<=2.01&&
   duck.actualRotations.y===0;
 },null,{timeout:3500,polling:80});
 const pausedDuck=await page.evaluate(()=>
  window.__nothing3DPreview.completionFinale.duck);
 await page.waitForTimeout(180);
 const stillPaused=await page.evaluate(()=>
  window.__nothing3DPreview.completionFinale.duck);
 assert(stillPaused.elapsedSeconds===pausedDuck.elapsedSeconds&&
  stillPaused.actualRotations.y===0,
  "Duck continued to spin while the audio transport was silent");
 // Once the real score resumes, jump to its current beat, not wall time.
 await page.evaluate(()=>{
  window.NothingHereAudio.getFinaleClock=()=>2.40;
 });
 await page.waitForFunction(()=>{
  const duck=window.__nothing3DPreview.completionFinale.duck;
  return duck.soundtrackStarted&&duck.elapsedSeconds>=2.399&&
   Math.abs(duck.actualRotations.y)>.01;
 },null,{timeout:3500,polling:80});
 await page.evaluate(()=>{
  window.NothingHereAudio.getFinaleClock=()=>null;
  window.NothingHereAudio.getState=()=>({finalePlaying:false});
 });
 await page.waitForFunction(()=>{
  const show=window.__nothing3DPreview.completionFinale.duck;
  return !show.dancing&&show.elapsedSeconds>=134.64;
 },null,{timeout:3500,polling:80});
 await page.evaluate(()=>{
  window.NothingHereAudio.getFinaleClock=window.__finaleClockBeforeTest;
  window.NothingHereAudio.getState=window.__finaleStateBeforeTest;
  delete window.__finaleClockBeforeTest;
  delete window.__finaleStateBeforeTest;
 });
 console.log("PASS: audio ending between frames does not hang the duck finale");
 const electric=await page.evaluate(t=>
  window.__nothing3DPreview.seekFinaleFrame(t),78.04);
 assert(electric.stageScene===12&&electric.sourceTimedHardStrobe>.85,
  "The former gray interlude needs an electric laser strobe: "+
   JSON.stringify(electric));
 console.log("PASS: Classic duck holds still before music and gray cut is gone");
 // The duck must COMPLETELY leave the upright box before any wall
 // rotation or opening-frame translation begins. Earlier versions moved
 // the cube at 3.1s although the duck was still rising until 5.05s.
 const openingTimes=[1.2,2.3,4.55,6.8,8.75,9.32,9.66];
 const opening=[];
 for(const time of openingTimes){
  const sample=await page.evaluate(t=>
   window.__nothing3DPreview.seekFinaleOpening(t),time);
  assert(sample?.phase==="opening",
   "The duck reveal must occur BEFORE the soundtrack starts: "+
    JSON.stringify({time,sample}));
  opening.push(sample);
  if(process.env.NH_CAPTURE_FINALE_SWEEP==="1"&&
    [2.3,4.55,6.8,9.32].includes(time)){
   await page.waitForTimeout(350);
   await page.locator("#stage canvas").screenshot({
    path:"test-results/video-reference-emergence-"+time+".png",timeout:45000
   });
  }
 }
 // Every original brass rail/corner remains attached and visible during
 // the FULLY folded entrance, including after the old 1.40-second cut.
 for(const [i,sample] of opening.entries()){
  const attachment=await page.evaluate(()=>
   window.__nothing3DPreview.finaleBatchAttachmentAudit);
  assert(attachment.allFollowPanels&&
   attachment.total===batchBefore.attachment.total,
   "Some combined detail detached from its panel at "+
    openingTimes[i]+"s: "+JSON.stringify(attachment));
  assert(sample.originalFramePreserved&&
   sample.originalFramePieceCount>=20&&
   sample.originalFrameAttachedCount===sample.originalFramePieceCount&&
   sample.originalFrameVisibleCount===sample.originalFramePieceCount&&
   sample.rigidCubeOrphanCount===0,
   "The original frame disappeared/replaced at "+
   openingTimes[i]+"s: "+JSON.stringify(sample));
 }
 assert(!opening[0].catRisingFromBox&&
  opening[0].openingLidAngle>.8&&opening[0].openingSideAngle<.05,
  "Lid must open before the duck appears");
 assert(opening[1].catRisingFromBox&&opening[1].catRevealedBeforeT&&
  opening[1].openingLidAngle>1.4&&
  opening[1].openingSideAngle<.05&&
  opening[1].cat.emergenceBackgroundHidden&&
  opening[1].cat.emergenceSameRig&&
  opening[1].cat.distinctCatModels===1&&
  opening[1].cat.actualRotations.y===0,
  "Single 3D duck must rise out of the stationary box: "+
   JSON.stringify(opening[1]));
 assert(opening[1].cat.emergenceLipClearance<.31&&
  opening[1].cat.emergenceHorizontalProgress===0,
  "Early emergence should remain inside the box opening");
 assert(opening[2].entranceProgress>=.999&&
  opening[2].openingSideAngle<.01&&
  Math.abs(opening[2].openingCubeTilt)<.01&&
  opening[2].cat.emergenceHorizontalProgress===0&&
  opening[2].cat.emergenceLipClearance>.50&&
  opening[2].duckRootClearanceOverFrontRim>.38&&
  opening[2].cat.emergenceHeadScreenY<.84,
  "Duck must fully clear the physical FRONT wall while the cube is "+
   "upright and BEFORE unfolding starts: "+
   JSON.stringify(opening[2]));
 assert(opening[3].openingSideAngle>.3&&
  opening[3].openingCubeTilt<-.25&&
  opening[3].cat.emergenceHorizontalProgress>.10&&
  opening[3].duckRootClearanceOverFrontRim>.15&&
  opening[3].cat.emergenceScale<.72&&
  opening[3].cat.emergenceHeadScreenY<.84,
  "Cube should unfold only after duck is outside, and never intersect "+
   "the real front lip: "+JSON.stringify(opening[3]));
 assert(opening[4].entranceProgress>=.999&&
  opening[4].openingSideAngle>1.50&&
  opening[4].cat.emergenceHorizontalProgress>.99&&
  opening[4].duckRootClearanceOverFrontRim>.15&&
  opening[4].cat.emergenceScale>.78&&
  opening[4].cat.actualRotations.y===0,
  "Duck must finish outside the unfolded T without clipping: "+
   JSON.stringify(opening[4]));
 assert(opening[5].netOpacity>.05&&opening[5].netOpacity<.95&&
  opening[5].netFadeTechnique==="opaque-solid-wipe"&&
  opening[5].netClipActive&&opening[5].netClippedMaterialCount>10&&
  opening[5].netAlteredTransparencyCount===0&&
  opening[6].netOpacity<.005&&
  opening[6].netAlteredTransparencyCount===0,
  "Complete six-panel sculpture should dissolve only AFTER unfolding, "+
  "and be gone before green backdrop appears: "+
  JSON.stringify({atTransition:opening[5],beforeMusic:opening[6]}));
 // Reproduce the cropped short viewport from the reported screenshots.
 // The duck must fit INSIDE the actual canvas rather than only on desktop.
 await page.setViewportSize({width:580,height:430});
 await page.waitForTimeout(250);
 await page.evaluate(()=>window.__nothing3DPreview.seekFinaleOpening(4.54));
 const shortViewport=await page.evaluate(()=>
  window.__nothing3DPreview.seekFinaleOpening(4.55));
 assert(shortViewport.cat.emergenceHeadScreenY<.84&&
  shortViewport.cat.emergenceHeadScreenY>-.85&&
  shortViewport.duckRootClearanceOverFrontRim>.38,
  "Duck head is cropped off the short game canvas, or the feet intersect "+
   "the front lip: "+JSON.stringify(shortViewport));
 await page.setViewportSize({width:1000,height:720});
 console.log("PASS: duck stays on-screen at short viewport; T fades before neon");
 console.log("PASS: one shared duck, synchronized moon fade and wormhole strobes");
 console.log("PASS: full-video 3D reference sweep",JSON.stringify(renderResults));
 assert.deepEqual(errors,[],"Browser errors in final-mile scene");
 console.log("PASS: restored 60/60 finale has all six textures and a real 3D cat");
}finally{
 await browser.close();
}
