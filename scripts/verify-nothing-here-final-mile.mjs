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
 await page.reload({waitUntil:"domcontentloaded",timeout:45000});
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
  finish.cat?.real3D&&finish.cat.meshCount>0&&finish.cat.visible&&
  Math.abs(finish.cat.durationSeconds-134.699)<.001,
  "Completed finale lost textured panels or genuine 134.7s 3D cat");
 assert.deepEqual(new Set((await state()).seen),new Set(sixty),
  "Finale save migration lost earned secrets");
 assert.deepEqual(errors,[],"Browser errors in final-mile scene");
 console.log("PASS: restored 60/60 finale has all six textures and a real 3D cat");
}finally{
 await browser.close();
}
