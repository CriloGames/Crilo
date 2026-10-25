import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const url='http://127.0.0.1:4173/secrets.html?classic=1';
const sample=()=>page.evaluate(()=>{
 const button=document.querySelector('#ncZoomIn');
 const zoom=document.querySelector('#ncZoomAmount');
 const css=[...document.styleSheets].filter(s=>s.href?.includes('cube-physical.css')).map(s=>s.href);
 return {theme:document.documentElement.dataset.theme,
  body:document.body.className,
  matched:button?.matches('html[data-theme="dark"] body.nc-page .nc-inspection-controls .nc-zoom-controls button'),
  css,buttonBackground:button?getComputedStyle(button).backgroundColor:null,
  buttonColor:button?getComputedStyle(button).color:null,
  zoomColor:zoom?getComputedStyle(zoom).color:null,
  html:button?.outerHTML};
});
try{
 await page.addInitScript(()=>localStorage.setItem('crilo_theme','dark'));
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('#ncZoomIn').waitFor();
 let state=await sample();
 console.log('Dark theme initial:',JSON.stringify(state));
 assert(state.css.length,'Physical stylesheet not linked or loaded');
 assert.equal(state.theme,'dark','Theme bridge did not honor saved dark preference');
 assert(state.matched,'Dark controls CSS selector does not match the actual DOM');
 assert.equal(state.buttonBackground,'rgb(48, 64, 71)','Dark zoom button remains white');
 assert.equal(state.zoomColor,'rgb(219, 233, 229)','Dark zoom value has unreadable text');
 assert.equal(await page.locator('#ncZoomIn').evaluate(el=>getComputedStyle(el).transitionDuration),'0s',
  'A hardware-constrained browser may leave the dark-theme button mid-transition');
 await page.evaluate(()=>{
   localStorage.setItem('crilo_theme','light');
   document.documentElement.dataset.theme='light';
 });
 // The toolbar intentionally animates its background for .15s. Test its
 // settled visible colors rather than the first transition frame.
 await page.waitForTimeout(275);
 state=await sample();
 console.log('Theme restored to light:',JSON.stringify(state));
 assert.notEqual(state.buttonBackground,'rgb(48, 64, 71)','Theme is stuck in dark mode');
 console.log('PASS: mobile toolbar loads, persisted dark color renders, and light mode restores');
 // A fresh game remains safe until players choose Reset TWICE: once to
 // open the compact confirmation, then explicitly inside that dialog.
 const existingProgress=await page.evaluate(()=>{
  localStorage.setItem('crilo_other_game_test_save','keep-me');
  window.CriloNothingHereCube.activatePhysical('latch');
  return window.CriloNothingHereCube.getState().seen.length;
 });
 assert(existingProgress>=2,'Could not create a local Nothing Here test save');
 assert.equal(await page.locator('#ncConfirmCubeReset').count(),0,
  'Destructive action must not exist in the page before confirmation');
 await page.locator('#ncResetCubeBtn').click();
 assert.equal(await page.locator('#ncModalTitle').innerText(),'Reset the cube?',
  'The Reset the Cube button did not open the correct warning');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'ncCancelCubeReset',
  'The safer Cancel action must receive initial focus');
 const compact=await page.locator('#ncModal .nc-modal').boundingBox();
 assert(compact?.width<=366,
  'Reset confirmation should be a smaller popup, not a full-size modal');
 assert.match(await page.locator('#ncModalBody').innerText(),/this browser|saved in this browser/i,
  'Reset confirmation did not explain what would be erased');
 assert.equal((await page.evaluate(()=>window.CriloNothingHereCube.getState())).seen.length,existingProgress,
  'Opening reset confirmation erased the progress before confirmation');
 await page.keyboard.press('Escape');
 assert(await page.locator('#ncModal').isHidden(),
  'Escape must dismiss the reset confirmation');
 assert.equal((await page.evaluate(()=>window.CriloNothingHereCube.getState())).seen.length,existingProgress,
  'Escape unexpectedly erased the game');
 await page.locator('#ncResetCubeBtn').click();
 await page.locator('#ncCancelCubeReset').click();
 assert(await page.locator('#ncModal').isHidden(),
  'Cancel must dismiss the reset popup');
 assert.equal((await page.evaluate(()=>window.CriloNothingHereCube.getState())).seen.length,existingProgress,
  'Cancel unexpectedly erased the game');
 await page.locator('#ncResetCubeBtn').click();
 await Promise.all([
  page.waitForNavigation({waitUntil:'domcontentloaded',timeout:30000}),
  page.locator('#ncConfirmCubeReset').click()
 ]);
 await page.waitForFunction(()=>!!window.CriloNothingHereCube,{timeout:20000});
 const afterReset=await page.evaluate(()=>({
  discoveries:window.CriloNothingHereCube.getState().seen.length,
  items:window.CriloNothingHereCube.getState().pocket.length,
  counter:document.querySelector('#ncCount').textContent,
  otherSave:localStorage.getItem('crilo_other_game_test_save'),
  theme:localStorage.getItem('crilo_theme'),
  hasButton:!!document.getElementById('ncResetCubeBtn')
 }));
 assert.deepEqual(afterReset,{discoveries:0,items:0,counter:'0',
  // The test's init script reapplies the saved dark preference on each navigation.
  // Resetting the cube must leave that preference untouched.
  otherSave:'keep-me',theme:'dark',hasButton:true},
  'Reset did not cleanly restart this cube, or damaged another save: '+JSON.stringify(afterReset));
 console.log('PASS: small two-step reset dialog, Escape, Cancel, confirmed restart and isolated localStorage');
}finally{await browser.close()}
