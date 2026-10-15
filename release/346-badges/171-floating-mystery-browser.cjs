'use strict';
/* Account-only floating Mystery Curiosities: fully mocked browser RPC.
 * Never writes a live player score, discovery, or account. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
const sql=fs.readFileSync('release/346-badges/170-floating-mystery-curiosities.sql','utf8');
const js=fs.readFileSync('floating-mystery.js','utf8');
const css=fs.readFileSync('floating-mystery.css','utf8');
const profile=fs.readFileSync('mystery-profile.js','utf8');
const keys=['sleepy_duck','cosmic_quack','backwards_map','tiny_crown','cloud_recipe','lost_button'];
assert.match(sql,/pg_catalog\.random\(\)<0\.08/);
assert.match(sql,/INTERVAL '30 seconds'/);
assert.match(sql,/FOR UPDATE/);
assert.match(sql,/PRIMARY KEY\(user_id,daily_period\)/);
assert.match(sql,/row_state\.spawn_id IS DISTINCT FROM p_spawn_id/);
assert.match(sql,/ON CONFLICT DO NOTHING/);
assert.match(sql,/email_confirmed_at IS NOT NULL/);
assert.match(sql,/crilo_banned_accounts/);
assert.match(sql,/crilo_daily_penalties/);
assert.match(sql,/REVOKE ALL ON public\.crilo_mystery_page_spawns/);
assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.crilo_mystery_page_visit\(text,text,uuid\)\s+TO authenticated/);
assert.doesNotMatch(sql,/(?:INSERT INTO|UPDATE|DELETE FROM) public\.(daily_runs|crilo_bonus_runs|user_badges|crilo_spin_sessions)/i);
assert.match(css,/position:fixed/,'The little visitor must remain visible while scrolling');
assert.match(css,/:hover \.crilo-wandering-tooltip/);
assert.match(css,/:focus-visible \.crilo-wandering-tooltip/);
assert.match(js,/crilo-mystery-discovered/);
assert.match(js,/BroadcastChannel/,'Claimed visitors synchronize across tabs');
assert.match(js,/window\.Crilo\?\.user\?\.id!==owner/,'Ignore stale claim responses after sign-out');
assert.match(profile,/CriloMysteryCuriosityIcon/,'Private collection uses authored unique artwork');
assert.match(profile,/addEventListener\('crilo-mystery-discovered'/);
for(const path of ['index.html','leaderboard.html','ducks.html','profile.html','settings.html',
                   'friends.html','badge-sets.html','shape-of-sound.html','moderation.html','owner-analytics.html']){
 const html=fs.readFileSync(path,'utf8');
 assert.match(html,/floating-mystery\.js\?v=5/,path+' must allow page discoveries');
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let tested=0;
 try{
  for(const width of [320,390,768,1180]){
   const page=await browser.newPage({viewport:{width,height:820},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',err=>errors.push(err.message));
   await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main style="height:2600px;padding:8px"><h1>Crilo mock page</h1></main></body></html>');
   await page.addStyleTag({content:css});
   await page.evaluate(()=>{
    window.Crilo={user:null,authResolved:false};
    window.__float={key:'sleepy_duck',calls:[],claimed:0,events:0};
    window.addEventListener('crilo-mystery-discovered',()=>window.__float.events++);
    window.criloDB={rpc:async(name,params)=>{
     window.__float.calls.push({name,params});
     if(name!=='crilo_mystery_page_visit')throw Error('Wrong RPC '+name);
     if(params.p_action==='enter')return {data:{state:'ready',key:window.__float.key,spawn_id:'token-qa'},error:null};
     if(params.p_action==='claim'){window.__float.claimed++;return {data:{
      state:'collected',key:window.__float.key,new_discovery:true,discovered_count:1
     },error:null};}
     throw Error('Unexpected action');
    }};
   });
   await page.addScriptTag({content:js});
   await page.evaluate(()=>window.dispatchEvent(new Event('crilo-auth-ready')));
   assert.equal(await page.locator('.crilo-wandering-find').count(),0,'Guest cannot discover things');
   await page.evaluate(()=>{window.Crilo.user={id:'mock-user'};window.dispatchEvent(new Event('crilo-auth-ready'))});
   await page.locator('.crilo-wandering-find').waitFor({state:'visible'});
   assert.equal(await page.locator('.crilo-wandering-find').getAttribute('title'),'The Napping Duck');
   assert.equal(await page.locator('.crilo-wandering-find').evaluate(e=>getComputedStyle(e).position),'fixed');
   const before=await page.locator('.crilo-wandering-find').boundingBox();
   await page.evaluate(()=>window.scrollTo(0,1500));
   await page.waitForFunction(()=>window.scrollY>1000);
   const after=await page.locator('.crilo-wandering-find').boundingBox();
   assert.ok(Math.abs(before.y-after.y)<=1,'A wandering curiosity must follow the viewport during scrolling');
   await page.locator('.crilo-wandering-find').hover();
   const tooltip=page.locator('.crilo-wandering-tooltip');
   assert.equal(await tooltip.textContent(),'The Napping Duck');
   assert.equal(await tooltip.evaluate(e=>getComputedStyle(e).visibility),'visible');
   const labelBounds=await tooltip.boundingBox();
   assert.ok(labelBounds.x>=-1&&labelBounds.x+labelBounds.width<=width+1,
     'Hover label remains inside viewport at '+width+'px');

   await page.evaluate(()=>window.dispatchEvent(new Event('crilo-auth-ready')));
   assert.equal(await page.evaluate(()=>window.__float.calls.filter(x=>x.params.p_action==='enter').length),1,
    'Repeated auth and scroll events never reroll');
   await page.locator('.crilo-wandering-find').click();
   await page.locator('.crilo-wandering-dialog').waitFor({state:'visible'});
   assert.match(await page.locator('.crilo-wandering-dialog').textContent(),/The Napping Duck/);
   assert.match(await page.locator('.crilo-wandering-dialog').textContent(),/Added to your Mystery Collection/);
   assert.match(await page.locator('.crilo-wandering-dialog').textContent(),/Just a collectible/);
   assert.equal(await page.locator('.crilo-wandering-find').count(),0);
   assert.equal(await page.evaluate(()=>window.__float.claimed),1,'Saved once');
   assert.equal(await page.evaluate(()=>window.__float.events),1,'Notify Statistics to refresh');
   assert.equal(await page.locator('.crilo-wandering-link').getAttribute('href'),'profile.html');
   await page.locator('.crilo-wandering-close').click();
   await page.locator('.crilo-wandering-dialog').waitFor({state:'detached'});
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<=3,'Horizontal overflow '+width+' '+theme+': '+overflow);
   }
   assert.deepEqual(errors,[],'JS errors at '+width);
   await page.close();tested++;
  }
  const page=await browser.newPage();
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  await page.evaluate(()=>{
   window.Crilo={authResolved:true,user:{id:'qa-test'}};
   window.__k='tiny_crown';
   window.criloDB={rpc:async(name,p)=>{
    if(p.p_action==='enter')return{data:{state:'ready',key:window.__k,spawn_id:'qa'},error:null};
    return {data:{state:'collected',key:window.__k,new_discovery:false,discovered_count:6},error:null};
   }};
  });
  await page.addStyleTag({content:css});
  await page.addScriptTag({content:js});
  await page.locator('.crilo-wandering-find').waitFor({state:'visible'});
  await page.locator('.crilo-wandering-find').click();
  assert.match(await page.locator('.crilo-wandering-dialog').textContent(),/Already in your Mystery Collection/);
  assert.equal(await page.locator('.crilo-wandering-dialog').getByRole('heading').textContent(),'An Absurdly Tiny Crown');
  await page.close();

  // Same account in two real browser tabs: claiming on one hides the visitor
  // in the other, and informs an open Statistics page to refresh its shelf.
  const context=await browser.newContext({reducedMotion:'reduce'});
  await context.route('https://test.crilo.fun/**',r=>r.fulfill({
   status:200,contentType:'text/html',
   body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main>Crilo synthetic page</main></body></html>'
  }));
  const peers=[await context.newPage(),await context.newPage()];
  for(const tab of peers){
   await tab.goto('https://test.crilo.fun/index.html');
   await tab.evaluate(()=>{
    window.Crilo={authResolved:true,user:{id:'same-qa-player'}};
    window.__received=0;
    window.addEventListener('crilo-mystery-discovered',()=>window.__received++);
    window.criloDB={rpc:async(name,args)=>({
     data:args.p_action==='enter'?
      {state:'ready',key:'cloud_recipe',spawn_id:'one-server-token'}:
      {state:'collected',key:'cloud_recipe',new_discovery:true,discovered_count:1},
     error:null
    })};
   });
   await tab.addStyleTag({content:css});
   await tab.addScriptTag({content:js});
   await tab.locator('.crilo-wandering-find').waitFor({state:'visible'});
  }
  await peers[0].locator('.crilo-wandering-find').click();
  await peers[1].locator('.crilo-wandering-find').waitFor({state:'detached'});
  await peers[1].waitForFunction(()=>window.__received===1);
  await context.close();

  // An old async claim must not reveal private prize details after sign-out.
  const signout=await browser.newPage({reducedMotion:'reduce'});
  await signout.setContent('<!doctype html><html><head></head><body></body></html>');
  await signout.evaluate(()=>{
   window.Crilo={authResolved:true,user:{id:'session-a'}};
   window.__finishClaim=null;
   window.criloDB={rpc:async(name,args)=>{
    if(args.p_action==='enter')return {data:{state:'ready',key:'tiny_crown',spawn_id:'late-token'},error:null};
    return new Promise(resolve=>{window.__finishClaim=resolve});
   }};
  });
  await signout.addStyleTag({content:css});
  await signout.addScriptTag({content:js});
  await signout.locator('.crilo-wandering-find').waitFor({state:'visible'});
  await signout.locator('.crilo-wandering-find').click();
  await signout.waitForFunction(()=>typeof window.__finishClaim==='function');
  await signout.evaluate(()=>{
   Crilo.user=null;
   window.dispatchEvent(new Event('crilo-auth-ready'));
   window.__finishClaim({data:{state:'collected',key:'tiny_crown',new_discovery:true,discovered_count:1},error:null});
  });
  await signout.waitForTimeout(100);
  assert.equal(await signout.locator('.crilo-wandering-dialog').count(),0,'No claim popup after sign out');
  assert.equal(await signout.locator('.crilo-wandering-find').count(),0,'No floating icon after sign out');
  await signout.close();

  for(const key of keys)assert.match(js,new RegExp(''+key+'\\\\?'.replace('\\\\?','')),'Missing '+key);
  console.log('FLOATING_MYSTERY_PASS: six illustrations, verified collection, scroll positioning, hover and click, guest protection and '+tested+' responsive widths');
 }finally{await browser.close()}
})().catch(e=>{console.error('FLOATING_MYSTERY_FAIL',e);process.exitCode=1});