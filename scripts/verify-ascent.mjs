import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch();
await mkdir('test-results/ascent', { recursive: true });
try {
  for (const [name, width, height] of [['phone',390,844],['tablet',768,1024],['desktop',1440,980]]) {
    const page = await browser.newPage({viewport:{width,height}, reducedMotion:'reduce'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/ascent/');
    await page.waitForSelector('#lock:enabled');
    const clues = await page.locator('.hold').allTextContents();
    assert.equal(clues.length,6);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const boxes = await page.locator('.hold').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().toJSON()));
    for(let i=0;i<6;i++) for(let j=i+1;j<6;j++){
      const a=boxes[i],b=boxes[j];
      assert(a.right<=b.left || b.right<=a.left || a.bottom<=b.top || b.bottom<=a.top,'clue overlap');
    }
    const colors = await page.locator('canvas').evaluate(c => {
      const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      const palette=new Set();for(let n=0;n<pixels.length;n+=316)palette.add(pixels[n]*65536+pixels[n+1]*256+pixels[n+2]);return palette.size;
    });
    assert(colors>20,'scene painted');
    await page.screenshot({path:'test-results/ascent/'+name+'.png',fullPage:true});
    await page.locator('#guide').click();assert(await page.locator('dialog').isVisible());await page.locator('#close').click();
    // Keep practice runs out of the live daily average. Initial load above uses the real API.
    const board=['clip','plane','wall','trail','news','mill'];
    const state={history:[],clues:board};
    await page.route('**/rpc/ascent_daily', async route => {
      const p=route.request().postDataJSON();
      state.day=p.p_day || state.day;
      if(p.p_guess && p.p_round===state.history.length+1) {
        const links=Object.fromEntries(board.map(c=>[c,c+' / paper']));
        state.history.push({guess:'paper',clues:board,links,points:200,target:'paper',solution:links});
        if(state.history.length===5)state.results={score:1000,players:2,average:600};
      }
      await route.fulfill({json:state});
    });
    for(let i=1;i<=5;i++){
      // First real board may itself show PAPER as a clue.
      await page.locator('#guess').fill(i===1?'fixture':'paper');await page.locator('#lock').click();
      await page.waitForSelector('#reveal:visible');assert.equal(await page.locator('#results').isVisible(),false);
      if(i===2){await page.reload();await page.waitForSelector('#reveal:visible')}
      await page.locator('#next').click();
    }
    await page.waitForSelector('#results:visible');assert.equal(await page.locator('#total').innerText(),'1,000');
    assert.deepEqual(errors,[]);await page.close();
  }
} finally {await browser.close()}
