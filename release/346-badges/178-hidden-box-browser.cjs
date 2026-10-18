'use strict';
/* Hidden homepage box: test real markup/CSS/JS at phone, tablet and desktop widths.
   This QA is completely isolated: no credentials, user writes or backend calls. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('style.css','utf8')+'\n'+fs.readFileSync('hidden-box.css','utf8');
const js=fs.readFileSync('hidden-box.js','utf8');
assert.match(html,/id="criloHiddenBox" class="crilo-hidden-box"/);
assert.match(html,/id="criloHiddenBoxNote" role="status" hidden/);
assert.match(html,/hidden-box\.css\?v=1/);
assert.match(html,/hidden-box\.js\?v=1/);
assert.doesNotMatch(js,/criloDB|supabase|user_badges|localStorage\./i,
 'The undecided Easter egg must never affect gameplay, rewards or storage');
assert.doesNotMatch(css,/cursor:\s*pointer/i,
 'The hidden clickable area must never advertise itself with the pointer cursor');
const markup=html.slice(html.indexOf('<!-- Tiny background-matched Easter egg.'),
 html.indexOf('</section>\n<section id="more-games"'));
assert.match(markup,/criloHiddenBox/);
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:850},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<!doctype html><html lang="en" data-theme="light">'+
    '<head><meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
    '<body><main><section class="hero" style="min-height:420px">'+markup+
    '</section></main></body></html>');
   await page.addStyleTag({content:css});
   await page.addScriptTag({content:js});
   const box=page.locator('#criloHiddenBox'),note=page.locator('#criloHiddenBoxNote');
   assert.equal(await box.count(),1);
   assert.equal(await note.isVisible(),false);
   assert.equal(await box.getAttribute('aria-expanded'),'false');
   const bounds=await box.boundingBox();
   assert.ok(bounds&&bounds.width===30&&bounds.height===30,
    'Unobtrusive 30px click target '+width);
   assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width,'Box remains on screen '+width);
   for(const theme of ['light','dark']){
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    const colors=await box.evaluate(el=>({
     body:getComputedStyle(document.body).backgroundColor,
     box:getComputedStyle(el,'::before').backgroundColor,
     cursor:getComputedStyle(el).cursor,
     tiny:getComputedStyle(el,'::before').width
    }));
    assert.equal(colors.box,colors.body,'Box must blend with the '+theme+' background');
    assert.equal(colors.cursor,'default');
    assert.equal(colors.tiny,'15px');
    await box.hover();
    assert.equal(await box.evaluate(el=>getComputedStyle(el).cursor),'default',
     'Hover must not show pointer or change cursor');
   }
   await box.click();
   await note.waitFor({state:'visible'});
   assert.equal(await box.getAttribute('aria-expanded'),'true');
   assert.match(await note.innerText(),/nothing inside this box/);
   await page.locator('body').click({position:{x:12,y:12}});
   assert.equal(await note.isVisible(),false,'Click away dismisses placeholder');
   await box.focus();
   await box.press('Enter');
   assert.equal(await note.isVisible(),true,'Keyboard activation works');
   await page.keyboard.press('Escape');
   assert.equal(await note.isVisible(),false,'Escape dismisses placeholder');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-
    document.documentElement.clientWidth)<=3,true,'No horizontal overflow '+width);
   assert.deepEqual(errors,[],'No browser errors '+width);
   await page.close();
  }
  console.log('HIDDEN_BOX_BROWSER_PASS: white/background-matched, normal cursor, click and keyboard, four viewports, both themes');
 } finally{await browser.close()}
})().catch(error=>{console.error('HIDDEN_BOX_BROWSER_FAIL',error);process.exitCode=1});
