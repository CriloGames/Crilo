'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8'),i=html.indexOf('<footer class="crilo-site-footer"'),j=html.indexOf('</footer>',i);
assert.ok(i>=0&&j>i,'Homepage footer missing');
const footer=html.slice(i,j+9),style=fs.readFileSync('style.css','utf8'),legal=fs.readFileSync('legal.css','utf8');
assert.ok(footer.indexOf('crilo-support-link')<footer.indexOf('crilo-home-legal'),'Support must precede legal links');
assert.ok(footer.indexOf('crilo-home-legal')<footer.indexOf('crilo-beetle-track'),'Beetle track at footer bottom');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280,1920]){
   const p=await browser.newPage({viewport:{width,height:850}});
   await p.setContent('<!doctype html><html data-theme="light"><body><main style="min-height:70px"></main>'+footer+'</body></html>');
   await p.addStyleTag({content:style});
   await p.addStyleTag({content:legal});
   const actual=await p.evaluate(()=>{
    const el=q=>{const r=document.querySelector(q).getBoundingClientRect();return{y:r.y,bottom:r.bottom,cx:r.left+r.width/2}};
    return{footer:el('.crilo-site-footer'),tip:el('.crilo-support-link'),links:el('.crilo-legal-nav'),copyright:el('.crilo-legal-copy'),beetle:el('.crilo-beetle-track'),alignment:getComputedStyle(document.querySelector('.crilo-legal-copy')).textAlign,scrollWidth:document.documentElement.scrollWidth,navLinks:document.querySelectorAll('.crilo-legal-nav a').length};
   });
   assert.ok(actual.scrollWidth<=width+1,'Horizontal overflow '+width);
   for(const name of ['tip','links','copyright'])assert.ok(Math.abs(actual[name].cx-actual.footer.cx)<3,'Misaligned '+name+' '+width);
   assert.equal(actual.alignment,'center');
   assert.ok(actual.tip.bottom<=actual.links.y+2,'Tip overlaps legal links');
   assert.ok(actual.links.bottom<=actual.copyright.y+2,'Legal links overlap copyright');
   assert.ok(actual.copyright.bottom<=actual.beetle.y+2,'Legal links overlap beetle rail');
   assert.equal(actual.navLinks,3);
   await p.close();
   console.log('PASS homepage footer '+width+'px');
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
