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
    let releaseInitialRead,initialReadHeld=false,initialReadDone;
    const initialReadGate=new Promise(resolve=>{releaseInitialRead=resolve});
    const initialReadCompleted=new Promise(resolve=>{initialReadDone=resolve});
    const holdInitialRead=async route=>{
      if(route.request().postDataJSON().p_action!=='read'||initialReadHeld)return route.continue();
      initialReadHeld=true;
      await initialReadGate;
      const response=await route.fetch();
      await route.fulfill({response});
      initialReadDone();
    };
    await page.route('**/rpc/ascent_pitch',holdInitialRead);
    await page.goto('http://127.0.0.1:4173/ascent/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.getElementById('start')&&!document.getElementById('start').disabled);
    assert(await page.locator('#start').isEnabled(),'Begin ascent is enabled while initial read is held');
    releaseInitialRead();
    await initialReadCompleted;
    await page.unroute('**/rpc/ascent_pitch',holdInitialRead);
    await page.waitForSelector('#start:enabled');
    assert(await page.locator('.crilo-top').isVisible());
    assert.equal(await page.locator('.crilo-top').getAttribute('href'),'/index.html?games=3');
    assert(await page.locator('#dailyReset').isVisible());
    assert.match(await page.locator('#resetClock').innerText(),/^\d{2}:\d{2}:\d{2}$/);
    await page.locator('.route-menu summary').click();
    const home=page.locator('.route-menu .crilo-home');
    assert(await home.isVisible(),'Crilo return link is accessible');
    assert.equal(await home.getAttribute('href'),'/index.html?games=3');
    await page.locator('.route-menu summary').click();
    assert.equal(await page.locator('.hold').count(),0);
    // The initial read uses the live API. Keep scored fixtures out of the daily average.
    const board=['clip','plane','wall','trail','lighthouse','mill'];
    await page.route('**/rpc/ascent_top_answers',route=>route.fulfill({json:['sailing','travel','journey','map','boat','paper'].map((word,i)=>{const hits=[5,4,3,2,1,6][i];return {word,hits,points:hits===6?200:10*(hits*(hits+1)/2+Math.max(0,hits-3)),links:Object.fromEntries(board.slice(0,hits).map(c=>[c,'fixture']))}})}));
    const state={history:[],clues:null,deadline:null};
    await page.route('**/rpc/ascent_pitch', async route => {
      const p=route.request().postDataJSON();
      if(p.p_action==='recheck_pitch'){
        const record=state.history[p.p_round-1];
        record.checkIncomplete=false;
        return route.fulfill({json:{record,total:state.results.score,checkIncomplete:false}});
      }
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
      if(i===5){
        // Hard-refresh from the final pitch itself: completed daily must go
        // directly to results, not ask the player to click See my climb again.
        await page.reload({waitUntil:'domcontentloaded'});
        await page.waitForSelector('#results:visible');
        assert(await page.locator('#reveal').isHidden());
      }else await page.locator('#next').click();
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
    assert.equal(await page.locator('#answerReview > .perfect-pitch-review').count(),5);
    assert.equal(await page.locator('#answerReview details').count(),0);
    assert.equal(await page.locator('#answerReview button').filter({hasText:'Recheck original answer'}).count(),0);
    assert.equal(await page.locator('#reviewPitchTabs').count(),0);
    assert.equal(await page.locator('#pitchSummary > .pitch-summary-row').count(),5);
    assert.equal(await page.locator('#pitchSummary .match-meter').count(),5);
    assert.equal(await page.locator('#pitchSummary .match-segment').count(),30);
    assert.deepEqual(await page.locator('#pitchSummary .match-meter').first().locator('.match-segment').allTextContents(),board);
    assert.equal(await page.locator('#pitchSummary .match-segment.matched').count(),24);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert(await page.locator('#pitchSummary .match-segment').evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1)),'all clue words fit their cells');
    assert(await page.locator('#pitchSummary .match-word-label').evaluateAll(nodes=>{
      const words=['dismissal','extinguisher','television','internationalization'];
      return words.every((word,i)=>{
        const label=nodes[i],old=label.textContent,fit=label.style.getPropertyValue('--word-fit');
        label.textContent=word;label.style.setProperty('--word-fit',(100/(.66*word.length))+'cqi');
        const range=document.createRange();range.selectNodeContents(label);
        const rects=[...range.getClientRects()];
        const ok=rects.length===1&&rects[0].width<=label.parentElement.clientWidth+1;
        label.textContent=old;label.style.setProperty('--word-fit',fit);return ok;
      });
    }),'long single words never break across lines');
    assert(await page.locator('#pitchSummary .match-word-label').evaluateAll(nodes=>{
      const label=nodes[0],old=label.textContent,fit=label.style.getPropertyValue('--word-fit');
      label.textContent='extinguisher';label.style.setProperty('--word-fit',(100/(.66*12))+'cqi');
      const readable=parseFloat(getComputedStyle(label).fontSize)>=8;
      label.textContent=old;label.style.setProperty('--word-fit',fit);return readable;
    }),'long clues retain a readable font size');
    assert.equal(await page.locator('#pitchSummary details, #pitchSummary .clue-preview').count(),0);
    await page.waitForFunction(()=>document.querySelectorAll('#answerReview .answer-word-row').length>=5);
    await page.route('**/rpc/ascent_top_answers',route=>route.fulfill({status:503,body:'Unavailable'}));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForSelector('#results:visible');
    assert.equal(await page.locator('#answerReview details').count(),0);
    for(const pitch of await page.locator('#answerReview > .perfect-pitch-review').all()){
      const clueList=pitch.locator('.answer-matched-words');
      assert(await clueList.isVisible());
      assert.deepEqual(await clueList.locator('li').allTextContents(),board.map(w=>w[0].toUpperCase()+w.slice(1)));
      assert.deepEqual(await pitch.locator('.answer-tier-heading').allTextContents(),['6/6 answers']);
      const rows=await pitch.locator('.answer-word-row').all();
      assert(rows.length>=1);
      for(const row of rows){assert(await row.isVisible());assert.equal(await row.locator('span').innerText(),'200 pts')}
      assert.equal(await pitch.locator('.more-answer-words').count(),0);
    }
    assert.equal(await page.locator('#answerReview .connection-row').count(),0);
    assert((await page.locator('#answerReview .perfect-pitch-heading').first().innerText()).includes('200 pts'));
    assert.deepEqual(errors,[]);
    // Returning from Ascent must land on the same two-game homepage, not an old wheel-only page.
    await Promise.all([page.waitForURL('**/index.html?games=3'),page.locator('.crilo-top').click()]);
    const menu=page.locator('.topbar .crilo-game-menu');
    assert(await menu.locator('summary').isVisible());
    assert.equal(await page.locator('.daily-games-feature').count(),0);
    assert(await menu.locator('.crilo-game-options').isHidden());
    await menu.locator('summary').click();
    assert(await menu.getByRole('link',{name:/daily wheel/i}).isVisible());
    const ascentLink=menu.getByRole('link',{name:/ascent/i});
    assert(await ascentLink.isVisible());
    for(const name of ['Daily Wheel','ASCENT']){
      const label=menu.locator('strong').filter({hasText:name});
      assert(await label.isVisible());
      assert.notEqual(await label.evaluate(el=>getComputedStyle(el).webkitTextFillColor),'rgba(0, 0, 0, 0)','game name must not inherit transparent logo text');
    }
    assert.equal(await ascentLink.getAttribute('href'),'/ascent/');
    await page.keyboard.press('Escape');
    assert(await menu.locator('.crilo-game-options').isHidden());
    await page.close();
  }
} finally {await browser.close()}
