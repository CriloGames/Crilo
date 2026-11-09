// Browser QA: fullscreen must keep the real 3D cube, inventory, and dialogs.
// Run from repository root with the game served at 127.0.0.1:4173.
import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:[
 "--enable-webgl","--use-gl=angle","--use-angle=swiftshader",
 "--enable-unsafe-swiftshader"
]});
const url=process.env.NOTHING_HERE_TEST_URL||
 "http://127.0.0.1:4173/secrets.html";
const supabaseMock=`window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:null},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
 signOut:async()=>({error:null})},
 rpc:async()=>({data:null,error:null}),
 from:()=>({select(){return this},eq(){return this},order(){return this},
 limit:async()=>({data:[],error:null}),
 in:async()=>({data:[],error:null}),
 maybeSingle:async()=>({data:null,error:null})})
})};`;
const cases=[
 {name:"desktop",viewport:{width:1280,height:800}},
 {name:"mobile",viewport:{width:390,height:844}}
];
try{
 for(const test of cases){
  const page=await browser.newPage({viewport:test.viewport});
  const errors=[];
  page.on("pageerror",e=>errors.push(String(e)));
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*",
   route=>route.fulfill({status:200,body:supabaseMock,
    contentType:"application/javascript"}));
  await page.goto(url,{waitUntil:"domcontentloaded",timeout:75000});
  await page.waitForFunction(()=>
   window.__nothing3DPreview?.ready&&
   document.body.classList.contains("nc-physical-ready"),
   null,{timeout:65000,polling:250});
  const initial=await page.evaluate(()=>({
   fullscreen:!!document.fullscreenElement,
   inventory:!!document.getElementById("ncInventory"),
   stageWidth:document.getElementById("stage").clientWidth,
   state:JSON.stringify(window.CriloNothingHereCube?.getState?.().seen||[])
  }));
  assert(initial.inventory&&initial.stageWidth>150);
  const button=page.locator("#ncFullscreenToggle");
  await button.click({timeout:16000});
  await page.waitForFunction(()=>
   document.fullscreenElement===document.body||
   document.body.classList.contains("nc-pseudo-fullscreen"),
   null,{timeout:9000});
  const full=await page.evaluate(()=>({
   pressed:document.getElementById("ncFullscreenToggle").getAttribute("aria-pressed"),
   label:document.getElementById("ncFullscreenToggle").getAttribute("aria-label"),
   bodyFull:document.fullscreenElement===document.body,
   fallback:document.body.classList.contains("nc-pseudo-fullscreen"),
   stage:(()=>{const r=document.getElementById("stage").getBoundingClientRect();
    const c=document.querySelector("#stage canvas").getBoundingClientRect();
    return {width:r.width,height:r.height,canvasWidth:c.width,canvasHeight:c.height}})(),
   navHidden:getComputedStyle(document.querySelector(".crilo-game-topbar")).display==="none",
   inventory:!!document.querySelector("#ncInventory"),
   zoom:!!document.querySelector("#ncZoomIn"),
   seen:JSON.stringify(window.CriloNothingHereCube?.getState?.().seen||[])
  }));
  assert.equal(full.pressed,"true");
  assert.match(full.label,/Exit/);
  assert(full.stage.width>250&&full.stage.height>320&&
   Math.abs(full.stage.canvasWidth-full.stage.width)<2&&
   Math.abs(full.stage.canvasHeight-full.stage.height)<2,
   "Three.js canvas did not resize into fullscreen: "+JSON.stringify(full.stage));
  assert(full.navHidden&&full.inventory&&full.zoom,
   "Fullscreen lost navigational focus or playable controls");
  assert.equal(full.seen,initial.state,"Fullscreen changed saved discoveries");
  // Dialog is outside #ncMain. Fullscreen on BODY ensures it remains in
  // the fullscreen top-level element instead of hiding behind the browser.
  await page.locator("#ncResetCubeBtn").click({timeout:12000});
  await page.waitForFunction(()=>!document.getElementById("ncModal").hidden,
   null,{timeout:5000});
  assert(await page.locator("#ncModalClose").isVisible(),
   "Fullscreen hid the reset confirmation dialog");
  await page.locator("#ncModalClose").click();
  assert(await page.locator("#ncModal").isHidden());
  if(test.name==="desktop"){
   await page.keyboard.press("Escape");
   try{
    await page.waitForFunction(()=>
     !document.fullscreenElement&&
     !document.body.classList.contains("nc-pseudo-fullscreen"),
     null,{timeout:3000});
   }catch{
    // Headless Chromium can block Esc from exiting its native browser
    // fullscreen; the visible Exit button remains the guaranteed path.
    await button.click();
   }
  }else await button.click();
  await page.waitForFunction(()=>
   !document.fullscreenElement&&
   !document.body.classList.contains("nc-pseudo-fullscreen"),
   null,{timeout:7000});
  assert.equal(await button.getAttribute("aria-pressed"),"false");
  const restored=await page.evaluate(()=>({
   width:document.getElementById("stage").getBoundingClientRect().width,
   canvas:document.querySelector("#stage canvas").getBoundingClientRect().width,
   label:document.getElementById("ncFullscreenToggle").getAttribute("aria-label")
  }));
  assert(restored.width>150&&
   Math.abs(restored.width-restored.canvas)<2&&
   /Play Nothing Here/.test(restored.label),
   "Exiting fullscreen didn't restore the playable canvas and toggle");
  // Simulate iPhone Safari and embedded browsers lacking the fullscreen API.
  await page.evaluate(()=>{
   Object.defineProperty(document,"fullscreenEnabled",{value:false,configurable:true});
   // Simulate a truly unsupported device, not merely a browser refusing
   // a native request while still exposing its method.
   Object.defineProperty(document.body,"requestFullscreen",
    {value:undefined,configurable:true});
   Object.defineProperty(document.body,"webkitRequestFullscreen",
    {value:undefined,configurable:true});
  });
  await button.click();
  const fallback=await page.evaluate(()=>({
   active:document.body.classList.contains("nc-pseudo-fullscreen"),
   enabled:document.fullscreenEnabled,
   native:!!document.fullscreenElement,
   pressed:document.getElementById("ncFullscreenToggle")?.getAttribute("aria-pressed")
  }));
  assert(fallback.active,"iOS fallback did not activate: "+JSON.stringify(fallback));
  await page.keyboard.press("Escape");
  await page.waitForFunction(()=>
   !document.body.classList.contains("nc-pseudo-fullscreen"),
   null,{timeout:5000});
  assert.equal(await button.getAttribute("aria-pressed"),"false");
  assert(!errors.some(e=>/fullscreen|requestFullscreen|ResizeObserver/.test(e)),
   "Fullscreen created a page exception: "+errors.join(" | "));
  console.log("PASS: "+test.name+" native fullscreen/exit, responsive Three.js, inventory, reset dialog, iOS fallback");
  await page.close();
 }
}finally{
 await browser.close();
}
