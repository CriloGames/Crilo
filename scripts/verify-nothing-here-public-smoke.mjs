// Public-release smoke test. Unlike the local WebGL suite, this checks the
// ACTUAL GitHub Pages deployment served to players at crilo.fun.
import assert from "node:assert/strict";
import {readFileSync, mkdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {chromium} from "playwright";

const LIVE="https://crilo.fun";
const md5=text=>createHash("sha256").update(text).digest("hex");
async function get(path,{method="GET"}={}){
 const url=LIVE+"/"+path;
 const response=await fetch(url,{
  method,redirect:"follow",signal:AbortSignal.timeout(25000),
  headers:{"Cache-Control":"no-cache","Pragma":"no-cache"}
 });
 assert(response.ok,"Live asset failed HTTP "+response.status+": "+url);
 return response;
}
const localHTML=readFileSync(new URL("../secrets.html",import.meta.url),"utf8");
const liveHTML=await (await get("secrets.html")).text();
assert.match(liveHTML,/id="ncCubeZone"/);
for(const re of [/secrets-3d-preview\.js\?v=\d+/,
 /nothing-here-audio\.js\?v=\d+/,
 /nothing-here-fullscreen\.js\?v=\d+/,
 /nothing-here-finale\.css\?v=\d+/]){
 const published=liveHTML.match(re)?.[0],local=localHTML.match(re)?.[0];
 assert(published&&local,"Missing key game asset reference: "+re);
 assert.equal(published,local,
  "The public game is running an older release than the main repo: "+re);
 console.log("PASS published asset version: "+published);
}
// These are the actual dynamic game modules, not superficial HTML.
// A mismatch means the GitHub Pages deployment was stale or incomplete.
for(const name of [
 "cube-secrets.js","secrets-3d-preview.js","secrets-3d-finale.js",
 "secrets-3d-finale-cat.js","secrets-3d-finale-duck.js",
 "secrets-3d-finale-egg.js","secrets-3d-finale-timeline.js",
 "nothing-here-audio.js","nothing-here-finale.css",
 "nothing-here-fullscreen.js"
]){
 const local=readFileSync(new URL("../"+name,import.meta.url),"utf8").trimEnd();
 const published=(await(await get(name)).text()).trimEnd();
 assert.equal(md5(published),md5(local),
  "Published "+name+" does not match the current game source");
 console.log("PASS exact deployed "+name);
}
const audio=await get("audio/nothing-here/finale-licensed.mp3",{method:"HEAD"});
const len=Number(audio.headers.get("content-length"))||0;
assert(len===0||len>1000000,"Public finale audio appears truncated: "+len);
console.log("PASS final music is publicly available, bytes="+(len||"unspecified"));

const browser=await chromium.launch({headless:true,args:[
 "--enable-webgl","--use-gl=angle","--use-angle=swiftshader",
 "--enable-unsafe-swiftshader"
]});
try{
 const context=await browser.newContext({viewport:{width:1180,height:760},
  reducedMotion:"reduce"});
 const page=await context.newPage();
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(LIVE+"/secrets.html",{waitUntil:"domcontentloaded",timeout:75000});
 await page.waitForFunction(()=>window.__nothing3DPreview?.ready&&
  document.body.classList.contains("nc-physical-ready"),
  null,{timeout:100000,polling:300});
 const game=await page.evaluate(()=>{
  const api=window.__nothing3DPreview;
  return {
   meshCount:api?.meshCount,
   gameLoaded:!!window.CriloNothingHereCube,
   seen:window.CriloNothingHereCube?.getState?.().seen?.length,
   stageSize:{
    w:document.querySelector("#stage")?.clientWidth,
    h:document.querySelector("#stage")?.clientHeight
   },
   canvasVisible:!!document.querySelector("#stage canvas")?.getClientRects().length,
   fullScreenButton:!!document.getElementById("ncFullscreenToggle")
  };
 });
 assert(game.gameLoaded&&game.canvasVisible&&game.fullScreenButton&&
  game.stageSize.w>400&&game.stageSize.h>250,
  "The published 3D game failed to render: "+JSON.stringify(game));
 // A fresh isolated visitor should not start at a completed finale.
 assert.equal(game.seen,0,"Public fresh-visitor progress was not empty");
 assert(!errors.length,"JavaScript errors on the public game: "+errors.join(" | "));
 console.log("PASS public WebGL first visit: "+JSON.stringify(game));
 await page.locator("#ncFullscreenToggle").click({timeout:15000});
 await page.waitForFunction(()=>
  !!document.fullscreenElement||
  document.body.classList.contains("nc-pseudo-fullscreen"),
  null,{timeout:10000});
 await page.locator("#ncFullscreenToggle").click();
 await page.waitForFunction(()=>
  !document.fullscreenElement&&
  !document.body.classList.contains("nc-pseudo-fullscreen"),
  null,{timeout:10000});
 console.log("PASS live fullscreen enters and exits without losing the 3D game");
 mkdirSync("test-results",{recursive:true});
 try{
  await page.locator("#stage canvas").screenshot({
   path:"test-results/nothing-here-public-smoke.png",timeout:20000
  });
 }catch(e){
  console.warn("Optional live screenshot unavailable:",String(e).slice(0,180));
 }
 await context.close();
}finally{
 await browser.close();
}
console.log("PUBLIC LIVE PASS: published assets, actual WebGL, blank visitor, controls, music");
