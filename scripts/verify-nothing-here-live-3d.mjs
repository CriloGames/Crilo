// Verify that the default real 3D scene is actually the 60-secret game,
// not an unrelated prototype. The existing save key and story stay canonical.
import assert from "node:assert/strict";
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
const mock=`window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:null},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
 signOut:async()=>({error:null})},rpc:async()=>({data:null,error:null})
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
 const initial=await page.evaluate(()=>({
 state:window.CriloNothingHereCube.getState(),
 meshes:window.__nothing3DPreview.meshCount,
 controls:window.__nothing3DPreview.gameControls,
 visible:getComputedStyle(document.querySelector("#stage")).visibility
 }));
 assert.equal(initial.visible,"visible");
 assert(initial.meshes>300,"Live stage is not rendering actual physical geometry");
 for(const c of ["latch","seam","dot","dent","pressure","eye","eye-ring","vent-1","vent-2","vent-3","triangle","top-reed","foot","hatch","cube-offer","serial","shutter","right-bolt-1","hinge-0"]){
  assert(initial.controls.includes(c),"Missing physical target for original puzzle action: "+c);
 }
 const activate=async name=>page.evaluate(action=>window.__nothing3DPreview.clickAction(action),name);
 const state=async()=>page.evaluate(()=>window.CriloNothingHereCube.getState());
 await activate("front");
 assert.equal((await state()).a,true,"Physical front tray did not unlock original story");
 await activate("side");
 assert.equal((await state()).b,true,"Physical side tray did not unlock original story");
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
 // Exercise a real projected pointer click on the sculpted handbag, rather
 // than merely invoking an internal click API.
 const handbag=await page.evaluate(()=>window.__nothing3DPreview.projectPhysicalStoryObject("bag"));
 assert(handbag&&handbag.x>10&&handbag.x<1280&&handbag.y>10&&handbag.y<860,
  "The sculpted handbag has no usable visible canvas projection: "+JSON.stringify(handbag));
 await page.locator("#stage canvas").click({position:{x:handbag.x,y:handbag.y},timeout:30000});
 assert((await page.locator("#ncNarrator").innerText()).includes("bag is locked"),
  "Clicking the actual 3D handbag mesh did not reach the existing bag puzzle");
 console.log("PASS: actual physical-pointer raycast activates the sculpted bag");
 // Items selected from the existing inventory must combine with a real 3D
 // model and write to the existing save key, not a separate 3D progress store.
 await page.locator('#ncInventory [data-item="coin"]').click();
 assert.equal((await state()).selected,"coin");
 await activate("thing:machine");
 let selectedState=await state();
 assert(selectedState.seen.includes("machine")&&selectedState.pocket.includes("sugar"),
  "Coin into 3D vending machine failed the canonical inventory recipe");
 assert(!selectedState.pocket.includes("coin"),"The 3D machine duplicated a spent coin");
 console.log("PASS 3D miniature world: fifteen modeled actors, visible state, inventory recipe and machine discovery");
 for(let i=0;i<3;i++)await activate("triangle");
 assert.equal((await state()).top,true,"Three physical lid taps did not open original hatch");
 await activate("hatch");
 assert.equal((await state()).top,true);
 await activate("hatch-latch"); // An additional metal control still routes to the real triangle.
 await activate("dot");await activate("dot");await activate("dot");await activate("dot");
 assert.equal((await state()).redHits,4,"Red-dot sequence lost state parity");
 // Real users click meshes, not the programmatic inspection API. Project a
 // raised 3D button into the actual canvas and exercise pointer raycasting.
 const button=await page.evaluate(()=>window.__nothing3DPreview.projectGameControl("dot"));
 assert(button&&button.x>0&&button.y>0,
  "Red button does not have a visible projected position");
 await page.locator("#stage canvas").click({position:{x:button.x,y:button.y},timeout:30000});
 assert.equal((await state()).redHits,5,
  "Clicking a visible physical red button did not trigger the original puzzle");
 for(let i=0;i<3;i++)await activate("pressure");
 await activate("serial");
 for(const n of [0,1,2])await activate("front-screw-"+n);
 let s=await state();
 assert(s.screws.length===3,"Three physical faceplate screws did not reach the original backend");
 await activate("cube-offer");
 s=await state();
 assert(s.plateOpen,"The original faceplate did not open from the physical 3D receiver");
 assert(s.seen.includes("faceplate")&&s.seen.includes("pipe")&&s.seen.includes("drawer"),
  "Physical actions failed to award the existing discovery catalog");
 await page.waitForTimeout(1400);
 const once=await state();
 assert(once.pocket.includes("tooth")&&once.pocket.includes("thread")&&once.pocket.includes("pipe"),
  "Existing automatic physical compartment item pickups stopped working");
 assert(await page.locator("#ncCount").innerText()!=="0","Live discovery counter did not advance");
 assert.equal(await page.locator("#ncPhysicalToggle").getAttribute("aria-pressed"),"true");
 const original=await page.evaluate(()=>localStorage.getItem("crilo_nothing_here_cube_v3"));
 assert(original && JSON.parse(original).plateOpen,"3D progression was not stored in the existing save slot");
 console.log("PASS real 3D: physical geometry, 60-secret progression, 3 compartments, item pickup and saved faceplate.");
 // The accessibility/classic fallback must restore exactly the same run.
 await page.goto("http://127.0.0.1:4173/secrets.html?classic=1",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>!!window.CriloNothingHereCube,{timeout:30000});
 const classic=await page.evaluate(()=>window.CriloNothingHereCube.getState());
 assert(classic.plateOpen&&classic.a&&classic.b&&classic.top,"Classic view did not preserve the physical session");
 assert(await page.locator("#ncCube").isVisible(),"Classic 3D fallback is no longer available");
 assert.equal(await page.locator("#ncPhysicalToggle").getAttribute("aria-pressed"),"false");
 // Mobile physical version still loads, and 3D controls remain available.
 await page.setViewportSize({width:390,height:844});
 await page.goto("http://127.0.0.1:4173/secrets.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>window.__nothing3DPreview?.ready&&document.body.classList.contains("nc-physical-ready"),{timeout:60000});
 assert.equal((await state()).plateOpen,true,"Mobile view lost the same saved run");
 const bounds=await page.locator("#stage canvas").boundingBox();
 assert(bounds&&bounds.width>200&&bounds.width<=390,"Real 3D mobile canvas does not fit viewport");
 assert.equal(errors.length,0,"3D integration produced browser exceptions: "+errors.join(" | "));
 console.log("PASS: desktop, mobile, classic fallback, persisted 60-secret engine, and zero browser exceptions");
}finally{await browser.close()}
