'use strict';
/* Browser audit of all seven badge hues and eight score hues, light/dark,
   phone/tablet/desktop. All network auth calls are mocked locally. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const pages=['index.html','leaderboard.html','profile.html','badge-sets.html'];
const tiers=['common','uncommon','rare','epic','anomaly','mythic','divine'];
const scoreTiers=['trash',...tiers];
const dark={light:'#bd2633',dark:'#eda0aa'};
(async()=>{
 const server=http.createServer(serve);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const root='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [390,768,1280]){
   const ctx=await browser.newContext({viewport:{width,height:880},reducedMotion:'reduce'});
   await ctx.addInitScript({content:mockSupabase});
   await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
     r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await ctx.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
   for(const name of pages){
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(root+'/'+name,{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('link[href="rarity-palette.css?v=3"]').count(),1,
      'Missing shared rarity stylesheet on '+name);
    for(const theme of ['light','dark']){
     const data=await page.evaluate(({theme,scoreTiers,tiers})=>{
      document.documentElement.dataset.theme=theme;
      const color=el=>getComputedStyle(el).getPropertyValue('--crilo-badge-accent').trim();
      const badgeColors={};
      for(const tier of tiers){
       const el=document.createElement('button');
       el.className='badge-top-chip';el.dataset.badgeRarity=tier;
       document.body.appendChild(el);
       badgeColors[tier]=color(el);
       el.remove();
      }
      const result=document.getElementById('result');
      let resultColors={};
      if(result)for(const tier of scoreTiers){
       result.dataset.rarity=tier;
       resultColors[tier]=getComputedStyle(result).getPropertyValue('--rarity-accent').trim();
      }
      const rootStyle=getComputedStyle(document.documentElement);
      return {mythic:rootStyle.getPropertyValue('--tier-mythic').trim(),
       badgeColors,resultColors,
       overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
     },{theme,scoreTiers,tiers});
     assert.equal(data.mythic,dark[theme],name+' '+theme+' Mythic must be red, not magenta');
     assert.equal(Object.keys(data.badgeColors).length,7);
     for(const tier of tiers)assert.ok(data.badgeColors[tier],
      name+' '+width+'px '+theme+' badge '+tier+' color is missing');
     assert.equal(new Set(Object.values(data.badgeColors)).size,7,
      name+' '+theme+' badge colors should all be distinguishable');
     if(name==='index.html'){
      assert.equal(new Set(Object.values(data.resultColors)).size,8,
       'Eight result colors should stay distinct on '+theme);
      assert.equal(data.resultColors.mythic,data.badgeColors.mythic,
       'Mythic score and badge must use the same hue');
     }
     assert.ok(data.overflow<=3,'Unexpected page overflow: '+name+' '+width+' '+theme+': '+data.overflow);
    }
    assert.deepEqual(errors,[],name+' '+width+' browser errors');
    await page.close();
   }
   await ctx.close();
  }
  console.log('RARITY_COLORS_BROWSER_PASS: 4 pages, 390/768/1280, light and dark, all score and badge tiers');
 }finally{
  await browser.close();
  await new Promise(ok=>server.close(ok));
 }
})().catch(e=>{console.error('RARITY_COLORS_BROWSER_FAIL',e);process.exitCode=1});
