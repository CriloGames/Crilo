'use strict';
/* Browser-only authentication: synthetic Supabase and local files, no email
   delivery, production accounts, real database mutations or tokens. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const patch=(source,from,to)=>{assert.equal(source.split(from).length,2,'Fixture marker '+from);return source.replace(from,to)};
let sdk=mockSupabase;
sdk=patch(sdk,'loggedIn:false',"loggedIn:sessionStorage.getItem('__qaSignedIn')==='yes'");
sdk=patch(sdk,"username:'CriloQA'","username:sessionStorage.getItem('__qaName')||'CriloQA'");
sdk=patch(sdk,
 "api.maybeSingle=async()=>({data:table==='profiles'?profile:null,error:null});",
 "api.maybeSingle=async()=>({data:table==='profiles'&&sessionStorage.getItem('__qaProfile')==='yes'?profile:null,error:null});");
sdk=patch(sdk,"api[name]=(...args)=>{window.__qa.requests.push([table,name,...args]);return api};",
 "api[name]=(...args)=>{window.__qa.requests.push([table,name,...args]);if(table==='profiles'&&name==='insert'){sessionStorage.setItem('__qaProfile','yes');sessionStorage.setItem('__qaName',args[0].username);profile.username=args[0].username;}return api};");
sdk=patch(sdk,"signInWithOtp:async()=>({data:{},error:null}),",
 "signInWithOtp:async(args)=>{window.__qa.requests.push(['auth','send',args]);if(window.__qa.failSend)throw Error('Network unavailable');return {data:{},error:null}},");
(async()=>{
 const server=http.createServer(serve);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   await context.addInitScript({content:sdk});
   await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
    r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   await page.locator('#accountBtn[aria-busy="false"]').waitFor();
   await page.locator('#accountBtn').click();
   await page.locator('#authModal').waitFor({state:'visible'});
   await page.locator('#emailInput').fill('not-an-email');
   await page.locator('#emailInput').press('Enter');
   await page.waitForFunction(()=>document.querySelector('#authStatus')?.textContent.includes('valid email'));
   assert.equal(await page.evaluate(()=>window.__qa.requests.filter(x=>x[0]==='auth').length),0);
   await page.locator('#emailInput').fill('new@example.test');
   await page.evaluate(()=>window.__qa.failSend=true);
   await page.locator('#emailInput').press('Enter');
   await page.waitForFunction(()=>document.querySelector('#authStatus')?.textContent.includes('Network unavailable'));
   assert.equal(await page.locator('#sendLinkBtn').isEnabled(),true,'Network failures must re-enable link button');
   await page.evaluate(()=>window.__qa.failSend=false);
   await page.locator('#sendLinkBtn').click();
   await page.waitForFunction(()=>document.querySelector('#authStatus')?.textContent.includes('Check your email'));
   const sends=await page.evaluate(()=>window.__qa.requests.filter(x=>x[0]==='auth'));
   assert.equal(sends.length,2,'One failed request plus one successful request');
   assert.equal(sends[1][2].email,'new@example.test');
   assert.equal(sends[1][2].options.emailRedirectTo,base+'/index.html');
   assert.equal(await page.locator('#sendLinkBtn').isEnabled(),true);
   // An expired verification link should display an actionable error and
   // let the player request a new link without losing the page.
   const expired=await context.newPage();
   expired.on('pageerror',e=>errors.push(e.message));
   await expired.goto(base+'/index.html?error_description=Your%20link%20has%20expired',
    {waitUntil:'domcontentloaded'});
   await expired.locator('#accountBtn[aria-busy="false"]').waitFor();
   await expired.locator('#authModal').waitFor({state:'visible',timeout:5000});
   assert.match(await expired.locator('#authStatus').innerText(),/expired/i);
   await context.close();
   const first=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   await first.addInitScript({content:"sessionStorage.setItem('__qaSignedIn','yes');"+sdk});
   await first.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
    r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await first.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
   const page2=await first.newPage();
   page2.on('pageerror',e=>errors.push(e.message));
   await page2.goto(base+'/friends.html?invite=test123',{waitUntil:'domcontentloaded'});
   await page2.waitForURL(url=>url.pathname==='/index.html',{timeout:15000});
   assert.equal(await page2.evaluate(()=>sessionStorage.getItem('crilo_signup_return')),
    '/friends.html?invite=test123');
   await page2.locator('#profileModal').waitFor({state:'visible',timeout:10000});
   await page2.locator('#usernameInput').fill('NewPlayer');
   await page2.evaluate(()=>{window.__signupOriginalDocument=true});
   const existingTabs=first.pages().length;
   await page2.locator('#saveProfileBtn').click();
   await page2.waitForFunction(()=>window.Crilo?.profile?.username==='NewPlayer',{timeout:12000});
   assert.equal(await page2.locator('#accountBtn').innerText(),'NewPlayer');
   assert.equal(new URL(page2.url()).pathname,'/index.html','Username confirmation stays on Play');
   assert.equal(await page2.evaluate(()=>window.__signupOriginalDocument),true,'Username confirmation must not reload');
   assert.equal(first.pages().length,existingTabs,'Username confirmation must not open another tab');
   assert.equal(await page2.locator('#profileModal').isHidden(),true,'Onboarding dialog closes after saving');
   assert.equal(await page2.locator('#signupReturnLink').getAttribute('href'),'/friends.html?invite=test123');
   assert.equal(await page2.locator('#signupReturnLink').isVisible(),true);
   assert.equal(await page2.evaluate(()=>sessionStorage.getItem('crilo_signup_return')),null);
   // The invitation is accessible only by clicking the optional link.
   await page2.locator('#signupReturnLink').click();
   await page2.waitForURL(url=>url.pathname==='/friends.html'&&url.searchParams.get('invite')==='test123',{timeout:15000});
   await page2.waitForFunction(()=>window.Crilo?.profile?.username==='NewPlayer',{timeout:10000});
   await page2.goto(base+'/leaderboard.html',{waitUntil:'domcontentloaded'});
   await page2.waitForFunction(()=>window.Crilo?.profile?.username==='NewPlayer',{timeout:10000});
   assert.equal(new URL(page2.url()).pathname,'/leaderboard.html','Returning players must stay on their page');
   assert.deepEqual(errors,[],'Browser runtime errors '+width+'px');
   await first.close();
   console.log('AUTH_FIRST_RUN_BROWSER_PASS '+width+'px: same-document username onboarding, optional invite return, no extra tabs');
  }
 }finally{
  await browser.close();
  await new Promise(done=>server.close(done));
 }
})().catch(e=>{console.error('AUTH_FIRST_RUN_BROWSER_FAIL',e);process.exitCode=1});
