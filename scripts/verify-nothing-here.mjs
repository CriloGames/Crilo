// Nothing Here has one playable view: the real 3D cube.
// Lightweight routing/UI regression; the full 60-secret physical playthrough
// runs separately in verify-nothing-here-live-3d.mjs.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const html=readFileSync(new URL("../secrets.html",import.meta.url),"utf8");
const source=readFileSync(new URL("../cube-secrets.js",import.meta.url),"utf8");
const titles=[...source.matchAll(/^\\s*\\['([a-z-]+)','/gm)].map(m=>m[1]);
assert.equal(titles.length,60,"Original secrets were lost");
assert.equal(new Set(titles).size,60,"Duplicate secret IDs");
assert(!html.includes('id="ncPhysicalToggle"'),"Legacy Classic switch returned");
assert(!html.includes('Enable real 3D'),"Legacy view switch copy returned");
assert(html.includes('secrets-3d-preview.js'),"Physical Three.js module missing");
assert(!source.includes("location.search).get('classic')"),
 "Classic mode special-cases may corrupt saved uncollected items");

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1230,height:820}});
const base="http://127.0.0.1:4173/secrets.html";
const testProgress={
 seen:["first","drawer","mouse"],
 pocket:["tooth"],
 pendingPickups:["coin","prism"],
 a:true,drawerTaken:true,mouse:true,left:true,bag:true
};
await page.addInitScript(seed=>{
 localStorage.setItem("crilo_nothing_here_cube_v3",JSON.stringify(seed));
},testProgress);
try{
 await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
 await page.waitForFunction(()=>window.CriloNothingHereCube?.getState?.().seen?.length===3,
  null,{timeout:15000});
 const check=async()=>{
  const view=await page.evaluate(()=>{
   const sel=id=>document.querySelector(id);
   const visible=id=>!!sel(id)&&getComputedStyle(sel(id)).display!=="none";
   return {
    toggle:!!sel("#ncPhysicalToggle"),
    stage:visible("#stage"),
    illustratedCube:visible("#ncCube"),
    flatMiniatures:visible("#ncSideObjects"),
    legacyDoor:visible("#ncDoorScene"),
    reset:!!sel("#ncResetCubeBtn"),
    journal:!!sel("#ncJournalBtn"),
    combine:sel(".nc-combine-guide")?.textContent||"",
    progress:window.CriloNothingHereCube.getState()
   };
  });
  assert(!view.toggle&&view.stage&&!view.illustratedCube&&!view.flatMiniatures&&
   !view.legacyDoor&&view.reset&&view.journal&&/combine items/i.test(view.combine),
   "Legacy gameplay is visible or essential 3D controls are missing: "+JSON.stringify(view));
  assert.deepEqual(view.progress.pendingPickups.sort(),["coin","prism"],
   "The old Classic route must not automatically collect waiting 3D rewards");
  assert.deepEqual(view.progress.pocket,["tooth"],
   "Removing Classic changed saved player inventory");
 };
 await check();
 console.log("PASS: physical cube is the only visible game, player saves untouched");
 await page.goto(base+"?classic=1",{waitUntil:"domcontentloaded",timeout:30000});
 await page.waitForFunction(()=>!new URL(location.href).searchParams.has("classic")&&
  !!window.CriloNothingHereCube?.getState,{timeout:15000});
 await check();
 assert.equal(new URL(page.url()).pathname,"/secrets.html");
 console.log("PASS: former Classic link opens only the 3D game and retains progress");

 // A failed 3D module must show a Retry control instead of reviving Classic.
 await page.route("**/secrets-3d-preview.js*",route=>route.abort());
 await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
 await page.locator("#ncRetry3D").waitFor({timeout:20000});
 assert(await page.locator("#ncCube").isHidden()&&
  await page.locator("#ncSideObjects").isHidden(),
  "3D import error exposed the deleted Classic view");
 assert.match(await page.locator("#status").innerText(),/3D cube couldn't load/);
 console.log("PASS: 3D load failure offers Retry without a Classic fallback");
}finally{
 await browser.close();
}
