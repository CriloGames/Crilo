// Verify all 33 item silhouettes in a real browser without loading WebGL.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const source=readFileSync(new URL("../cube-secrets.js",import.meta.url),"utf8");
const namesText=source.split("const names={")[1]?.split("const glyphs=")[0]||"";
const ids=[...namesText.matchAll(/\b([a-z][a-z0-9_]*):'/g)].map(match=>match[1]);
assert.equal(ids.length,33,"Pocket catalog should contain exactly 33 items");
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
 await page.goto("http://127.0.0.1:4173/secrets.html",{
  waitUntil:"domcontentloaded",timeout:30000
 });
 await page.waitForFunction(()=>document.querySelectorAll("#ncInventory .nc-item").length===33,
  null,{timeout:30000});
 assert.equal(await page.locator("#ncPocketCount").innerText(),"33 carried",
  "The pocket count must represent actual inventory, not unrevealed rewards");
 assert.equal(await page.locator("#ncPocketCount").getAttribute("aria-label"),"33 items carried",
  "The number of carried objects needs an accessible label");
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
 assert.equal(observed.length,33);
 assert.deepEqual(observed.map(item=>item.id).sort(),ids.sort(),
  "Saved pocket did not restore the complete item catalog");
 assert(observed.every(item=>item.hasSvg&&item.geometry?.length>12&&
  item.shapeW>8&&item.shapeH>8&&item.width>=24&&item.height>=24&&
  item.hitHeight>=42&&item.label.length>2&&item.material&&item.accessible),
  "Some inventory artwork is missing or illegible: "+JSON.stringify(observed.filter(
   item=>!(item.hasSvg&&item.shapeW>8&&item.shapeH>8&&item.width>=24&&
    item.height>=24&&item.hitHeight>=42&&item.label.length>2&&item.material&&item.accessible)
  )));
 assert.equal(new Set(observed.map(item=>item.geometry)).size,33,
  "Separate collectibles share indistinguishable placeholder artwork");
 // The newly picked-up item's green flash must work without hovering it.
 // Previously physical WebGL mode disabled the arrival animation entirely.
 const arrival=await page.evaluate(()=>{
  const item=document.querySelector('#ncInventory [data-item="lens"]');
  const resting=getComputedStyle(item).animationName;
  item.classList.add("nc-item-new");
  const styles=getComputedStyle(item);
  const pulse={name:styles.animationName,duration:styles.animationDuration,
   hoverMatches:item.matches(":hover")};
  item.classList.remove("nc-item-new");
  return {resting,pulse};
 });
 assert.equal(arrival.resting,"none",
  "Items restored from saves must not flash as though just collected");
 assert.equal(arrival.pulse.name,"ncPocketCollectedFlash",
  "The picked-up item needs an independent green flash: "+JSON.stringify(arrival));
 assert.equal(arrival.pulse.duration,"1.05s",
  "Collected-item confirmation should be quick, not an endless glow");
 // A legacy translateY(-3px) on :hover caused the pointer to leave
 // the bottom pixel of a button, creating a hover/unhover feedback loop.
 // Exercise precisely that boundary in Chromium, not just computed CSS.
 const bottomItem=page.locator('#ncInventory [data-item="lens"]');
 await bottomItem.scrollIntoViewIfNeeded();
 const beforeHover=await bottomItem.boundingBox();
 await page.mouse.move(beforeHover.x+beforeHover.width/2,
  beforeHover.y+beforeHover.height-1);
 await page.waitForTimeout(320);
 const edge=await bottomItem.evaluate(node=>({
  hovered:node.matches(":hover"),
  transform:getComputedStyle(node).transform,
  hit:document.elementFromPoint(
   node.getBoundingClientRect().left+node.offsetWidth/2,
   node.getBoundingClientRect().bottom-1)?.closest(".nc-item")===node
 }));
 const afterHover=await bottomItem.boundingBox();
 assert(edge.hovered&&edge.hit&&edge.transform==="none",
  "Inventory flickers when hovering its bottom edge: "+JSON.stringify(edge));
 assert(Math.abs(beforeHover.y-afterHover.y)<.25&&
  Math.abs(beforeHover.height-afterHover.height)<.25,
  "Inventory card changes position or height on hover");
 // Clicking a held item must not recreate the rest of the pocket's SVG
 // collection, so drag, focus and the arrival pulse remain continuous.
 await page.evaluate(()=>{
  window.__pocketUntouched=document.querySelector('#ncInventory [data-item="lens"]');
  window.__pocketClicked=document.querySelector('#ncInventory [data-item="key"]');
 });
 await page.locator('#ncInventory [data-item="key"]').click();
 const stable=await page.evaluate(()=>({
  selected:document.querySelector('#ncInventory [data-item="key"]')===window.__pocketClicked,
  sibling:document.querySelector('#ncInventory [data-item="lens"]')===window.__pocketUntouched
 }));
 assert(stable.selected&&stable.sibling,
  "Pocket item selection rebuilt stable SVG elements: "+JSON.stringify(stable));
 assert.equal(await page.evaluate(()=>window.CriloNothingHereCube.getState().selected),
  "key","Selecting an inventory icon no longer picks up the correct item");
 assert.equal(await page.locator('#ncInventory [data-item="key"]').getAttribute("aria-pressed"),
  "true","Selected pocket item no longer communicates state to assistive technology");
 const selectedBorder=await page.locator('#ncInventory [data-item="key"]')
  .evaluate(node=>({
   width:getComputedStyle(node).borderTopWidth,
   transform:getComputedStyle(node).transform
  }));
 assert.equal(selectedBorder.width,"1px",
  "Selecting an item must not enlarge its border and shift the inventory");
 assert.equal(selectedBorder.transform,"none",
  "Selected inventory card cannot leave the mouse hit area");
 assert.equal(await page.locator("#ncPocketCount").innerText(),"33 carried",
  "Selecting an item must not remove it from the pocket");
 await page.evaluate(()=>{document.documentElement.dataset.theme="dark"});
 const contrast=await page.locator('#ncInventory [data-item="lens"] .nc-item-icon')
  .evaluate(node=>getComputedStyle(node).color);
 assert(contrast!=="rgb(145, 106, 94)"&&contrast!=="rgb(0, 0, 0)",
  "Glass icons did not adjust for dark mode");
 assert.deepEqual(errors,[],"Pocket rendering threw a browser exception");
 console.log("PASS: all 33 distinct vector pocket items, readable icon size, 3D-only restore, selection and dark-mode contrast");
}finally{
 await browser.close();
}
