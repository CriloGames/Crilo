'use strict';
/* Test every shared legal footer using the real page markup and styles,
 * in Chromium without touching Supabase or sending network requests. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const pages=['leaderboard.html','ducks.html','badge-sets.html','friends.html',
 'profile.html','settings.html','support.html','shape-of-sound.html',
 'beetle-tricks.html','owner-analytics.html','privacy.html','terms.html'];
const css=fs.readFileSync('legal.css','utf8');
const globalCSS=fs.readFileSync('style.css','utf8');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let checked=0;
 try{
  for(const width of [320,390,600,768,1280,1920]){
   const page=await browser.newPage({viewport:{width,height:850}});
   for(const file of pages){
    const html=fs.readFileSync(file,'utf8');
    const markup=html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0];
    assert.ok(markup,'Missing footer in '+file);
    await page.setContent('<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main style="min-height:80px"></main>'+markup+'</body></html>');
    await page.addStyleTag({content:globalCSS});
    await page.addStyleTag({content:css});
    const state=await page.evaluate(()=>{
     const box=element=>{
      const b=element.getBoundingClientRect();
      return{x:b.left,y:b.top,right:b.right,bottom:b.bottom,width:b.width,
       cx:b.left+b.width/2};
     };
     const footer=document.querySelector('.crilo-simple-footer');
     const nav=footer?.querySelector('.crilo-legal-nav');
     const anchors=[...(nav?.querySelectorAll('a')||[])];
     return {
      viewport:innerWidth,scroll:document.documentElement.scrollWidth,
      footer:footer&&box(footer),nav:nav&&box(nav),
      copy:box(document.querySelector('.crilo-legal-copy')),
      anchors:anchors.map(box),
      columns:getComputedStyle(nav).gridTemplateColumns.split(' ').length,
      labels:anchors.map(a=>a.textContent.trim()),
      dots:nav.querySelectorAll('span').length
     };
    });
    assert.equal(state.viewport,width);
    assert.ok(state.scroll<=width+1,'Page overflow '+file+' at '+width+'px: '+state.scroll);
    assert.ok(state.footer&&Math.abs(state.footer.cx-width/2)<1.1,
     file+' footer is not centered at '+width);
    assert.ok(Math.abs(state.nav.cx-width/2)<1.1,file+' links are not centered at '+width);
    assert.ok(Math.abs(state.copy.cx-width/2)<1.1,file+' copyright is not centered at '+width);
    assert.deepEqual(state.labels,['Privacy Policy','Terms of Service','Contact'],
     file+' link labels differ from redesigned footer');
    assert.equal(state.dots,0,file+' should not have separator dots');
    assert.equal(state.anchors.length,3,file+' must have three links');
    for(const r of [state.nav,state.copy,...state.anchors])
     assert.ok(r.x>=-1&&r.right<=width+1,file+' content is clipped at '+width);
    const [privacy,terms,contact]=state.anchors;
    if(width>600){
     assert.equal(state.columns,3,file+' not three columns on desktop');
     assert.ok(Math.abs(terms.cx-width/2)<1.5,file+' center column shifted');
     assert.ok(Math.abs((terms.cx-privacy.cx)-(contact.cx-terms.cx))<2,
      file+' side columns lack symmetry at '+width);
     assert.ok(Math.abs(privacy.y-terms.y)<1.5&&Math.abs(contact.y-terms.y)<1.5,
      file+' links should share one row at '+width);
    }else{
     assert.equal(state.columns,2,file+' should use two columns on mobile');
     assert.ok(Math.abs(contact.cx-width/2)<1.5,
      file+' Contact is not centered underneath at '+width);
     assert.ok(Math.abs(privacy.cx+terms.cx-width)<2,
      file+' first row links are not symmetrical at '+width);
     assert.ok(contact.y>privacy.y+4,file+' Contact should wrap onto its own row');
    }
    assert.ok(state.nav.bottom<=state.copy.y+1,file+' copyright overlaps links');
    checked++;
   }
   await page.close();
  }
  assert.equal(checked,pages.length*6);
  console.log('PASS '+checked+' shared-footer checks across 12 pages and six viewport widths.');
 }finally{await browser.close()}
})().catch(e=>{console.error('SHARED_FOOTER_BROWSER_FAIL',e);process.exitCode=1});
