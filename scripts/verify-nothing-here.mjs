// Nothing Here: full-page real-pointer walkthrough of the white playground.
// Run from repository root with an HTTP server on port 4173 and Playwright installed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';

const source=fs.readFileSync(new URL('../secret-room.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../secrets.html',import.meta.url),'utf8');
new Function(source);
const catalog=[...source.matchAll(/^\s*\['([a-z-]+)','/gm)].map(m=>m[1]);
assert.equal(catalog.length,44,'The curated 44 discoveries changed');
assert.equal(new Set(catalog).size,44,'Duplicate discoveries in new catalog');
assert(html.includes('nhField')&&!html.includes('srScene'),'Old room is still visible');
assert(!html.includes('auth-first-paint.js'),'Puzzle must not wait for account authentication');
const browser=await chromium.launch({headless:true});
const sdkMock=`window.supabase={createClient:()=>({
 auth:{
  getSession:async()=>({data:{session:null},error:null}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
  signOut:async()=>({error:null})
 },
 rpc:async()=>({data:null,error:null})
})};`;
const page=await browser.newPage({viewport:{width:1280,height:850}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*',r=>r.fulfill({
 status:200,contentType:'application/javascript',body:sdkMock
}));
await page.addInitScript(()=>{
 // Initialize once per tab, not on every reload: otherwise the test itself
 // would delete the progress it is supposed to verify.
 if(!sessionStorage.getItem('nh_test_seeded')){
  localStorage.setItem('crilo_nothing_here_secrets_v1',JSON.stringify({found:['first-touch','moon']}));
  localStorage.removeItem('crilo_nothing_here_playground_v2');
  sessionStorage.setItem('nh_test_seeded','1');
 }
});
await page.goto('http://127.0.0.1:4173/secrets.html',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>document.getElementById('nhCount')?.textContent.includes('/ 44'));
const visual=await page.evaluate(()=>({
 bg:getComputedStyle(document.body).backgroundColor,
 font:getComputedStyle(document.body).fontFamily,
 title:document.querySelector('h1')?.innerText,
 oldRoom:!!document.querySelector('#srScene'),
 pending:document.documentElement.classList.contains('crilo-auth-pending')
}));
assert.equal(visual.bg,'rgb(255, 255, 255)','Page is not pure white');
assert.match(visual.font,/Inter/);
assert.equal(visual.oldRoom,false);
assert.equal(visual.pending,false);
assert(await page.locator('[data-toy="button"]').isVisible());
assert.deepEqual(errors,[],'Runtime errors at initial page load');
const toy=async(id,n=1)=>{for(let i=0;i<n;i++)await page.locator('[data-toy="'+id+'"]').click({timeout:6000})};
const pocket=async(id)=>page.locator('#nhInventory [data-item="'+id+'"]').click({timeout:5000});
const combine=async(a,b)=>{await pocket(a);await pocket(b)};
const use=async(a,target)=>{await pocket(a);await toy(target)};
const close=async()=>{await page.locator('#nhClose').click();assert(await page.locator('#nhOverlay').evaluate(el=>el.hidden))};
// No routine puzzle should consume incompatible items.
await toy('magnet');await toy('seedbag');
let before=await page.locator('#nhPocketCount').textContent();
await combine('magnet','seed');
assert.equal(await page.locator('#nhPocketCount').textContent(),before);
assert(await page.locator('[data-item="magnet"]').count());
assert(await page.locator('[data-item="seed"]').count());
await pocket('magnet');await toy('rocket');
assert(await page.locator('[data-item="magnet"]').count(),'Wrong world combination consumed magnet');
// Press/tap toys and collect components.
await page.locator('#nhTitle').click({clickCount:3,delay:75});
await toy('button',12);
await toy('egg',7);
await toy('switch');
await toy('envelope');
await toy('clock',4);
await toy('dice',6);
await toy('faucet');await toy('pencil');
// Play all three small interactive games with actual clicks and keys.
await toy('record');
await page.locator('[data-mini="replay"]').click();
await page.waitForTimeout(3700); // Observe the whole four-note pattern first.
for(const p of [0,2,1,3])await page.locator('[data-pad="'+p+'"]').click();
assert(await page.locator('[data-item="wire"]').count(),'Memory game did not reward wire');
await close();
await toy('maze');
for(const k of ['ArrowRight','ArrowRight','ArrowRight','ArrowDown','ArrowDown','ArrowDown'])await page.keyboard.press(k);
assert(await page.locator('[data-item="tooth"]').count(),'Maze did not reward key fragment');
await close();
await toy('dot');
for(let i=0;i<5;i++)await page.locator('#nhMovingDot').click({timeout:6000});
assert(await page.locator('[data-item="needle"]').count(),'Catch-the-dot did not reward needle');
await close();
// Both paint recipes, without inventing a third one.
await toy('colors');
for(const color of ['red','yellow'])await page.locator('[data-color="'+color+'"]').click();
assert.equal(await page.locator('[data-item="green"]').count(),0,'Wrong paint recipe created green');
for(const color of ['red','blue','blue','yellow'])await page.locator('[data-color="'+color+'"]').click();
assert(await page.locator('[data-item="green"]').count());
assert(await page.locator('[data-item="purple"]').count());
await close();
// Safe must reject a bad combination and accept the clock's actual code.
await toy('safe');
await page.locator('#nhSafeInput').fill('123');
await page.locator('#nhSafeForm button[type=submit]').click();
assert.equal(await page.locator('[data-item="shaft"]').count(),0);
await page.locator('#nhSafeInput').fill('417');
await page.locator('#nhSafeForm button[type=submit]').click();
assert(await page.locator('[data-item="shaft"]').count());
await close();
// The only supported recipes are explicit; they either produce real objects or affect a valid world target.
await toy('pot');
await combine('seed','water');
assert(await page.locator('[data-item="sprout"]').count());
await use('sprout','pot');await use('sunbeam','pot');
assert(await page.locator('body').evaluate(el=>el.classList.contains('nh-plant-bloomed')));
await combine('battery','wire');await use('spark','rocket');
assert(await page.locator('body').evaluate(el=>el.classList.contains('nh-rocket-launched')));
await use('coin','vending');
assert(await page.locator('[data-item="fuel"]').count());
await combine('shaft','tooth');await use('key','door');
assert(await page.locator('#nhExtra').isVisible(),'Key did not reveal more things');
await toy('mirror');await toy('cloud');await toy('stars',3);
await toy('ball',3);await toy('lever',3);
await combine('magnet','needle');
await combine('paper','pencil');
await toy('envelope'); // Refill paper, since a recipe consumes it.
await combine('feather','paper');
await use('airmail','mailbox');
await use('gear','clock');
// Every single discovery must have a legitimate pointer/keyboard path.
await page.locator('#nhJournalBtn').click();await close();
for(let i=0;i<3;i++){await page.locator('#nhHintBtn').click();await close()}
const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem('crilo_nothing_here_playground_v2')));
const missing=catalog.filter(id=>!progress.found.includes(id));
console.log('PLAYGROUND QA',JSON.stringify({found:progress.found.length,total:catalog.length,missing,
 inventory:progress.inventory,errors},null,2));
assert.deepEqual(missing,[],'Some discoveries are unreachable');
assert.deepEqual(errors,[],'Page errors while playing');
assert.equal(progress.found.length,44);
assert.equal(progress.door,true);assert.equal(progress.bloom,true);assert.equal(progress.launched,true);
assert(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor==='rgb(255, 255, 255)'));
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>document.getElementById('nhCount')?.textContent.startsWith('44 / 44'));
assert(await page.locator('#nhExtra').isVisible(),'Door was not saved');
assert(await page.locator('[data-item="compass"]').count(),'Combined item was not saved');
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('crilo_nothing_here_secrets_v1')).found.length),2,
 'Original 70-secret game progress was overwritten');
// White page means white in light AND dark modes, but header still follows the Crilo site theme.
await page.evaluate(()=>localStorage.setItem('crilo_theme','dark'));
await page.reload({waitUntil:'domcontentloaded'});
assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
await page.setViewportSize({width:390,height:844});
const mobile=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,width:document.documentElement.scrollWidth}));
assert(mobile.width<=mobile.viewport+2,'Mobile has horizontal overflow');
await page.locator('[data-toy="button"]').click();
// Screenshot for design regression triage, uploaded as Actions artifact.
fs.mkdirSync('test-results',{recursive:true});
await page.screenshot({path:'test-results/nothing-here-mobile.png',fullPage:true});
await page.setViewportSize({width:1280,height:850});
await page.screenshot({path:'test-results/nothing-here-desktop.png',fullPage:true});
// When the CDN is down, account controls can fail but this *independent* playground cannot vanish.
const outage=await browser.newPage();
await outage.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*',r=>r.abort());
await outage.goto('http://127.0.0.1:4173/secrets.html',{waitUntil:'domcontentloaded'});
await outage.waitForFunction(()=>document.getElementById('nhCount')?.textContent.includes('/ 44'));
assert(await outage.locator('[data-toy="button"]').isVisible(),'CDN outage hid toys');
await outage.locator('[data-toy="button"]').click();
assert(await outage.locator('#nhCount').textContent()!=='0 / 44');
await outage.close();
await browser.close();
console.log('PASS: 44/44 discoveries, recipes, five microgames, white page, mobile, dark mode, save and independent startup.');