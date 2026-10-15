'use strict';
/* Synthetic Chromium QA: grouped Official and Bonus Spin History, private
 * art, disclosure interaction, preview, dark/light and responsive layout. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const html=fs.readFileSync('profile.html','utf8');
const js=fs.readFileSync('spin-history.js','utf8');
const preview=fs.readFileSync('wheel-preview.js','utf8');
const styles=fs.readFileSync('spin-history.css','utf8')+'\n'+fs.readFileSync('wheel-preview.css','utf8');
const start=html.indexOf('<section class="spin-history"');
const end=html.indexOf('</section>',start);
assert.ok(start>0&&end>start,'Spin History HTML section exists');
const markup=html.slice(start,end+10);
const official={id:'o1',source:'official',slot:0,score:100,spins:5,upgrades:1,doubles:0,ducks:0,
 drawing:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WZkAAAAASUVORK5CYII='};
const bonus1={id:'b1',source:'bonus',slot:1,score:740,spins:8,upgrades:1,doubles:0,ducks:0,drawing:null};
const bonus2={id:'b2',source:'bonus',slot:2,score:2100,spins:8,upgrades:2,doubles:1,ducks:0,drawing:null};
const old={id:'o2',source:'official',slot:0,score:230,spins:5,upgrades:0,doubles:0,ducks:0,drawing:null};
const days=[
 {daily_period:'2026-10-14',run_count:3,best:bonus2,runs:[bonus2,bonus1,official]},
 {daily_period:'2026-10-13',run_count:1,best:old,runs:[old]}
];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:850},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main class="page-shell">'+markup+'</main></body></html>');
   await page.addStyleTag({content:styles+'\nbody{margin:0; font-family:system-ui;background:#f8f8fb}.page-shell{box-sizing:border-box;width:min(100%,960px);padding:15px;margin:auto}'});
   await page.evaluate(days=>{
    window.Crilo={user:{id:'qa-owner'},esc:v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')};
    window.CriloRarity={scoreBands:[{key:'common',max:500},{key:'mythic',max:Infinity}]};
    window.criloDB={rpc:async(name,args)=>({
     data:{days:days.slice(args.p_offset,args.p_offset+args.p_limit),total_dailies:2,official_dailies:2,
      official_spins:10,bonus_runs:2},error:null
    })};
   },days);
   await page.addScriptTag({content:preview});
   await page.addScriptTag({content:js});
   await page.waitForFunction(()=>document.querySelectorAll('.spin-history-item').length===2);
   assert.equal(await page.locator('.spin-history-item').count(),2);
   assert.equal(await page.locator('.spin-history-expand').count(),1);
   assert.equal(await page.locator('.spin-history-score').first().textContent(),'2,100');
   assert.match(await page.locator('#spinHistorySpinCount').textContent(),/2 Bonus Runs/);
   assert.equal(await page.locator('.spin-history-runs').isVisible(),false);
   const button=page.locator('.spin-history-expand');
   await button.focus();await page.keyboard.press('Enter');
   await page.locator('.spin-history-runs').waitFor({state:'visible'});
   assert.equal(await button.getAttribute('aria-expanded'),'true');
   assert.equal(await page.locator('.spin-history-subrun').count(),3);
   assert.equal(await page.locator('.spin-history-subrun .spin-history-wheel').count(),3);
   assert.equal(await page.locator('.spin-history-subrun img[src="blank-wheel.svg"]').count(),2);
   assert.equal(await page.locator('.spin-history-subrun img[src^="data:image/png;base64,"]').count(),1);
   assert.equal(await page.locator('.spin-history-subrun .spin-history-best-mark').count(),1);
   assert.match(await page.locator('.spin-history-runs').textContent(),/Bonus Run 1/);
   assert.match(await page.locator('.spin-history-runs').textContent(),/Bonus Run 2/);
   assert.equal(await page.locator('.spin-history-item .spin-history-kind').count(),1,'Only top Bonus has a visible pill');
   assert.equal(await page.locator('.spin-history-item').last().locator('.spin-history-kind').count(),0,'Official-only day has no pill');
   assert.equal(await page.locator('.spin-history-subrun .spin-history-kind').count(),2,'Only expanded Bonuses have type pills');
   assert.doesNotMatch(await page.locator('.spin-history-runs').textContent(),/Official Daily/,'Expanded Official Daily label is removed');
   assert.equal(await page.locator('.spin-history-subrun .spin-history-wheel').last().getAttribute('aria-label').then(s=>s.includes('Official Daily')),true,'Official artwork retains accessible name');
   await page.locator('.spin-history-subrun .spin-history-wheel').first().click();
   await page.locator('#criloWheelPreview').waitFor({state:'visible'});
   assert.equal(await page.locator('.crilo-wheel-preview-image').getAttribute('src'),'blank-wheel.svg');
   await page.locator('.crilo-wheel-preview-close').click();
   await page.locator('.spin-history-subrun .spin-history-wheel').last().click();
   await page.locator('#criloWheelPreview').waitFor({state:'visible'});
   assert.match(await page.locator('.crilo-wheel-preview-image').getAttribute('src'),/^data:image\/png;base64,/);
   await page.locator('.crilo-wheel-preview-close').click();
   for(const theme of ['light','dark']){
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<=3,'Overflow '+width+'px '+theme+': '+overflow);
   }
   await button.click();
   assert.equal(await button.getAttribute('aria-expanded'),'false');
   assert.equal(await page.locator('.spin-history-runs').isVisible(),false);
   assert.deepEqual(errors,[],'Browser errors '+width+'px');
   await page.close();
  }
  console.log('GROUPED_SPIN_HISTORY_BROWSER_PASS on phones, iPad, desktop, both themes and accessible disclosure');
 }finally{await browser.close()}
})().catch(err=>{console.error('GROUPED_SPIN_HISTORY_BROWSER_FAIL',err);process.exitCode=1});