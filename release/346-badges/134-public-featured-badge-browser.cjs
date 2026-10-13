'use strict';
/* Real Chromium preview of a different player's earned featured badge.
 * Local fixtures only: no production account or badge writes. */
const assert=require('node:assert/strict'),http=require('node:http');
const fs=require('node:fs'),{chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const definitions=JSON.parse(fs.readFileSync('release/346-badges/catalog-rules.json','utf8'));
const badges=definitions.map((b,i)=>({id:i+1,badge_key:b.key,name:b.name,
 description:b.condition,category:b.category,requirement:{rarity:b.rarity},
 is_secret:false,sort_order:i+1}));
const earned=badges.map(b=>({badge_id:b.id,earned_at:'2026-10-10T12:00:00Z'}));
const picked=badges.find(b=>String(b.requirement.rarity).toLowerCase()==='common');
assert.ok(picked,'Test requires a common badge outside the rarest Top 50');
const fixtures={badges,user_badges:earned,
 featured_badges:[{user_id:'public-profile',position:1,badge_id:picked.id}],
 daily_runs:[],game_scores:[]};
const stub=mockSupabase.replace(
 "api.then=(yes,no)=>Promise.resolve({data:table==='badges'?[]:[],error:null,count:0}).then(yes,no);",
 "api.then=(yes,no)=>Promise.resolve({data:window.__featuredFixture[table]||[],error:null,count:0}).then(yes,no);");
assert.notEqual(stub,mockSupabase,'Mocked read-only table rows were not installed');
(async()=>{
 const server=http.createServer(serve);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [390,780,1280]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   await context.addInitScript({content:stub+';window.__featuredFixture='+JSON.stringify(fixtures)+';'});
   await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/profile.html?id=public-profile',{waitUntil:'domcontentloaded',timeout:20000});
   const tile=page.locator('#featuredBadges .featured-viewable');
   await tile.waitFor({state:'visible',timeout:15000});
   assert.equal(await page.locator('#featuredBadges .featured-slot').count(),5);
   assert.equal(await tile.count(),1,'Only earned filled featured badge is interactive');
   assert.equal(await tile.getAttribute('data-badge-key'),picked.badge_key);
   assert.equal(await page.locator('#featuredBadges .featured-empty:disabled').count(),4);
   assert.equal(await page.locator('#badgeGrid [data-badge-key="'+picked.badge_key+'"]').count(),0,
    'This badge must test the case outside the Top 50 gallery');
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await tile.focus();
    await tile.press('Enter');
    await page.locator('#badgePreviewDialog').waitFor({state:'visible',timeout:4000});
    assert.equal(await page.locator('#badgePreviewCard .collection-tile b').innerText(),picked.name);
    assert.match(await page.locator('#badgePreviewCard').innerText(),new RegExp(picked.description.slice(0,20).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    const link=await page.locator('#badgePreviewOpenSet').getAttribute('href');
    assert.ok(link.includes('id=public-profile')&&link.includes('badge='+encodeURIComponent(picked.badge_key)));
    await page.locator('#badgePreviewClose').click();
    assert.equal(await page.locator('#badgePreviewDialog').isVisible(),false);
    assert.equal(await tile.evaluate(el=>document.activeElement===el),true,'Focus should return to selected slot');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=2),true,'Layout overflow');
   }
   assert.deepEqual(errors,[],'Profile runtime errors at '+width+'px');
   await context.close();
  }
  console.log('PUBLIC_FEATURED_BADGE_BROWSER_PASS 390/780/1280px, both themes, keyboard, focus and Top 50 overflow');
 }finally{
  await browser.close();
  await new Promise(ok=>server.close(ok));
 }
})().catch(e=>{console.error('PUBLIC_FEATURED_BADGE_BROWSER_FAIL',e);process.exitCode=1});
