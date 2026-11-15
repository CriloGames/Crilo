// Mobile touch QA for Nothing Here, against real WebGL and real pointer events.
// Start a static server at http://127.0.0.1:4173 before running.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const html=readFileSync("secrets.html","utf8");
const three=readFileSync("secrets-3d-preview.js","utf8");
const pocket=readFileSync("cube-secrets.js","utf8");
const styles=readFileSync("nothing-here-mobile.css","utf8");
assert.match(html,/secrets-3d-preview\.js\?v=273/);
assert.match(html,/cube-secrets\.js\?v=93/);
assert.match(html,/nothing-here-mobile\.css\?v=1/);
assert.match(three,/function pickTouchAction\(clientX,clientY\)/);
assert.match(three,/const action=start\.action\|\|\(start\.pointerType==="touch"/);
assert.match(three,/clearHover\(\);\n\},true\); \/\/ Run before OrbitControls/);
assert.match(pocket,/button\.draggable=!window\.matchMedia/);
assert.match(pocket,/function pocketPointerUp\(e\)/);
assert.match(pocket,/pocketTouchActivation\.item===item\.dataset\.item/);
assert.match(styles,/\.nc-page \.nc-pocket \.nc-item\{/);

const base=process.env.NOTHING_HERE_TEST_URL||
 "http://127.0.0.1:4173/secrets.html";
const mock='window.supabase={createClient:()=>({'+
 'auth:{getSession:async()=>({data:{session:null},error:null}),'+
 'getUser:async()=>({data:{user:null},error:null}),'+
 'onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),'+
 'signOut:async()=>({error:null})},'+
 'rpc:async()=>({data:null,error:null}),'+
 'from:()=>({select(){return this},eq(){return this},order(){return this},'+
 'limit:async()=>({data:[],error:null}),in:async()=>({data:[],error:null}),'+
 'maybeSingle:async()=>({data:null,error:null})})})};';
const browser=await chromium.launch({headless:true,args:[
 "--enable-webgl","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"
]});

async function runMobile(width,height,includePickup){
 const context=await browser.newContext({
  viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true,
  reducedMotion:"reduce"
 });
 const page=await context.newPage();
 const errors=[];
 page.on("pageerror",e=>errors.push(String(e.message)));
 await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*",r=>
  r.fulfill({status:200,contentType:"application/javascript",body:mock}));
 await page.addInitScript(()=>{
  if(sessionStorage.getItem("nh_mobile_touch_seeded"))return;
  localStorage.setItem("crilo_nothing_here_cube_v3",JSON.stringify({
   seen:["first","drawer"],a:true,drawerTaken:false,
   pocket:["thread","flute"],pendingPickups:[],
   gearMazePlayed:true,gearMazeLayoutVersion:6,gearMazeCell:81
  }));
  sessionStorage.setItem("nh_mobile_touch_seeded","1");
 });
 try{
  await page.goto(base,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.__nothing3DPreview?.ready&&
   window.CriloNothingHereCube?.getState&&
   document.body.classList.contains("nc-physical-ready"),null,{timeout:105000});
  const state=()=>page.evaluate(()=>window.CriloNothingHereCube.getState());
  assert.equal(await page.locator("#stage canvas").count(),1);
  assert.equal((await state()).a,true,"Saved drawer must remain open");
  assert.equal((await state()).pocket.includes("thread"),true,"Saved item missing");
  const originalSeen=(await state()).seen.length;
  const thread=page.locator('#ncInventory [data-item="thread"]');
  await thread.tap();
  assert.equal((await state()).selected,"thread",
   "One mobile tap should select an inventory item exactly once");
  await thread.tap();
  assert.equal((await state()).selected,null,"Second tap should release item");
  assert.equal(await thread.getAttribute("draggable"),"false",
   "Touch inventory must not trigger native HTML drag");
  await page.locator('#ncInventory [data-item="flute"]').tap();
  assert.equal(await page.locator("#ncFluteTray").isVisible(),true);
  await page.locator('[data-flute-key="1"]').tap();
  await page.locator("#ncFluteClose").tap();
  assert.equal(await page.locator("#ncFluteTray").isVisible(),false);
  await page.locator("#ncZoomIn").tap();
  await page.locator("#ncZoomOut").tap();
  await page.locator("#ncPanMode").tap();
  assert.equal(await page.evaluate(()=>
   window.__nothing3DPreview.navigationState.panMode),true);
  await page.locator("#ncPanMode").tap();
  assert.equal(await page.evaluate(()=>
   window.__nothing3DPreview.navigationState.panMode),false);
  await page.locator("#ncViewReset").tap();
  await page.locator("#ncJournalBtn").tap();
  assert.equal(await page.locator("#ncModal").isVisible(),true);
  await page.locator("#ncModalClose").tap();
  await page.locator("#ncResetCubeBtn").tap();
  assert.equal(await page.locator("#ncModal").isVisible(),true);
  await page.locator("#ncCancelCubeReset").tap();
  assert.equal((await state()).seen.length,originalSeen,
   "Canceling reset must not erase progress");
  await page.locator("#ncSfxToggle").tap();
  await page.locator("#ncSfxToggle").tap();
  // Phone Safari may lack native fullscreen: entering/exiting must still be
  // reversible, with the pocket inside the viewport experience.
  await page.locator("#ncFullscreenToggle").tap();
  await page.waitForFunction(()=>document.body.classList.contains("nc-pseudo-fullscreen")||
   document.fullscreenElement===document.body,null,{timeout:3500});
  assert.ok(await page.locator("#ncPocket").isVisible());
  await page.locator("#ncFullscreenToggle").tap();
  await page.waitForFunction(()=>!document.body.classList.contains("nc-pseudo-fullscreen")&&
   document.fullscreenElement!==document.body,null,{timeout:3500});
  if(includePickup){
   await page.evaluate(()=>{
    window.__nothing3DPreview.setRotation(-13,0);
    window.__nothing3DPreview.setZoom(1.7);
   });
   await page.waitForTimeout(450);
   let target=await page.evaluate(()=>
    window.__nothing3DPreview.projectOriginalPickup("tooth"));
   if(target?.pick!=="pickup:tooth"){
    for(const [x,y] of [[-19,-33],[-9,0],[0,0],[-13,18],[-25,-15]]){
     await page.evaluate(([a,b])=>window.__nothing3DPreview.setRotation(a,b),[x,y]);
     await page.waitForTimeout(90);
     target=await page.evaluate(()=>
      window.__nothing3DPreview.projectOriginalPickup("tooth"));
     if(target?.pick==="pickup:tooth")break;
    }
   }
   assert.equal(target?.pick,"pickup:tooth",
    "Exposed key is not raycast-selectable on a phone: "+JSON.stringify(target));
   const box=await page.locator("#stage canvas").boundingBox();
   assert.ok(box,"WebGL canvas must have a mobile bounding box");
   // A long hold names the collectible but must NOT accidentally pocket it.
   const cdp=await context.newCDPSession(page);
   const px=box.x+target.x,py=box.y+target.y;
   await cdp.send("Input.dispatchTouchEvent",{
    type:"touchStart",touchPoints:[{x:px,y:py}]});
   await page.waitForTimeout(640);
   assert.equal((await state()).pocket.includes("tooth"),false,
    "Holding to inspect an item must not collect it");
   await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
   await page.touchscreen.tap(px,py);
   await page.waitForFunction(()=>
    window.CriloNothingHereCube.getState().pocket.includes("tooth"),
    null,{timeout:7000});
   assert.equal((await state()).pocket.includes("tooth"),true);
   await page.locator('#ncInventory [data-item="tooth"]').tap();
   assert.equal((await state()).selected,"tooth",
    "Collected item must be selectable on the same phone");
   await page.locator("#ncUnselect").tap();
   assert.equal((await state()).selected,null);
   const pocketLength=(await state()).pocket.length;
   await page.reload({waitUntil:"domcontentloaded"});
   await page.waitForFunction(()=>window.__nothing3DPreview?.ready,
    null,{timeout:105000});
   assert.equal((await state()).pocket.includes("tooth"),true,
    "Real touch pickup must persist across reloads");
   assert.equal((await state()).pocket.length,pocketLength,
    "Saved inventory must never duplicate a touched collectible");
   // Test a genuine one-finger swipe and two-finger pinch, not only buttons.
   const cdp2=await context.newCDPSession(page);
   const area=await page.locator("#stage canvas").boundingBox();
   const cx=area.x+area.width*.23,cy=area.y+area.height*.37;
   const beforeSwipe=await page.evaluate(()=>
    window.__nothing3DPreview.navigationState.camera);
   await cdp2.send("Input.dispatchTouchEvent",{type:"touchStart",
    touchPoints:[{x:cx,y:cy}]});
   for(let i=1;i<=7;i++){
    await cdp2.send("Input.dispatchTouchEvent",{type:"touchMove",
     touchPoints:[{x:cx+i*11,y:cy+i*2}]});
    await page.waitForTimeout(22);
   }
   await cdp2.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
   const afterSwipe=await page.evaluate(()=>
    window.__nothing3DPreview.navigationState.camera);
   assert.ok(Math.hypot(...afterSwipe.map((value,i)=>value-beforeSwipe[i]))>.03,
    "Swiping across the 3D stage must rotate the camera");
   await page.locator("#ncViewReset").tap();
   const beforePinch=await page.evaluate(()=>
    window.__nothing3DPreview.navigationState.camera);
   await cdp2.send("Input.dispatchTouchEvent",{type:"touchStart",
    touchPoints:[{x:cx-28,y:cy},{x:cx+28,y:cy}]});
   for(let i=1;i<=5;i++){
    await cdp2.send("Input.dispatchTouchEvent",{type:"touchMove",
     touchPoints:[{x:cx-28-i*12,y:cy},{x:cx+28+i*12,y:cy}]});
    await page.waitForTimeout(24);
   }
   await cdp2.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
   const afterPinch=await page.evaluate(()=>
    window.__nothing3DPreview.navigationState.camera);
   assert.ok(Math.hypot(...afterPinch.map((value,i)=>value-beforePinch[i]))>.03,
    "Pinching must zoom the 3D camera on mobile");
  }
  assert.equal(errors.length,0,"Mobile JS errors: "+errors.join("; "));
  const sizes=await page.evaluate(()=>({
   viewport:window.innerWidth,document:document.documentElement.scrollWidth
  }));
  assert.ok(sizes.document<=sizes.viewport+22,
   "Mobile layout overflows horizontally: "+JSON.stringify(sizes));
  console.log("PASS Nothing Here "+width+"×"+height+
   ": inventory, flute, zoom, move, reset, journal, sound, saved state"+
   (includePickup?", physical touch pickup":""));
 }finally{await context.close()}
}
try{
 await runMobile(390,844,true);
 await runMobile(768,1024,false);
}finally{await browser.close()}
