// Fast, real-Chromium WebGL startup gate for Nothing Here.
// Code parsing is not enough: the previous maze rewrite parsed cleanly but
// crashed while constructing a curved wall. This deliberately waits until
// the full 3D scene has initialized, in both fresh and saved-player states.
//
// Run from repo root with a static server at http://127.0.0.1:4173:
//   node scripts/verify-nothing-here-startup.mjs
// Requires Playwright Chromium. Never connects to a live Crilo account.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const base=process.env.NOTHING_HERE_TEST_URL||
 "http://127.0.0.1:4173/secrets.html";
const savedKey="crilo_nothing_here_cube_v3";
const catalogText=readFileSync("cube-secrets.js","utf8").split("const catalog=[")[1]
 .split("const title=new Map(catalog)")[0];
const peculiarities=[...catalogText.matchAll(/^\s*\['([^']+)',/gm)].map(match=>match[1]);
assert.equal(peculiarities.length,60,"Completion gate expects exactly 60 discoveries");
const allButDot=peculiarities.filter(id=>id!=="dot");
assert.equal(allButDot.length,59);
await mkdir("test-results",{recursive:true});

const cases=[
 {label:"fresh-desktop",viewport:{width:1280,height:850},seed:null},
 // A saved 60/60 game must unfold without replaying sounds or animations.
 {label:"finale-saved-mobile",viewport:{width:390,height:844},
  seed:{seen:peculiarities,plateOpen:true,door:true,doorOpen:true,
   pocket:[],pendingPickups:[],gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}},
 // The sixtieth TRUE discovery must start the finale in the same session.
 {label:"finale-last-discovery",viewport:{width:1280,height:850},
  seed:{seen:allButDot,redHits:0,
   pocket:["coin"],pendingPickups:[],gearMazePlayed:true,
   gearMazeLayoutVersion:6,gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}},
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
 // Both the sugar cube and the second-coin service key can await pickup.
 // Their two output sockets must remain seated on the moving vending tray.
 {label:"vending-two-rewards",viewport:{width:1280,height:850},
  seed:{seen:["first","mouse","bag","machine"],mouse:true,bag:true,
   machine:true,shimUsed:true,coinReturned:true,refundRedeemed:true,
   pendingPickups:["sugar","seal"],pocket:[],
   gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}},
 // Repro: flute plays correctly before the door is opened. Both the new
 // unlock and a previously saved unlock must let the player click the
 // visible wooden panel instead of hunting for a subpixel door knob.
 // Existing saves opened this hatch automatically on the third screw.
 // Keep those players' unlocked hinge and collected rewards intact.
 {label:"legacy-front-latch",viewport:{width:1280,height:850},
  seed:{seen:["first","fastener","faceplate"],screws:[0,1,2],
   plateOpen:true,pendingPickups:["cog"],pocket:[],
   gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}},
 {label:"flute-door-unlock",viewport:{width:1280,height:850},
  seed:{seen:["first","flute"],pocket:["flute"],
   gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}},
 {label:"saved-flute-door",viewport:{width:1280,height:850},
  seed:{seen:["first","flute","door"],pocket:["flute"],door:true,
   doorOpen:false,fluteNotes:[2,1,3,1,3,2],
   gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}},
 // An accessible maker-stamp elevator must not give away its fourth
 // floor just by pressing buttons. A real collar tag activates its reader.
 {label:"lift-requires-collar-tag",viewport:{width:1280,height:850},
  seed:{seen:["first","serial","tag"],serialRead:true,tag:true,
   pocket:["tag"],pendingPickups:[],
   gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}},
 // Do not retroactively lock an already-cleared fourth floor for players
 // with an old save from when the lift had no tag keyway.
 {label:"legacy-fourth-floor",viewport:{width:1280,height:850},
  seed:{seen:["first","serial","fourth"],serialRead:true,
   floorFour:true,pocket:[],pendingPickups:[],
   gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}},
 // Reproduce four real gameplay observations without a production
 // account: duplicate rain, a bell that rings forever, an invisible 04
 // stamp, and the apparently random purple portal rim.
 {label:"rain-bell-tag-portal",viewport:{width:1280,height:850},
  seed:{seen:["first","door","music","cloud","tag","portal","bell"],
   music:true,cloud:true,plant:true,tag:true,door:true,doorOpen:true,
   portal:true,redHits:4,pocket:["bell"],pendingPickups:["tag"],
   gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}},
 // Repro: old recovery resurrects a bell already attached to the dog's collar.
 // Both stale pocket ownership and pending pickups must be repaired on load.
 {label:"spent-bell-in-pocket",viewport:{width:1280,height:850},
  seed:{seen:["first","dot","bell","door","bark"],redHits:4,
   door:true,doorOpen:true,barked:true,bellUsed:true,
   pocket:["bell","coin"],pendingPickups:["tag"],
   gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}},
 {label:"spent-bell-in-tray",viewport:{width:1280,height:850},
  seed:{seen:["first","dot","bell","door","bark"],redHits:4,
   door:true,doorOpen:true,barked:true,bellUsed:true,
   pocket:["coin"],pendingPickups:["bell","tag"],
   gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}},
 // Existing users may have taken another drop *after* growing the tree.
 // Loading this specific impossible spare must not resurrect it.
 {label:"legacy-extra-raindrop",viewport:{width:1280,height:850},
  seed:{seen:["first","music","rain","tree","door","bark"],music:true,cloud:true,
   plant:true,tree:true,door:true,doorOpen:true,barked:true,
   pocket:["raindrop","bell"],pendingPickups:[],
   gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}},
 {label:"held-coin-guidance",viewport:{width:1280,height:850},
  seed:{seen:["first","mouse","bag","machine"],mouse:true,
   bag:true,machine:true,pocket:["coin"],pendingPickups:[],
   gearMazePlayed:true,gearMazeLayoutVersion:6,
   gearMazeCell:81,gearMazeSolved:false,gearMazeTurns:1}}
];
const onlyCases=new Set((process.env.NOTHING_HERE_ONLY_CASES||"").split(",").filter(Boolean));
const skipCases=new Set((process.env.NOTHING_HERE_SKIP_CASES||"").split(",").filter(Boolean));
const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--enable-webgl","--use-gl=angle",
 "--use-angle=swiftshader","--enable-unsafe-swiftshader"
]});
let failed=false;
try{
 for(const check of cases){
  if(onlyCases.size&&!onlyCases.has(check.label)||skipCases.has(check.label))continue;
  const context=await browser.newContext({
   viewport:check.viewport,
   reducedMotion:["held-coin-guidance","finale-last-discovery"].includes(check.label)
    ?"no-preference":"reduce"
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
    // Seed only an empty isolated test context. Subsequent page reloads
    // must restore the player's *updated* progress, not the original seed.
    if(localStorage.getItem(key)===null)
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
   if(check.label==="legacy-front-latch"){
    const legacy=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    assert(legacy.plateOpen&&legacy.screws.length===3&&
     legacy.pendingPickups.includes("cog"),
     "Older solved front hatches must stay open without re-pressing the pin");
    assert((await page.evaluate(()=>window.__nothing3DPreview.frontCogHatchPose)).open,
     "An earlier player's open front hatch was physically relocked");
    const pose=await page.evaluate(()=>window.__nothing3DPreview.frontSpringLatchPose);
    assert(pose.pressed&&pose.depth<.085&&pose.cue===0,
     "Old saved hatches must restore the depressed latch without relocking: "+JSON.stringify(pose));
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("front-screw-3"));
    const remembered=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    assert(remembered.plateOpen&&remembered.pendingPickups.includes("cog")&&
     remembered.seen.includes("false-screw"),
     "Old hatches must retain their gear and allow the previously missed pin discovery");
   }
   if(check.label==="fresh-desktop"){
    // Before the screws are removed, the captive pin depresses, but cannot
    // open the cover. Its response is mechanical, not a testing instruction.
    for(let i=0;i<2;i++){
     await page.evaluate(()=>window.__nothing3DPreview.clickAction("front-screw-3"));
     const narration=await page.locator("#ncNarrator").innerText();
     const state=await page.evaluate(()=>window.CriloNothingHereCube.getState());
     assert.match(narration,/corner pin springs back/i);
     assert.equal(state.falseScrewTurns,i+1,"Each physical press should animate");
     assert.deepEqual(state.screws,[],"The pin was treated as a removable screw");
     assert(!state.plateOpen,"The pin opened a still-bolted front cover");
    }
    const discovered=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    assert.equal(discovered.seen.filter(x=>x==="false-screw").length,1,
     "Repressing the pin must not duplicate its discovery");
    for(const n of [0,1,2])
     await page.evaluate(n=>window.__nothing3DPreview.clickAction("front-screw-"+n),n);
    const loose=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    assert(loose.screws.length===3&&!loose.plateOpen&&
     !loose.pendingPickups.includes("cog"),
     "Three screws must free but not open the spring-latched service hatch");
    assert.match(await page.locator("#ncNarrator").innerText(),
     /rounded corner pin still holds/i,
     "Player has no clue what holds the screw-free hatch");
    const armed=await page.evaluate(()=>window.__nothing3DPreview.frontSpringLatchPose);
    assert(armed.cue>.5&&!armed.pressed&&armed.depth>.12,
     "With screws removed, the real spring latch does not show it is ready: "+JSON.stringify(armed));
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("front-screw-3"));
    const unlatched=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    assert(unlatched.plateOpen&&unlatched.pendingPickups.includes("cog"),
     "The real corner pin did not release the openable hatch and cog");
    assert.match(await page.locator("#ncNarrator").innerText(),
     /stays depressed.*hatch swings open/i,
     "The final latch action has no clear physical feedback");
    const released=await page.evaluate(()=>window.__nothing3DPreview.frontSpringLatchPose);
    assert(released.pressed&&released.depth<.085&&released.cue===0,
     "Hatch release did not leave the physical pin depressed: "+JSON.stringify(released));
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("front-screw-3"));
    const afterRepeat=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    assert.equal(afterRepeat.falseScrewTurns,unlatched.falseScrewTurns,
     "A released pin must not keep triggering useless animations");
    assert(afterRepeat.plateOpen&&afterRepeat.pendingPickups.includes("cog"),
     "Pressing the already released latch damaged progress");
    await page.reload({waitUntil:"domcontentloaded",timeout:90000});
    await page.waitForFunction(()=>window.__nothing3DPreview?.ready&&
     document.body.classList.contains("nc-physical-ready"),{timeout:60000});
    const restored=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    assert(restored.plateOpen&&restored.pendingPickups.includes("cog"),
     "Reloading relocked a successfully released spring hatch");
   }
   if(check.label==="finale-saved-mobile"||
      check.label==="finale-last-discovery"){
    const before=await page.evaluate(()=>({
     game:window.CriloNothingHereCube.getState(),
     ending:window.__nothing3DPreview.completionFinale
    }));
    if(check.label==="finale-last-discovery"){
     assert(before.game.seen.length===59&&before.ending.phase==="idle"&&
      await page.locator("#ncFinaleBanner").isHidden(),
      "The finale began before the 60th discovery");
     await page.evaluate(()=>window.__nothing3DPreview.clickAction("dot"));
     const finished=await page.evaluate(()=>({
      game:window.CriloNothingHereCube.getState(),
      ending:window.__nothing3DPreview.completionFinale
     }));
     assert(finished.game.seen.length===60&&finished.game.seen.includes("dot"),
      "The final genuine peculiarity failed to count");
     console.log("FINALE TRIGGER",JSON.stringify(finished));
     try{
      await page.waitForFunction(()=>window.__nothing3DPreview.completionFinale.phase==="open",
       null,{timeout:36000,polling:250});
     }catch(error){
      const debug=await page.evaluate(()=>({
       game:window.CriloNothingHereCube.getState(),
       finale:window.__nothing3DPreview.completionFinale,
       audio:window.NothingHereAudio?.getState(),
       status:document.querySelector("#status")?.textContent
      }));
      throw new Error("60th discovery unfolding did not settle: "+
       JSON.stringify(debug),{cause:error});
     }
     assert((await page.evaluate(()=>
      window.__nothing3DPreview.completionFinale)).phase==="open",
      "The sixtieth discovery did not finish the real unfolding animation");
     assert(finished.game.pocket.includes("coin"),
      "Finale consumed a legitimate saved inventory item");
    }else{
     assert(before.game.seen.length===60&&before.ending.phase==="open",
      "A completed mobile save did not restore the unfolded cube");
    }
    const layout=await page.evaluate(()=>window.__nothing3DPreview.completionFinale);
    assert(layout.banner&&layout.replay&&layout.outerFrameHidden&&
     layout.centerFit&&layout.scale>=.18&&layout.scale<=.43,
     "The final scene is not properly visible: "+JSON.stringify(layout));
    const expected={front:[0,0],left:[-3.22,0],right:[3.22,0],
     bottom:[0,-3.22],back:[0,-6.44],top:[0,-9.66]};
    for(const [side,[x,y]] of Object.entries(expected)){
     const center=layout.panels?.[side];
     assert(center&&Math.abs(center.x-x)<.05&&
      Math.abs(center.y-y)<.05&&center.normal>.98,
      "The cube did not form a real flat T, panel "+side+": "+JSON.stringify(center));
    }
    const headline=await page.locator("#ncFinaleBanner h2").innerText();
    assert.equal(headline,"You found all secrets!");
    assert(await page.locator("#ncFinaleReplay").isVisible(),
     "A completed run has no replayable ending");
    await page.locator("#ncFinaleReplay").click();
    console.log("FINALE REPLAY STARTED",check.label);
    try{
     await page.waitForFunction(()=>window.__nothing3DPreview.completionFinale.phase==="open",
      null,{timeout:36000,polling:250});
    }catch(error){
     const debug=await page.evaluate(()=>({
      finale:window.__nothing3DPreview.completionFinale,
      audio:window.NothingHereAudio?.getState()
     }));
     throw new Error("Watch again did not finish: "+JSON.stringify(debug),{cause:error});
    }
    assert.equal(await page.evaluate(()=>
     window.__nothing3DPreview.completionFinale.phase),"open",
     "Watch again failed to replay the unfolding sequence");
    await page.reload({waitUntil:"domcontentloaded",timeout:90000});
    await page.waitForFunction(()=>window.__nothing3DPreview?.ready&&
     document.body.classList.contains("nc-physical-ready"),{timeout:60000});
    assert.equal(await page.evaluate(()=>
     window.__nothing3DPreview.completionFinale.phase),"open",
     "Reload lost the completed T-shaped display");
    assert.equal((await page.evaluate(()=>
     window.CriloNothingHereCube.getState())).seen.length,60,
     "Ending changed the saved discovery catalog");
    await page.locator("#stage canvas").screenshot({
     path:"test-results/nothing-here-finale-"+check.label+".png",timeout:60000});
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
   if(check.label==="flute-door-unlock"||
      check.label==="saved-flute-door"){
    const before=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    assert(!before.doorOpen,"Flute-door test unexpectedly started with the door open");
    if(check.label==="flute-door-unlock"){
     // The physical flute remains playable until the full six-note score
     // unlocks a real door; the door itself must still be pressed to open.
     assert(before.pocket.includes("flute")&&!before.door,
      "New flute scenario lost the unsolved instrument");
     await page.evaluate(()=>window.__nothing3DPreview.clickAction("thing:door"));
     assert.equal((await page.evaluate(()=>window.CriloNothingHereCube.getState())).doorOpen,
      false,"Touching a still-locked door bypassed its melody");
     for(const key of [2,1,3,1,3,2])
      await page.evaluate(key=>window.CriloNothingHereCube.activatePhysicalFluteNote(key),key);
     const afterSong=await page.evaluate(()=>window.CriloNothingHereCube.getState());
     assert(afterSong.door&&!afterSong.doorOpen,
      "The correct melody must unlock, but not open, the physical door");
     assert(!afterSong.pocket.includes("flute")&&
       !afterSong.pendingPickups.includes("flute"),
      "Completed flute must be consumed instead of staying in inventory");
    }else{
     assert(before.door&&!before.pocket.includes("flute")&&
       !before.pendingPickups.includes("flute"),
      "Legacy completed saves must discard their already-used flute");
    }
    assert.equal(await page.evaluate(()=>
     window.__nothing3DPreview.physicalFluteVisible),false,
     "The physical flute should disappear after the correct code");
    assert(await page.locator('#ncInventory [data-item="flute"]').count()===0&&
      await page.locator("#ncFluteTray").isHidden(),
     "Completed flute or its controls remained on screen");
    await page.evaluate(()=>window.CriloNothingHereCube.activatePhysicalFluteNote(2));
    assert.deepEqual((await page.evaluate(()=>
      window.CriloNothingHereCube.getState())).fluteNotes,[2,1,3,1,3,2],
     "Playing a spent flute changed the saved melody");
    // The visible door panel uses the same raycast action as a real click.
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("thing:door"));
    const opened=await page.evaluate(()=>({
     state:window.CriloNothingHereCube.getState(),
     scene:window.__nothing3DPreview.physicalScenePose
    }));
    assert(opened.state.doorOpen&&opened.scene.doorAngle<-.8,
     "Clicking the unlocked door panel did not physically open it: "+
      JSON.stringify({door:opened.state.door,open:opened.state.doorOpen,
       angle:opened.scene.doorAngle}));
    const disk=await page.evaluate(()=>JSON.parse(localStorage.getItem(
      "crilo_nothing_here_cube_v3")));
    assert(disk.door&&disk.doorOpen&&!disk.pocket.includes("flute"),
     "Saving the open door incorrectly brought the consumed flute back");
    await page.reload({waitUntil:"domcontentloaded",timeout:90000});
    await page.waitForFunction(()=>window.__nothing3DPreview?.ready&&
     document.body.classList.contains("nc-physical-ready"),{timeout:60000});
    const restored=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    assert(restored.door&&restored.doorOpen&&!restored.pocket.includes("flute"),
     "Reloading resurrected a consumed flute or relocked the door");
    assert.equal(await page.evaluate(()=>
     window.__nothing3DPreview.physicalFluteVisible),false,
     "Reloading restored the flute model on the 3D cube");
   }
   if(check.label==="lift-requires-collar-tag"||
      check.label==="legacy-fourth-floor"){
    const before=await page.evaluate(()=>({
     state:window.CriloNothingHereCube.getState(),
     reader:window.__nothing3DPreview.physicalElevatorTagReaderState,
     controls:window.__nothing3DPreview.physicalPuzzleActions
    }));
    assert(before.reader?.hasSocket&&before.reader.panelMounted&&
     before.controls.includes("thing:elevator-keyway"),
     "Lift lost its visible, physical collar-tag reader: "+JSON.stringify(before.reader));
    await page.evaluate(()=>window.__nothing3DPreview.clickAction(
     "thing:elevator-floor-4"));
    const pressed=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    if(check.label==="legacy-fourth-floor"){
     assert(pressed.floorFour,
      "Old saves must not relock a previously opened fourth floor");
    }else{
     assert(!pressed.floorFour&&!pressed.pendingPickups.includes("lens"),
      "Random button presses bypassed the collar-tag access lock");
     await page.locator('#ncInventory [data-item="tag"]').click();
     const fits=await page.evaluate(()=>window.CriloNothingHereCube
      .canUseSelectedWithAction("thing:elevator-keyway"));
     assert(fits,"Holding the collar tag must recognize the reader as a fitting");
     await page.evaluate(()=>window.__nothing3DPreview.setRotation(-19,95));
     const socket=await page.evaluate(()=>window.__nothing3DPreview
      .projectPhysicalPuzzleControl("thing:elevator-keyway"));
     assert(socket?.pick==="thing:elevator-keyway",
      "The collar-tag slot is physically obscured by the lift/buttons: "+
       JSON.stringify(socket));
     await page.evaluate(()=>window.__nothing3DPreview.clickAction(
      "thing:elevator-keyway"));
     const placed=await page.evaluate(()=>({
      state:window.CriloNothingHereCube.getState(),
      reader:window.__nothing3DPreview.physicalElevatorTagReaderState
     }));
     assert(placed.state.elevatorTagInserted&&
      !placed.state.pocket.includes("tag")&&placed.reader.tagVisible&&
      placed.reader.lamp>.3,
      "The dog tag did not seat and stay visible in the lift's reader: "+
       JSON.stringify(placed));
     await page.evaluate(()=>window.__nothing3DPreview.clickAction(
      "thing:elevator-floor-4"));
     const opened=await page.evaluate(()=>window.CriloNothingHereCube.getState());
     assert(opened.floorFour&&opened.pendingPickups.includes("lens"),
      "Fourth floor did not produce the real lens after inserting the tag");
     const disk=await page.evaluate(()=>JSON.parse(localStorage.getItem(
      "crilo_nothing_here_cube_v3")));
     assert(disk.elevatorTagInserted&&disk.floorFour&&
      !disk.pocket.includes("tag"),"The installed tag/fourth floor did not save");
    }
   }
   if(check.label==="rain-bell-tag-portal"){
    const tag=await page.evaluate(()=>window.__nothing3DPreview
     .getPhysicalPickupRevealState("tag"));
    assert(tag?.onScene&&tag.stamp==="04",
     "The visible dog collar tag lacks a real 04 engraving: "+
      JSON.stringify(tag));
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("pickup:tag"));
    assert((await page.locator('#ncInventory [data-item="tag"]').innerText())
     .includes("04"),"Collected tag never identifies the engraved floor 04");
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("cube-offer"));
    assert(/postcard|landscape|portal/i.test(
     await page.locator("#ncNarrator").innerText()),
     "The postcard portal still falsely describes an empty brass receiver");
    await page.locator('#ncInventory [data-item="bell"]').click();
    assert(await page.evaluate(()=>window.CriloNothingHereCube
     .canUseSelectedWithAction("thing:dog")),
     "An unused bell must fit the dog before it barks");
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("thing:dog"));
    const barked=await page.evaluate(()=>({
     state:window.CriloNothingHereCube.getState(),
     pose:window.__nothing3DPreview.physicalScenePose
    }));
    assert(barked.state.barked&&barked.state.bellUsed&&
     !barked.state.pocket.includes("bell")&&barked.pose.dogBellOnCollar,
     "The bell must be consumed once and physically hang on the dog: "+
      JSON.stringify({pocket:barked.state.pocket,
       bellUsed:barked.state.bellUsed,visible:barked.pose.dogBellOnCollar}));
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("thing:cloud"));
    const first=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    assert(first.rainReleased&&first.pendingPickups.includes("raindrop"),
     "The cloud failed to release its first physical drop");
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("thing:cloud"));
    const second=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    assert.equal(second.pendingPickups.filter(id=>id==="raindrop").length,1,
     "Repeat cloud clicks duplicated the pending drop");
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("pickup:raindrop"));
    assert((await page.evaluate(()=>window.CriloNothingHereCube.getState()))
      .pocket.includes("raindrop"),
     "The cloud's first drop was not collectible");
    await page.locator('#ncInventory [data-item="raindrop"]').click();
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("thing:pot"));
    const grown=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    assert(grown.tree&&!grown.pocket.includes("raindrop"),
     "Using the only drop did not grow the tree");
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("thing:cloud"));
    const afterRepeat=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    assert(afterRepeat.tree&&afterRepeat.rainReleased&&
     !afterRepeat.pendingPickups.includes("raindrop")&&
     !afterRepeat.pocket.includes("raindrop"),
     "The cloud generated a useless second drop after the tree grew");
    // The captive pin may be inspected before screw removal; its discovery
    // is awarded once, while pressing remains physically responsive.
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("front-screw-3"));
    const firstPress=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("front-screw-3"));
    const nextPress=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    assert(nextPress.falseScrewTurns===firstPress.falseScrewTurns+1&&
      !nextPress.plateOpen,
     "Pressing an early pin must rebound without releasing the screwed-down hatch");
    const disk=await page.evaluate(()=>JSON.parse(localStorage.getItem(
     "crilo_nothing_here_cube_v3")));
    assert(disk.rainReleased&&disk.bellUsed&&disk.tree&&
     !disk.pocket.includes("raindrop")&&disk.seen.includes("portal"),
     "One-shot rain/bell and postcard portal were not saved");
   }
   if(check.label==="spent-bell-in-pocket"||
      check.label==="spent-bell-in-tray"){
    const initial=await page.evaluate(()=>({
     game:window.CriloNothingHereCube.getState(),
     scene:window.__nothing3DPreview.getPhysicalPickupRevealState("bell"),
     dog:window.__nothing3DPreview.physicalScenePose.dogBellOnCollar,
     disk:JSON.parse(localStorage.getItem("crilo_nothing_here_cube_v3"))
    }));
    assert(initial.game.bellUsed&&initial.game.barked&&initial.dog,
     "The previously used bell lost its saved attachment to the dog");
    assert(!initial.game.pocket.includes("bell")&&
     !initial.game.pendingPickups.includes("bell")&&
     initial.game.pocket.includes("coin")&&
     initial.game.pendingPickups.includes("tag"),
     "Bell recovery discarded other items or revived the spent bell: "+
      JSON.stringify(initial.game));
    assert(!initial.scene?.visible&&!initial.scene?.onScene,
     "The spent bell is physically visible again on the underside of the cube");
    assert(!initial.disk.pocket.includes("bell")&&
     !initial.disk.pendingPickups.includes("bell"),
     "The saved bell was not corrected on disk");
    const pickup=await page.evaluate(()=>
     window.CriloNothingHereCube.activatePhysicalPickup("bell"));
    assert.equal(pickup,false,
     "Pressing the old bell socket allowed the spent bell to be reclaimed");
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("dot"));
    const afterDot=await page.evaluate(()=>window.CriloNothingHereCube.getState());
    assert(afterDot.bellUsed&&!afterDot.pocket.includes("bell")&&
     !afterDot.pendingPickups.includes("bell"),
     "The completed red ratchet regenerated the already-used bell");
    await page.reload({waitUntil:"domcontentloaded",timeout:90000});
    await page.waitForFunction(()=>window.__nothing3DPreview?.ready&&
     document.body.classList.contains("nc-physical-ready"),{timeout:60000});
    const afterReload=await page.evaluate(()=>({
     game:window.CriloNothingHereCube.getState(),
     scene:window.__nothing3DPreview.getPhysicalPickupRevealState("bell"),
     dog:window.__nothing3DPreview.physicalScenePose.dogBellOnCollar
    }));
    assert(afterReload.game.bellUsed&&afterReload.dog&&
     !afterReload.game.pocket.includes("bell")&&
     !afterReload.game.pendingPickups.includes("bell")&&
     !afterReload.scene?.visible,
     "The duplicate bell reappeared on a second reload");
   }
   if(check.label==="legacy-extra-raindrop"){
    const clean=await page.evaluate(()=>({
     game:window.CriloNothingHereCube.getState(),
     disk:JSON.parse(localStorage.getItem("crilo_nothing_here_cube_v3"))
    }));
    assert(clean.game.tree&&clean.game.rainReleased&&
     !clean.game.pocket.includes("raindrop")&&
     !clean.game.pendingPickups.includes("raindrop"),
     "A previously spent extra raindrop still remains after save migration");
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("thing:cloud"));
    assert(!(await page.evaluate(()=>window.CriloNothingHereCube.getState()))
     .pendingPickups.includes("raindrop"),
     "Legacy tree completion could generate the same obsolete spare again");
    // Older players may have made the dog bark by petting first. Their
    // unused bell should still attach ONCE, without replaying the squirrel.
    await page.locator('#ncInventory [data-item="bell"]').click();
    await page.evaluate(()=>window.__nothing3DPreview.clickAction("thing:dog"));
    const oldBell=await page.evaluate(()=>({
     game:window.CriloNothingHereCube.getState(),
     bell:window.__nothing3DPreview.physicalScenePose.dogBellOnCollar
    }));
    assert(oldBell.game.bellUsed&&!oldBell.game.pocket.includes("bell")&&oldBell.bell,
     "An unused legacy bell should attach once even after the dog barked");
    assert(!oldBell.game.pendingPickups.includes("raindrop"),
     "Using the bell in an old save resurrected the second raindrop");
   }
   if(check.label==="vending-two-rewards"){
    const result=await page.evaluate(()=>{
     const scene=window.__nothing3DPreview;
     return {mount:scene.vendingReturnPickupAudit,
      tray:scene.physicalPickupTrays.find(t=>t.source==="machine"),
      sugar:scene.getPhysicalPickupRevealState("sugar"),
      seal:scene.getPhysicalPickupRevealState("seal")};
    });
    assert(result.mount?.seated&&result.mount.noDetachedRewards&&
     result.tray?.visible&&result.tray.visibleItems===2,
     "Vending rewards are not sitting on the actual moving return tray: "+
      JSON.stringify(result));
    for(const id of ["sugar","seal"]){
     const entry=result.mount.items.find(item=>item.id===id);
     assert(entry?.visible&&entry.onReturnTray&&entry.supported&&
      result[id]?.onScene,
      "The "+id+" collectible is detached from the machine: "+
       JSON.stringify(result));
    }
    // The return tray itself slides farther out when a service key appears.
    assert(Math.abs((await page.evaluate(()=>
     window.__nothing3DPreview.physicalScenePose.vendingTrayDepth))-.355)<.002,
     "The mounting tray failed to follow the reward-unlock movement");
    assert(await page.evaluate(()=>
     window.__nothing3DPreview.physicalScenePose.vendingServiceSealCabinetMounted),
     "The small stamped ^ badge must be flush-mounted to the vending cabinet, not carried away by the tray");
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
    assert(align?.visible&&align.anchored&&align.centeredTexture&&align.error<1e-5&&
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
    assert(turned?.visible&&turned.anchored&&turned.centeredTexture&&turned.error<1e-5,
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
