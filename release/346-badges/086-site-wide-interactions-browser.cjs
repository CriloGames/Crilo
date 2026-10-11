'use strict';
/* Safe end-to-end UI click audit on the actual repository assets, with a
   local static web server and fake read-only Supabase. No live accounts,
   emails, payments, score writes or moderation actions are performed. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const ROOT=process.cwd();
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
let total=0;
function ok(msg){total++;console.log('PASS '+msg)}
function serve(req,res){
 const url=new URL(req.url,'http://localhost');
 let pathname=decodeURIComponent(url.pathname);
 if(pathname.endsWith('/'))pathname+='index.html';
 const file=path.resolve(ROOT,'.'+pathname);
 if(!file.startsWith(ROOT+path.sep)){res.writeHead(403).end();return}
 try{const buf=fs.readFileSync(file);res.writeHead(200,{'content-type':MIME[path.extname(file)]||'application/octet-stream'});res.end(buf)}
 catch{res.writeHead(404).end('Not Found: '+pathname)}
}
const mockSupabase=`(()=>{
 const profile={id:'11111111-1111-4111-8111-111111111111',username:'CriloQA',name_color:'#2f8761',theme:'light',sound_enabled:true,is_owner:false,account_code:'QA123'};
 const fakeUser={id:profile.id,email:'qa@example.test',email_confirmed_at:new Date().toISOString()};
 window.__qa={requests:[], profile, loggedIn:false};
 function query(table){
  const api={};
  for(const name of ['select','eq','neq','gt','gte','lt','lte','in','or','not','order','limit','range','filter','contains','match','is','upsert','update','insert','delete']){
   api[name]=(...args)=>{window.__qa.requests.push([table,name,...args]);return api};
  }
  api.single=async()=>({data:table==='profiles'?profile:null,error:null});
  api.maybeSingle=async()=>({data:table==='profiles'?profile:null,error:null});
  api.then=(yes,no)=>Promise.resolve({data:table==='badges'?[]:[],error:null,count:0}).then(yes,no);
  return api;
 }
 window.supabase={createClient:()=>({
  from:query,
  rpc:async(name,args)=>{
   window.__qa.requests.push(['rpc',name,args||null]);
   if(name==='crilo_my_ban_status')return {data:false,error:null};
   if(name==='crilo_public_daily_completion_counts')return {data:{today:1,all_time:2,period:new Date(Date.now()-22*3600000).toISOString().slice(0,10)},error:null};
   if(name==='search_crilo_players'||name==='crilo_total_points_leaders'||name==='crilo_gameplay_badge_leaders')return {data:[],error:null};
   return {data:true,error:null};
  },
  auth:{
   getSession:async()=>({data:{session:window.__qa.loggedIn?{user:fakeUser,access_token:'qa-token'}:null},error:null}),
   getUser:async()=>({data:{user:window.__qa.loggedIn?fakeUser:null},error:null}),
   onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
   signInWithOtp:async()=>({data:{},error:null}),
   signOut:async()=>({error:null}),
   exchangeCodeForSession:async()=>({data:{session:null},error:null})
  },
  functions:{invoke:async()=>({data:{},error:{message:'Synthetic test does not change accounts'}})},
  storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}
 })};
})();`;
function initPage(page){let errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});return errors}
async function goto(page,url){let response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:16000});assert.equal(response.status(),200,'Page missing '+url);await page.waitForTimeout(180);return response}
async function checkErrors(errors,label){assert.deepEqual(errors,[],label+' script errors: '+JSON.stringify(errors))}
async function main(){
 const server=http.createServer(serve);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:860},reducedMotion:'reduce'});
   await context.addInitScript({content:mockSupabase});
   await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
   const pages=['index.html','leaderboard.html','ducks.html','badge-sets.html','friends.html','profile.html','settings.html','support.html','shape-of-sound.html','beetle-tricks.html','domain/','privacy.html','terms.html'];
   // Every page opens without a runtime exception, and internal links resolve.
   for(const filename of pages){
    const page=await context.newPage(),errors=initPage(page);
    await goto(page,origin+'/'+filename);
    const links=await page.locator('a[href]').evaluateAll(els=>els.map(a=>a.getAttribute('href')).filter(Boolean));
    for(const href of links){
     if(/^(mailto:|https?:|#|javascript:)/i.test(href))continue;
     const url=new URL(href,page.url());
     if(url.origin!==origin)continue;
     const response=await context.request.get(url.toString());
     assert.equal(response.status(),200,'Broken internal link '+filename+' => '+href);
    }
    if(filename==='index.html'){
     const hrefs=await page.locator('.topbar nav a').evaluateAll(els=>els.map(x=>x.getAttribute('href')));
     for(const h of ['index.html','leaderboard.html','ducks.html','#more-games'])assert.ok(hrefs.includes(h),'Missing navigation '+h);
     await page.locator('#helpBtn').click();assert.ok(await page.locator('#helpModal').isVisible(),'Help click failed');
     await page.locator('[data-close="helpModal"]').click();assert.ok(await page.locator('#helpModal').isHidden(),'Help close failed');
     await page.locator('#accountBtn').click();assert.ok(await page.locator('#authModal').isVisible(),'Sign in click failed');
     await page.locator('#authModal [data-close]').first().click();assert.ok(await page.locator('#authModal').isHidden(),'Sign-in close failed');
     await page.locator('#pixelStudioBtn').click();assert.ok(await page.locator('#pixelModal').isVisible(),'Pixel Studio failed to open');
     await page.locator('#pixelUndo').click();
     await page.locator('#pixelClear').click();
     await page.locator('#pixelClose').click();assert.ok(await page.locator('#pixelModal').isHidden(),'Pixel Studio close failed');
     await page.locator('#bugBeetle').click();assert.ok(await page.locator('#bugReportModal').isVisible(),'Bug-report beetle did not open');
     await page.locator('#bugClose').click();assert.ok(await page.locator('#bugReportModal').isHidden(),'Bug report did not close');
     ok('Home nav, Help, sign-in, Pixel Studio and beetle modal '+width);
    }
    if(filename==='leaderboard.html'){
     const buttons=page.locator('.leader-tab');assert.equal(await buttons.count(),7,'Expected seven leaderboard tabs');
     for(const name of ['today','week','all','points','records','badges','ducks']){
      const b=page.locator('.leader-tab[data-tab="'+name+'"]');
      await b.click();
      assert.ok(await b.evaluate(el=>el.classList.contains('active')),'Tab did not become active: '+name);
     }
     ok('All seven leaderboard tabs '+width);
    }
    if(filename==='support.html'){
     const cases=[['2','$2.00','75LUCY8GEAF84'],['5','$5.00','N2EFYQL27VB3Q'],['10','$10.00','ZK6WTGVE48JG4'],['custom','Choose your tip','K7QJM2NVLKEYU']];
     for(const [amount,summary,payid]of cases){
      const btn=page.locator('.support-amount[data-amount="'+amount+'"]');await btn.click();
      assert.equal(await btn.getAttribute('aria-pressed'),'true','Tip selection did not react');
      assert.ok((await page.locator('#tipSummary').innerText()).includes(summary),'Tip amount summary wrong');
      assert.ok((await page.locator('#supportPayLink').getAttribute('href')).includes(payid),'PayPal link does not match selection');
     }
     ok('All 4 tip buttons update correct PayPal link, without starting checkout '+width);
    }
    if(filename==='beetle-tricks.html'){
     await page.locator('#pauseAll').click();assert.ok((await page.locator('#pauseAll').innerText()).includes('Resume'));
     await page.locator('#pauseAll').click();assert.ok((await page.locator('#pauseAll').innerText()).includes('Pause'));
     await page.locator('#replayAll').click();assert.ok((await page.locator('#pauseAll').innerText()).includes('Pause'));
     ok('Beetle Pause, Resume and Replay '+width);
    }
    if(filename==='domain/'){
     await page.locator('#helpBtn').click();assert.ok(await page.locator('#helpModal').isVisible());
     await page.locator('#closeHelp').click();assert.ok(await page.locator('#helpModal').isHidden());
     await page.waitForFunction(()=>document.querySelector('#domainName').textContent!=='loading…',{timeout:10000});
     for(let round=1;round<=5;round++){
      await page.locator('#priceSlider').fill(String(240+round*80));
      await page.locator('#guessButton').click();
      assert.ok(await page.locator('#reveal').isVisible(),'Reveal missing on round '+round);
      await page.locator('#nextButton').click();
     }
     assert.ok(await page.locator('#resultsScreen').isVisible(),'Domain final results missing');
     await page.locator('#playAgainButton').click();assert.ok(await page.locator('#gameScreen').isVisible(),'Domain replay failed');
     ok('Domain instructions, slider, five guesses, reveal, next and replay '+width);
    }
    if(filename==='shape-of-sound.html'){
     await page.locator('#soundAdd').click();
     await page.locator('#soundShuffle').click();
     await page.locator('#soundMute').click();
     await page.locator('#soundPlayRoom').click();
     await page.locator('#soundPlayRoom').click();
     await page.locator('#soundReset').click();
     const tempo=page.locator('#soundTempo');await tempo.fill('120');
     assert.ok((await page.locator('#soundTempoValue').innerText()).includes('120'));
     ok('Sound playground Add, Mix, Mute, Play, Reset, tempo '+width);
    }
    await checkErrors(errors,filename+' '+width);
    await page.close();
    ok('Page loads, internal links resolve, scripts load: '+filename+' '+width);
   }
   await context.close();
  }
  console.log('SITE_WIDE_AUDIT_PASS '+total+' checks');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(e=>{console.error('SITE_WIDE_AUDIT_FAIL',e);process.exitCode=1});
