// Complete Nothing Here browser puzzle-path regression.
// Run: node scripts/verify-nothing-here.mjs (requires Playwright + local static server)
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const rawJs=fs.readFileSync(new URL('../secret-room.js',import.meta.url),'utf8');
const rawHtml=fs.readFileSync(new URL('../secrets.html',import.meta.url),'utf8');
new Function(rawJs);
const all=[...rawJs.matchAll(/^\s*\['([^']+)','/gm)].map(m=>m[1]);
assert.equal(all.length,70,'Curated secret collection changed');
assert.equal(new Set(all).size,70,'Duplicated secret');
const html=rawHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,m=>
 m.includes('secret-room.js')||m.includes('theme-bridge.js')?m:'');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:850}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/secrets.html*',r=>r.fulfill({status:200,contentType:'text/html',body:html}));
await page.goto('http://127.0.0.1:4173/secrets.html',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>document.getElementById('srCount')?.textContent.includes('/ 70'));
// Nothing Here must use exactly the same UI font as Crilo's other pages.
const typography=await page.evaluate(()=>{
 const selectors=['.crilo-game-topbar .brand','.crilo-game-topbar nav a',
  '.crilo-game-topbar #accountBtn','.crilo-game-topbar .circle-btn','.sr-heading h1 button',
  '.sr-whisper','.sr-cursor-note','.sr-alt-caption','.sr-hint-clue','.sr-book span'];
 const body=getComputedStyle(document.body).fontFamily;
 return {body,fonts:selectors.filter(s=>document.querySelector(s))
  .map(selector=>({selector,font:getComputedStyle(document.querySelector(selector)).fontFamily}))};
});
assert.match(typography.body,/^Inter,\s*ui-sans-serif/,
 'The Nothing Here page lost the shared Crilo sans-serif font and fell back to serif');
for(const {selector,font} of typography.fonts)
 assert.equal(font,typography.body,'Font mismatch on '+selector);
// The information dialog must be keyboard-accessible and close with Escape.
await page.locator('#gameInfoBtn').click();
assert.equal(await page.locator('#gameInfoBtn').getAttribute('aria-expanded'),'true');
await page.keyboard.press('Tab');
assert(await page.evaluate(()=>document.activeElement?.closest('#srDialog')!==null),'Modal focus escaped into the page');
await page.keyboard.press('Escape');
assert(await page.locator('#srDialog').evaluate(el=>el.hidden),'Escape did not close the dialog');
assert.equal(await page.locator('#gameInfoBtn').getAttribute('aria-expanded'),'false');
const take=async(action,n=1,attribute)=>{
 const selector=attribute?
  '[data-action="'+action+'"][data-'+attribute[0]+'="'+attribute[1]+'"]':
  '[data-action="'+action+'"]';
 for(let i=0;i<n;i++){
  // Exercise real browser hit targets, not DOM .click() (which bypasses overlays).
  // There are two return doors; only the current world's return door is visible.
  const locator=page.locator(selector+':visible').first();
  assert.equal(await locator.count(),1,'Missing visible action '+selector);
  await locator.click({timeout:5000});
 }
};
const click=async(sel,n=1)=>{
 for(let i=0;i<n;i++)await page.locator(sel).click();
};
const dismiss=async()=>{
 await page.locator('#srClose').click({timeout:5000});
 assert(await page.locator('#srDialog').evaluate(el=>el.hidden));
};
// Fully traverse ordinary room and discover multi-tap secrets.
await take('notice',7);
await page.locator('[data-action="moon"]').click();
await take('moon',3);
await take('star',1,['star','2']);
await take('star',1,['star','0']);
await take('star',1,['star','4']);
await take('window',2);
await take('clock',12);
await take('painting',3);
await take('mirror');
await take('lamp');
await take('mirror',2);
assert.equal(await page.locator('#srScene').getAttribute('data-place'),'mirror','Dark mirror did not open');
for(const action of ['mirror-sun','mirror-eye','mirror-word','mirror-fish','mirror-clock','mirror-key'])await take(action);
await take('return');
assert.equal(await page.locator('#srScene').getAttribute('data-place'),'room');
// Correct book ordering opens a terminal.
for(const color of ['red','blue','gold'])await take('book',1,['book',color]);
assert.equal(await page.locator('#srDialogTitle').textContent(),'A terminal with no purpose');
for(const command of ['hello','xyzzy','crilo','secret']){
 await page.locator('#srTerminalInput').fill(command);
 await page.locator('#srTerminalForm button[type=submit]').click();
}
await dismiss();
await take('radio',6); // radio is off on the sixth tap
await take('vent');
await take('plant',6);
await take('cup');
await take('plant'); // pour the rainwater
await take('candle');
await take('rug',2);
await take('drawer',2);
await take('floorboard',5);
await take('door'); // opens the other side because of the brass key
assert.equal(await page.locator('#srScene').getAttribute('data-place'),'back','Brass key did not open door');
for(const action of ['back-orbit','back-eye','back-stairs','back-mail','back-hole'])await take(action);
await take('back-box',2);
await take('back-bell',3);
await take('return');
await take('door'); // revisiting must be safe
await take('return');
await take('keyhole');
// The safe uses the number hinted on the wall clock.
await take('safe');
await page.locator('#srSafeInput').fill('417');
await page.locator('#srSafeForm button[type=submit]').click();
assert.equal(await page.locator('#srDialogTitle').textContent(),'The safe is open');
await dismiss();
await click('#srJournalBtn');
await dismiss();
for(let i=0;i<3;i++){
 await click('#srHintBtn');
 assert.equal(await page.locator('.sr-hint-clue').evaluate(el=>getComputedStyle(el).fontFamily),
  typography.body,'The hint dialog used a different font from Crilo');
 await dismiss();
}
await click('#srTitle',3);
await click('#srFooterSecret',3);
await page.keyboard.type('secret');
for(const key of ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'])
 await page.keyboard.press(key);
const progress=await page.evaluate(()=>{
 const raw=JSON.parse(localStorage.getItem('crilo_nothing_here_secrets_v1')||'{}');
 return {found:raw.found||[],room:raw.room||{},count:document.getElementById('srCount').textContent,
  scene:document.getElementById('srScene').dataset.place};
});
const missing=all.filter(id=>!progress.found.includes(id));
console.log('SECRET QA',JSON.stringify({total:all.length,found:progress.found.length,missing,
 scriptErrors:errors,score:progress.count},null,2));
assert.deepEqual(errors,[]);
assert.deepEqual(missing,[],'Some curated secrets cannot be discovered');
assert.equal(progress.found.length,70);
assert.deepEqual(progress.room,{lamp:false,rain:true,watered:true,radio:false,cup:false,cupFull:false},
 'Interactions did not persist their environmental state');
const savedCount=progress.found.length;
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>document.getElementById('srCount')?.textContent.includes('70'));
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('crilo_nothing_here_secrets_v1')).found.length),savedCount,
 'Discoveries did not survive reload');
const reloadedRoom=await page.locator('#srScene').evaluate(el=>({
 lamp:el.dataset.lamp,rain:el.dataset.rain,watered:el.dataset.watered,
 radio:el.dataset.radio,cup:el.dataset.cup,cupWater:el.dataset.cupWater,
 safe:el.dataset.safe,rug:el.dataset.rug
}));
assert.deepEqual(reloadedRoom,{lamp:'off',rain:'yes',watered:'yes',radio:'off',
 cup:'set',cupWater:'empty',safe:'open',rug:'lift'},
 'Room visuals failed to restore from saved progress');
// Responsive layout and dark theme on a fresh tab. No progress corruption.
await page.setViewportSize({width:390,height:844});
const mobile=await page.evaluate(()=>({
 viewport:document.documentElement.clientWidth,
 width:document.documentElement.scrollWidth,
 count:document.getElementById('srCount').textContent
}));
assert(mobile.width<=mobile.viewport+2,'Horizontal overflow on mobile');
await take('star',1,['star','1']); // physically tap a small mobile object
await page.evaluate(()=>localStorage.setItem('crilo_theme','dark'));
await page.reload({waitUntil:'domcontentloaded'});
assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
assert.deepEqual(errors,[]);
console.log('PASS: 70/70 physically clicked secrets, persistent room, keyboard modal, mobile and dark theme');
await browser.close();
