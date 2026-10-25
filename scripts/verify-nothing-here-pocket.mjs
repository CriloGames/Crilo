// Verify all 32 item silhouettes in a real browser without loading WebGL.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const source=readFileSync(new URL("../cube-secrets.js",import.meta.url),"utf8");
const namesText=source.split("const names={")[1]?.split("const glyphs=")[0]||"";
const ids=[...namesText.matchAll(/\b([a-z][a-z0-9_]*):'/g)].map(match=>match[1]);
assert.equal(ids.length,32,"Pocket catalog should contain exactly 32 items");
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on("pageerror",error=>errors.push(error.message));
await page.addInitScript(items=>{
 localStorage.setItem("crilo_nothing_here_cube_v3",JSON.stringify({
  seen:[],pocket:items,rx:-19,ry:-33
 }));
},ids);
try{
 await page.goto("http://127.0.0.1:4173/secrets.html?classic=1",{
  waitUntil:"domcontentloaded",timeout:30000
 });
 await page.waitForFunction(()=>document.querySelectorAll("#ncInventory .nc-item").length===32,
  null,{timeout:30000});
 const observed=await page.evaluate(()=>{
  const buttons=[...document.querySelectorAll("#ncInventory .nc-item")];
  return buttons.map(button=>{
   const path=button.querySelector("svg.nc-item-art path");
   const svg=button.querySelector("svg.nc-item-art");
   const icon=button.querySelector(".nc-item-icon");
   const box=svg?.getBoundingClientRect();
   const target=button.getBoundingClientRect();
   const shape=path?.getBBox();
   return {id:button.dataset.item,material:button.dataset.material,
    label:button.textContent.trim(),hasSvg:!!svg,
    geometry:path?.getAttribute("d"),shapeW:shape?.width,shapeH:shape?.height,
    width:box?.width,height:box?.height,hitHeight:target.height,
    iconColor:icon?getComputedStyle(icon).color:null,
    accessible:button.getAttribute("aria-pressed")!==null
   };
  });
 });
 assert.equal(observed.length,32);
 assert.deepEqual(observed.map(item=>item.id).sort(),ids.sort(),
  "Saved pocket did not restore the complete item catalog");
 assert(observed.every(item=>item.hasSvg&&item.geometry?.length>12&&
  item.shapeW>8&&item.shapeH>8&&item.width>=24&&item.height>=24&&
  item.hitHeight>=42&&item.label.length>2&&item.material&&item.accessible),
  "Some inventory artwork is missing or illegible: "+JSON.stringify(observed.filter(
   item=>!(item.hasSvg&&item.shapeW>8&&item.shapeH>8&&item.width>=24&&
    item.height>=24&&item.hitHeight>=42&&item.label.length>2&&item.material&&item.accessible)
  )));
 assert.equal(new Set(observed.map(item=>item.geometry)).size,32,
  "Separate collectibles share indistinguishable placeholder artwork");
 await page.locator('#ncInventory [data-item="key"]').click();
 assert.equal(await page.evaluate(()=>window.CriloNothingHereCube.getState().selected),
  "key","Selecting an inventory icon no longer picks up the correct item");
 assert.equal(await page.locator('#ncInventory [data-item="key"]').getAttribute("aria-pressed"),
  "true","Selected pocket item no longer communicates state to assistive technology");
 await page.evaluate(()=>{document.documentElement.dataset.theme="dark"});
 const contrast=await page.locator('#ncInventory [data-item="lens"] .nc-item-icon')
  .evaluate(node=>getComputedStyle(node).color);
 assert(contrast!=="rgb(145, 106, 94)"&&contrast!=="rgb(0, 0, 0)",
  "Glass icons did not adjust for dark mode");
 assert.deepEqual(errors,[],"Pocket rendering threw a browser exception");
 console.log("PASS: all 32 distinct vector pocket items, readable icon size, Classic restore, selection and dark-mode contrast");
}finally{
 await browser.close();
}
