'use strict';
/* Responsive usability audit: synthetic Supabase session, no real users/data.
   Looks for offscreen controls, accidental page overflow, clipped dialogs and
   overlapping shared navigation across phones and iPads. */
const http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const pages=['index.html','leaderboard.html','ducks.html','badge-sets.html','profile.html',
 'settings.html','friends.html','support.html','shape-of-sound.html','domain/',
 'moderation.html','owner-analytics.html','privacy.html','terms.html'];
const widths=[320,360,375,390,430,600,700,768,820,900,1024,1180];
const examine=()=>{
 const vw=document.documentElement.clientWidth;
 const visible=el=>{
  const s=getComputedStyle(el),r=el.getBoundingClientRect();
  return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity!==0&&
   r.width>=6&&r.height>=6&&r.bottom>=0&&r.top<=innerHeight;
 };
 const clipped=[],collision=[],scroll=[];
 for(const el of document.querySelectorAll('button,a[href],input,select,textarea,[role="button"]')){
  if(!visible(el))continue;
  const rect=el.getBoundingClientRect();
  if(rect.left< -3||rect.right>vw+3){
   // The Leaderboard and badge gallery intentionally expose scrollable tabs.
   let parent=el.parentElement,insideScroll=false;
   while(parent&&parent!==document.body){
    const css=getComputedStyle(parent);
    if(['auto','scroll'].includes(css.overflowX)&&parent.scrollWidth>parent.clientWidth+2){
     insideScroll=true;break;
    }
    parent=parent.parentElement;
   }
   if(!insideScroll)clipped.push({
    target:(el.id?'#'+el.id:el.className?.toString()?.slice(0,80)||el.tagName),
    rect:[Math.round(rect.left),Math.round(rect.right)]
   });
  }
 }
 for(const header of document.querySelectorAll('.topbar,.crilo-game-topbar')){
  if(!visible(header))continue;
  const anchors=[...header.querySelectorAll('nav a')].filter(visible);
  for(let i=0;i<anchors.length;i++)for(let j=i+1;j<anchors.length;j++){
   const a=anchors[i].getBoundingClientRect(),b=anchors[j].getBoundingClientRect();
   if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>3&&
      Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>3){
     collision.push([anchors[i].textContent.trim(),anchors[j].textContent.trim()]);
   }
  }
  const brand=header.querySelector('.brand'),actions=header.querySelector('.header-actions');
  if(brand&&actions&&visible(brand)&&visible(actions)){
   const a=brand.getBoundingClientRect(),b=actions.getBoundingClientRect();
   if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>3&&
      Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>3)
    collision.push(['brand','account/actions']);
  }
 }
 const documentOverflow=Math.max(0,document.documentElement.scrollWidth-vw);
 if(documentOverflow>3)scroll.push({scroll:document.documentElement.scrollWidth,viewport:vw});
 return {scroll,clipped:clipped.slice(0,9),collision:collision.slice(0,9)};
};
(async()=>{
 const server=http.createServer(serve);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const failures=[],counts={pages:0,modal:0,studio:0};
 try{
  for(const width of widths){
   for(const role of ['guest','signed']){
    // Full visitor audit plus authenticated iPhone/iPad coverage.
    if(role==='signed'&&![320,390,430,768,820,1024].includes(width))continue;
    const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
    const signed=role==='signed';
    await ctx.addInitScript({content:'localStorage.setItem("crilo_theme","light");'+
      mockSupabase.replace('loggedIn:false','loggedIn:'+signed)});
    await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
      r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
    await ctx.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
    for(const name of pages){
     const page=await ctx.newPage(),errors=[];
     page.on('pageerror',e=>errors.push(e.message));
     try{
      const result=await page.goto(origin+'/'+name,{waitUntil:'domcontentloaded',timeout:20000});
      assert.equal(result?.status(),200,'Missing '+name);
      await page.waitForTimeout(120);
      const ui=await page.evaluate(examine);
      if(ui.scroll.length||ui.clipped.length||ui.collision.length)failures.push({name,width,role,...ui});
      if(errors.length)failures.push({name,width,role,errors:errors.slice(0,3)});
      counts.pages++;
      if(name==='index.html'&&[320,390,430,768,820,1024].includes(width)){
       const btn=page.locator('#pixelStudioBtn');
       if(await btn.isVisible()&&await btn.isEnabled()){
        await btn.click();
        if(await page.locator('#pixelStudioModal').isVisible()){
         const studio=await page.evaluate(()=>{
          const card=document.querySelector('#pixelStudioModal .pixel-studio-card');
          const tools=document.querySelector('#pixelStudioModal .pixel-studio-tools');
          const target=[...tools.children].filter(x=>{
           const r=x.getBoundingClientRect();return r.width>=5&&r.height>=5;
          }).map(x=>({rect:x.getBoundingClientRect(),type:x.id||x.className?.toString().slice(0,45)}));
          const rect=card.getBoundingClientRect();
          return {card:[Math.round(rect.left),Math.round(rect.right)],
           toolsOverflow:tools.scrollWidth-tools.clientWidth,
           outside:target.filter(x=>x.rect.left<rect.left-4||x.rect.right>rect.right+4)
             .map(x=>x.type)};
         });
         if(studio.card[0]< -2||studio.card[1]>width+2||studio.toolsOverflow>4||studio.outside.length)
          failures.push({name,width,role,studio});
         counts.studio++;
         // Close the full-screen Studio before testing the account dialog.
         // Otherwise Playwright waits for the modal to stop intercepting
         // the header click, which is expected behavior, not a layout bug.
         await page.locator('#pixelExit').click({timeout:5000});
        }
       }
      }
      if(name==='index.html'&&!signed){
       await page.locator('#accountBtn').click({timeout:5000});
       const modal=await page.evaluate(examine);
       if(modal.scroll.length||modal.clipped.length)failures.push({name,width,role,modal});
       counts.modal++;
      }
     }catch(error){failures.push({name,width,role,error:error.message})}
     await page.close();
    }
    await ctx.close();
   }
  }
  for(const failure of failures.slice(0,95))console.log('RESPONSIVE_AUDIT_ISSUE '+JSON.stringify(failure));
  console.log('RESPONSIVE_AUDIT_TOTAL '+JSON.stringify({counts,failures:failures.length}));
  assert.equal(failures.length,0,'Responsive audit detected '+failures.length+' layout or script issues');
  console.log('RESPONSIVE_AUDIT_PASS');
 }finally{
  await browser.close();
  await new Promise(ok=>server.close(ok));
 }
})().catch(e=>{console.error('RESPONSIVE_AUDIT_FAIL',e);process.exitCode=1});
