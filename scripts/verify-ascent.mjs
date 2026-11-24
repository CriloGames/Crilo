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
    assert.equal(await page.locator('.hold').count(),0);
    // The initial read uses the live API. Keep scored fixtures out of the daily average.
    const board=['clip','plane','wall','trail','news','mill'];
    const state={history:[],clues:null,deadline:null};
    await page.route('**/rpc/ascent_pitch', async route => {
      const p=route.request().postDataJSON();
      state.day=p.p_day || state.day;
      state.rejected=false;
      if(p.p_action==='start' && !state.deadline){
        state.clues=board;state.deadline=new Date(Date.now()+(p.p_round===5?800:15000)).toISOString();
      }
      const expired=state.deadline && Date.parse(state.deadline)<=Date.now();
      if(expired || (p.p_action==='guess' && p.p_guess==='paper')){
        const solution=Object.fromEntries(board.map(c=>[c,c+' / paper']));
        state.history.push({guess:expired?'':'paper',clues:board,links:expired?{}:solution,points:expired?0:200,target:'paper',solution,timedOut:!!expired});
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
      if(i===1){
        const deadline=state.deadline;
        await page.locator('#guess').fill('zzzz');await page.locator('#lock').click();
        await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Try another word'));
        assert.equal(state.history.length,0);
        await page.reload();await page.waitForSelector('#lock:enabled');assert.equal(state.deadline,deadline);
      }
      if(i<5){await page.locator('#guess').fill('paper');await page.locator('#lock').click();
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
      await page.locator('#next').click();
    }
    await page.waitForSelector('#results:visible');assert.equal(await page.locator('#total').innerText(),'800');
    assert.equal(await page.locator('#answerReview details:not([open])').count(),5);
    assert((await page.locator('#answerReview summary').first().innerText()).includes('200 pts'));
    assert.deepEqual(errors,[]);await page.close();
  }
} finally {await browser.close()}
