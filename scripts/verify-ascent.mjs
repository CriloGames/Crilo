import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch();
await mkdir('test-results/ascent', { recursive: true });
try {
  for (const [name, width, height] of [['phone',390,844],['tablet',768,1024],['desktop',1440,980]]) {
    const page = await browser.newPage({viewport:{width,height}, reducedMotion:name==='desktop'?'no-preference':'reduce'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/ascent/');
    await page.waitForSelector('#start:enabled');
    assert(await page.locator('.crilo-top').isVisible());
    assert.equal(await page.locator('.crilo-top').getAttribute('href'),'/index.html?games=2');
    assert(await page.locator('#dailyReset').isVisible());
    assert.match(await page.locator('#resetClock').innerText(),/^\d{2}:\d{2}:\d{2}$/);
    await page.locator('.route-menu summary').click();
    const home=page.locator('.route-menu .crilo-home');
    assert(await home.isVisible(),'Crilo return link is accessible');
    assert.equal(await home.getAttribute('href'),'/index.html?games=2');
    await page.locator('.route-menu summary').click();
    assert.equal(await page.locator('.hold').count(),0);
    // The initial read uses the live API. Keep scored fixtures out of the daily average.
    const board=['clip','plane','wall','trail','lighthouse','mill'];
    const state={history:[],clues:null,deadline:null};
    await page.route('**/rpc/ascent_pitch', async route => {
      const p=route.request().postDataJSON();
      if(p.p_action==='retry_pitch'){
        assert.equal(p.p_round,5);
        return route.fulfill({json:{links:{clip:'a paper clip',mill:'a paper mill'},points:30,rejected:false}});
      }
      state.day=p.p_day || state.day;
      state.rejected=false;
      if(p.p_action==='start' && !state.deadline){
        state.contexts=p.p_round;state.pitchSeconds=[20,21,22,24,25][p.p_round-1];state.clues=board;state.deadline=new Date(Date.now()+(p.p_round===5?800:15000)).toISOString();
      }
      const expired=state.deadline && Date.parse(state.deadline)<=Date.now();
      if(expired || (p.p_action==='guess' && p.p_guess==='paper trail')){
        const solution=Object.fromEntries(board.map(c=>[c,c+' / paper']));
        state.history.push({guess:expired?'':'paper',clues:board,links:expired?{}:solution,points:expired?0:200,target:'paper',solution,timedOut:!!expired,checkIncomplete:!expired&&state.history.length===0});
        state.clues=null;state.deadline=null;
        if(state.history.length===5)state.results={score:800,players:2,average:600};
      }else if(p.p_action==='guess'){state.rejected=true}
      await route.fulfill({json:{...state,serverTime:new Date().toISOString()}});
    });
    await page.locator('#start').click();
    await page.waitForSelector('#lock:enabled');
    const clues = await page.locator('.hold').allTextContents();
    assert.equal(clues.length,6);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const boxes = await page.locator('.hold').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().toJSON()));
    for(let i=0;i<6;i++) for(let j=i+1;j<6;j++){
      const a=boxes[i],b=boxes[j];
      assert(a.right<=b.left || b.right<=a.left || a.bottom<=b.top || b.bottom<=a.top,'clue overlap');
    }
    const field=await page.locator('#guess').boundingBox();
    const scene=await page.locator('#view').boundingBox();
    assert(field.y+field.height<=height && field.y>=scene.y,'answer fits inside the visible scene');
    assert.equal(scene.x,0,'edge-to-edge mountain');
    assert.equal(Math.round(scene.width),width);
    const colors = await page.locator('canvas').evaluate(c => {
      const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      const palette=new Set();for(let n=0;n<pixels.length;n+=316)palette.add(pixels[n]*65536+pixels[n+1]*256+pixels[n+2]);return palette.size;
    });
    assert(colors>20,'scene painted');
    await page.screenshot({path:'test-results/ascent/'+name+'.png',fullPage:true});
    await page.locator('#guide').click();assert(await page.locator('dialog').isVisible());await page.locator('#close').click();
    for(let i=1;i<=5;i++){
      await page.waitForSelector('#play:visible');
      assert.equal(await page.locator('#clockbar').evaluate(el=>el.max),[20,21,22,24,25][i-1]);
      if(i===1){
        const deadline=state.deadline;
        for(const word of ['light','house','the lights']){
          await page.locator('#guess').fill(word);await page.locator('#lock').click();
          assert.match(await page.locator('#status').innerText(),/already in a clue/);
          assert.equal(await page.locator('#guess').inputValue(),word);
        }
        await page.locator('#guess').fill('zzzz');await page.locator('#lock').click();
        await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Try another word'));
        assert.equal(state.history.length,0);
        assert.equal(await page.locator('#guess').getAttribute('aria-invalid'),'true');
        assert(await page.locator('#guess').evaluate(el=>el.selectionStart===0 && el.selectionEnd===el.value.length));
        assert.equal(state.deadline,deadline);
        await page.reload();await page.waitForSelector('#lock:enabled');assert.equal(state.deadline,deadline);
      }
      if(i<5){await page.locator('#guess').fill('paper trail');await page.locator('#lock').click();
        if(name==='desktop' && i===1){
          await page.waitForFunction(()=>document.querySelector('.expedition').dataset.phase==='animating' && Number(getComputedStyle(document.querySelector('.expedition .card')).opacity)<0.05);
          await page.waitForFunction(()=>document.getElementById('gripWord').textContent.length>0);
          assert(await page.locator('#view').isVisible());
          assert(await page.locator('.expedition .card').evaluate(el=>el.inert));
        }
      }
      await page.waitForSelector('#reveal:visible');assert.equal(await page.locator('#results').isVisible(),false);
      assert.equal(await page.locator('#reveal #holds .hold').count(),6);
      assert.equal(await page.locator('#reveal #holds .hit').count(),i===5?0:6);
      if(i===2){await page.reload();await page.waitForSelector('#reveal:visible')}
      if(i===5)assert.equal(await page.locator('#hitTitle').innerText(),'Time’s up.');
      assert.equal(await page.locator('#reveal details, #reveal #originalRecheck').count(),0,'no mid-climb review controls');
      assert(await page.locator('#reveal #next').isVisible(),'next pitch stays available');
      await page.locator('#next').click();
    }
    await page.waitForSelector('#results:visible');assert.equal(await page.locator('#total').innerText(),'800');
    assert.equal(await page.locator('#completeTitle').innerText(),'Daily complete.');
    assert(await page.locator('#dailyCompleteNote').isVisible());
    assert(await page.locator('#again').isHidden());
    assert.match(await page.locator('#freshClimb').innerText(),/practice climb/i);
    const dailyTicket=await page.evaluate(()=>localStorage.getItem('ascent.climber.v1'));
    await page.reload();await page.waitForSelector('#results:visible');
    assert.equal(await page.evaluate(()=>localStorage.getItem('ascent.climber.v1')),dailyTicket);
    assert.equal(await page.locator('#total').innerText(),'800');
    assert.equal(await page.locator('#answerReview details:not([open])').count(),5);
    assert.equal(await page.locator('#answerReview button').filter({hasText:'Recheck original answer'}).count(),1,'recheck is retained only in final review');
    assert((await page.locator('#answerReview summary').first().innerText()).includes('200 pts'));
    assert.deepEqual(errors,[]);
    // Returning from Ascent must land on the same two-game homepage, not an old wheel-only page.
    await Promise.all([page.waitForURL('**/index.html?games=2'),page.locator('.crilo-top').click()]);
    assert(await page.locator('.topbar .main-ascent-link').isVisible());
    assert(await page.locator('.daily-games-feature .ascent-daily-choice').isVisible());
    assert(await page.locator('.daily-games-feature .wheel-daily-choice').isVisible());
    await page.close();
  }
} finally {await browser.close()}
