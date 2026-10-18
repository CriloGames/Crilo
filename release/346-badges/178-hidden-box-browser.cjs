'use strict';
/* Escape the Box regression: genuine pre- and post-Daily DOM, mobile/desktop
 * touch and keyboard controls, all five solvable rooms, no gameplay writes. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8');
const secretCss=fs.readFileSync('hidden-box.css','utf8');
const css=fs.readFileSync('style.css','utf8')+'\n'+fs.readFileSync('bonus-runs.css','utf8')+
 '\n'+fs.readFileSync('daily-drawing-state.css','utf8')+'\n'+secretCss;
const js=fs.readFileSync('hidden-box.js','utf8');
assert.match(html,/id="criloHiddenBox" class="crilo-hidden-box"/);
assert.match(html,/id="criloHiddenBoxNote" role="dialog" aria-modal="true"/);
assert.match(html,/id="criloEscapeBoard"/);
assert.match(html,/id="criloEscapeShade"/);
assert.match(html,/hidden-box\.css\?v=5/);
assert.match(html,/hidden-box\.js\?v=4/);
assert.doesNotMatch(html,/id="criloChaosPoke"|A pocket of sky|Make a wish/);
assert.doesNotMatch(js,/criloDB|supabase|user_badges|localStorage\.|sessionStorage\.|fetch\(|XMLHttpRequest|\.rpc\(/i,
 'The mini-game must not read/write scoring, authentication or persistent state');
const entrance=secretCss.slice(secretCss.indexOf('.crilo-hidden-box{'),secretCss.indexOf('/* Escape the Box:'));
assert.match(entrance,/cursor:default!important/);
assert.doesNotMatch(entrance,/cursor:\s*pointer/i);

// The maze solutions were verified independently by BFS. Browser test plays
// the complete game with those exact moves rather than simulating a win.
const routes=[
 ['down','right','up','right','down'],
 ['down','left','up','right','up','left','down','left','down'],
 ['right','up','right','up','down','left','up','right','left','down','right','down'],
 ['left','up','left','up','down','right','up','left','up','right','down','right','down','left'],
 ['right','up','left','down','left','down','up','right','up','left','up','right','up','left','down','right','down','left']
];
const key={up:'ArrowUp',right:'ArrowRight',down:'ArrowDown',left:'ArrowLeft'};
const sanitized=html
 .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
 .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi,'');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:780},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',err=>errors.push(err.message));
   await page.setContent(sanitized,{waitUntil:'domcontentloaded'});
   await page.addStyleTag({content:css});
   // Shorten the puzzle's visual transition for browser QA only.
   await page.evaluate(()=>{
    const original=window.setTimeout.bind(window);
    window.setTimeout=(fn,ms,...args)=>original(fn,Math.min(ms,7),...args);
   });
   await page.addScriptTag({content:js});
   const entrance=page.locator('#criloHiddenBox');
   const panel=page.locator('#criloHiddenBoxNote');
   const shade=page.locator('#criloEscapeShade');
   const board=page.locator('#criloEscapeBoard');
   const status=page.locator('#criloEscapeStatus');
   const next=page.locator('#criloEscapeOverlay .crilo-escape-next');
   const screen=()=>page.evaluate(()=>({
    score:document.getElementById('score').textContent,
    spins:document.getElementById('spins').textContent,
    badges:document.getElementById('newBadgeCount').textContent,
    progress:document.getElementById('criloBonusProgress').textContent
   }));
   const original=await screen();
   const size=await entrance.boundingBox();
   assert.ok(size&&size.width===60&&size.height===60,'Invisible 60px hit target at '+width);
   for(const dailyState of ['before','finished']){
    await page.evaluate(state=>{
     const finished=state==='finished';
     document.documentElement.classList.toggle('crilo-daily-pending',!finished);
     document.getElementById('drawPanel').classList.toggle('daily-finished',finished);
     document.getElementById('drawPanel').inert=finished;
     for(const id of ['playedPanel','result','criloBonusPanel']){
      document.getElementById(id).classList.toggle('hidden',!finished);
     }
    },dailyState);
    for(const theme of ['light','dark']){
     await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
     await entrance.scrollIntoViewIfNeeded();
     const style=await entrance.evaluate(el=>{
      const r=el.getBoundingClientRect();
      return {cursor:getComputedStyle(el).cursor,
       color:getComputedStyle(el,'::before').backgroundColor,
       page:getComputedStyle(document.body).backgroundColor,
       border:getComputedStyle(el,'::before').borderTopWidth,
       pointed:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===el};
     });
     assert.equal(style.cursor,'default','No hover hint');
     assert.equal(style.color,style.page,'Invisible in both themes');
     assert.equal(style.border,'0px');
     assert.ok(style.pointed,'Clickable before/after Daily');
     await entrance.click({timeout:5000});
     await panel.waitFor({state:'visible'});
     assert.equal(await shade.isVisible(),true);
     assert.equal(await board.getAttribute('data-room'),'1');
     assert.equal(await board.getAttribute('data-sparks'),'0');
     const initialPosition=await board.getAttribute('data-position');
     await page.locator('[data-secret-direction="right"]').click();
     await page.waitForTimeout(24);
     assert.notEqual(await board.getAttribute('data-position'),initialPosition,
       'Directional button advances sliding puzzle '+dailyState+'/'+theme+'/'+width);
     await page.locator('#criloEscapeRestart').click();
     assert.equal(await board.getAttribute('data-slides'),'0','Restart resets current room');
     assert.equal(await board.getAttribute('data-position'),initialPosition);
     // Test keyboard. A downward slide is always available from the initial position.
     await page.keyboard.press('ArrowDown');
     await page.waitForTimeout(24);
     assert.notEqual(await board.getAttribute('data-position'),initialPosition);
     await page.locator('#criloEscapeRestart').click();
     const previous=await board.getAttribute('data-position');
     await board.dispatchEvent('pointerdown',{pointerId:99,pointerType:'touch',clientX:100,clientY:100,button:0});
     await board.dispatchEvent('pointerup',{pointerId:99,pointerType:'touch',clientX:170,clientY:100,button:0});
     await page.waitForTimeout(24);
     assert.notEqual(await board.getAttribute('data-position'),previous,
       'Touch swipe advances sliding puzzle');
     assert.deepEqual(await screen(),original,'Never affect score, spins, badges or bonuses');
     await page.keyboard.press('Escape');
     assert.equal(await panel.isVisible(),false);
     assert.equal(await shade.isVisible(),false);
    }
   }
   // Complete the entire game once on a wide viewport, not just a mocked award.
   if(width===1280){
    await page.evaluate(()=>document.documentElement.dataset.theme='light');
    await entrance.click();
    await page.locator('#criloEscapeRestart').click();
    for(let level=0;level<routes.length;level++){
     assert.equal(await board.getAttribute('data-room'),String(level+1),'Room progress');
     for(const dir of routes[level]){
      await page.keyboard.press(key[dir]);
      await page.waitForTimeout(24);
     }
     assert.equal(await board.getAttribute('data-sparks'),'3','All sparks collected');
     await next.waitFor({state:'visible'});
     if(level<4){
      await next.click();
      assert.equal(await board.getAttribute('data-room'),String(level+2));
     }
    }
    assert.match(await page.locator('#criloEscapeOverlay').innerText(),/YOU ESCAPED!/);
    assert.equal(await board.getAttribute('data-slides'),'58','Complete run move counter');
    await next.click();
    assert.equal(await board.getAttribute('data-slides'),'0','Play again resets run');
    assert.equal(await board.getAttribute('data-room'),'1');
    assert.deepEqual(await screen(),original,'Winning cannot touch Daily or badge values');
    await page.locator('#criloEscapeClose').click();
    assert.equal(await panel.isVisible(),false);
   }
   assert.deepEqual(errors,[],'No browser errors at '+width);
   await page.close();
  }
  console.log('ESCAPE_BOX_BROWSER_PASS: five rooms beaten, 58-slide win, keyboard, d-pad, swipe, all viewports, pre/post Daily, score isolation');
 }finally{await browser.close()}
})().catch(error=>{console.error('ESCAPE_BOX_BROWSER_FAIL',error);process.exitCode=1});
