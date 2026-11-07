// Fast, real-Chromium WebGL startup gate for Nothing Here.
// Code parsing is not enough: the previous maze rewrite parsed cleanly but
// crashed while constructing a curved wall. This deliberately waits until
// the full 3D scene has initialized, in both fresh and saved-player states.
//
// Run from repo root with a static server at http://127.0.0.1:4173:
//   node scripts/verify-nothing-here-startup.mjs
// Requires Playwright Chromium. Never connects to a live Crilo account.
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const base=process.env.NOTHING_HERE_TEST_URL||
 "http://127.0.0.1:4173/secrets.html";
const savedKey="crilo_nothing_here_cube_v3";
await mkdir("test-results",{recursive:true});

const cases=[
 {label:"fresh-desktop",viewport:{width:1280,height:850},seed:null},
 {label:"saved-mobile",viewport:{width:390,height:844},
  seed:{seen:["first"],gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}},
 // The former drawer aura was visible while the actual key was concealed
 // behind the solid lavender faceplate. Verify its *raycast*, not just that
 // the mesh exists or that a purple glow was drawn in the scene.
 {label:"lavender-open-desktop",viewport:{width:1280,height:850},
  seed:{seen:["first","drawer"],a:true,drawerTaken:false,
   gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}},
 {label:"observatory-open-desktop",viewport:{width:1280,height:850},
  seed:{seen:["first","observatory"],top:true,pipeTaken:true,
   observatoryRaised:true,observed:false,
   telescopeLensMounted:false,telescopeIrisMounted:false,
   // Holding this optical piece should mark the front lens, not the dome.
   pocket:["lens"],
   gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}},
 {label:"held-coin-guidance",viewport:{width:1280,height:850},
  seed:{seen:["first","mouse","bag","machine"],mouse:true,
   bag:true,machine:true,pocket:["coin"],pendingPickups:[],
   gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}}
];
const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--enable-webgl","--use-gl=angle",
 "--use-angle=swiftshader","--enable-unsafe-swiftshader"
]});
let failed=false;
try{
 for(const check of cases){
  const context=await browser.newContext({
   viewport:check.viewport,
   reducedMotion:check.label==="held-coin-guidance"?"no-preference":"reduce"
  });
  const errors=[];
  const page=await context.newPage();
  page.on("pageerror",error=>errors.push("uncaught JS: "+error.message));
  page.on("console",message=>{
   if(message.type()==="error"&&/nothing here:|uncaught|three\.js|webgl/i.test(message.text()))
    errors.push("console: "+message.text().slice(0,380));
  });
  page.on("requestfailed",request=>{
   const url=request.url();
   if(/secrets-3d-|cube-secrets\.js|three@|gsap@/.test(url))
    errors.push("failed request: "+url+" — "+request.failure()?.errorText);
  });
  // Auth header scripts must not access real accounts during QA. The
  // live 3D scene and its Three.js/GSAP dependency imports remain REAL.
  const mock=`window.supabase={createClient:()=>({
   auth:{getSession:async()=>({data:{session:null},error:null}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
    signOut:async()=>({error:null})},
   rpc:async()=>({data:null,error:null}),
   from:()=>({select(){return this},eq(){return this},order(){return this},
    in:async()=>({data:[],error:null}),
    limit:async()=>({data:[],error:null}),
    maybeSingle:async()=>({data:null,error:null})})
  })};`;
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*",
   route=>route.fulfill({status:200,contentType:"application/javascript",body:mock}));
  if(check.seed){
   await page.addInitScript(({key,data})=>{
    // This context has isolated browser storage. No production saves change.
    localStorage.setItem(key,JSON.stringify(data));
   },{key:savedKey,data:check.seed});
  }
  try{
   await page.goto(base,{waitUntil:"domcontentloaded",timeout:45000});
   // Fail quickly on the site's own error UI; never count a loaded HTML
   // page or an available WebGL canvas as a successfully initialized game.
   await page.waitForFunction(()=>
    window.__nothing3DPreview?.ready===true||
    !!document.getElementById("ncRetry3D"),
    null,{timeout:90000,polling:200});
   const result=await page.evaluate(()=>{
    const view=window.__nothing3DPreview;
    const canvas=document.querySelector("#stage canvas");
    const state=window.CriloNothingHereCube?.getState?.();
    const attachments=view?.physicalAttachmentAudit;
    return {
     ready:view?.ready===true,
     physical:document.body.classList.contains("nc-physical-ready"),
     retry:!!document.getElementById("ncRetry3D"),
     message:document.querySelector("#nc3DLoadDiagnostic code")?.textContent||"",
     status:document.getElementById("status")?.textContent||"",
     canvas:!!canvas&&canvas.width>0&&canvas.height>0,
     meshCount:view?.meshCount||0,
     mazeChannels:view?.physicalGearMaze?.networkChannels||0,
     mazeBall:view?.physicalGearMaze?{
      cell:view.physicalGearMaze.cell,
      haloAttached:view.physicalGearMaze.blackHaloAttached,
      haloDiameter:view.physicalGearMaze.blackHaloDiameter,
      markerParts:view.physicalGearMaze.movingMarkerParts,
      paleRemoved:view.physicalGearMaze.paleFollowerRemoved,
      goalStrokes:view.physicalGearMaze.visibleBlockedEdges
     }:null,
     ornaments:{
      routes:view?.engravedTrackAudit?.length||0,
      faces:[...new Set((view?.engravedTrackAudit||[]).map(x=>x.face))],
      visible:(view?.engravedTrackAudit||[]).reduce((n,x)=>n+x.count,0),
      clearance:view?.trimClearanceAudit?.okay
     },
     mounts:attachments?{
      okay:attachments.okay,issues:attachments.issues,
      wheels:attachments.wheels.length,fixed:attachments.fixed.length,
      miniatures:attachments.miniatures.length,
      figures:attachments.figures?.length||0,
      frontLens:attachments.lens?.barrelRetained,
      exceptions:attachments.intentionalExceptions
     }:null,
     progress:state?{cell:state.gearMazeCell,solved:state.gearMazeSolved,
      played:state.gearMazePlayed}:null
    };
   });
   assert(result.ready&&result.physical&&!result.retry&&result.canvas&&
    result.meshCount>80&&result.mazeChannels>0,
    "The real WebGL game did not initialize: "+JSON.stringify(result));
   assert(result.mazeBall?.haloAttached&&result.mazeBall?.paleRemoved&&
    result.mazeBall.markerParts===2&&
    Math.abs(result.mazeBall.haloDiameter-.036)<.0001,
    "Maze marble must have one moving black halo and no leftover pale pin: "+
     JSON.stringify(result.mazeBall));
   assert(result.mounts?.okay&&result.mounts.wheels>=2&&
    result.mounts.fixed>=12&&result.mounts.miniatures>=15&&
    result.mounts.figures===15&&result.mounts.frontLens===true,
    "Mechanical attachment QA failed: "+JSON.stringify(result.mounts));
   const eye=await page.evaluate(()=>{
    const view=window.__nothing3DPreview;
    return {parts:view?.rearEyeReliefAudit||[],
     mounts:view?.miniatureControlClearanceViolations||[]};
   });
   assert(eye.parts.length>=24,
    "Green eye side lost its inset panels and physical connections");
   // Verify actual rendered back-face cosmetic bounds against every puzzle
   // and all three future miniature stands, not a blanket 'no overlaps'.
   const protectedRear=[
    {name:"live eye",x:0,y:-.18,w:1.48,h:.77},
    {name:"iris adjustment",x:1.055,y:-1.095,w:.49,h:.725},
    {name:"symbol cassette",x:-.93,y:-1.25,w:.86,h:.29},
    {name:"revealed eye inscription",x:.075,y:-1.395,w:.755,h:.19},
    ...[[-1.16,.73],[0,1.09],[1.16,.73]].map(([x,y])=>
     ({name:"miniature holder",x,y:y+.10,w:.56,h:.48}))
   ];
   for(const part of eye.parts)for(const zone of protectedRear){
    const dx=Math.abs(part.x-zone.x)-(part.w+zone.w)/2;
    const dy=Math.abs(part.y-zone.y)-(part.h+zone.h)/2;
    assert(dx>=.016||dy>=.016,
     "Green eye detail "+part.name+" clips "+zone.name);
   }
   assert.equal(result.ornaments.routes,46,
    "The ornate black/gold second-tier border was removed from a face");
   assert.equal(result.ornaments.faces.length,6,
    "Every cube side needs its individual restored inlay system");
   assert(result.ornaments.visible>=45&&result.ornaments.clearance,
    "Restored tracks are either absent or cross real hardware: "+
     JSON.stringify(result.ornaments));
   if(check.seed){
    assert.equal(result.progress?.cell,check.seed.gearMazeCell,
     "Loading the 3D scene corrupted the saved maze position");
    assert.equal(result.progress?.solved,false,
     "Loading a saved game incorrectly marked the maze complete");
   }
   if(check.label==="lavender-open-desktop"){
    await page.evaluate(()=>window.__nothing3DPreview.setRotation(30,0));
    await page.waitForFunction(()=>
     window.__nothing3DPreview.drawerPositions.front>.55,
     null,{timeout:20000});
    await page.waitForTimeout(280);
    const key=await page.evaluate(()=>{
     const scene=window.__nothing3DPreview;
     return {layout:scene.lavenderDrawerItemAudit,
      target:scene.projectOriginalPickup("tooth"),
      rays:scene.debugLavenderPickupRays};
    });
    assert(key.layout?.drawerOpen&&key.layout.keyVisible&&
      key.layout.keyInDrawer&&key.layout.seatOnFloor&&
      key.layout.pending&&key.layout.keyScale>=1.1&&
      key.layout.glow?.active,
      "Key must be seated in the opened lavender drawer: "+JSON.stringify(key));
    assert.equal(key.target?.pick,"pickup:tooth",
     "Real mouse raycast cannot reach the key in the open drawer: "+
      JSON.stringify(key));
   }
   if(check.label==="held-coin-guidance"){
    // Players must find the correct face themselves. Choosing a coin
    // from the opposite side must NOT rotate the cube or give away the
    // answer. After manually turning it, the green fitting persists.
    await page.evaluate(()=>window.__nothing3DPreview.setRotation(-13,180));
    await page.locator('#ncInventory [data-item="coin"]').click();
    await page.waitForFunction(()=>
     window.__nothing3DPreview?.selectedItemFlashAudit?.selected==="coin",
     null,{timeout:25000});
    await page.waitForTimeout(300);
    const beforeTurn=await page.evaluate(()=>({
     guide:window.__nothing3DPreview.selectedItemFlashAudit,
     rotation:window.__nothing3DPreview.cubeRotationDegrees
    }));
    assert(Math.abs(beforeTurn.rotation.ry-180)<.01,
     "Selecting an item rotated the cube without player input: "+
      JSON.stringify(beforeTurn));
    assert(!beforeTurn.guide.targets.includes("thing:machine"),
     "The wrong-side view exposed a hidden fitting");
    await page.evaluate(()=>window.__nothing3DPreview.setRotation(-13,0));
    await page.waitForFunction(()=>{
     const v=window.__nothing3DPreview?.selectedItemFlashAudit;
     return v?.targets?.includes("thing:machine")&&v?.persistent;
    },null,{timeout:25000});
    const initial=await page.evaluate(()=>({
     guide:window.__nothing3DPreview.selectedItemFlashAudit,
     rotation:window.__nothing3DPreview.cubeRotationDegrees,
     anchors:window.__nothing3DPreview.selectedFitAnchorPositions
    }));
    assert(initial.guide.anchored&&initial.guide.inScene&&
     initial.guide.domOverlays===0&&initial.anchors.length>0,
     "Green ring must be attached to a real 3D fitting: "+
      JSON.stringify(initial));
    // Move the cube while the item is held: the ring's *local mesh*
    // coordinates must not change, but its world position must move WITH
    // the mechanism rather than floating somewhere on the screen.
    await page.evaluate(()=>window.__nothing3DPreview.setRotation(-13,24));
    await page.waitForTimeout(260);
    const turned=await page.evaluate(()=>({
     guide:window.__nothing3DPreview.selectedItemFlashAudit,
     anchors:window.__nothing3DPreview.selectedFitAnchorPositions
    }));
    for(const first of initial.anchors){
     const later=turned.anchors.find(x=>x.action===first.action);
     assert(later&&later.mesh===first.mesh&&later.anchored,
      "The glow detached from its original 3D fitting: "+
       JSON.stringify({first,later}));
     assert(first.local.every((n,i)=>Math.abs(n-later.local[i])<1e-8),
      "The green ring slipped on the physical fitting when the cube moved");
     const travelled=Math.hypot(...first.world.map((n,i)=>n-later.world[i]));
     assert(travelled>.025,
      "The guide stayed in screen space instead of rotating with the cube");
    }
    assert(turned.guide.domOverlays===0&&turned.guide.anchored,
     "Old drifting DOM indicators returned after rotation");
    await page.waitForTimeout(3350);
    const after=await page.evaluate(()=>
     window.__nothing3DPreview.selectedItemFlashAudit);
    assert(after.persistent&&after.visible>0&&
     after.targets.includes("thing:machine"),
     "Green compatible fitting must keep pulsing while held: "+JSON.stringify(after));
    await page.screenshot({
     path:"test-results/nothing-here-persistent-green-fitting.png",
     timeout:45000
    });
    await page.locator("#ncUnselect").click();
    assert.equal((await page.evaluate(()=>
     window.__nothing3DPreview.selectedItemFlashAudit)).visible,0,
     "Green fitting pulse stayed behind after clearing selection");
   }
   if(check.label==="fresh-desktop"){
    const audit=await page.evaluate(()=>window.__nothing3DPreview.observatoryClickAudit);
    assert(!audit.open&&audit.registered>=8&&audit.domeMeshes>=1&&
     audit.noInvisibleBox,
     "Closed observatory must only be clickable on its physical dome: "+
      JSON.stringify(audit));
   }
   if(check.label==="observatory-open-desktop"){
    // The dome aperture faces toward the FRONT of the top panel. At
    // x=90° the camera sees the opaque REAR shell, not the telescope
    // opening. Check real oblique player views that expose the instrument.
    let view=null;
    for(const [rx,ry] of [[40,0],[50,0],[58,0],[38,-18],[38,18]]){
     view=await page.evaluate(([x,y])=>{
      const scene=window.__nothing3DPreview;
      scene.setRotation(x,y);
      return {rx:x,ry:y,audit:scene.observatoryClickAudit,
       target:scene.projectObservatoryInstrument()};
     },[rx,ry]);
     if(view.target?.scopeHit)break;
    }
    assert(view.audit.open&&view.audit.registered>=8&&
     view.audit.domeMeshes>=1&&view.audit.noInvisibleBox,
     "Opened telescope barrel was not registered: "+JSON.stringify(view));
    assert(view.target?.scopeHit&&
     view.target.pick==="thing:telescope",
     "Pressing the actual exposed telescope does not reach its action: "+
      JSON.stringify(view));
    const bounds=await page.locator("#stage canvas").boundingBox();
    await page.mouse.click(bounds.x+view.target.x,bounds.y+view.target.y);
    await page.waitForFunction(()=>
     window.__nothing3DPreview.lastClickedAction==="thing:telescope",
     null,{timeout:8000});
    // The game narrates puzzle feedback in #ncNarrator, not the generic
    // 3D stage's persistent #status caption.
    const clue=await page.locator("#ncNarrator").textContent();
    assert(/optic|socket|telescope|sky|focus/i.test(clue||""),
     "Pressing the real telescope offered no useful text feedback: "+clue);
    await page.screenshot({path:"test-results/nothing-here-observatory-click.png",
     timeout:45000});
    // Holding the silver lens should pulse exactly at the objective's
    // optical axis, not at a random roof-panel raycast intersection.
    await page.locator('#ncInventory [data-item="lens"]').click();
    await page.waitForFunction(()=>window.__nothing3DPreview
     ?.selectedItemFlashAudit?.targets.includes("thing:telescope"),
     null,{timeout:25000});
    const align=await page.evaluate(()=>
     window.__nothing3DPreview.observatoryFitGuideAlignment);
    assert(align?.visible&&align.anchored&&align.error<1e-5&&
     Math.abs(align.local[0])<1e-8&&Math.abs(align.local[2])<1e-8,
     "Held lens indicator must be centered on the telescope glass: "+
      JSON.stringify(align));
    // Turning the cube changes the world location but not the optical
    // center in the telescope's own permanent local frame.
    await page.evaluate(([rx,ry])=>window.__nothing3DPreview
     .setRotation(rx,ry),[view.rx+4,view.ry+8]);
    await page.waitForTimeout(300);
    const turned=await page.evaluate(()=>
     window.__nothing3DPreview.observatoryFitGuideAlignment);
    assert(turned?.visible&&turned.anchored&&turned.error<1e-5,
     "Green target drifted off the objective when the cube turned: "+
      JSON.stringify(turned));
    await page.screenshot({path:"test-results/nothing-here-observatory-lens-fit.png",
     timeout:45000});
    await page.locator("#ncUnselect").click();
    assert.equal((await page.evaluate(()=>
     window.__nothing3DPreview.selectedItemFlashAudit)).visible,0,
     "Green observatory guide remained after putting the lens down");
   }
   assert.deepEqual(errors,[],"Browser reported errors during 3D startup");
   // Check the design at each physical angle, not merely a Three.js
   // geometry count. These six images expose stray stubs/ugly intersections.
   if(check.label==="fresh-desktop"){
    for(const [face,rx,ry] of [
      ["front",0,0],["right",0,-90],["back",0,180],
      ["left",0,90],["top",90,0],["bottom",-90,0]
    ]){
      await page.evaluate(([x,y])=>
        window.__nothing3DPreview.setRotation(x,y),[rx,ry]);
      await page.screenshot({
        path:"test-results/nothing-here-inlay-"+face+".png",
        timeout:45000
      });
    }
   }
   await page.screenshot({
    path:"test-results/nothing-here-startup-"+check.label+".png",
    timeout:45000
   });
   console.log("PASS: "+check.label+
    ", scene initialized, "+result.meshCount+" meshes and "+
    result.mazeChannels+" maze channels");
  }catch(error){
   failed=true;
   console.error("FAIL: "+check.label+"\n"+String(error));
   if(errors.length)console.error(errors.join("\n"));
   try{
    console.error("Page status:",await page.locator("#status").textContent());
    console.error("Page diagnostic:",
     await page.locator("#nc3DLoadDiagnostic code").textContent({timeout:1000}));
   }catch{}
   try{
    await page.screenshot({
     path:"test-results/nothing-here-startup-FAILED-"+check.label+".png",
     timeout:20000
    });
   }catch{}
  }finally{
   await context.close();
  }
 }
}finally{
 await browser.close();
}
if(failed)process.exitCode=1;
else console.log("PASS: 3D startup regression gate, fresh/saved/lavender drawer");
