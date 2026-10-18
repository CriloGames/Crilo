'use strict';
/* Isolated Chromium QA for the actual Crilo Daily homepage. No session or
   network: test before Daily, completed Daily, light/dark, pointer/keyboard,
   while proving scoreboard and badge DOM remain untouched. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8');
const hiddenCss=fs.readFileSync('hidden-box.css','utf8');
const css=fs.readFileSync('style.css','utf8')+'\n'+
 fs.readFileSync('bonus-runs.css','utf8')+'\n'+
 fs.readFileSync('daily-drawing-state.css','utf8')+'\n'+hiddenCss;
const js=fs.readFileSync('hidden-box.js','utf8');
assert.match(html,/id="criloHiddenBox" class="crilo-hidden-box"/);
assert.match(html,/id="criloHiddenBoxNote" role="group"[^>]*hidden/);
assert.match(html,/id="criloChaosPoke"/);
assert.match(html,/id="criloChaosStage"/);
assert.doesNotMatch(html,/A pocket of sky|Make a wish/);
assert.match(html,/hidden-box\.css\?v=4/);
assert.match(html,/hidden-box\.js\?v=3/);
assert.doesNotMatch(js,/criloDB|supabase|user_badges|localStorage\.|fetch\(/i,
 'The Easter egg must not interact with backend, account, scores, or storage');
const triggerStyles=hiddenCss.slice(hiddenCss.indexOf('.crilo-hidden-box{'),hiddenCss.indexOf('.crilo-hidden-box-note{'));
assert.doesNotMatch(triggerStyles,/cursor:\s*pointer/i,
 'The hidden click target must not advertise itself with a pointer cursor');
assert.match(hiddenCss,/\.crilo-hidden-box\{[^}]*cursor:default!important/s,
 'Even when the Daily is locked, hover must leave the cursor unchanged');
const sanitized=html
 .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
 .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi,'');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:860},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent(sanitized,{waitUntil:'domcontentloaded'});
   await page.addStyleTag({content:css});
   await page.addScriptTag({content:js});
   const box=page.locator('#criloHiddenBox');
   const note=page.locator('#criloHiddenBoxNote');
   const poke=page.locator('#criloChaosPoke');
   const stage=page.locator('#criloChaosStage');
   const close=page.locator('#criloChaosClose');
   assert.equal(await box.count(),1);
   assert.equal(await note.isVisible(),false);
   assert.equal(await box.isEnabled(),true);
   const bounds=await box.boundingBox();
   assert.ok(bounds&&bounds.width===60&&bounds.height===60,'Doubled 60px hit target at '+width);
   assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width,'Box on screen '+width);

   for(const mode of ['before','finished']){
    await page.evaluate(mode=>{
     const finished=mode==='finished';
     document.documentElement.classList.toggle('crilo-daily-pending',!finished);
     document.getElementById('drawPanel').classList.toggle('daily-finished',finished);
     document.getElementById('drawPanel').inert=finished;
     for(const id of ['playedPanel','result','criloBonusPanel']){
      document.getElementById(id).classList.toggle('hidden',!finished);
     }
    },mode);
    for(const theme of ['light','dark']){
     await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
     await box.scrollIntoViewIfNeeded();
     const metrics=await box.evaluate(el=>{
      const rect=el.getBoundingClientRect();
      const midpoint={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
      return{
       body:getComputedStyle(document.body).backgroundColor,
       box:getComputedStyle(el,'::before').backgroundColor,
       cursor:getComputedStyle(el).cursor,
       tiny:getComputedStyle(el,'::before').width,
       visibleHeight:getComputedStyle(el,'::before').height,
       edgeStyle:getComputedStyle(el,'::before').borderStyle,
       edgeWidth:getComputedStyle(el,'::before').borderTopWidth,
       shadow:getComputedStyle(el,'::before').boxShadow,
       buttonEdge:getComputedStyle(el).borderTopWidth,
       clickable:document.elementFromPoint(midpoint.x,midpoint.y)===el,
       inert:el.inert||el.closest('[inert]')!==null,
       disabled:el.disabled,
       score:document.getElementById('score').textContent,
       spins:document.getElementById('spins').textContent,
       badges:document.getElementById('newBadgeCount').textContent
      };
     });
     assert.equal(metrics.box,metrics.body,'Camouflage '+mode+' '+theme+' '+width);
     assert.equal(metrics.cursor,'default','Normal cursor '+mode+' '+theme);
     assert.equal(metrics.tiny,'30px');
     assert.equal(metrics.visibleHeight,'30px','Secret square remains square');
     assert.equal(metrics.edgeWidth,'0px','No border pixels may reveal the square');
     assert.equal(metrics.edgeStyle,'none','No border style may reveal the square');
     assert.equal(metrics.buttonEdge,'0px','No border on clickable area');
     assert.equal(metrics.shadow,'none','No shadow may reveal the square');
     assert.ok(metrics.clickable,'The box must be the real pointer target: '+mode+' '+theme+' '+width);
     assert.equal(metrics.inert,false,'The box must not be made inert with the Daily');
     assert.equal(metrics.disabled,false);
     await box.hover();
     assert.equal(await box.evaluate(el=>getComputedStyle(el).cursor),'default');
     await box.click({timeout:5000});
     await note.waitFor({state:'visible'});
     assert.equal(await box.getAttribute('aria-expanded'),'true');
     assert.match(await note.innerText(),/the box/);
     assert.equal((await note.innerText()).includes('you found'),false,'No explanation copy');
     const outcomes=new Set();
     // All thirteen shuffled physical gags must be playable without scores or badges.
     for(let n=0;n<13;n++){
      await poke.click();
      const action=await stage.getAttribute('data-effect');
      assert.ok(action&&action!=='idle','A poke always produces a toy reaction');
      outcomes.add(action);
      assert.ok((await page.locator('#criloChaosAccessible').textContent()).length>8,
       'Assistive tech gets a discreet description');
      if(action==='confetti')assert.equal(await stage.locator('.crilo-chaos-confetti').count(),15);
      if(action==='clone'||action==='bonk')assert.equal(await stage.locator('.crilo-chaos-extra.crilo-chaos-cube').count(),1);
      if(action==='duck')assert.equal(await stage.locator('.crilo-chaos-duck').count(),1);
     }
     assert.equal(outcomes.size,13,'Every secret animation appears once per deck');
     const after=await page.evaluate(()=>({
      score:document.getElementById('score').textContent,
      spins:document.getElementById('spins').textContent,
      badges:document.getElementById('newBadgeCount').textContent
     }));
     assert.deepEqual(after,{score:metrics.score,spins:metrics.spins,badges:metrics.badges},
      'Secret may not change any gameplay or badges');
     await page.keyboard.press('Escape');
     assert.equal(await note.isVisible(),false);
     await box.focus();
     await box.press('Enter');
     assert.equal(await note.isVisible(),true,'Keyboard access '+mode+' '+theme);
     await close.click();
     assert.equal(await note.isVisible(),false,'Close button works');
     await box.click();
     await page.locator('body').click({position:{x:10,y:140}});
     assert.equal(await note.isVisible(),false,'Dismiss click away');
    }
   }
   assert.deepEqual(errors,[],'No homepage JS errors at '+width);
   await page.close();
  }
  console.log('HIDDEN_BOX_BROWSER_PASS: complete real homepage, clickable pre/post Daily, 4 viewport widths, light/dark, 13 unique toy actions, unchanged scores/badges');
 }finally{await browser.close()}
})().catch(error=>{console.error('HIDDEN_BOX_BROWSER_FAIL',error);process.exitCode=1});
