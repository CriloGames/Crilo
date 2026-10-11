'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8');
const i=html.indexOf('<footer class="crilo-site-footer"'),j=html.indexOf('</footer>',i);
assert.ok(i>=0&&j>i,'Homepage footer missing');
const footer=html.slice(i,j+9),style=fs.readFileSync('style.css','utf8'),legal=fs.readFileSync('legal.css','utf8');
const support=footer.indexOf('crilo-support-link'),group=footer.indexOf('crilo-footer-content'),
  navigation=footer.indexOf('crilo-home-legal'),rail=footer.indexOf('crilo-beetle-track');
assert.ok(group>=0&&group<support&&support<navigation&&navigation<rail,'Unexpected footer layout');
assert.ok(footer.indexOf('</div>\n<div class="crilo-beetle-track"')>=0,'The beetle must be outside the narrow links group');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280,1920]){
   const page=await browser.newPage({viewport:{width,height:850}});
   await page.setContent('<!doctype html><html data-theme="light"><body><main style="min-height:70px"></main>'+footer+'</body></html>');
   await page.addStyleTag({content:style});
   await page.addStyleTag({content:legal});
   const state=await page.evaluate(()=>{
    const b=q=>{const r=document.querySelector(q).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,top:r.top,right:r.right,bottom:r.bottom,cx:r.left+r.width/2}};
    return{footer:b('.crilo-site-footer'),content:b('.crilo-footer-content'),tip:b('.crilo-support-link'),links:b('.crilo-legal-nav'),copy:b('.crilo-legal-copy'),rail:b('.crilo-beetle-track'),align:getComputedStyle(document.querySelector('.crilo-legal-copy')).textAlign,scroll:document.documentElement.scrollWidth,viewport:innerWidth};
   });
   assert.ok(state.scroll<=width+1,'Horizontal overflow '+width);
   assert.ok(Math.abs(state.footer.x)<1&&Math.abs(state.footer.w-width)<2,'Footer not viewport-wide '+width+' '+JSON.stringify(state.footer));
   assert.ok(Math.abs(state.rail.x)<1&&Math.abs(state.rail.w-width)<2,'Beetle rail must reach both edges '+width+' '+JSON.stringify(state.rail));
   for(const item of ['content','tip','links','copy'])assert.ok(Math.abs(state[item].cx-width/2)<2,'Text not screen-centered: '+item+' at '+width);
   assert.equal(state.align,'center');
   assert.ok(state.tip.bottom<=state.links.y+2,'Tip overlaps legal links');
   assert.ok(state.links.bottom<=state.copy.y+2,'Legal links overlap copyright');
   assert.ok(state.rail.y>=state.copy.bottom-2,'Beetle overlaps copyright');
   assert.ok(state.rail.y-state.copy.bottom<=6,'Too much empty space before beetle '+width);
   await page.evaluate(()=>document.querySelector('.crilo-beetle-track').classList.add('walking'));
   const stops=await page.evaluate(()=>{
     const bug=document.querySelector('.crilo-beetle');
     const animation=bug.getAnimations().find(a=>a.animationName==='criloBeetlePatrol');
     if(!animation)throw Error('Beetle patrol animation unavailable');
     animation.pause();
     const stop=ms=>{animation.currentTime=ms;const r=bug.getBoundingClientRect();return{left:r.left,right:r.right}};
     return{start:stop(0),right:stop(16e3*.46),back:stop(16e3*.96)};
   });
   assert.ok(stops.start.left>=5&&stops.start.left<=11,'Beetle misses left edge at '+width+': '+JSON.stringify(stops));
   assert.ok(stops.right.right>=width-12&&stops.right.right<=width-4,'Beetle misses right edge at '+width+': '+JSON.stringify(stops));
   assert.ok(stops.back.left>=5&&stops.back.left<=11,'Beetle misses return edge '+width);
   await page.close();
   console.log('PASS full-width centered footer + both beetle edges '+width+'px');
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
