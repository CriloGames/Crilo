'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const paths=['index.html','ducks.html','leaderboard.html','profile.html','settings.html','friends.html','badge-sets.html','shape-of-sound.html','domain/'];
const palette=['#ff0000','#00aa66','#3366ee','#ff9900','#aa66cc','#245678','#996633'];
const mock=mockSupabase.replace('loggedIn:false','loggedIn:true')+
 'window.__qa.profile.name_letter_colors='+JSON.stringify(palette)+';'+
 '(function(){const f=window.supabase.createClient;window.supabase.createClient=(...args)=>{const db=f(...args),get=db.auth.getSession;db.auth.getSession=async()=>{await new Promise(resolve=>setTimeout(resolve,700));return get()};return db}})();';
const verifySource=()=>{
 const continuity=fs.readFileSync('header-continuity.js','utf8');
 const app=fs.readFileSync('app.js','utf8');
 const boot=fs.readFileSync('auth-first-paint.js','utf8');
 assert.match(continuity,/crilo-header-preview-v2/);
 assert.match(continuity,/letters:\s*validLetters/);
 assert.match(continuity,/paintName\(button,snapshot\)/);
 assert.match(boot,/classList\.add\('crilo-auth-pending'\)/);
 assert.match(app,/CriloAuthFirstPaint\?\.reveal/);
 for(const path of paths){
  const source=fs.readFileSync(path==='domain/'?'domain/index.html':path,'utf8');
  assert.match(source,/auth-first-paint\.js\?v=1/);
  assert.ok(source.indexOf('auth-first-paint.js')<source.indexOf('</head>'),'Bootstrap after first body paint: '+path);
 }
};
async function run(){
 verifySource();
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const base='http://127.0.0.1:'+server.address().port;
 let cases=0;
 try{
 for(const width of [390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:860},reducedMotion:'reduce'});
  await ctx.addInitScript({content:mock});
  await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await ctx.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
  const page=await ctx.newPage();
  await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.Crilo?.user?.id&&document.documentElement.dataset.criloAuthReady==='true',{timeout:12000});
  for(const path of paths){
   await page.goto(base+'/'+path,{waitUntil:'domcontentloaded'});
   const state=await page.evaluate(()=>{
    const el=document.querySelector('#accountBtn');
    return {pending:document.documentElement.classList.contains('crilo-auth-pending'),
      main:getComputedStyle(document.querySelector('main')).visibility,
      account:el.textContent,
      visible:getComputedStyle(el).visibility,
      colors:[...el.querySelectorAll('span')].map(x=>x.style.color),
      busy:el.getAttribute('aria-busy')}
   });
   assert.equal(state.pending,true,'Expected pending load for '+path);
   assert.equal(state.main,'hidden','Main briefly displayed guest layout: '+path);
   assert.equal(state.busy,'true','Header preview should stay unverified: '+path);
   assert.equal(state.account,'CriloQA','Wrong cached username: '+path);
   assert.equal(state.visible,'visible','Header flickered blank: '+path);
   assert.equal(state.colors.length,7,'Individual letter colors absent before auth: '+path);
   await page.waitForFunction(()=>document.documentElement.dataset.criloAuthReady==='true'&&
    document.getElementById('accountBtn')?.getAttribute('aria-busy')==='false',{timeout:12000});
   const done=await page.evaluate(()=>({
    main:getComputedStyle(document.querySelector('main')).visibility,
    colors:[...document.querySelectorAll('#accountBtn span')].map(x=>x.style.color)
   }));
   assert.equal(done.main,'visible','Main did not reveal after auth: '+path);
   assert.deepEqual(done.colors,state.colors,'Name colors changed after session verification: '+path);
   cases++;
  }
  await ctx.close();
 }
 // Guests must also see content after the authentication check; never hang.
 const guest=await browser.newContext();
 await guest.addInitScript({content:mockSupabase});
 await guest.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
 await guest.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
 const p=await guest.newPage();await p.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>document.documentElement.dataset.criloAuthReady==='true',{timeout:12000});
 assert.equal(await p.locator('#accountBtn').innerText(),'SIGN IN');
 assert.equal(await p.locator('main').evaluate(x=>getComputedStyle(x).visibility),'visible');
 await guest.close();cases++;
 console.log('AUTH_PREPAINT_BROWSER_PASS '+cases+' signed-in and guest refresh scenarios');
 }finally{await browser.close();await new Promise(r=>server.close(r))}
}
run().catch(e=>{console.error('AUTH_PREPAINT_BROWSER_FAIL',e);process.exitCode=1});