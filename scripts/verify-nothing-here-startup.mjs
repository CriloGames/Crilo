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
   viewport:check.viewport,reducedMotion:"reduce"
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
    return {
     ready:view?.ready===true,
     physical:document.body.classList.contains("nc-physical-ready"),
     retry:!!document.getElementById("ncRetry3D"),
     message:document.querySelector("#nc3DLoadDiagnostic code")?.textContent||"",
     status:document.getElementById("status")?.textContent||"",
     canvas:!!canvas&&canvas.width>0&&canvas.height>0,
     meshCount:view?.meshCount||0,
     mazeChannels:view?.physicalGearMaze?.networkChannels||0,
     progress:state?{cell:state.gearMazeCell,solved:state.gearMazeSolved,
      played:state.gearMazePlayed}:null
    };
   });
   assert(result.ready&&result.physical&&!result.retry&&result.canvas&&
    result.meshCount>80&&result.mazeChannels>0,
    "The real WebGL game did not initialize: "+JSON.stringify(result));
   if(check.seed){
    assert.equal(result.progress?.cell,check.seed.gearMazeCell,
     "Loading the 3D scene corrupted the saved maze position");
    assert.equal(result.progress?.solved,false,
     "Loading a saved game incorrectly marked the maze complete");
   }
   assert.deepEqual(errors,[],"Browser reported errors during 3D startup");
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
else console.log("PASS: 3D startup regression gate, both browser states");
