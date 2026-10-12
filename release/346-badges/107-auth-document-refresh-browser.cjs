'use strict';
/* Browser test: real Crilo auth UI, synthetic Supabase. No production writes.
   Login/logout must discard transient canvas and picker state by reloading. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const original='onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})';
const signout='signOut:async()=>({error:null})';
assert.ok(mockSupabase.includes(original)&&mockSupabase.includes(signout),
 'Synthetic Supabase auth contract changed');
const authScript=
 "sessionStorage.setItem('__qaLoads',String(Number(sessionStorage.getItem('__qaLoads')||0)+1));"+
 mockSupabase
 .replace('loggedIn:false',"loggedIn:sessionStorage.getItem('__qaSignedIn')==='yes'")
 .replace(original,"onAuthStateChange:fn=>{window.__qaAuthChanged=fn;return {data:{subscription:{unsubscribe(){}}}}}")
 .replace(signout, "signOut:async()=>{"+
  "if(window.__qaSignOutError)return {error:{message:'Synthetic failure'}};"+
  "sessionStorage.setItem('__qaSignedIn','no');window.__qa.loggedIn=false;"+
  "window.__qaAuthChanged?.('SIGNED_OUT',null);return {error:null};}");
(async()=>{
 const server=http.createServer(serve);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let checks=0;
 const loadCount=page=>page.evaluate(()=>Number(sessionStorage.getItem('__qaLoads')));
 async function ready(page,signedIn){
  await page.waitForFunction(expected=>
   document.getElementById('accountBtn')?.getAttribute('aria-busy')==='false'&&
   !!window.Crilo?.user===expected,signedIn,{timeout:10000});
  assert.equal(await page.locator('#accountBtn').innerText(),signedIn?'CriloQA':'SIGN IN');
 }
 async function paint(page){
  await page.locator('#drawColor').evaluate(el=>{
   el.value='#ff3366';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.locator('#drawing').evaluate(el=>{
   const ctx=el.getContext('2d');ctx.fillStyle='#ff3366';ctx.fillRect(94,94,12,12);
  });
  assert.equal(await page.locator('#drawColor').inputValue(),'#ff3366');
  assert.ok(await page.locator('#drawing').evaluate(el=>
   el.getContext('2d').getImageData(100,100,1,1).data[3]>0));
 }
 async function clean(page){
  assert.equal(await page.locator('#drawColor').inputValue(),'#222222',
   'Color picker leaked from a previous account');
  assert.equal(await page.locator('#drawing').evaluate(el=>
   el.getContext('2d').getImageData(100,100,1,1).data[3]),0,
   'Drawing survived an auth document reload');
  assert.equal(await page.locator('#drawRecentSwatches button').count(),0,
   'Recent paint colors must be cleared');
  assert.equal(await page.locator('#pixelStudioModal').isHidden(),true);
  checks++;
 }
 async function signIn(page){
  const before=await loadCount(page);
  await page.evaluate(()=>{
   sessionStorage.setItem('__qaSignedIn','yes');window.__qa.loggedIn=true;
   setTimeout(()=>window.__qaAuthChanged('SIGNED_IN',{
    user:{id:'11111111-1111-4111-8111-111111111111'}
   }),0);
  });
  await page.waitForFunction(before=>Number(sessionStorage.getItem('__qaLoads'))>before,before);
  await ready(page,true);checks++;
 }
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:860}});
   await context.addInitScript({content:authScript});
   await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
    route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route(/^https:\/\/(?!crilo\.fun)/,route=>route.abort());
   const page=await context.newPage(),errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   await ready(page,false);
   await paint(page);
   await signIn(page);
   await clean(page);
   // Ordinary token refreshes and repeated SIGNED_IN callbacks must not
   // restart the player's run or cause an infinite reload.
   const noReload=await loadCount(page);
   await page.evaluate(()=>{
    const user={id:'11111111-1111-4111-8111-111111111111'};
    window.__qaAuthChanged('TOKEN_REFRESHED',{user});
    window.__qaAuthChanged('SIGNED_IN',{user});
   });
   await page.waitForTimeout(220);
   assert.equal(await loadCount(page),noReload,'Same-user auth refresh unexpectedly reloaded');
   await paint(page);
   // Sign out from home, where location.reload() is required even though
   // the page address was already index.html.
   await page.locator('#accountBtn').click();
   const beforeLogout=await loadCount(page);
   await page.locator('#menuSignOut').click();
   await page.waitForFunction(before=>Number(sessionStorage.getItem('__qaLoads'))>before,beforeLogout);
   await ready(page,false);
   await clean(page);
   await signIn(page);
   await page.goto(base+'/settings.html',{waitUntil:'domcontentloaded'});
   await ready(page,true);
   const beforeSettings=await loadCount(page);
   await page.locator('#signOutBtn').click();
   await page.waitForFunction(before=>Number(sessionStorage.getItem('__qaLoads'))>before,beforeSettings);
   assert.match(new URL(page.url()).pathname,/\/index\.html$/);
   await ready(page,false);await clean(page);
   // A rejected sign-out request must not wipe a valid user session.
   await signIn(page);
   await page.goto(base+'/settings.html',{waitUntil:'domcontentloaded'});
   await ready(page,true);
   const beforeFailed=await loadCount(page);
   await page.evaluate(()=>{window.__qaSignOutError=true});
   await page.locator('#signOutBtn').click();
   await page.waitForFunction(()=>document.getElementById('identityStatus')?.textContent.includes('Synthetic failure'));
   assert.equal(await loadCount(page),beforeFailed);
   await ready(page,true);
   assert.deepEqual(errors,[],'Browser errors '+width+': '+errors.join('; '));
   await context.close();
   console.log('PASS clean authenticated transitions on '+width+'px');
  }
  console.log('AUTH_DOCUMENT_REFRESH_BROWSER_PASS '+checks+' assertions');
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(err=>{console.error('AUTH_DOCUMENT_REFRESH_BROWSER_FAIL',err);process.exitCode=1});
