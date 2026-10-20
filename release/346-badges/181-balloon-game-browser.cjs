'use strict';
/* Cargo Bay: actual WebGL Three.js runtime, movement, hit ring, click-only
 * raycast, floor loss, pause, save, responsive desktop/mobile, isolated data. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('keep-it-up.html','utf8');
const home=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('balloon-game.js','utf8');
const css=['style.css','night-pages.css','game-topbar.css','balloon-game.css']
 .map(p=>fs.readFileSync(p,'utf8')).join('\n');
assert.match(html,/id="cargoViewport3d"/);
assert.match(html,/data-move="w"/);
assert.match(html,/data-move="a"/);
assert.match(html,/data-move="s"/);
assert.match(html,/data-move="d"/);
assert.match(html,/id="cargoRangeStatus"/);
assert.match(html,/balloon-game\.js\?v=4/);
assert.match(html,/first-person/i);
assert.match(js,/camera\.position\.set\(player\.x,1\.77,player\.z\)/);
assert.match(html,/balloon-game\.css\?v=3/);
assert.match(home,/href="keep-it-up\.html"/);
assert.match(home,/Keep It Up: Cargo Bay/);
assert.match(js,/RingGeometry\(HIT_RADIUS/);
assert.match(js,/HIT_RADIUS=2\.55/);
assert.match(js,/raycaster\.intersectObject\(hitSphere/);
assert.doesNotMatch(js,/\b(?:criloDB|daily_runs|user_badges|player_stats|badge_events|bonus_runs|leaderboard|\.rpc\(|\bfetch\(|XMLHttpRequest)\b/i,
 'Cargo Bay must not update any Daily, badge, stats or leaderboard data');
assert.doesNotMatch(js,/['"]ArrowUp['"]\.includes|\[' ',\s*'ArrowUp'\]|event\.key===' '\)bop\(/,
 'Keyboard shortcuts must not directly hit the balloon');
const sanitized=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
 .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi,'');
const path=require('node:path');
const three=fs.readFileSync(path.join(path.dirname(require.resolve('three')),'three.module.js'),'utf8');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
 ]});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:820},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://crilo.test/keep-it-up.html',route=>route.fulfill({
    status:200,contentType:'text/html',body:sanitized
   }));
   await page.route('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js',route=>route.fulfill({
    status:200,contentType:'text/javascript',body:three,
    headers:{'access-control-allow-origin':'*'}
   }));
   await page.goto('https://crilo.test/keep-it-up.html',{waitUntil:'domcontentloaded'});
   await page.addStyleTag({content:css});
   await page.evaluate(()=>{
    const callbacks=new Map();let seq=0,t=performance.now();
    window.requestAnimationFrame=fn=>{callbacks.set(++seq,fn);return seq;};
    window.cancelAnimationFrame=id=>callbacks.delete(id);
    window.__advanceCargo=(frames,ms=16)=>{
     for(let i=0;i<frames;i++){
      t+=ms;const pending=[...callbacks.values()];callbacks.clear();
      for(const cb of pending)cb(t);
     }
    };
   });
   await page.addScriptTag({content:js,type:'module'});
   await page.waitForFunction(()=>document.getElementById('balloonStage').dataset.renderer==='webgl',{timeout:20000});
   const stage=page.locator('#balloonStage');
   const start=page.locator('#balloonStart'),pause=page.locator('#balloonPause');
   const score=page.locator('#balloonScore'),best=page.locator('#balloonBest');
   const range=page.locator('#cargoRangeStatus'),overlay=page.locator('#balloonOverlay');
   const state=()=>stage.evaluate(el=>({
    mode:el.dataset.state,px:Number(el.dataset.playerX),pz:Number(el.dataset.playerZ),
    by:Number(el.dataset.y),x:Number(el.dataset.hitX),y:Number(el.dataset.hitY),
    near:el.dataset.inRange,hits:el.dataset.hits
   }));
   const rect=await stage.boundingBox();
   assert.ok(rect&&rect.width>=260&&rect.height>=350,'3D stage fits viewport');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,
    'No horizontal page scroll on '+width);
   assert.equal(await stage.locator('canvas').count(),1,'Real 3D canvas present');
   assert.equal(await score.textContent(),'000');
   assert.equal(await best.textContent(),'000');
   await start.click();
   assert.equal((await state()).mode,'playing');
   assert.equal(await overlay.isVisible(),false);
   await page.evaluate(()=>window.__advanceCargo(8));
   const first=await state();
   assert.equal(await stage.getAttribute('data-view'),'first-person','Camera must be first-person');
   assert.equal(await stage.getAttribute('data-camera-height'),'1.77','Camera must be at eye height');
   const firstYaw=Number(await stage.getAttribute('data-player-yaw'));
   const aim=await stage.boundingBox();
   await page.locator('#cargoViewport3d').dispatchEvent('pointerdown',{
    pointerId:345,pointerType:'mouse',button:2,clientX:aim.x+aim.width*.3,clientY:aim.y+aim.height*.5
   });
   await page.locator('#cargoViewport3d').dispatchEvent('pointermove',{
    pointerId:345,pointerType:'mouse',button:2,clientX:aim.x+aim.width*.4,clientY:aim.y+aim.height*.5
   });
   await page.locator('#cargoViewport3d').dispatchEvent('pointerup',{pointerId:345,pointerType:'mouse'});
   assert.notEqual(Number(await stage.getAttribute('data-player-yaw')),firstYaw,'Dragging should turn the first-person camera');
   // Return to initial forward-facing aim before the hit test.
   await page.locator('#cargoViewport3d').dispatchEvent('pointerdown',{
    pointerId:346,pointerType:'mouse',button:2,clientX:aim.x+aim.width*.4,clientY:aim.y+aim.height*.5
   });
   await page.locator('#cargoViewport3d').dispatchEvent('pointermove',{
    pointerId:346,pointerType:'mouse',button:2,clientX:aim.x+aim.width*.3,clientY:aim.y+aim.height*.5
   });
   await page.locator('#cargoViewport3d').dispatchEvent('pointerup',{pointerId:346,pointerType:'mouse'});

   assert.equal(first.near,'true','Balloon initially inside the worker ground ring');
   assert.equal(await range.textContent(),'BALLOON IN HIT ZONE');
   await page.keyboard.press('Space');
   await page.keyboard.press('ArrowUp');
   assert.equal(await score.textContent(),'000','Space and arrow key must NEVER hit balloon');

   // Holding WASD genuinely changes 3D player coordinates rather than moving a DOM sprite.
   await page.keyboard.down('w');
   await page.evaluate(()=>window.__advanceCargo(18));
   await page.keyboard.up('w');
   const forward=await state();
   assert.ok(forward.pz<first.pz-.7,'W moves worker forward in 3D');
   await page.keyboard.down('a');
   await page.evaluate(()=>window.__advanceCargo(13));
   await page.keyboard.up('a');
   const left=await state();
   assert.ok(left.px<forward.px-.35,'A moves worker left');
   await page.keyboard.down('d');
   await page.evaluate(()=>window.__advanceCargo(13));
   await page.keyboard.up('d');
   assert.ok((await state()).px>left.px+.35,'D moves worker right');

   // The 3D balloon must actually be clicked on-screen; pointer raycasting
   // replaces the previous auto-bounce Space mechanic.
   const target=await state();
   await page.locator('#cargoViewport3d').dispatchEvent('pointerdown',{
    pointerType:'mouse',button:0,clientX:rect.x+target.x,clientY:rect.y+target.y
   });
   assert.equal(await score.textContent(),'001','Click on balloon in ring scores one hit');
   assert.equal(await best.textContent(),'001');
   assert.equal(await page.evaluate(()=>localStorage.getItem('crilo_keep_it_up_best_v1')),'1');

   // Pause must freeze ball physics but not alter score.
   await pause.click();
   assert.equal((await state()).mode,'paused');
   const paused=await state();
   await page.evaluate(()=>window.__advanceCargo(12));
   assert.equal((await state()).by,paused.by);
   await start.click();assert.equal((await state()).mode,'playing');

   // Move sideways until the balloon is out of the visible ring.
   await page.keyboard.down('d');
   await page.evaluate(()=>window.__advanceCargo(66));
   await page.keyboard.up('d');
   let far=await state();
   assert.equal(far.near,'false','Hit zone ring checks 3D horizontal distance');
   assert.equal(await range.textContent(),'OUT OF RANGE · MOVE CLOSER');
   await page.locator('#cargoViewport3d').dispatchEvent('pointerdown',{
    pointerType:'mouse',button:0,clientX:rect.x+far.x,clientY:rect.y+far.y
   });
   assert.equal(await score.textContent(),'001','Click cannot hit balloon outside worker ring');

   await page.evaluate(()=>window.__advanceCargo(90,60));
   assert.equal((await state()).mode,'over','The balloon touching the floor ends the shift');
   assert.equal(await overlay.isVisible(),true);
   await start.click();
   assert.equal((await state()).mode,'playing');
   assert.equal(await score.textContent(),'000','Restart resets score');
   assert.equal(await best.textContent(),'001','Restart preserves personal record');
   await page.evaluate(()=>window.__advanceCargo(90,60));
   assert.equal((await state()).mode,'over');
   await page.reload({waitUntil:'domcontentloaded'});
   await page.addStyleTag({content:css});
   await page.addScriptTag({content:js,type:'module'});
   await page.waitForFunction(()=>document.getElementById('balloonStage').dataset.renderer==='webgl',{timeout:20000});
   assert.equal(await best.textContent(),'001','Personal best persists after reload');
   assert.equal((await state()).mode,'ready');
   assert.deepEqual(errors,[],'No browser JS errors on '+width);
   await page.close();
  }
  console.log('CARGO_BAY_BROWSER_PASS: live WebGL room, WASD worker, reach ring, mouse hit, no Space hit, pause, loss, saved best, mobile and desktop');
 }finally{await browser.close()}
})().catch(err=>{console.error('CARGO_BAY_BROWSER_FAIL',err);process.exitCode=1});
