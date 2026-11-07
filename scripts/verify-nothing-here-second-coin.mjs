// Real-browser regression of the refurbished vending machine and every
// dependent late-game delivery mechanism. Tests run in isolated storage;
// never touch a player's live Crilo account or saved progress.
import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:[
 "--enable-webgl","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"
]});
const base="http://127.0.0.1:4173/secrets.html";
const saveKey="crilo_nothing_here_cube_v3";
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
const state=page=>page.evaluate(()=>window.CriloNothingHereCube.getState());
const act=(page,action)=>page.evaluate(a=>window.__nothing3DPreview.clickAction(a),action);
const useItem=async(page,item,thing,{realPointer=false}={})=>{
 const action=thing==="shutter"?"shutter":thing==="cube"?"cube-offer":thing==="eye"?"eye":"thing:"+thing;
 await page.locator('#ncInventory [data-item="'+item+'"]').click();
 assert.equal((await state(page)).selected,item,
  "Selecting "+item+" in inventory failed");
 assert(await page.evaluate(a=>window.CriloNothingHereCube.canUseSelectedWithAction(a),action),
  item+" has no valid physical target "+thing);
 if(realPointer){
  const p=await page.evaluate(t=>{
   const v=window.__nothing3DPreview;
   const point=v.projectPhysicalStoryObject(t);
   return point?{...point,actual:v.getPhysicalActionAt(point.x,point.y)}:null;
  },thing);
  assert(p?.pick===action&&p.actual===action,
   "Selected "+item+" cannot be used on visible "+thing+" with a real pointer: "+JSON.stringify(p));
  await page.locator("#stage canvas").click({position:{x:p.x,y:p.y},timeout:25000});
 }else await act(page,action);
};
const collect=async(page,item)=>{
 assert((await state(page)).pendingPickups.includes(item),
  item+" was not physically produced by the preceding mechanism");
 assert((await page.evaluate(id=>window.__nothing3DPreview.getPhysicalPickupRevealState(id),item))?.visible,
  "The "+item+" pickup is not visible in its real 3D holder");
 await act(page,"pickup:"+item);
 assert((await state(page)).pocket.includes(item),
  "The "+item+" pickup could not be collected into inventory");
};
async function scenario(name,seed){
 const ctx=await browser.newContext({viewport:{width:1280,height:860},reducedMotion:"reduce"});
 const page=await ctx.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*",
  r=>r.fulfill({status:200,body:mock,contentType:"application/javascript"}));
 await page.addInitScript(({key,data})=>{
  if(!sessionStorage.getItem("nc_coin_seeded")){
   localStorage.setItem(key,JSON.stringify(data));
   sessionStorage.setItem("nc_coin_seeded","yes");
  }
 },{key:saveKey,data:seed});
 await page.goto(base,{waitUntil:"domcontentloaded",timeout:45000});
 await page.waitForFunction(()=>
  !!window.CriloNothingHereCube&&window.__nothing3DPreview?.ready&&
  document.body.classList.contains("nc-physical-ready"),null,{timeout:90000});
 return {page,close:async()=>{
  assert.deepEqual(errors,[],name+" had uncaught browser errors");
  await ctx.close();
 }};
}
// A real roof release is necessary before fitting either optical component.
async function deployObservatory(page){
 for(let n=0;n<3;n++)await act(page,"triangle");
 assert((await state(page)).top,"The upper hinged lid failed to open");
 await act(page,"top-reed");
 assert((await state(page)).pipeTaken,"The tube still obstructs the lift");
 await act(page,"observatory-release");
 const s=await state(page);
 const pose=await page.evaluate(()=>window.__nothing3DPreview.physicalScenePose.observatory);
 assert(s.observatoryRaised&&pose.installed&&pose.deployed&&
  pose.shutterProgress>=.999&&pose.slatCount===16&&
  pose.visibleSlats===0&&pose.rearCapVisible&&pose.mouthWidth>.53&&
   pose.guideRailCount===2&&pose.visibleGuideRollers===0&&
   pose.visibleRivetCount>=20&&pose.visibleRivetCount<=48&&
   pose.enamelTextureApplied&&
   pose.openingRise>.23&&
   pose.retainedDomeFraction>.59&&pose.retainedDomeFraction<.70&&
  Math.abs(pose.domeSeamHeight-.118)<.001&&Math.abs(pose.scopeTilt)<.02&&
  pose.barrelForwardY<-.98&&pose.barrelUpZ>.10&&pose.barrelUpZ<.25&&
  pose.canopyFrontY<-.07&&pose.canopyFrontY>-.12&&
  pose.canopyCrownZ>.325&&pose.canopyCrownZ<.35&&
  pose.frontSillTopZ>.052&&pose.frontSillTopZ<.065&&
  pose.objectiveFrontY>pose.canopyFrontY-.07&&pose.objectiveFrontY<pose.canopyFrontY+.03&&
  pose.objectiveCenterZ>pose.frontSillTopZ+.04,
  "The ivory observatory did not open its arched front or keep the telescope centered");
}
async function refundCoin(page,{realPointer=false}={}){
 let s=await state(page);
 assert(s.coinReturned&&s.shimUsed&&!s.refundRedeemed,
  "The repair must return one coin before its final redemption");
 assert(s.pendingPickups.includes("coin")&&!s.pocket.includes("coin"),
  "The second coin must wait for a real pickup, not materialize in the pocket");
 const layout=await page.evaluate(()=>
  window.__nothing3DPreview.physicalPickupLayout.find(x=>x.id==="coin"));
 assert.equal(layout?.source,"machine",
  "The returned coin must appear AT the machine rather than in the bag");
 if(realPointer){
  await page.evaluate(()=>window.__nothing3DPreview.setRotation(0,0));
  const p=await page.evaluate(()=>{
   const v=window.__nothing3DPreview;
   const target=v.projectPhysicalPickup("coin");
   return target?{...target,actual:v.getPhysicalActionAt(target.x,target.y)}:null;
  });
  assert(p?.pick==="pickup:coin"&&p.actual==="pickup:coin",
   "Refunded coin cannot be physically clicked: "+JSON.stringify(p));
  await page.locator("#stage canvas").click({position:{x:p.x,y:p.y},timeout:20000});
  assert((await state(page)).pocket.includes("coin"),
   "Real mouse click missed the refunded coin");
 }else await collect(page,"coin");
 const sugarStillWaiting=(await state(page)).pendingPickups.includes("sugar");
 await useItem(page,"coin","machine",{realPointer});
 s=await state(page);
 assert(s.refundRedeemed&&s.seen.includes("service-bolt"),
  "Second coin did not reveal the separate service-drawer discovery");
 assert(!s.pocket.includes("coin")&&!s.pendingPickups.includes("coin"),
  "Second coin was not consumed exactly once");
 assert.equal(s.pendingPickups.includes("sugar"),sugarStillWaiting,
  "Second coin changed an earlier sugar pickup instead of opening the new service drawer");
 assert(s.pendingPickups.includes("seal")&&!s.pocket.includes("seal"),
  "Second coin made only a decorative seal instead of a usable physical key");
 assert.equal(await page.evaluate(()=>
  window.__nothing3DPreview.physicalPickupLayout.find(x=>x.id==="seal")?.source),"machine",
  "The brass service key did not originate from the vending machine");
 assert((await page.evaluate(()=>
  window.__nothing3DPreview.getPhysicalPickupRevealState("seal")))?.visible,
  "The real brass service key is not visible and collectible in 3D");
 assert(await page.evaluate(()=>
  window.__nothing3DPreview.physicalScenePose.vendingServiceSealVisible),
  "The service-key tray has no visible mechanical counterpart");
 assert((await page.evaluate(()=>window.__nothing3DPreview.physicalScenePose.vendingTrayDepth))>.44,
  "The vending machine's second tray is still closed");
 assert.match(await page.locator("#ncNarrator").innerText(),/brass service key/i);
 await act(page,"thing:machine");
 assert(!(await state(page)).pendingPickups.includes("coin"),
  "A completed machine spawned another refunded coin on inspection");
 // Real downstream use: the discovered key must physically fit the
 // service shutter. A new player must not get the wax cylinder just by
 // obtaining a badge or a duplicate sugar cube.
 // The previous working shutter geometry was restored to recover the
 // scene: only puzzle gating is asserted until a visual test is available.
 await act(page,"shutter");
 assert(!(await state(page)).serviceOpen,
  "Service shutter opened without the brass key or sound release");
 if(await page.locator("#ncMechanismsToggle").getAttribute("aria-expanded")==="true")
  assert.match(await page.locator("#ncMechanismsList").innerText(),/Service key/,
   "The earned brass key is not reflected in the live mechanism log");
 await collect(page,"seal");
 await useItem(page,"seal","shutter");
 assert((await state(page)).serviceSealInserted&&
  !(await state(page)).pocket.includes("seal"),
  "Using the brass key did not seat it in the matching service keyway");
 assert(await page.evaluate(()=>
  window.__nothing3DPreview.physicalMechanicalFeedback.serviceKeyInserted),
  "The brass service key does not visibly insert into the real shutter");
 await act(page,"shutter");
 assert(!(await state(page)).serviceOpen,
  "A fitted key bypassed the vibrating spring catch without the tuning fork");
 for(let i=0;i<3;i++)await act(page,"pressure");
 assert((await state(page)).pressureReady&&
  !(await state(page)).pendingPickups.includes("fork"),
  "Pressure dial alone bypassed the still-secured gear-maze screw");


 // The new eight-ring labyrinth has a fixed white face and a moving
 // toothed black cog. Verify that LEFT and RIGHT drags work on the white
 // face, and black-gear motion turns the carrier behind it.
 await page.evaluate(()=>window.__nothing3DPreview.setRotation(-15,90));
 const controls=await page.evaluate(()=>{
  const v=window.__nothing3DPreview;
  return {large:v.projectGameControl("gear-large"),
   small:v.projectGameControl("gear-small"),
   inward:v.projectGameControl("maze-in"),
   outward:v.projectGameControl("maze-out"),
   maze:v.physicalGearMaze};
 });
 assert(controls.maze?.face==="leftFace"&&
  controls.maze.mazeStyle==="continuous six-ring circular labyrinth"&&
  controls.maze.networkCells===97&&controls.maze.networkChannels===96&&
  controls.maze.extraConnections===0&&controls.maze.branches>=10&&
  controls.maze.raisedWalls>=40&&controls.maze.stationaryFace&&
   controls.maze.uniqueSolution&&controls.maze.exitApproaches===1&&
   controls.maze.ballRadius>=.0084&&controls.maze.visibleBlockedEdges===96&&controls.maze.wallMeshes===2&&controls.maze.mouthSector===8&&
  Math.abs(controls.maze.faceAngle)<.000001&&
  controls.maze.followerTrackDistance<.000001,
  "The physical fixed maze did not load correctly: "+JSON.stringify(controls));
 assert.equal((await state(page)).gearMazeCell,80,
  "The captive pin must begin at the 6 o'clock outer entry");
 // The white face no longer rotates, and one direction of a drag must
 // always reverse the same groove the other direction entered.
 async function dragWheel(name,direction){
  const data=await page.evaluate(name=>{
   const p=window.__nothing3DPreview;
   return {start:p.projectGameControl(name),center:p.getGearDragCenter(name)};
  },name);
  assert(data.start?.pick===name&&data.center,
   "The actual "+name+" cannot be grabbed");
  const center=data.center,start=data.start;
  const radius=Math.hypot(start.x-center.x,start.y-center.y);
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  if(direction==="in"||direction==="out"){
   const sign=direction==="in"?-1:1;
   for(let i=1;i<=10;i++)
    await page.mouse.move(start.x,start.y+sign*28*i/10);
  }else if(radius>13){
   const angle=Math.atan2(start.y-center.y,start.x-center.x);
   // White face: negative angular drag = counterclockwise.
   // Black cog: opposite drag turns the large geared carrier.
   const desired=direction==="ccw"?-1:1;
   const sign=name==="gear-small"?-desired:desired;
   for(let i=1;i<=10;i++)
    await page.mouse.move(center.x+radius*Math.cos(angle+sign*.32*i/10),
     center.y+radius*Math.sin(angle+sign*.32*i/10));
  }else{
   const desired=direction==="ccw"?-1:1;
   const sign=name==="gear-small"?-desired:desired;
   for(let i=1;i<=10;i++)
    await page.mouse.move(start.x+sign*40*i/10,start.y);
  }
  await page.mouse.up();
 }
 await page.locator("#stage canvas").click({
  position:{x:controls.large.x,y:controls.large.y},timeout:25000});
 assert.equal((await state(page)).gearMazeCell,80,
  "A click without rotation should not move the captive pin");
 // White face is now passive: neither drag nor action may move the ball.
 const beforeWhite=await state(page);
 await dragWheel("gear-large","ccw");
 const afterWhite=await state(page);
 assert.equal(afterWhite.gearMazeCell,beforeWhite.gearMazeCell,
  "Dragging the white maze must not move the captive pin");
 assert.equal(afterWhite.gearMazeTurns,beforeWhite.gearMazeTurns,
  "Dragging the white maze must not turn the black carrier");
 await act(page,"gear-large");
 assert.equal((await state(page)).gearMazeCell,80,
  "Direct white-face activation moved the captive pin");
 // A passive drag can orbit the camera; recenter before cog testing.
 await page.evaluate(()=>window.__nothing3DPreview.setRotation(-15,90));
 const initial=await page.evaluate(()=>
  window.__nothing3DPreview.physicalGearMaze);
 assert(Math.abs(initial.faceAngle)<.000001,
  "The white maze visibly rotated, despite being stationary");
 await dragWheel("gear-small","ccw");
 assert.equal((await state(page)).gearMazeCell,81,
  "The black drive cog did not advance the captive pin");
 await dragWheel("gear-small","cw");
 assert.equal((await state(page)).gearMazeCell,80,
  "Reversing the black drive cog failed to return the ball");
 await dragWheel("gear-small","ccw");
 assert.equal((await state(page)).gearMazeCell,81,
  "The black cog could not resume movement");
 await page.waitForFunction(()=>{
  const g=window.__nothing3DPreview?.physicalGearMaze;
  return g&&Math.abs(g.faceAngle)<.000001&&
   Math.abs(g.carrierAngle)>.0001&&
   Math.abs(g.blackCogAngle)>.0001;
 },null,{timeout:12000});
 const geared=await page.evaluate(()=>
  window.__nothing3DPreview.physicalGearMaze);
 assert(geared.stationaryFace&&Math.abs(geared.faceAngle)<.000001,
  "The black cog turned but the white maze also rotated");
 await page.reload({waitUntil:"domcontentloaded",timeout:45000});
 await page.waitForFunction(()=>window.__nothing3DPreview?.ready,null,{timeout:90000});
 assert.equal((await state(page)).gearMazeCell,81,
  "Reloading erased an unfinished maze position");
 await page.evaluate(()=>window.__nothing3DPreview.setRotation(-15,90));
 // The calibrated dial retains separate radial control.
 await act(page,"maze-cw");
 assert.equal((await state(page)).gearMazeCell,80);
 await act(page,"maze-in");
 assert.equal((await state(page)).gearMazeCell,80,
  "The dial crossed the sealed outer radial wall at the start");
 const fullPath=[80,81,82,83,84,85,69,70,54,55,56,57,58,42,41,40,39,38,22,21,5,4,20,19,35,34,50,49,65,64,79,78,62,63,47,32,33,17,16,0,15,31,30,29,45,44,43,27,26,10,9,8,96];
 for(let i=1;i<fullPath.length;i++){
  const from=fullPath[i-1],to=fullPath[i];
  const action=to===96||to===from-16?"maze-in":
   to===from+16?"maze-out":
   Math.floor(to/16)===Math.floor(from/16)&&
   to%16===(from%16+1)%24?"maze-ccw":"maze-cw";
  await act(page,action);
  assert.equal((await state(page)).gearMazeCell,to,
   "A sculpted channel does not match its playable direction: "+from+" -> "+to);
 }
 await page.waitForFunction(()=>window.__nothing3DPreview.physicalGearMaze.exitReached,
  null,{timeout:25000});
 assert((await state(page)).gearMazeSolved&&
  (await state(page)).pendingPickups.includes("fork"),
  "Reaching the center failed to release the real tuning fork");
 await page.waitForFunction(()=>
  window.__nothing3DPreview.physicalGearMaze.dialTongueX<.02,
  null,{timeout:14000});
 const exit=await page.evaluate(()=>window.__nothing3DPreview.physicalGearMaze);
 assert(Math.hypot(exit.exit.x-exit.railEntry.x,
  exit.exit.y-exit.railEntry.y)<.023,
  "The central socket no longer engages the pressure dial linkage");
 await collect(page,"fork");
 await useItem(page,"fork","cube");
 assert((await state(page)).resonance,
  "The tuning fork cannot release the shutter's sound-operated catch");
 await act(page,"shutter");
 assert((await state(page)).serviceOpen&&
  (await state(page)).pendingPickups.includes("cylinder"),
  "Second coin and tuning fork did not jointly expose the real wax cylinder");
 assert((await page.evaluate(()=>
  window.__nothing3DPreview.physicalMechanicalFeedback.serviceKeyInserted)),
  "The service key should remain seated after the shutter opens");
}

try{
 // Order A: spend -> repair -> collect refund -> redeem -> reload.
 {
  const {page,close}=await scenario("spend-then-repair",{
   seen:["first","mouse","bag","machine","vent-sequence"],
   mouse:true,bag:true,machine:true,ventOpen:true,
   pocket:["shim","sugar"],pendingPickups:[]
  });
  assert(await page.locator("#ncMechanisms").isVisible(),
   "Previously discovered mechanisms must have an optional readable status");
  assert(await page.locator("#ncMechanismsList").isHidden(),
   "Mechanism log should start collapsed to keep the cube uncluttered");
  await page.locator("#ncMechanismsToggle").click();
  assert.match(await page.locator("#ncMechanismsList").innerText(),/Vending machine.*coin-return slot is still jammed/s,
   "Unresolved machine state is not explained in ordinary physical language");
  assert.doesNotMatch(await page.locator("#ncMechanismsList").innerText(),/3\s*·\s*1\s*·\s*4/,
   "An unopened code was leaked by the progress summary");
  await useItem(page,"shim","machine");
  assert.match(await page.locator("#ncMechanismsList").innerText(),/Coin return.*working coin return/s,
   "Fixing the jam did not update the visible mechanism state");
  await refundCoin(page,{realPointer:true});
  await page.reload({waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForFunction(()=>window.__nothing3DPreview?.ready,null,{timeout:90000});
  const saved=await state(page);
  assert(saved.refundRedeemed&&saved.seen.includes("service-bolt")&&
    saved.serviceSealInserted&&saved.serviceOpen&&
    !saved.pendingPickups.includes("coin")&&!saved.pendingPickups.includes("seal"),
   "Refreshing the solved machine rewound or duplicated the second coin");
  assert(await page.evaluate(()=>
   window.__nothing3DPreview.physicalScenePose.vendingServiceSealVisible),
   "The second drawer disappeared after save reload");
  await close();
  console.log("PASS: spent coin -> returned coin pointer -> collectible key -> keyway + resonance -> wax cylinder -> saved");
 }
 // Order B: repair before the very first coin is inserted. It must not
 // prematurely refund a coin still in the original bag/player pocket.
 {
  const {page,close}=await scenario("repair-before-spend",{
   seen:["first","mouse","bag","vent-sequence"],
   mouse:true,bag:true,machine:true,ventOpen:true,
   pocket:["coin","shim"],pendingPickups:[]
  });
  await useItem(page,"shim","machine");
  assert(!(await state(page)).coinReturned,
   "Repairing before spending minted a second coin from nowhere");
  await useItem(page,"coin","machine");
  const first=await state(page);
  assert(first.seen.includes("machine")&&first.pendingPickups.includes("sugar"),
   "The first payment stopped delivering its original sugar cube");
  await refundCoin(page);
  await close();
  console.log("PASS: repair-first ordering still makes first sugar, then one refund, then unlocks wax cylinder");
 }
 // Order C: older player save with a spent first coin and jam already
 // repaired, but no separate pending reward: recover it ON the cube.
 {
  const {page,close}=await scenario("legacy-repaired",{
   seen:["first","mouse","bag","machine","service-bolt"],
   mouse:true,bag:true,machine:true,shimUsed:true,
   coinReturned:false,refundRedeemed:false,
   pocket:["sugar"],pendingPickups:[]
  });
  assert((await state(page)).pendingPickups.includes("coin"),
   "An older repaired machine stranded its returned coin permanently");
  await refundCoin(page);
  await close();
  console.log("PASS: old saves recover the unspent coin and its brass key still opens the shutter");
 }
 // Older saves sometimes had the returned coin ALREADY IN INVENTORY but
 // a false coinReturned flag. That exact mismatch used to silently award
 // an extra sugar cube when the user spent their second coin.
 {
  const {page,close}=await scenario("legacy-pocket-coin",{
   seen:["first","mouse","bag","machine","service-bolt"],
   mouse:true,bag:true,machine:true,shimUsed:true,
   coinReturned:false,refundRedeemed:false,
   pocket:["coin","sugar"],pendingPickups:[]
  });
  const recovered=await state(page);
  assert(recovered.coinReturned&&recovered.pocket.includes("coin")&&
   !recovered.pendingPickups.includes("coin"),
   "Existing returned coin was duplicated or wrongly treated as a first purchase");
  await useItem(page,"coin","machine");
  const redeemed=await state(page);
  assert(redeemed.refundRedeemed&&!redeemed.pocket.includes("coin")&&
    !redeemed.pendingPickups.includes("sugar")&&redeemed.pendingPickups.includes("seal"),
   "Old pocketed refund still turned into duplicate sugar or cosmetic seal");
  await collect(page,"seal");
  await useItem(page,"seal","shutter");
  assert((await state(page)).serviceSealInserted,
   "An old returned coin produces a key that cannot actually fit its keyway");
  await close();
  console.log("PASS: a legacy second coin already in pocket now redeems correctly");
 }
 // Previously completed calibrations should NOT force a former player
 // to replay already-earned rewards, but the newly authored physical gear
 // maze must remain playable rather than pre-solved on arrival.
 {
  const {page,close}=await scenario("pre-maze-earned-fork",{
   seen:["first","pressure-dial"],pressureReady:true,pressureTicks:3,
   pocket:["fork"],pendingPickups:[]
  });
  const legacy=await state(page);
  assert(legacy.legacyGearBypass&&!legacy.gearMazeSolved&&legacy.pocket.includes("fork"),
   "Old players lost their tuning fork or their new gear puzzle was solved automatically");
  await act(page,"gear-small");
  assert((await state(page)).gearMazeCell===95&&
    (await state(page)).gearMazePlayed,
   "Old fork owners cannot operate the restored clockwise wheel");
  await close();
  console.log("PASS: prior fork owners keep it and can still play new gear maze");
 }
 // An earlier migration briefly stamped the new gears solved at zero
 // actual turns. Detect that exact synthetic state, not real solutions.
 {
  const {page,close}=await scenario("previous-synthetic-gear-migration",{
   seen:["first","pressure-dial"],pressureReady:true,pressureTicks:3,
   gearMazeSolved:true,gearMazeIndex:10,gearMazeTurns:0,
   pocket:["fork"],pendingPickups:[]
  });
  assert(!(await state(page)).gearMazeSolved&&
   (await state(page)).legacyGearBypass&&
   (await state(page)).pocket.includes("fork"),
   "The earlier automatic migration has locked the owner out of the new gear maze");
  await close();
  console.log("PASS: synthetic auto-solved gears are reopened without resetting earned items");
 }
 // Players may solve the meshed-wheel channel BEFORE touching the
 // calibration dial. In this order its screw must retract the latch but
 // must not invent a tuning fork until the needle also reaches its stop.
 {
  const {page,close}=await scenario("gear-before-pressure",{
   seen:[],pocket:[],pendingPickups:[]
  });
  const path=[80,81,82,83,84,85,69,70,54,55,56,57,58,42,41,40,39,38,22,21,5,4,20,19,35,34,50,49,65,64,79,78,62,63,47,32,33,17,16,0,15,31,30,29,45,44,43,27,26,10,9,8,96];
  for(let i=1;i<path.length;i++){
   const from=path[i-1],to=path[i];
   await act(page,to===96||to===from-16?"maze-in":
    to===from+16?"maze-out":
    Math.floor(to/16)===Math.floor(from/16)&&
    to%16===(from%16+1)%24?"maze-ccw":"gear-small");
  }
  const opened=await state(page);
  assert(opened.gearMazeSolved&&!opened.pressureReady&&
   !opened.pendingPickups.includes("fork"),
   "Unscrewing the gear maze alone gave an uncalibrated tuning fork");
  for(let i=0;i<3;i++)await act(page,"pressure");
  assert((await state(page)).pendingPickups.includes("fork"),
   "Calibrating the already released dial did not expose the physically earned fork");
  await collect(page,"fork");
  await close();
  console.log("PASS: gear-first and pressure-first orders unlock the same genuine calibration reward");
 }
 // The red-switch bell used to have an apparently valid "use on dog"
 // target that did NOTHING. Ringing it must now cause the same observable
 // dog -> squirrel -> broken-vase chain as petting the dog three times.
 {
  const {page,close}=await scenario("bell-is-not-dead-end",{
   seen:["first","door","dog","bell"],door:true,doorOpen:true,
   redHits:4,pocket:["bell"],pendingPickups:[]
  });
  assert(await page.locator("#ncMechanisms").isHidden(),
   "The progress panel revealed a future puzzle before it was encountered");
  await useItem(page,"bell","dog");
  const sounded=await state(page);
  assert(sounded.barked&&sounded.squirrel&&sounded.vase&&
   sounded.seen.includes("bark")&&sounded.seen.includes("vase")&&
   sounded.pendingPickups.includes("acorn")&&sounded.pendingPickups.includes("spring"),
   "Using the bell on the dog failed to trigger its physical vase-and-pickups chain");
  assert.match(await page.locator("#ncNarrator").innerText(),/acorn|spring|vase/i,
   "The bell did something but the player was not told what changed");
  await close();
  console.log("PASS: bell rings -> dog barks -> squirrel escapes -> vase breaks -> two real pickups");
 }
 // An untouched account can open the dome using only the physical
 // top-lid controls. No maker's stamp, moon or side-quest is required.
 {
  const {page,close}=await scenario("observatory-direct-release",{
   seen:[],pocket:[],pendingPickups:[]
  });
  const initial=await state(page);
  assert(!initial.top&&!initial.pipeTaken&&!initial.moon&&
   !initial.serialRead&&!initial.observatoryRaised,
   "The direct observatory test did not start fresh");
  await act(page,"observatory-release");
  assert(!(await state(page)).observatoryRaised,
   "The closed top hatch must keep the telescope locked");
  for(let n=0;n<3;n++)await act(page,"triangle");
  assert((await state(page)).top,"The lid must open after its three catches");
  await act(page,"observatory-release");
  assert(!(await state(page)).observatoryRaised,
   "The tube should obstruct the release until collected");
  await act(page,"top-reed");
  await act(page,"observatory-release");
  let opened=await state(page);
  assert(opened.observatoryRaised&&!opened.moon&&!opened.serialRead,
   "A cleared cradle must let the observatory open independently");
  const pose=await page.evaluate(()=>window.__nothing3DPreview.physicalScenePose.observatory);
  assert(pose.deployed&&pose.shutterProgress>=.999&&
   pose.slatCount===16&&pose.visibleSlats===0&&
   pose.rearCapVisible&&pose.mouthWidth>.53&&
   pose.guideRailCount===2&&pose.visibleGuideRollers===0&&
   pose.visibleRivetCount>=20&&pose.visibleRivetCount<=48&&
   pose.enamelTextureApplied&&
   pose.openingRise>.23&&
   pose.retainedDomeFraction>.59&&pose.retainedDomeFraction<.70&&Math.abs(pose.domeSeamHeight-.118)<.001&&
   pose.barrelForwardY<-.98&&pose.barrelUpZ>.10&&pose.barrelUpZ<.25&&
  pose.canopyFrontY<-.07&&pose.canopyFrontY>-.12&&
  pose.canopyCrownZ>.325&&pose.canopyCrownZ<.35&&
  pose.frontSillTopZ>.052&&pose.frontSillTopZ<.065&&
  pose.objectiveFrontY>pose.canopyFrontY-.07&&pose.objectiveFrontY<pose.canopyFrontY+.03&&
  pose.objectiveCenterZ>pose.frontSillTopZ+.04,
   "The reference observatory was unlocked but its curved shutter did not retract");
  await page.reload({waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForFunction(()=>window.__nothing3DPreview?.ready,null,{timeout:90000});
  opened=await state(page);
  assert(opened.observatoryRaised&&!opened.moon&&!opened.serialRead,
   "Reload erased the opened dome or falsely awarded another secret");
  await close();
  console.log("PASS: latch -> remove tube -> observatory release, independent of other puzzles");
 }
 // A fresh player can now follow the maker's-stamp -> lift -> telescope
 // -> railway route BEFORE meeting the dog, growing a tree, or starting
 // the music box. All rewards still have real, collectible 3D origins.
 {
  const {page,close}=await scenario("optics-before-dog",{
   seen:[],pocket:[],pendingPickups:[]
  });
  const fresh=await state(page);
  assert(!fresh.door&&!fresh.watch&&!fresh.tag&&!fresh.moon&&!fresh.music,
   "Independent optics test started with story-chain progress");
  const initialWorlds=await page.evaluate(()=>
   window.__nothing3DPreview.visiblePhysicalStoryObjects);
  const closedDome=await page.evaluate(()=>
   window.__nothing3DPreview.physicalScenePose.observatory);
  assert(closedDome.installed&&!closedDome.deployed&&
   closedDome.visibleSlats===16&&closedDome.slatCount===16&&
   closedDome.shutterProgress===0&&
    closedDome.guideRailCount===2&&closedDome.visibleGuideRollers===2&&
    closedDome.visibleRivetCount>=20&&closedDome.visibleRivetCount<=48&&
    closedDome.enamelTextureApplied&&
   Math.abs(closedDome.domeSeamHeight-.118)<.001&&
   !initialWorlds.includes("telescope")&&!initialWorlds.includes("elevator"),
   "The observatory must start with every shutter slat closed at fixed height");
  const emptyOptics=await page.evaluate(()=>
   window.__nothing3DPreview.physicalScenePose.telescopeOptics);
  assert(!emptyOptics.lens&&!emptyOptics.iris,
   "The initial telescope has magically preinstalled its two puzzle parts");
  await act(page,"serial");
  assert((await state(page)).serialRead&&!((await state(page)).watch),
   "Maker's stamp cannot expose the lift until the clock chain is solved");
  assert((await page.evaluate(()=>
   window.__nothing3DPreview.visiblePhysicalStoryObjects)).includes("elevator"),
   "Maker's stamp did not reveal an actual side-mounted miniature lift");
  // The maker stamp unlocks this early path without the dog or the bird.
  await deployObservatory(page);
  await act(page,"thing:elevator-floor-4");
  assert((await state(page)).floorFour&&!((await state(page)).tag),
   "Fourth-floor cage incorrectly depends on obtaining the dog's tag");
  await collect(page,"lens");
  await useItem(page,"lens","telescope");
  const focused=await state(page);
  assert(focused.observed&&focused.telescopeLensMounted&&!focused.telescopeIrisMounted&&
    !focused.secondSky&&focused.pendingPickups.includes("starmap"),
   "First optical fitting did not produce exactly the constellation reward");
  await collect(page,"starmap");
  await useItem(page,"starmap","elevator");
  const railway=await state(page);
  assert(railway.train&&!railway.door&&!railway.music&&
   railway.seen.includes("constellation"),
   "Railway no longer has an independent early optical route");
  // The rear-eye service hatch provides the second, distinct optic.
  for(let n=0;n<3;n++)await act(page,"eye-ring");
  for(let n=0;n<3;n++)await act(page,"front-screw-"+n);
  await collect(page,"cog");
  await useItem(page,"cog","eye");
  await collect(page,"iris");
  await useItem(page,"iris","telescope");
  let merged=await state(page);
  assert(merged.telescopeLensMounted&&merged.telescopeIrisMounted&&
   merged.secondSky&&merged.seen.includes("second-sky")&&
   (await page.evaluate(()=>
    window.__nothing3DPreview.physicalScenePose.telescopeOptics.both)),
   "Using two physically distinct optic holders did not reveal the second sky");
  await page.reload({waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForFunction(()=>window.__nothing3DPreview?.ready,null,{timeout:90000});
  merged=await state(page);
  assert(merged.observed&&merged.train&&merged.secondSky&&
   merged.telescopeLensMounted&&merged.telescopeIrisMounted&&
   !merged.pendingPickups.includes("starmap")&&
   !merged.pendingPickups.includes("lens")&&
   !merged.pendingPickups.includes("iris"),
   "Saving the early optical branch resurrected spent telescope parts or lost progress");
  await close();
  console.log("PASS: fresh stamp -> early lift/lens -> chart/railway -> eye iris -> second sky, saved");
 }
 // Reverse the two independently earned telescope optics. A first iris
 // MUST work, and a later lens must NOT duplicate its one-time star chart.
 {
  const {page,close}=await scenario("iris-before-lens",{
   seen:[],pocket:[],pendingPickups:[]
  });
  for(let n=0;n<3;n++)await act(page,"front-screw-"+n);
  await collect(page,"cog");
  for(let n=0;n<3;n++)await act(page,"eye-ring");
  await useItem(page,"cog","eye");
  await collect(page,"iris");
  await act(page,"serial");
  await deployObservatory(page);
  await useItem(page,"iris","telescope");
  let focused=await state(page);
  assert(focused.observed&&focused.telescopeIrisMounted&&!focused.telescopeLensMounted&&
   !focused.secondSky&&focused.pendingPickups.includes("starmap"),
   "Glass iris cannot focus the chart as the first installed element");
  await act(page,"serial");
  await collect(page,"starmap");
  await useItem(page,"starmap","elevator");
  focused=await state(page);
  assert(focused.train&&!focused.floorFour&&!focused.moon&&!focused.door,
   "First iris route secretly required floor four or the dog and moon");
  await act(page,"thing:elevator-floor-4");
  await collect(page,"lens");
  await useItem(page,"lens","telescope");
  const finished=await state(page);
  assert(finished.secondSky&&finished.telescopeIrisMounted&&
   finished.telescopeLensMounted&&!finished.pendingPickups.includes("starmap")&&
   !finished.pocket.includes("starmap"),
   "Installing lens second duplicated chart or failed to reveal second sky");
  await close();
  console.log("PASS: front screws -> cog -> iris -> chart/railway before floor four -> lens -> second sky");
 }
 // Saved games from before the dual-optic model had no component flags.
 // Preserve their already-installed lens/iris and completed discoveries,
 // without duplicating the star chart or resurrecting consumed optics.
 {
  const {page,close}=await scenario("legacy-telescope-compatibility",{
   seen:["first","observatory","constellation","hidden-optic","second-sky",
    "railway","fourth"],
   observed:true,secondSky:true,opticOpened:true,train:true,floorFour:true,
   pendingPickups:[],pocket:[]
  });
  const legacy=await state(page);
  const visual=await page.evaluate(()=>
   window.__nothing3DPreview.physicalScenePose.telescopeOptics);
  assert(legacy.telescopeLensMounted&&legacy.telescopeIrisMounted&&
   legacy.secondSky&&legacy.train&&visual.both&&
   !legacy.pendingPickups.includes("lens")&&
   !legacy.pendingPickups.includes("iris")&&
   !legacy.pendingPickups.includes("starmap"),
   "Existing players' installed telescope optics or earned chart were lost");
  await close();
  console.log("PASS: old one-order telescope saves preserve both optics and spent chart");
 }
 // After the machine, the other late mechanisms are independent, but
 // all must still lead to a reachable physical reward and the final letter.
 {
  const {page,close}=await scenario("late-game-chain",{
   seen:["first","mouse","bag","machine","service-bolt","music","teacup",
     "door","dog","pressure-dial","moon"],
   mouse:true,bag:true,machine:true,shimUsed:true,
   coinReturned:true,refundRedeemed:true,
   pressureReady:true,ventOpen:true,
   music:true,cloud:true,cup:true,watch:true,
   vase:true,moon:true,tag:true,train:false,floorFour:false,
   door:true,doorOpen:true,
   pocket:["fork"],pendingPickups:[]
  });
  // This migrated session already paid the second coin, but never had
  // a useful service key in the older release. It should be recovered
  // PHYSICALLY at the vending machine, not inserted automatically.
  assert((await state(page)).pendingPickups.includes("seal"),
   "Previously spent second coin was not upgraded to a collectible key");
  await collect(page,"seal");
  await useItem(page,"fork","cube");
  assert((await state(page)).resonance,
   "Fork never releases the vibrating spring catch");
  await act(page,"shutter");
  assert(!(await state(page)).serviceOpen,
   "Resonance alone should not bypass the missing brass service key");
  await useItem(page,"seal","shutter");
  assert((await state(page)).serviceSealInserted,
   "Previously earned second coin cannot activate the shutter keyway");
  await act(page,"shutter");
  assert((await state(page)).serviceOpen,
   "Both the key and sound release were met but service shutter stayed shut");
  await collect(page,"cylinder");
  await useItem(page,"cylinder","musicbox");
  assert((await state(page)).cylinderMounted,"Wax cylinder failed to turn music box");
  await collect(page,"tape");
  await useItem(page,"tape","clock");
  assert((await state(page)).tapeInserted,"Punched tape failed to operate clock");
  await collect(page,"letter");
  // The watch and recovered collar tag make the fourth lift button
  // meaningful. Its lens produces the telescope chart, which unlocks
  // the railway needed to post the late-game letter.
  await act(page,"thing:elevator-floor-4");
  assert((await state(page)).floorFour,
   "Fourth-floor lift did not reveal its lens and moth");
  await collect(page,"lens");
  await deployObservatory(page);
  await useItem(page,"lens","telescope");
  assert((await state(page)).observed,
   "The recovered telescope lens failed to focus its sky");
  await collect(page,"starmap");
  await useItem(page,"starmap","elevator");
  assert((await state(page)).train,
   "Star chart failed to create the tiny railway and delivery train");
  // The mechanical moth must remain useful after the lift unlock.
  await act(page,"thing:moth");
  await collect(page,"stardust");
  await useItem(page,"stardust","musicbox");
  assert((await state(page)).dancer,
   "Moth dust stopped activating the clockwork music-box dancer");
  // The train offers an independent parcel branch as well as delivering
  // the written message. Both physical outputs must be reachable.
  await act(page,"thing:train");
  await collect(page,"parcel");
  await useItem(page,"parcel","dog");
  await collect(page,"postcard");
  await page.locator('#ncInventory [data-item="postcard"]').click();
  assert(await page.evaluate(()=>
   window.CriloNothingHereCube.canUseSelectedWithAction("cube-offer")),
   "The postcard cannot enter the physical cube offering port");
  await act(page,"cube-offer");
  assert((await state(page)).portal,
   "Postcard never revealed the miniature portal scene");
  await useItem(page,"letter","train");
  assert((await state(page)).letterMailed,"Train failed to mail the letter");
  await collect(page,"envelope");
  await useItem(page,"envelope","door");
  const final=await state(page);
  assert(final.doorReplied&&final.seen.includes("return-letter"),
   "Returned envelope never opened the last door secret");
  for(const item of ["fork","seal","cylinder","tape","letter","envelope"])
   assert(!final.pocket.includes(item)&&!final.pendingPickups.includes(item),
    "Downstream mechanism duplicated spent "+item);
  await page.reload({waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForFunction(()=>window.__nothing3DPreview?.ready,null,{timeout:90000});
  const restored=await state(page);
  assert(restored.doorReplied&&restored.letterMailed&&restored.tapeInserted&&
   restored.cylinderMounted&&restored.serviceSealInserted&&restored.train&&
   restored.portal&&restored.dancer&&!restored.pendingPickups.includes("envelope")&&
   !restored.pendingPickups.includes("seal"),
   "Reloading restored spent late-game parts or lost final secret");
  await close();
  console.log("PASS: fork/shutter/wax/tape/clock, lift/lens/stars/railway, moth/dancer, parcel/postcard/portal, and envelope/door");
 }
 console.log("PASS: all second-coin orders, actual 3D clicks, legacy save repair, and downstream mechanisms");
}finally{
 await browser.close();
}
