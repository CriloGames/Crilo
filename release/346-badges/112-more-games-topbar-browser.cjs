'use strict';
/* Check the two games actually linked under More Games, in light/dark mode and
   from narrow phones to desktop. Does not call the production database. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
(async()=>{
 const server=http.createServer(serve);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let checks=0;
 try{
  for(const width of [320,390,768,1280]){
   for(const theme of ['light','dark']){
    const ctx=await browser.newContext({viewport:{width,height:860}});
    await ctx.addInitScript({content:
     'localStorage.setItem("crilo_theme","'+theme+'");'+
     'localStorage.setItem("crilo_sound","'+(theme==='dark'?'off':'on')+'");'+
     mockSupabase
    });
    await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
     r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
    await ctx.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
    for(const game of [
     {url:'shape-of-sound.html',info:'#gameInfoBtn',modal:'#gameInfoModal',close:'#gameInfoClose',settings:'settings.html'},
     {url:'domain/',info:'#helpBtn',modal:'#helpModal',close:'#closeHelp',settings:'../settings.html'}
    ]){
     const page=await ctx.newPage(),errors=[];
     page.on('pageerror',error=>errors.push(error.message));
     const res=await page.goto(base+'/'+game.url,{waitUntil:'domcontentloaded'});
     assert.equal(res.status(),200,'Game failed to load: '+game.url);
     const header=page.locator('header.crilo-game-topbar');
     assert.equal(await header.count(),1,'Missing Crilo game header');
     assert.equal(await header.locator('a.brand').innerText(),'CRILO');
     const nav=await header.locator('nav a').allTextContents();
     assert.deepEqual(nav.map(s=>s.trim()),['PLAY','MORE GAMES'],
      'Show only Play and More Games on '+game.url);
     const settings=header.locator('a.crilo-game-settings');
     assert.equal(await settings.getAttribute('href'),game.settings);
     assert.equal(await settings.getAttribute('aria-label'),'Settings');
     assert.ok(await header.locator(game.info).isVisible(),'Game Info control missing');
     await page.locator(game.info).click();
     assert.ok(await page.locator(game.modal).isVisible(),'Game-specific information did not open');
     if(game.url==='shape-of-sound.html'){
      assert.ok((await page.locator(game.modal).innerText()).includes('Play the room'));
      assert.equal(await page.locator(game.info).getAttribute('aria-expanded'),'true');
      await page.keyboard.press('Escape');
      assert.ok(await page.locator(game.modal).isHidden(),'Escape should dismiss sound game info');
      await page.locator(game.info).click();
      await page.locator(game.close).click();
      assert.ok(await page.locator(game.modal).isHidden(),'Close button did not dismiss sound info');
      assert.ok((await page.locator('.sound-free').innerText()).includes('Settings'));
      assert.equal(await page.locator('.sound-free a').getAttribute('href'),'settings.html');
      await page.waitForFunction(()=>document.querySelector('#soundMute')?.getAttribute('aria-pressed')!==null);
      assert.equal(await page.locator('#soundMute').getAttribute('aria-pressed'),
       theme==='dark'?'false':'true','Sound game ignored saved sound preference');
     }else{
      await page.locator(game.close).click();
      assert.ok(await page.locator(game.modal).isHidden(),'Domain info close failed');
      assert.equal(await header.locator('.score-pill #score').count(),1,
       'Domain points must remain visible');
     }
     const sizes=await page.evaluate(()=>{
      const bar=document.querySelector('header.crilo-game-topbar');
      const bg=getComputedStyle(bar).backgroundColor;
      return{w:document.documentElement.scrollWidth,viewport:innerWidth,
       bg,help:bar.querySelector('button').getBoundingClientRect().toJSON(),
       settings:bar.querySelector('.crilo-game-settings').getBoundingClientRect().toJSON()};
     });
     assert.ok(sizes.w<=width+2,game.url+' '+width+'px has horizontal overflow: '+JSON.stringify(sizes));
     assert.ok(sizes.settings.left>=-1&&sizes.settings.right<=width+1,
      game.url+' Settings button clipped at '+width);
     assert.ok(sizes.help.left>=-1&&sizes.help.right<=width+1,
      game.url+' Info button clipped at '+width);
     const bg=Number((sizes.bg.match(/rgba?\((\d+)/)||[])[1]);
     assert.ok(Number.isFinite(bg));
     if(theme==='dark')assert.ok(bg<70,'Nighttime game header is too bright');
     if(theme==='light')assert.ok(bg>160,'Daytime game header is too dark');
     assert.deepEqual(errors,[],game.url+' unexpected browser errors');
     checks+=14;
     await page.close();
    }
    await ctx.close();
   }
  }
  console.log('MORE_GAMES_TOPBAR_PASS '+checks+' checks across 2 games, 4 widths and 2 themes');
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
})().catch(err=>{console.error('MORE_GAMES_TOPBAR_FAIL',err);process.exitCode=1});
