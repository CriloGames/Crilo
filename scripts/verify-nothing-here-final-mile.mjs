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
 await page.reload({waitUntil:"domcontentloaded",timeout:45000});
 await ready();
 const finish=await page.evaluate(()=>window.__nothing3DPreview.completionFinale);
 assert(finish.phase==="open"&&finish.replay&&
  Object.keys(finish.panels).length===6&&finish.outerFrameHidden,
  "Completed save didn't reveal its actual unfolded T");
 assert(finish.reverseTexturedPanels===6&&
  finish.duck?.real3DDuck&&finish.duck.meshCount>0&&finish.duck.visible&&
  Math.abs(finish.cat.durationSeconds-134.699)<.001,
  "Completed finale lost textured panels or genuine 134.7s Crilo Classic duck");
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
 // The unfolded real T is present for the first note, dissolves over 1.8s,
 // then vanishes. The 3D cat remains anchored over its center and hovering.
 // The top-left moon is a ::after decoration. The same real music-clock
 // fade must reach both the box and the moon, not hide just the 3D mesh.
 await page.evaluate(()=>document.body.classList.add("nc-moon"));
 const fadeStages=[];
 for(const seconds of [0,.9,2.2]){
  const frame=await page.evaluate(t=>{
   const cat=window.__nothing3DPreview.seekFinaleFrame(t);
   const ending=window.__nothing3DPreview.completionFinale;
   return {cat,opacity:ending.netOpacity,done:ending.netFadeComplete,
    aligned:ending.duckCenteredOverBox,
    moon:+getComputedStyle(document.querySelector(".nc-world"),"::after").opacity,
    moonClock:+document.body.style.getPropertyValue("--nh-finale-moon-opacity")};
  },seconds);
  assert(frame?.aligned&&frame.cat?.hoveringOverBox&&frame.cat.duck,
   "Cat must stay centered and hovering over the open box at "+seconds+"s: "+
    JSON.stringify(frame));
  fadeStages.push(frame);
 }
 assert(fadeStages[0].opacity===1&&!fadeStages[0].done&&
  fadeStages[1].opacity>.05&&fadeStages[1].opacity<.95&&
  fadeStages[2].opacity===0&&fadeStages[2].done,
  "The T-shaped box must smoothly fade away when the music begins: "+
   JSON.stringify(fadeStages));
 assert(fadeStages.every(f=>Math.abs(f.moon-f.opacity)<.025&&
  Math.abs(f.moonClock-f.opacity)<.025),
  "Moon and T-shaped box do not fade together: "+JSON.stringify(fadeStages));
 await page.evaluate(()=>document.body.classList.remove("nc-moon"));
 console.log("PASS: unfolded box fades during first musical notes; duck stays centered");
 // Inspect the ENTIRE 134.7s visual choreography, not just the start and
 // end. The actual rendered Three.js meshes and shader uniforms must change
 // at the same timestamp as the uploaded 1080p reference video.
 const visualSamples=[
  [0,"front",0],[2,"loaf",0],[4,"front",0],[8.5,"loaf",0],
  [29,"front",1],[30.5,"loaf",1],[34,"loaf",2],
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
    Math.abs(actual.actualRotations.z)<.001,
    "The forward-facing duck should not be spinning at "+seconds);
  renderResults.push([seconds,pose,backdrop]);
  if(process.env.NH_CAPTURE_FINALE_SWEEP==="1"&&
   [0,2,34,68,91,123].includes(seconds)){
   await page.locator("#stage canvas").screenshot({
    path:"test-results/video-reference-"+String(seconds).padStart(3,"0")+".png",
    timeout:45000
   });
  }
 }
 // At 30fps the opening spin makes one full left-right revolution
 // every FIVE frames, with no change to the barrel/forward pitch.
 const t0=await page.evaluate(t=>window.__nothing3DPreview.seekFinaleFrame(t),1.6);
 const t1=await page.evaluate(t=>window.__nothing3DPreview.seekFinaleFrame(t),1.6+1/30);
 const t5=await page.evaluate(t=>window.__nothing3DPreview.seekFinaleFrame(t),1.6+5/30);
 assert(Math.abs(t1.actualRotations.y-t0.actualRotations.y-2*Math.PI/5)<.035&&
  Math.abs(t5.actualRotations.y-t0.actualRotations.y-2*Math.PI)<.035,
  "Duck yaw does not match the five-frame music spin cue: "+
   JSON.stringify({t0,t1,t5}));
 const strobePeak=await page.evaluate(t=>
  window.__nothing3DPreview.seekFinaleFrame(t),34.04);
 const strobeRest=await page.evaluate(t=>
  window.__nothing3DPreview.seekFinaleFrame(t),34.19);
 assert(strobePeak.sourceTimedHardStrobe>.85&&
  strobeRest.sourceTimedHardStrobe<.40,
  "Beat-synced strobe should make short hard white cuts, not slow glow: "+
   JSON.stringify({strobePeak:strobePeak.sourceTimedHardStrobe,
    strobeRest:strobeRest.sourceTimedHardStrobe}));
 // Replay the 60/60 completion with the NEW physical entrance sequence.
 // The lid must open BEFORE the duck rises, and side hinges must not form
 // the T until the same duck has visibly emerged from the box.
 const openingTimes=[1.2,2.3,4.3,5.65];
 const opening=[];
 for(const time of openingTimes){
  const sample=await page.evaluate(t=>
   window.__nothing3DPreview.seekFinaleOpening(t),time);
  assert(sample?.phase==="opening",
   "The duck reveal must occur BEFORE the soundtrack starts: "+
    JSON.stringify({time,sample}));
  opening.push(sample);
  if(process.env.NH_CAPTURE_FINALE_SWEEP==="1"&&
    [2.3,4.3].includes(time)){
   // Render at least one fresh on-demand WebGL frame after a paused seek.
   await page.waitForTimeout(350);
   await page.locator("#stage canvas").screenshot({
    path:"test-results/video-reference-emergence-"+time+".png",timeout:45000
   });
  }
 }
 assert(!opening[0].catRisingFromBox&&
  opening[0].openingLidAngle>.8&&opening[0].openingSideAngle<.05,
  "The box lid must open while the duck is still inside");
 assert(opening[1].catRisingFromBox&&opening[1].catRevealedBeforeT&&
  opening[1].openingLidAngle>1.4&&
  opening[1].openingSideAngle<.05&&
  opening[1].cat.emergenceBackgroundHidden&&
  opening[1].cat.emergenceSameRig&&
  opening[1].cat.distinctCatModels===1&&
  opening[1].cat.actualRotations.y===0,
  "One real cat must climb out of the open lid BEFORE any side unfolds: "+
   JSON.stringify(opening[1]));
 assert(opening[2].entranceProgress>.80&&
  opening[2].openingSideAngle>.3&&
  opening[2].cat.emergenceScale<.57&&
  opening[2].cat.actualRotations.y===0,
  "The T shape must begin AFTER the duck has substantially emerged: "+
   JSON.stringify(opening[2]));
 assert(opening[3].entranceProgress>=.999&&
  opening[3].openingSideAngle>1.50&&
  opening[3].cat.emergenceScale>.78&&
  opening[3].cat.actualRotations.y===0,
  "Cat should hover over a nearly-complete T before the music: "+
   JSON.stringify(opening[3]));
 console.log("PASS: open lid -> same duck rises -> T folds flat -> music fade");
 console.log("PASS: one shared duck, synchronized moon fade and wormhole strobes");
 console.log("PASS: full-video 3D reference sweep",JSON.stringify(renderResults));
 assert.deepEqual(errors,[],"Browser errors in final-mile scene");
 console.log("PASS: restored 60/60 finale has all six textures and a real 3D cat");
}finally{
 await browser.close();
}
