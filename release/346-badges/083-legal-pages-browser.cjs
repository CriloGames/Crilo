'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const common=fs.readFileSync('style.css','utf8'),legal=fs.readFileSync('legal.css','utf8');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const file of ['privacy.html','terms.html']){
   const html=fs.readFileSync(file,'utf8').replace(/<link rel="stylesheet"[^>]*>/g,'');
   for(const width of [320,390,768,1280]){
    const page=await browser.newPage({viewport:{width,height:800},deviceScaleFactor:1});
    await page.setContent(html,{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:common});
    await page.addStyleTag({content:legal});
    const state=await page.evaluate(()=>{
     const headings=[...document.querySelectorAll('.crilo-legal-section h2')];
     const foot=document.querySelector('.crilo-simple-footer');
     return {scroll:document.documentElement.scrollWidth, width:document.documentElement.clientWidth,
       headings:headings.length, footerLinks:[...foot.querySelectorAll('a')].map(a=>a.getAttribute('href')),
       main:document.querySelector('.crilo-legal-paper').getBoundingClientRect().width};
    });
    assert.ok(state.headings>=7,file+' missing policy sections');
    assert.ok(state.scroll<=width+1,file+' horizontal overflow '+width+' '+JSON.stringify(state));
    assert.ok(state.main>200&&state.main<=width,file+' paper offscreen '+width);
    assert.ok(state.footerLinks.includes('privacy.html')&&state.footerLinks.includes('terms.html'),
       file+' missing footer links');
    await page.close();
    console.log('PASS '+file+' responsive '+width+'px');
   }
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
