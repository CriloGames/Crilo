'use strict';
// Layout and read-only live-counter behavior in actual Chromium at phone,
// tablet and desktop viewport widths. All database calls are synthetic.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const home=fs.readFileSync('index.html','utf8');
const fragment=home.split('<div class="daily-row">')[1]?.split('<h1>')[0];
assert.ok(fragment?.includes('criloOfficialDailyTotal'));
const siteCss=fs.readFileSync('style.css','utf8');
const chipCss=fs.readFileSync('official-daily-total.css','utf8');
const javascript=fs.readFileSync('official-daily-total.js','utf8');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:850}});
   await page.setContent('<!doctype html><html data-theme="light"><body><main><section class="hero"><div class="daily-row">'+fragment+'<h1>Make the number bigger.</h1><p class="sub">Five spins to start. One official run per Daily.</p><div id="message"></div></section></main></body></html>');
   await page.addStyleTag({content:siteCss});
   await page.addStyleTag({content:chipCss});
   await page.evaluate(()=>{window.__qaTotal=2;window.__qaCalls=0;window.criloDB={
    rpc:async(name)=>{if(name!=='crilo_public_official_daily_total')throw Error('Unexpected RPC');window.__qaCalls++;return{data:window.__qaTotal,error:null}}
   }});
   await page.addScriptTag({content:javascript});
   await page.waitForFunction(()=>document.getElementById('criloOfficialDailyTotal').textContent==='2');
   const bounds=await page.locator('.crilo-daily-total').boundingBox();
   assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+1,'Counter clipped at '+width+' px');
   assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=width+1,'Horizontal overflow at '+width);
   await page.evaluate(()=>{window.__qaTotal=3;document.getElementById('message').textContent='Official Daily saved. See how you ranked.';});
   await page.waitForFunction(()=>document.getElementById('criloOfficialDailyTotal').textContent==='3');
   assert.equal(await page.evaluate(()=>window.__qaCalls),2,'Only initial read and completed Daily refresh');
   await page.close();
   console.log('PASS community counter '+width+'px, initial read and real Daily completion update');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
