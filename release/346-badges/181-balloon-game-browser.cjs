'use strict';
/* Keep It Up! real Chromium smoke tests: independent of Daily/bonus scoring.
 * Deterministic RAF stepping proves the balloon hits the ground, collisions
 * increment only when tapped, pause freezes play and personal best persists. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
const html=fs.readFileSync('keep-it-up.html','utf8');
const home=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('balloon-game.js','utf8');
const css=['style.css','game-topbar.css','balloon-game.css','night-pages.css'].map(p=>fs.readFileSync(p,'utf8')).join('\n');
assert.match(home,/id="balloonHomeGame" href="keep-it-up\.html"/);
assert.match(home,/balloon-game\.css\?v=1/);
assert.match(html,/balloon-game\.css\?v=1/);
assert.match(html,/balloon-game\.js\?v=1/);
assert.match(html,/href="index\.html#more-games"/);
assert.match(html,/id="balloonScore"/);
assert.match(html,/id="balloonBest"/);
assert.match(html,/id="balloonTarget"/);
assert.match(html,/id="balloonPause"/);
assert.match(html,/id="balloonSound"/);
assert.match(html,/id="balloonOverlay"/);
assert.doesNotMatch(js,/\b(?:criloDB|daily_runs|user_badges|player_stats|leaderboard|badge_events|bonus_runs|\.rpc\(|\bfetch\(|XMLHttpRequest)\b/i,
 'The balloon game must not write any regular Crilo scores or badge progress');
const sanitized=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
 .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi,'');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:810},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',err=>errors.push(err.message));
   await page.route('https://crilo.test/keep-it-up.html',route=>route.fulfill({
    status:200,contentType:'text/html',body:sanitized
   }));
   await page.goto('https://crilo.test/keep-it-up.html',{waitUntil:'domcontentloaded'});
   await page.addStyleTag({content:css});
   await page.evaluate(()=>{
    const callbacks=new Map();let seq=0,t=1000;
    window.requestAnimationFrame=fn=>{callbacks.set(++seq,fn);return seq};
    window.cancelAnimationFrame=id=>{callbacks.delete(id)};
    window.__advanceBalloon=(steps,ms=16)=>{
     for(let i=0;i<steps;i++){
      t+=ms;
      const list=[...callbacks.entries()];callbacks.clear();
      for(const [id,fn] of list)fn(t);
     }
    };
   });
   await page.addScriptTag({content:js});
   const stage=page.locator('#balloonStage');
   const balloon=page.locator('#balloonTarget');
   const start=page.locator('#balloonStart');
   const pause=page.locator('#balloonPause');
   const best=page.locator('#balloonBest');
   const score=page.locator('#balloonScore');
   const overlay=page.locator('#balloonOverlay');

   assert.equal(await stage.getAttribute('data-state'),'ready');
   assert.equal(await score.innerText(),'0');
   assert.equal(await best.innerText(),'0');
   assert.equal(await pause.isEnabled(),false);
   const rect=await stage.boundingBox();
   assert.ok(rect&&rect.width>=260&&rect.height>=380);
   const viewportLayout=await page.evaluate(()=>({
    overflow:document.documentElement.scrollWidth>innerWidth+2,
    stageRight:document.getElementById('balloonStage').getBoundingClientRect().right
   }));
   assert.equal(viewportLayout.overflow,false,'No horizontal overflow at '+width);
   assert.ok(viewportLayout.stageRight<=width+2,'Game stage must fit on '+width);

   await start.click();
   assert.equal(await stage.getAttribute('data-state'),'playing');
   assert.equal(await overlay.isVisible(),false);
   assert.equal(await pause.isEnabled(),true);
   await page.evaluate(()=>window.__advanceBalloon(25));
   await balloon.click();
   assert.equal(await score.innerText(),'1','Pointer tap scores one bounce');
   assert.equal(await best.innerText(),'1');
   assert.equal(await page.evaluate(()=>localStorage.getItem('crilo_keep_it_up_best_v1')),'1');
   await page.keyboard.press('Space');
   assert.equal(await score.innerText(),'2','Space scores one bounce');
   await page.keyboard.press('ArrowUp');
   assert.equal(await score.innerText(),'3','Up arrow scores one bounce');
   await page.evaluate(()=>window.__advanceBalloon(12));
   const center=await balloon.boundingBox();
   await balloon.dispatchEvent('pointerdown',{
    pointerId:7,pointerType:'touch',clientX:center.x+center.width/2,
    clientY:center.y+center.height/2,button:0
   });
   assert.equal(await score.innerText(),'4','Touch pointer scores exactly once');
   const sound=page.locator('#balloonSound');
   await sound.click();
   assert.equal(await sound.getAttribute('aria-pressed'),'false');
   await sound.click();
   assert.equal(await sound.getAttribute('aria-pressed'),'true');
   await pause.click();
   assert.equal(await stage.getAttribute('data-state'),'paused');
   assert.equal(await overlay.isVisible(),true);
   const frozen=await stage.getAttribute('data-y');
   await page.evaluate(()=>window.__advanceBalloon(200));
   assert.equal(await stage.getAttribute('data-y'),frozen,'Pausing must freeze physics');
   await start.click();
   assert.equal(await stage.getAttribute('data-state'),'playing','Resume returns to same run');
   assert.equal(await score.innerText(),'4','Pause preserves score');
   await page.locator('#gameInfoBtn').click();
   assert.equal(await stage.getAttribute('data-state'),'paused',
    'Opening How to Play must pause the balloon automatically');
   await start.click();
   await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
   assert.equal(await stage.getAttribute('data-state'),'paused',
    'Leaving or bfcache-navigating must pause rather than strand animation loop');
   await start.click();
   assert.equal(await stage.getAttribute('data-state'),'playing');
   await page.evaluate(()=>window.__advanceBalloon(500));
   assert.equal(await stage.getAttribute('data-state'),'over','Balloon must lose upon floor contact');
   assert.equal(await overlay.isVisible(),true);
   assert.match(await page.locator('#balloonOverlayText').textContent(),/4 bounces/);
   assert.equal(await score.innerText(),'4');
   await start.click();
   assert.equal(await stage.getAttribute('data-state'),'playing');
   assert.equal(await score.innerText(),'0','Restart clears only current run');
   assert.equal(await best.innerText(),'4','Restart retains local best');
   // Force another loss with no taps, and verify no phantom high score.
   await page.evaluate(()=>window.__advanceBalloon(500));
   assert.equal(await stage.getAttribute('data-state'),'over');
   assert.equal(await score.innerText(),'0');
   await page.reload({waitUntil:'domcontentloaded'});
   await page.addStyleTag({content:css});
   await page.addScriptTag({content:js});
   assert.equal(await page.locator('#balloonBest').innerText(),'4','Personal best survives reload');
   assert.equal(await page.locator('#balloonScore').innerText(),'0');
   assert.equal(await page.locator('#balloonStage').getAttribute('data-state'),'ready');

   await page.evaluate(()=>document.documentElement.dataset.theme='dark');
   assert.match(await stage.evaluate(el=>getComputedStyle(el).backgroundImage),/linear-gradient/);
   await page.evaluate(()=>document.documentElement.dataset.theme='light');
   assert.deepEqual(errors,[],'No JS errors at '+width);
   await page.close();
  }
  console.log('BALLOON_BROWSER_PASS: start, mouse/touch/keyboard hits, pause, floor collision, restart, local best, all widths and dark mode');
 }finally{await browser.close()}
})().catch(err=>{console.error('BALLOON_BROWSER_FAIL',err);process.exitCode=1});
