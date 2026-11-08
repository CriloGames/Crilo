// Real WebGL pointer regression for Nothing Here's mounted miniature cat.
// Runs with isolated localStorage; no live account or progress is touched.
import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:[
 "--enable-webgl","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"
]});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1280,height:860},reducedMotion:"reduce"});
 const page=await context.newPage();
 page.on("pageerror",error=>errors.push(error.message));
 const stub=`window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:null},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
 signOut:async()=>({error:null})},
 rpc:async()=>({data:null,error:null}),
 from:()=>({select(){return this},eq(){return this},order(){return this},
 limit:async()=>({data:[],error:null}),in:async()=>({data:[],error:null}),
 maybeSingle:async()=>({data:null,error:null})})
})};`;
 await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*",
  route=>route.fulfill({status:200,body:stub,contentType:"application/javascript"}));
 await page.addInitScript(()=>{
  // Preserve the state created by the first physical click across reload.
  if(sessionStorage.getItem("nc-cat-seeded"))return;
  localStorage.setItem("crilo_nothing_here_cube_v3",JSON.stringify({
   seen:["first","door","dog"],door:true,doorOpen:true,
   pocket:[],pendingPickups:[]
  }));
  sessionStorage.setItem("nc-cat-seeded","yes");
 });
 await page.goto("http://127.0.0.1:4173/secrets.html",{
  waitUntil:"domcontentloaded",timeout:45000
 });
 await page.waitForFunction(()=>window.__nothing3DPreview?.ready&&
  document.body.classList.contains("nc-physical-ready"),
  null,{timeout:90000});
 const before=await page.evaluate(()=>{
  const game=window.__nothing3DPreview;
  const hit=game.projectPhysicalPuzzleControl("thing:cat");
  return {point:hit,action:hit?game.getPhysicalActionAt(hit.x,hit.y):null,
   pose:game.physicalScenePose,targets:game.physicalPuzzleActions};
 });
 assert(before.pose.catMounted&&Number.isFinite(before.pose.catPawAngle),
  "The cat is not attached to a real 3D mount or its paw is missing");
 assert(before.targets.includes("thing:cat"),
  "The cat is rendered but has no separately clickable target");
 assert.equal(before.point?.pick,"thing:cat",
  "The cat is not reachable by a real projected pointer: "+JSON.stringify(before.point));
 assert.equal(before.action,"thing:cat",
  "A visible part obscures the cat hit target: "+JSON.stringify(before));
 await page.locator("#stage canvas").click({
  position:{x:before.point.x,y:before.point.y},timeout:25000
 });
 const state=()=>page.evaluate(()=>window.CriloNothingHereCube.getState());
 const after=await state();
 assert(after.catNudged&&after.barked&&after.squirrel&&after.vase,
  "Touching the physical cat failed to cause the saved dog/squirrel/vase chain");
 assert(after.pendingPickups.includes("acorn")&&
  after.pendingPickups.includes("spring"),
  "Cat interaction did not expose two real vase collectibles");
 const beforeReloadCount=after.seen.length;
 await page.reload({waitUntil:"commit",timeout:90000});
 await page.waitForFunction(()=>window.__nothing3DPreview?.ready,
  null,{timeout:90000});
 const loaded=await state();
 assert(loaded.catNudged&&loaded.barked&&loaded.vase,
  "Reload reverted cat state or the released vase");
 assert.equal(loaded.seen.length,beforeReloadCount,
  "Reload created a surprise secret or erased an earned one");
 await page.evaluate(()=>window.__nothing3DPreview.clickAction("thing:cat"));
 const again=await state();
 assert.equal(again.dogHits,loaded.dogHits,
  "Repeated cat taps fired the once-only nudge again");
 assert.deepEqual(again.pendingPickups,loaded.pendingPickups,
  "Repeated cat taps duplicated vase contents");
 assert.deepEqual(errors,[],"Cat scenario produced browser page errors");
 console.log("PASS: mounted cat real pointer -> dog bark -> squirrel/vase -> saved one-time state");
 await context.close();
}finally{await browser.close();}
