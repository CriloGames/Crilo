'use strict';
/* Verify Crilo's REAL shared account controls, not decorative mock controls,
   on both standalone games. No production requests, email, or score writes. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
(async()=>{
 const server=http.createServer(serve);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let cases=0;
 try{
  for(const width of [320,390,768,1280]){
   for(const theme of ['light','dark']){
    for(const loggedIn of [false,true]){
     const ctx=await browser.newContext({viewport:{width,height:860},reducedMotion:'reduce'});
     const auth=mockSupabase.replace('loggedIn:false','loggedIn:'+loggedIn)
       .replace("theme:'light'","theme:'"+theme+"'");
     await ctx.addInitScript({content:
      'localStorage.setItem("crilo_theme","'+theme+'");'+
      'localStorage.setItem("crilo_sound","'+(theme==='dark'?'off':'on')+'");'+auth
     });
     await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
      r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
     await ctx.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
     for(const game of [
      {url:'shape-of-sound.html',info:'#gameInfoBtn',modal:'#gameInfoModal',
       close:'#gameInfoClose',root:'',settings:'settings.html'},
      {url:'domain/',info:'#helpBtn',modal:'#helpModal',
       close:'#closeHelp',root:'../',settings:'../settings.html'}
     ]){
      const page=await ctx.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      const res=await page.goto(base+'/'+game.url,{waitUntil:'domcontentloaded'});
      assert.equal(res.status(),200,game.url+' must load');
      const header=page.locator('header.crilo-game-topbar');
      assert.equal(await header.locator('a.brand').innerText(),'CRILO');
      assert.deepEqual((await header.locator('nav a:visible').allTextContents()).map(s=>s.trim()),
       ['PLAY','MORE GAMES'],game.url+' must hide Leaderboard/Ducks/owner navigation');
      assert.equal(await header.locator('.crilo-game-settings').count(),0,
       'Remove redundant Settings shortcut from top-level navigation');
      assert.equal(await header.locator(game.info).count(),1);
      assert.ok(await header.locator(game.info).isVisible(),'Info must be top right');
      await page.locator(game.info).click();
      assert.ok(await page.locator(game.modal).isVisible(),game.url+' help must open');
      if(game.url==='shape-of-sound.html'){
       assert.ok((await page.locator(game.modal).innerText()).includes('Play the room'));
       await page.keyboard.press('Escape');
       assert.ok(await page.locator(game.modal).isHidden(),'Esc should close sound info');
       await page.locator(game.info).click();
       await page.locator(game.close).click();
       assert.ok((await page.locator('.sound-free').innerText()).includes('Settings'));
       assert.equal(await page.locator('.sound-free a').getAttribute('href'),'settings.html');
       await page.waitForFunction(()=>document.querySelector('#soundMute')?.getAttribute('aria-pressed')!==null);
       assert.equal(await page.locator('#soundMute').getAttribute('aria-pressed'),
        theme==='dark'?'false':'true','Sound game should follow the saved mute preference');
      }else{
       await page.locator(game.close).click();
       assert.ok(await page.locator(game.modal).isHidden(),'Domain help close must work');
       assert.equal(await page.locator('.domain-score-line #score').count(),1,
        'Domain score remains on the game page, not crammed into its header');
      }
      const account=header.locator('#accountBtn');
      await page.waitForFunction(()=>{
       const button=document.getElementById('accountBtn');
       return button&&button.getAttribute('aria-busy')==='false'
      },{timeout:8000});
      if(loggedIn){
       assert.equal(await account.innerText(),'CriloQA',game.url+' real username missing');
       const bell=header.locator('#friendBellBtn');
       assert.ok(await bell.isVisible(),'Authenticated notification bell missing');
       await bell.click();
       assert.ok(await page.locator('#friendBellPanel').isVisible(),'Notification panel failed to open');
       const dropdown=await page.locator('#friendBellPanel').boundingBox();
       assert.ok(dropdown.x>=-2 && dropdown.x+dropdown.width<=width+2,
        'Friend notifications clipped outside viewport on '+width+'px: '+JSON.stringify(dropdown));
       const friendFooter=await page.locator('.crilo-notification-footer').getAttribute('href');
       assert.equal(friendFooter,game.root+'friends.html','Friends bell link points outside site root');
       await bell.click();
       await account.click();
       assert.ok(await page.locator('#accountMenu').isVisible(),'Account dropdown missing');
       const hrefs=await page.locator('#accountMenu a').evaluateAll(els=>els.map(e=>e.getAttribute('href')));
       assert.deepEqual(hrefs,['profile.html','friends.html','settings.html'].map(x=>game.root+x),
        game.url+' account navigation broken');
       assert.ok(await page.locator('#menuSignOut').isVisible(),'Sign-out control missing');
       await page.keyboard.press('Escape');
       assert.ok(await page.locator('#accountMenu').isHidden(),'Account menu should close on Escape');
      }else{
       assert.equal(await account.innerText(),'SIGN IN','Guest must see sign-in control');
       assert.ok(!(await header.locator('#friendBellBtn').isVisible()),
        'Guest should not see a signed-in notification bell');
       await account.click();
       assert.ok(await page.locator('#criloSharedAuthModal').isVisible(),
        game.url+' must support passwordless sign in');
       await page.locator('#criloSharedAuthModal [data-shared-auth-close]').click();
       assert.ok(await page.locator('#criloSharedAuthModal').isHidden());
      }
      const ui=await page.evaluate(()=>{
       const bar=document.querySelector('.crilo-game-topbar');
       const actions=[bar.querySelector('[aria-label^="How to play"]'),
        bar.querySelector('#friendBellBtn'),bar.querySelector('#accountBtn')]
        .filter(el=>el&&getComputedStyle(el).display!=='none')
        .map(el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right}});
       return{scroll:document.documentElement.scrollWidth,viewport:innerWidth,
        bg:getComputedStyle(bar).backgroundColor,actions};
      });
      assert.ok(ui.scroll<=width+2,game.url+' '+width+'px horizontal overflow '+JSON.stringify(ui));
      assert.ok(ui.actions.every(r=>r.left>=-2&&r.right<=width+2),
       game.url+' '+width+'px header control clipped '+JSON.stringify(ui));
      const bg=Number((ui.bg.match(/rgba?\((\d+)/)||[])[1]);
      assert.ok(theme==='dark'?bg<70:bg>160,'Header has wrong '+theme+' palette '+ui.bg);
      assert.deepEqual(errors,[],game.url+' runtime errors');
      cases++;
      await page.close();
     }
     await ctx.close();
    }
   }
  }
  console.log('MORE_GAMES_TOPBAR_PASS '+cases+
   ' fully exercised header scenarios across both games, two auth states, four widths and two themes');
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
})().catch(err=>{console.error('MORE_GAMES_TOPBAR_FAIL',err);process.exitCode=1});
