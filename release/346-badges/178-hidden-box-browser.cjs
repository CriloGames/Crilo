'use strict';
/* All 25 Escape the Box rooms must be independently solvable within their move
 * budgets. Test real browser wins/failures, keyboard, swipe, every layout and
 * verify the secret never changes official or Bonus gameplay statistics. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8');
const hiddenCss=fs.readFileSync('hidden-box.css','utf8');
const css=fs.readFileSync('style.css','utf8')+'\n'+
 fs.readFileSync('bonus-runs.css','utf8')+'\n'+
 fs.readFileSync('daily-drawing-state.css','utf8')+'\n'+hiddenCss;
const js=fs.readFileSync('hidden-box.js','utf8');
assert.match(html,/id="criloHiddenBox" class="crilo-hidden-box"/);
assert.match(html,/id="criloHiddenBoxNote" role="dialog" aria-modal="true"/);
assert.match(html,/id="criloEscapeBudgetFill"/);
assert.match(html,/ROOM 1 \/ 25/);
assert.match(html,/Progress saves on this device/);
assert.match(html,/one-time reward/);
assert.match(html,/hidden-box\.css\?v=8/);
assert.match(html,/hidden-box\.js\?v=8/);
assert.match(html,/Collect 3 stars and reach the exit using the fewest moves possible\./);
assert.match(html,/<small>Stars<\/small>/);
assert.doesNotMatch(html,/3 sparks, then the exit\. Exactly enough moves/);
assert.match(js,/crilo_unlock_golden_box/,'Cosmetic claims must be verified by dedicated RPC');
assert.match(js,/crilo_escape_cosmetics/,'Unlocks are stored separately from gameplay');
assert.doesNotMatch(js,/\b(?:daily_runs|bonus_runs|user_badges|badge_events|leaderboard_scores|player_stats)\b|XMLHttpRequest|fetch\(/i,
 'Secret game cannot alter Crilo scores, badges or leaderboard state');
const entranceStyles=hiddenCss.slice(hiddenCss.indexOf('.crilo-hidden-box{'),hiddenCss.indexOf('/* Escape the Box:'));
assert.doesNotMatch(entranceStyles,/cursor:\s*pointer/i,'Entrance remains camouflaged');
assert.match(entranceStyles,/cursor:default!important/);

const beginning=js.indexOf('const levels=[');
const end=js.indexOf('\n ];',beginning);
assert.ok(beginning>=0&&end>beginning,'Static level data present');
const levelExpression=js.slice(beginning+'const levels='.length,end+3);
const levels=vm.runInNewContext('('+levelExpression+')',Object.create(null));
const parMoves=JSON.parse(js.match(/const parMoves=(\[[0-9,]+\]);/)[1]);
assert.equal(levels.length,25,'There must be exactly 25 rooms');
assert.equal(parMoves.length,25);
const dirs={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
const key={up:'ArrowUp',right:'ArrowRight',down:'ArrowDown',left:'ArrowLeft'};
function shortest(grid){
 const start=[];const stars=[];let exit=null;
 for(let y=0;y<9;y++)for(let x=0;x<9;x++){
  if(grid[y][x]==='S')start.push(x,y);
  if(grid[y][x]==='*')stars.push(x+','+y);
  if(grid[y][x]==='E')exit=[x,y];
 }
 assert.equal(grid.length,9);
 for(const row of grid)assert.equal(row.length,9);
 assert.equal(start.length,2);assert.equal(stars.length,3);assert.ok(exit);
 const flags=new Map(stars.map((s,i)=>[s,1<<i]));
 const q=[[start[0],start[1],0,[]]];
 const seen=new Set([start.join(',')+',0']);
 for(let j=0;j<q.length;j++){
  const [x,y,mask,path]=q[j];
  for(const [name,[dx,dy]] of Object.entries(dirs)){
   let xx=x,yy=y,m=mask;
   while(true){
    const nx=xx+dx,ny=yy+dy;
    if(nx<0||ny<0||ny>=9||nx>=9||grid[ny][nx]==='#')break;
    xx=nx;yy=ny;m|=flags.get(xx+','+yy)||0;
    if(xx===exit[0]&&yy===exit[1]&&m===7)break;
   }
   if(xx===x&&yy===y)continue;
   const route=[...path,name];
   if(xx===exit[0]&&yy===exit[1]&&m===7)return route;
   const state=xx+','+yy+','+m;
   if(!seen.has(state)){seen.add(state);q.push([xx,yy,m,route]);}
  }
 }
 return null;
}
const routes=levels.map((grid,index)=>{
 const route=shortest(grid);
 assert.ok(route,'Room '+(index+1)+' must be solvable');
 assert.equal(route.length,parMoves[index],'Exact minimum moves for room '+(index+1));
 assert.equal(route.length,parMoves[index],'Every room must have exactly its minimum moves');
 if(index>0)assert.ok(parMoves[index]>=parMoves[index-1],'Rooms must grow harder');
 return route;
});
const totalPar=routes.reduce((n,r)=>n+r.length,0);
assert.equal(totalPar,486,'Expected minimum for 25 rooms');
assert.match(js,/moveLimits=parMoves\.slice\(\)/);

const sanitized=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
 .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi,'');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:800},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('https://crilo.test/',route=>route.fulfill({status:200,contentType:'text/html',body:sanitized}));
   await page.goto('https://crilo.test/',{waitUntil:'domcontentloaded'});
   await page.addStyleTag({content:css});
   await page.evaluate(()=>{
    const original=window.setTimeout.bind(window);
    window.setTimeout=(f,ms,...args)=>original(f,Math.min(ms,5),...args);
   });
   await page.addScriptTag({content:js});
   const reloadSecret=async()=>{
    await page.reload({waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:css});
    await page.evaluate(()=>{
     const original=window.setTimeout.bind(window);
     window.setTimeout=(fn,ms,...args)=>original(fn,Math.min(ms,5),...args);
    });
    await page.addScriptTag({content:js});
   };
   const trigger=page.locator('#criloHiddenBox');
   const panel=page.locator('#criloHiddenBoxNote');
   const board=page.locator('#criloEscapeBoard');
   const overlay=page.locator('#criloEscapeOverlay');
   const next=overlay.locator('.crilo-escape-next');
   const state=()=>page.evaluate(()=>({
    score:document.getElementById('score').textContent,
    spins:document.getElementById('spins').textContent,
    badges:document.getElementById('newBadgeCount').textContent,
    bonus:document.getElementById('criloBonusProgress').textContent
   }));
   const initial=await state();
   const bounds=await trigger.boundingBox();
   assert.ok(bounds&&bounds.width===60&&bounds.height===60);

   for(const daily of ['before','finished']){
    await page.evaluate(mode=>{
     const finished=mode==='finished';
     document.documentElement.classList.toggle('crilo-daily-pending',!finished);
     document.getElementById('drawPanel').classList.toggle('daily-finished',finished);
     document.getElementById('drawPanel').inert=finished;
     for(const id of ['playedPanel','result','criloBonusPanel']){
      document.getElementById(id).classList.toggle('hidden',!finished);
     }
    },daily);
    for(const theme of ['light','dark']){
     await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
     await trigger.scrollIntoViewIfNeeded();
     const styles=await trigger.evaluate(el=>{
      const rect=el.getBoundingClientRect();
      return{
       pointed:document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)===el,
       cursor:getComputedStyle(el).cursor,
       border:getComputedStyle(el,'::before').borderTopWidth,
       color:getComputedStyle(el,'::before').backgroundColor,
       background:getComputedStyle(document.body).backgroundColor
      };
     });
     assert.equal(styles.pointed,true,'Entrance clickable '+daily+' '+theme);
     assert.equal(styles.cursor,'default');
     assert.equal(styles.border,'0px');
     assert.equal(styles.color,styles.background);
     await trigger.click();
     await panel.waitFor({state:'visible'});
     assert.equal(await page.locator('#criloGoldenPanel').isVisible(),false,'Gold remains locked before victory');
     await page.locator('#criloEscapeRestart').click();
     assert.equal(await board.getAttribute('data-room'),'1');
     assert.equal(await board.getAttribute('data-move-limit'),'5');
     assert.equal(await board.getAttribute('data-moves-left'),'5');
     const origin=await board.getAttribute('data-position');
     await page.locator('[data-secret-direction="right"]').click();
     await page.waitForTimeout(20);
     assert.notEqual(await board.getAttribute('data-position'),origin);
     assert.equal(await board.getAttribute('data-moves-left'),'4');
     await page.locator('#criloEscapeRestart').click();
     assert.equal(await board.getAttribute('data-moves-left'),'5');
     await page.keyboard.press('ArrowDown');
     await page.waitForTimeout(20);
     assert.notEqual(await board.getAttribute('data-position'),origin);
     await page.locator('#criloEscapeRestart').click();
     await board.dispatchEvent('pointerdown',{pointerId:7,pointerType:'touch',clientX:100,clientY:100,button:0});
     await board.dispatchEvent('pointerup',{pointerId:7,pointerType:'touch',clientX:180,clientY:100,button:0});
     await page.waitForTimeout(20);
     assert.notEqual(await board.getAttribute('data-position'),origin,'Swipe moves the character');
     const savedPosition=await board.getAttribute('data-position');
     const savedLeft=await board.getAttribute('data-moves-left');
     const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('crilo_escape_progress_v2')));
     assert.equal(saved.room,0);
     assert.equal(saved.route.length,1,'Move persisted locally');
     await reloadSecret();
     assert.equal(await panel.isVisible(),false);
     await trigger.click();
     assert.equal(await board.getAttribute('data-position'),savedPosition,
      'Returning to site restores mid-room character position');
     assert.equal(await board.getAttribute('data-moves-left'),savedLeft,
      'Returning does not reset move counter');
     assert.deepEqual(await state(),initial);
     await page.keyboard.press('Escape');
     assert.equal(await panel.isVisible(),false);
    }
   }
   if(width===1280){
    await page.evaluate(()=>document.documentElement.dataset.theme='light');
    await trigger.click();
    await page.locator('#criloEscapeRestart').click();
    // Deliberately waste slides in Room 1. At zero moves, it must lose.
    for(let i=0;i<5;i++){
     await page.keyboard.press(i%2===0?'ArrowRight':'ArrowLeft');
     await page.waitForTimeout(105);
    }
    assert.equal(await board.getAttribute('data-moves-left'),'0');
    assert.match(await overlay.innerText(),/OUT OF MOVES!/);
    await reloadSecret();
    await trigger.click();
    assert.match(await overlay.innerText(),/OUT OF MOVES!/,'Failed room restored on reload');
    assert.equal(await board.getAttribute('data-moves-left'),'0');
    assert.equal(await page.locator('#criloGoldenPanel').isVisible(),false,'Losing never awards Gold');
    assert.match(await next.innerText(),/Retry room/);
    const failedPosition=await board.getAttribute('data-position');
    await page.keyboard.press('ArrowUp');
    assert.equal(await board.getAttribute('data-position'),failedPosition,
      'No movement allowed after losing');
    await next.click();
    assert.equal(await board.getAttribute('data-room'),'1');
    assert.equal(await board.getAttribute('data-moves-left'),'5');
    assert.equal(await board.getAttribute('data-slides'),'0');
    assert.deepEqual(await state(),initial,'Failure does not affect Daily state');
    // Finish all 25 levels using independently computed optimal routes.
    for(let room=0;room<25;room++){
     assert.equal(await board.getAttribute('data-room'),String(room+1));
     for(const dir of routes[room]){
      await page.keyboard.press(key[dir]);
      await page.waitForTimeout(105);
     }
     assert.equal(await board.getAttribute('data-sparks'),'3','Three sparks on room '+(room+1));
     await next.waitFor({state:'visible'});
     const text=await overlay.innerText();
     assert.match(text,room===24?/GOLDEN BOX UNLOCKED!/:/ROOM CLEAR!/,'Room '+(room+1));
     if(room<24)await next.click();
    }
    assert.equal(await board.getAttribute('data-slides'),String(totalPar),'No wasted slides on shortest routes');
    assert.match(await overlay.innerText(),/25 rooms/);
    assert.equal(await page.locator('.crilo-golden-prize').count(),1);
    assert.equal(await page.locator('#criloGoldenPanel').isVisible(),true);
    assert.equal(await board.evaluate(el=>el.classList.contains('is-golden')),true);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('crilo_escape_golden_guest_proof_v1')));
    assert.equal(saved.length,25,'Golden Box proof persists for guests');
    assert.deepEqual(await state(),initial,'Winning cannot affect Daily points or badges');
    await next.click();
    assert.equal(await board.getAttribute('data-room'),'1');
    assert.equal(await board.getAttribute('data-slides'),'0');
    assert.equal(await board.getAttribute('data-moves-left'),'5');
    assert.equal(await board.evaluate(el=>el.classList.contains('is-golden')),true,
      'Golden Box stays equipped when replaying');
    const toggle=page.locator('#criloGoldenToggle');
    await toggle.click();
    assert.equal(await board.evaluate(el=>el.classList.contains('is-golden')),false,
      'Gold owner can switch back to original white cosmetic');
    await toggle.click();
    assert.equal(await board.evaluate(el=>el.classList.contains('is-golden')),true);
    await page.locator('#criloEscapeClose').click();
    assert.equal(await panel.isVisible(),false);
    // Refresh must preserve the earned Gold Box and equipped appearance.
    await page.reload({waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:css});
    await page.addScriptTag({content:js});
    await page.locator('#criloHiddenBox').click();
    assert.equal(await page.locator('#criloGoldenPanel').isVisible(),true);
    assert.equal(await page.locator('#criloEscapeBoard').evaluate(el=>el.classList.contains('is-golden')),true);
    assert.equal(await page.locator('#criloEscapeBoard').getAttribute('data-room'),'1');
    // Restore a completed first 24 rooms during a replay, then complete Room 25:
    // replay is always playable, but never awards another Golden Box.
    const replaySnapshot={v:2,room:24,
     cleared:routes.slice(0,24).map(path=>path.map(dir=>({up:'U',right:'R',down:'D',left:'L'})[dir]).join('')),
     route:''};
    await page.evaluate(snapshot=>localStorage.setItem('crilo_escape_progress_v2',JSON.stringify(snapshot)),replaySnapshot);
    await reloadSecret();
    await trigger.click();
    assert.equal(await board.getAttribute('data-room'),'25','Later rooms survive leaving and returning');
    for(const dir of routes[24]){
     await page.keyboard.press(key[dir]);
     await page.waitForTimeout(105);
    }
    await next.waitFor({state:'visible'});
    assert.match(await overlay.innerText(),/YOU ESCAPED AGAIN!/);
    assert.match(await overlay.innerText(),/no more rewards/);
    assert.equal(await overlay.locator('.crilo-golden-prize').count(),0,'Second win has no second prize');
    assert.match(await next.innerText(),/Play again · Room 1/);
    await next.click();
    assert.equal(await board.getAttribute('data-room'),'1');
    assert.equal(await board.getAttribute('data-slides'),'0');
    assert.equal(await board.getAttribute('data-moves-left'),'5');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('crilo_escape_progress_v2')).room),0,
     'Restarting after a replay saves the new Room 1 run');
    assert.deepEqual(await state(),initial,'Replays cannot affect Daily or badges');
   }
   assert.deepEqual(errors,[],'No JavaScript errors at '+width);
   await page.close();
  }
  // Fresh browser context has no guest proof. An authenticated account with
  // a server-owned award must still show Golden Box on another device.
  const cloud=await browser.newPage({viewport:{width:390,height:780},reducedMotion:'reduce'});
  const cloudErrors=[];cloud.on('pageerror',e=>cloudErrors.push(e.message));
  await cloud.route('https://crilo.test/',route=>route.fulfill({status:200,contentType:'text/html',body:sanitized}));
  await cloud.goto('https://crilo.test/',{waitUntil:'domcontentloaded'});
  await cloud.addStyleTag({content:css});
  await cloud.evaluate(()=>{
   window.criloDB={
    auth:{getUser:async()=>({data:{user:{id:'account-with-gold'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    from:(table)=>{
     if(table!=='crilo_escape_cosmetics')throw Error('Unexpected table read: '+table);
     return {select:()=>({eq:()=>({maybeSingle:async()=>({data:{golden_unlocked_at:'2026-10-18T00:00:00Z'},error:null})})})};
    },
    rpc:()=>{throw Error('Already unlocked account should not submit proof');}
   };
  });
  await cloud.addScriptTag({content:js});
  await cloud.locator('#criloHiddenBox').click();
  await cloud.waitForFunction(()=>document.querySelector('#criloEscapeBoard')?.classList.contains('is-golden'));
  assert.equal(await cloud.locator('#criloGoldenPanel').isVisible(),true);
  assert.equal(await cloud.evaluate(()=>localStorage.getItem('crilo_escape_golden_guest_proof_v1')),null,
   'A cloud-owned cosmetic does not require guest local proof');
  assert.deepEqual(cloudErrors,[]);
  await cloud.close();
  console.log('GOLDEN_BOX_CLOUD_PASS: authenticated owner restores Golden Box on a fresh device');
  console.log('ESCAPE_BOX_25_PASS: 25 verified shortest paths, exact par limits, saved unfinished rooms, loss/retry, one-time reward, replay, 486-slide win, mobile, desktop, input parity, isolation');
 }finally{await browser.close()}
})().catch(err=>{console.error('ESCAPE_BOX_25_FAIL',err);process.exitCode=1});
