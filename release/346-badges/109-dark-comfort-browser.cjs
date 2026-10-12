'use strict';
/* Dark-mode readability smoke test in actual Chromium across main site pages.
   No live database writes; verification uses synthetic auth and computed CSS. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
function channels(s){
 const found=s.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
 if(!found)throw Error('Unexpected CSS color: '+s);
 return found.slice(1,4).map(Number);
}
function lum(s){
 const c=channels(s).map(n=>{let v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});
 return .2126*c[0]+.7152*c[1]+.0722*c[2];
}
function contrast(a,b){const aa=lum(a),bb=lum(b);return (Math.max(aa,bb)+.05)/(Math.min(aa,bb)+.05)}
(async()=>{
 const server=http.createServer(serve);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let cases=0;
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:860}});
   await context.addInitScript({content:mockSupabase.replace('loggedIn:false','loggedIn:true')});
   await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
    route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route(/^https:\/\/(?!crilo\.fun)/,route=>route.abort());
   for(const path of ['index.html','leaderboard.html','ducks.html','badge-sets.html',
    'profile.html','settings.html','friends.html','moderation.html','owner-analytics.html',
    'privacy.html','terms.html','beetle-tricks.html','shape-of-sound.html']){
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/'+path,{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('link[href="dark-comfort.css?v=1"]').count(),1,
     'Missing dark-mode shared styles on '+path);
    await page.evaluate(()=>document.documentElement.dataset.theme='dark');
    const body=await page.evaluate(()=>{
     const s=getComputedStyle(document.body);
     return {text:s.color,bg:s.backgroundColor,scroll:document.documentElement.scrollWidth,viewport:innerWidth};
    });
    assert.ok(lum(body.bg)<.045,path+' dark background too light: '+body.bg);
    assert.ok(contrast(body.text,body.bg)>8,path+' dark body text too faint');
    assert.ok(body.scroll<=body.viewport+2,path+' dark layout overflows at '+width);
    if(path==='index.html'){
     // Readable at a glance: check the actual text/background of every critical control.
     await page.locator('#pixelStudioModal').evaluate(el=>el.classList.remove('hidden'));
     for(const selector of ['#pixelStudioBtn','.pixel-studio-card',
      '.pixel-studio-card .pixel-tool.active',
      '.pixel-studio-card .pixel-tool:not(.active)',
      '.pixel-studio-card .pixel-studio-header p',
      '.pixel-studio-card .pixel-hint',
      '.pixel-studio-card #pixelSize',
      '.draw-panel .drawing-tool.active','#drawMode','.recent-colors>strong']){
      const colors=await page.locator(selector).first().evaluate(el=>{
       const text=getComputedStyle(el).color;
       let p=el,bg;
       while(p){
        const c=getComputedStyle(p).backgroundColor;
        if(c!=='transparent'&&!/rgba\([^)]*,\s*0\)/.test(c)){bg=c;break}
        p=p.parentElement;
       }
       return{text,bg:bg||getComputedStyle(document.body).backgroundColor};
      });
      const n=contrast(colors.text,colors.bg);
      assert.ok(n>=4.5,selector+' unreadable in dark mode: '+n.toFixed(2)+
       ':1 foreground '+colors.text+' against '+colors.bg);
      assert.ok(lum(colors.bg)<.18,selector+' surface is too bright in dark mode');
      cases++;
     }
     await page.evaluate(()=>document.documentElement.dataset.theme='light');
     const original=await page.locator('#pixelStudioBtn').evaluate(el=>getComputedStyle(el).backgroundColor);
     assert.ok(lum(original)>.7,'Light theme Pixel Studio styling changed');
    }
    assert.deepEqual(errors,[],'Browser script errors '+path+' '+width);
    cases++;await page.close();
   }
   await context.close();
  }
  console.log('DARK_COMFORT_BROWSER_PASS '+cases+' responsive contrast checks');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(err=>{console.error('DARK_COMFORT_BROWSER_FAIL',err);process.exitCode=1});
