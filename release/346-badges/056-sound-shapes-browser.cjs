/* Real-browser Crilo Shape of Sound regression: desktop Chromium and mobile WebKit.
   Checks real layout, gestures, Web Audio, merging, undo, persistence, and checkout.
   No payment is made; tests always use a local server and synthetic events. */
'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const pathname=(req.url||'/').split('?')[0];
 const normalized=path.normalize(decodeURIComponent(pathname));
 const resolved=path.resolve(root,'.'+normalized);
 if(!resolved.startsWith(root+path.sep)||!fs.existsSync(resolved)||!fs.statSync(resolved).isFile()){
  res.writeHead(404);res.end('Not found');return;
 }
 res.writeHead(200,{'content-type':mime[path.extname(resolved)]||'text/plain; charset=utf-8'});
 fs.createReadStream(resolved).pipe(res);
});
function check(cond,msg){assert.ok(cond,msg)}
async function main(){
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',e=>e?reject(e):resolve()));
 const port=server.address().port,url='http://127.0.0.1:'+port+'/shape-of-sound.html';
 let runs=0;
 for(const scenario of [
  {name:'desktop-wide',engine:chromium,width:1440,height:900,touch:false},
  {name:'desktop-small',engine:chromium,width:1024,height:768,touch:false},
  {name:'laptop-narrow',engine:chromium,width:800,height:700,touch:false},
  {name:'iphone-se',engine:webkit,width:375,height:667,touch:true},
  {name:'iphone-portrait',engine:webkit,width:390,height:844,touch:true},
  {name:'iphone-large',engine:webkit,width:430,height:932,touch:true},
  {name:'iphone-landscape',engine:webkit,width:844,height:390,touch:true},
  {name:'ipad-portrait',engine:webkit,width:820,height:1180,touch:true},
  {name:'ipad-landscape',engine:webkit,width:1180,height:820,touch:true},
  {name:'android-portrait',engine:chromium,width:412,height:915,touch:true}
 ]){
  const browser=await scenario.engine.launch({headless:true,args:scenario.engine===chromium?['--no-sandbox','--autoplay-policy=no-user-gesture-required']:[]});
  const context=await browser.newContext({
   viewport:{width:scenario.width,height:scenario.height},deviceScaleFactor:1,
   isMobile:scenario.touch,hasTouch:scenario.touch
  });
  await context.addInitScript(()=>{
   window.__criloAudioVoices=0;
   const Ctor=window.AudioContext||window.webkitAudioContext;
   if(Ctor&&Ctor.prototype){
    const method=Ctor.prototype.createOscillator;
    Ctor.prototype.createOscillator=function(){
     const osc=method.apply(this,arguments),start=osc.start;
     osc.start=function(){window.__criloAudioVoices++;return start.apply(this,arguments)};
     return osc;
    };
   }
  });
  const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(7000);
  console.log('START '+scenario.name+' '+scenario.width+'x'+scenario.height);
  page.on('pageerror',e=>{if(/sound-shapes|sound|null|undefined|ReferenceError|SyntaxError/.test(e.message))errors.push(e.message)});
  // Keep the sound sandbox independent from Crilo auth and third-party CDNs.
  await page.route(/\/(?:app|supabase-config)\.js(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('.sound-blob').first().waitFor({state:'visible'});
  check(await page.locator('#shape-of-sound').isVisible(),scenario.name+' standalone sound game missing');
  check(await page.locator('#supportPayLink').count()===0,scenario.name+' sound game unexpectedly contains checkout');
  const layout=await page.evaluate(()=>{
   const stage=document.getElementById('soundStage').getBoundingClientRect();
   const blobs=[...document.querySelectorAll('.sound-blob')].map(el=>el.getBoundingClientRect());
   return {vw:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,
    stage:stage.toJSON(),blobs:blobs.map(r=>r.toJSON()),
    soundShown:getComputedStyle(document.getElementById('soundStage')).display,
    header:document.querySelector('.sound-heading h1').getBoundingClientRect().toJSON()};
  });
  check(layout.scrollWidth<=layout.vw+2,scenario.name+' horizontal overflow '+JSON.stringify(layout));
  check(layout.stage.width>Math.min(290,scenario.width*.7),scenario.name+' stage too narrow');
  check(layout.blobs.length===5,scenario.name+' expected five playable blobs');
  for(const r of layout.blobs){
   check(r.left>=layout.stage.left-2&&r.right<=layout.stage.right+2,
    scenario.name+' blob clipped horizontally at startup '+JSON.stringify({blob:r,stage:layout.stage}));
   check(r.top>=layout.stage.top-2&&r.bottom<=layout.stage.bottom+2,
    scenario.name+' blob clipped vertically at startup');
  }
  const controls=await page.evaluate(()=>{
    const r=document.querySelector('.sound-toolbar').getBoundingClientRect();
    return {toolbar:r.toJSON(),
      controls:[...document.querySelectorAll('.sound-toolbar .sound-button')].map(el=>el.getBoundingClientRect().toJSON())};
  });
  for(const control of controls.controls)check(
    control.left>=controls.toolbar.left-2&&control.right<=controls.toolbar.right+2,
    scenario.name+' toolbar button was clipped '+JSON.stringify(controls));
  check(await page.locator('#accountBtn').count()===0,
    scenario.name+' standalone sound game should not require a sign-in button');
  const organization=await page.evaluate(()=>{
    const toolbar=document.querySelector('.sound-toolbar').getBoundingClientRect();
    const left=document.querySelector('.sound-toolbar-left').getBoundingClientRect();
    const right=document.querySelector('.sound-toolbar-right').getBoundingClientRect();
    const label=document.querySelector('.sound-palette-title').getBoundingClientRect();
    const options=document.querySelector('.sound-palette-options').getBoundingClientRect();
    const buttons=[...document.querySelectorAll('.sound-palette-button')].map(n=>n.getBoundingClientRect().toJSON());
    return {toolbar:toolbar.toJSON(),left:left.toJSON(),right:right.toJSON(),label:label.toJSON(),options:options.toJSON(),buttons};
  });
  check(organization.buttons.length===5,scenario.name+' needs five named sound choices');
  check(organization.label.top>=organization.toolbar.bottom-3,
    scenario.name+' sound label overlaps the toolbar');
  check(organization.options.top>=organization.label.bottom-3,
    scenario.name+' add buttons should appear below their label');
  for(const b of organization.buttons)check(
    b.left>=organization.options.left-2&&b.right<=organization.options.right+2,
    scenario.name+' sound button exceeds its palette');
  if(scenario.width>=360){
    check(Math.abs(organization.left.top-organization.right.top)<4,
      scenario.name+' Play and utility controls should share the first row');
    check(Math.max(...organization.buttons.map(b=>b.top))-
      Math.min(...organization.buttons.map(b=>b.top))<3,
      scenario.name+' five sound choices should occupy a single row');
  }
  if(scenario.name==='iphone-portrait'||scenario.name==='desktop-wide'){
   const jpg=await page.screenshot({type:'jpeg',quality:50,fullPage:false});
   console.log('VISUAL_SCREENSHOT_B64 '+scenario.name+' '+jpg.toString('base64'));
  }
  const before=await page.evaluate(()=>window.__criloAudioVoices);
  if(scenario.touch)await page.locator('.sound-blob').first().tap();
  else await page.locator('.sound-blob').first().click();
  await page.waitForTimeout(100);
  const after=await page.evaluate(()=>window.__criloAudioVoices);
  check(after>before,scenario.name+' tap should play Web Audio, voices '+before+' -> '+after);
  check(await page.locator('#soundInspector').isVisible(),scenario.name+' inspector must open');
  const slider=page.locator('#soundStretch');
  await slider.evaluate(input=>{input.value='140';input.dispatchEvent(new Event('input',{bubbles:true}))});
  check((await page.locator('.sound-blob').first().boundingBox()).width>layout.blobs[0].width,scenario.name+' stretch should change width');
  const persisted=await page.evaluate(()=>localStorage.getItem('crilo_sound_shapes_v1'));
  check(!!persisted&&persisted.includes('1.4'),scenario.name+' scaled shape persisted');
  // Test real mouse drag and corresponding pointer behavior, including mobile touch pointer type.
  const boxes=await Promise.all([0,1].map(i=>page.locator('.sound-blob').nth(i).boundingBox()));
  const center=b=>({x:b.x+b.width/2,y:b.y+b.height/2});
  const start=center(boxes[0]),end=center(boxes[1]);
  if(scenario.touch){
   await page.evaluate(({start,end})=>{
    const source=document.querySelectorAll('.sound-blob')[0];
    source.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'touch',pointerId:11,isPrimary:true,clientX:start.x,clientY:start.y}));
    for(let i=1;i<=14;i++){
     const f=i/14;
     window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerType:'touch',pointerId:11,isPrimary:true,clientX:start.x+(end.x-start.x)*f,clientY:start.y+(end.y-start.y)*f}));
    }
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerType:'touch',pointerId:11,isPrimary:true,clientX:end.x,clientY:end.y}));
   },{start,end});
  }else{
   await page.mouse.move(start.x,start.y);await page.mouse.down();
   await page.mouse.move(end.x,end.y,{steps:18});await page.mouse.up();
  }
  check(await page.locator('.sound-blob').count()===4,scenario.name+' drop-to-merge failed');
  check(await page.locator('#soundSeparate').isEnabled(),scenario.name+' merged blob cannot split');
  await page.locator('#soundSeparate').click();
  check(await page.locator('.sound-blob').count()===5,scenario.name+' split failed');
  await page.locator('#soundAddBoop').click();
  check(await page.locator('.sound-blob').count()===6,scenario.name+' add failed');
  await page.locator('#soundPlayRoom').click();
  check((await page.locator('#soundPlayRoom').innerText()).includes('Stop'),scenario.name+' room playback failed');
  await page.waitForTimeout(250);
  await page.locator('#soundPlayRoom').click();
  await page.locator('#soundMute').click();
  check((await page.locator('#soundMute').innerText()).includes('off'),scenario.name+' mute toggle failed');
  await page.reload({waitUntil:'domcontentloaded'});
  check(await page.locator('.sound-blob').count()===6,scenario.name+' local restore failed');
  await page.locator('#soundReset').click();
  check(await page.locator('.sound-blob').count()===5,scenario.name+' reset failed');
  // Stretch to maximum and drag far beyond the stage with two pointer IDs.
  await page.locator('.sound-blob').first().click();
  await page.locator('#soundStretch').evaluate(input=>{
    input.value='180';input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.evaluate(()=>{
    const shape=document.querySelector('.sound-blob');
    const box=shape.getBoundingClientRect();
    const x=box.x+box.width/2,y=box.y+box.height/2;
    shape.dispatchEvent(new PointerEvent('pointerdown',{
      bubbles:true,cancelable:true,pointerId:41,pointerType:'touch',clientX:x,clientY:y}));
    // Unrelated touches cannot move or release the selected sound.
    window.dispatchEvent(new PointerEvent('pointermove',{
      bubbles:true,pointerId:42,pointerType:'touch',clientX:-800,clientY:-800}));
    window.dispatchEvent(new PointerEvent('pointerup',{
      bubbles:true,pointerId:42,pointerType:'touch'}));
    window.dispatchEvent(new PointerEvent('pointermove',{
      bubbles:true,pointerId:41,pointerType:'touch',clientX:-800,clientY:-800}));
    window.dispatchEvent(new PointerEvent('pointerup',{
      bubbles:true,pointerId:41,pointerType:'touch'}));
  });
  const edge=await page.evaluate(()=>({
    stage:document.getElementById('soundStage').getBoundingClientRect().toJSON(),
    blob:document.querySelector('.sound-blob').getBoundingClientRect().toJSON(),
    scale:window.visualViewport?.scale||1
  }));
  check(edge.blob.left>=edge.stage.left-2&&edge.blob.right<=edge.stage.right+2,
    scenario.name+' stretched sound clipped horizontally '+JSON.stringify(edge));
  check(edge.blob.top>=edge.stage.top-2&&edge.blob.bottom<=edge.stage.bottom+2,
    scenario.name+' stretched sound clipped vertically');
  check(Math.abs(edge.scale-1)<.02,scenario.name+' unexpected viewport zoom '+edge.scale);
  await page.locator('#soundReset').click();
  const palette=await page.locator('.sound-palette-button').count();
  check(palette===5,scenario.name+' sound palette did not show all five choices');
  for(let i=0;i<20;i++){
    await page.locator('#soundAdd'+['Boop','Hum','Pluck','Chime','Buzz'][i%5]).click();
  }
  check(await page.locator('.sound-blob').count()===25,scenario.name+' 25-sound capacity failed');
  if(scenario.name==='iphone-portrait'||scenario.name==='desktop-wide'){
    const screenshot=await page.locator('#soundStage').screenshot({type:'jpeg',quality:56});
    console.log('FULL_SOUND_ROOM_B64 '+scenario.name+' '+screenshot.toString('base64'));
  }
  check((await page.locator('#soundCounter').innerText()).includes('25 / 25'),scenario.name+' counter is wrong');
  for(const kind of ['Boop','Hum','Pluck','Chime','Buzz'])
    check(await page.locator('#soundAdd'+kind).isDisabled(),scenario.name+' '+kind+' did not disable at capacity');
  const filled=await page.evaluate(()=>{
    const box=document.getElementById('soundStage').getBoundingClientRect();
    return {stage:box.toJSON(),vw:innerWidth,sw:document.documentElement.scrollWidth,
      sounds:[...document.querySelectorAll('.sound-blob')].map(el=>el.getBoundingClientRect().toJSON())};
  });
  check(filled.sw<=filled.vw+2,scenario.name+' horizontal overflow at 25 sounds');
  for(const sound of filled.sounds)
    check(sound.left>=filled.stage.left-2&&sound.right<=filled.stage.right+2&&
      sound.top>=filled.stage.top-2&&sound.bottom<=filled.stage.bottom+2,
      scenario.name+' a sound clipped '+JSON.stringify({stage:filled.stage,sound}));
  await page.reload({waitUntil:'domcontentloaded'});
  check(await page.locator('.sound-blob').count()===25,scenario.name+' 25 sounds did not persist');
  await page.locator('#soundReset').click();
  check(await page.locator('.sound-blob').count()===5,scenario.name+' reset after 25 failed');
  check(await page.locator('#soundAddBoop').isEnabled(),scenario.name+' palette was not re-enabled');
  // Dedicated support page: a pastel shape collage with one voluntary checkout.
  const tipPage=await context.newPage();
  tipPage.setDefaultTimeout(7000);
  const tipErrors=[];
  tipPage.on('pageerror',e=>tipErrors.push(e.message));
  await tipPage.goto(url.replace('shape-of-sound.html','support.html'),{waitUntil:'load'});
  check(await tipPage.locator('#supportPayLink').isVisible(),scenario.name+' optional PayPal checkout not immediately visible');
  check(await tipPage.locator('#nightShift').count()===0&&await tipPage.locator('#soundStage').count()===0,
    scenario.name+' old games still on donation page');
  check(await tipPage.locator('#accountBtn').count()===0,scenario.name+' account sign-in still on donation page');
  // Site-matched decoration: actual 12-section Crilo wheel miniatures and recognizable game shapes.
  check(await tipPage.locator('.toy-shape, .shape-toolbar, #stackProgress, [data-add-shape]').count()===0,
    scenario.name+' old block-stacking game reappeared');
  check(await tipPage.locator('.support-back').getAttribute('href')==='index.html#more-games',
    scenario.name+' back link to homepage missing');
  const art=await tipPage.evaluate(()=>{
    const field=document.getElementById('printField');
    const card=document.querySelector('.tip-card');
    const back=document.querySelector('.support-back');
    const template=document.getElementById('criloMiniWheel');
    const wheels=[...field.querySelectorAll('.crilo-mini-wheel')];
    const sizes=wheels.map(el=>el.getBoundingClientRect().width);
    const cr=card.getBoundingClientRect(),br=back.getBoundingClientRect();
    return {
      hidden:field.getAttribute('aria-hidden'),
      wheelCount:wheels.length,
      wedgeCount:template?.querySelectorAll('.wheel-disc > path[fill]').length||0,
      reuse:wheels.filter(el=>el.querySelector('use')?.getAttribute('href')==='#criloMiniWheel').length,
      sizes,
      ducks:field.querySelectorAll('.crilo-duck').length,
      pills:field.querySelectorAll('.crilo-pill').length,
      dots:field.querySelectorAll('.crilo-blob').length,
      badges:field.querySelectorAll('.crilo-badge').length,
      rewards:[...field.querySelectorAll('.crilo-badge span')].map(el=>el.textContent),
      artZ:Number(getComputedStyle(field).zIndex),
      cardZ:Number(getComputedStyle(card).zIndex),
      paper:getComputedStyle(card).backgroundColor,
      radius:getComputedStyle(card).borderRadius,
      card:cr.toJSON(),back:br.toJSON(),
      payVisible:document.getElementById('supportPayLink').getBoundingClientRect().width>120,
    };
  });
  check(art.hidden==='true'&&art.wheelCount===8&&art.wedgeCount===12&&art.reuse===8,
    scenario.name+' mini official wheel artwork missing '+JSON.stringify(art));
  check(art.sizes.every(n=>n>=35&&n<=110)&&Math.max(...art.sizes)-Math.min(...art.sizes)>=15,
    scenario.name+' wheel accents became too large or uniformly sized '+JSON.stringify(art));
  check(art.ducks===3&&art.pills>=6&&art.dots>=5&&art.badges===3&&
    ['×2','+2','UP!'].every(x=>art.rewards.includes(x)),
    scenario.name+' Crilo motifs incomplete '+JSON.stringify(art));
  check(art.cardZ>art.artZ&&art.paper==='rgb(255, 253, 249)'&&art.radius==='5px',
    scenario.name+' checkout card lost its foreground design '+JSON.stringify(art));
  check(art.card.width<=485&&art.back.width>60&&art.payVisible,
    scenario.name+' donation form or back link missing '+JSON.stringify(art));
  check(art.back.left>=0&&art.back.top>=0&&art.back.right<=scenario.width+2,
    scenario.name+' back link clipped '+JSON.stringify(art));
  await tipPage.emulateMedia({reducedMotion:'reduce'});
  check(await tipPage.locator('.crilo-mini-wheel').first().evaluate(el=>getComputedStyle(el).animationName)==='none',
    scenario.name+' motion preference not respected');
  await tipPage.emulateMedia({reducedMotion:'no-preference'});

  const typeStyles=await tipPage.evaluate(()=>({
    family:getComputedStyle(document.querySelector('.tip-card h1')).fontFamily,
    headlineWeight:getComputedStyle(document.querySelector('.tip-card h1')).fontWeight,
    buttonWeight:getComputedStyle(document.querySelector('.support-amount')).fontWeight,
    headingShadow:getComputedStyle(document.querySelector('.tip-card h1 span')).textShadow
  }));
  check(typeStyles.family.includes('Manrope')&&typeStyles.headlineWeight==='800'&&typeStyles.buttonWeight==='700'&&typeStyles.headingShadow==='none',
    scenario.name+' modern typography not applied '+JSON.stringify(typeStyles));
  const tipLayout=await tipPage.evaluate(()=>{
    const card=document.querySelector('.tip-card').getBoundingClientRect();
    const pay=document.getElementById('supportPayLink').getBoundingClientRect();
    return {card:card.toJSON(),pay:pay.toJSON(),width:innerWidth,
      scrollWidth:document.documentElement.scrollWidth,scale:visualViewport?.scale||1};
  });
  check(tipLayout.scrollWidth<=tipLayout.width+2,scenario.name+' pastel page horizontal overflow '+JSON.stringify(tipLayout));
  check(tipLayout.card.left>=-2&&tipLayout.card.right<=tipLayout.width+2,
    scenario.name+' pastel tip card cut off '+JSON.stringify(tipLayout));
  check(tipLayout.pay.left>=tipLayout.card.left-2&&tipLayout.pay.right<=tipLayout.card.right+2,
    scenario.name+' PayPal link clipped');
  check(Math.abs(tipLayout.scale-1)<.02,scenario.name+' unwanted page zoom');
  if(scenario.name==='iphone-portrait'||scenario.name==='desktop-wide'){
    const jpg=await tipPage.screenshot({type:'jpeg',quality:60,fullPage:false});
    console.log('PASTEL_DONATION_SCREENSHOT_B64 '+scenario.name+' '+jpg.toString('base64'));
  }
  const urls={
    '2':'https://www.paypal.com/ncp/payment/75LUCY8GEAF84',
    '5':'https://www.paypal.com/ncp/payment/N2EFYQL27VB3Q',
    '10':'https://www.paypal.com/ncp/payment/ZK6WTGVE48JG4',
    'custom':'https://www.paypal.com/ncp/payment/K7QJM2NVLKEYU'
  };
  for(const [amount,expected] of Object.entries(urls)){
    await tipPage.locator('[data-amount="'+amount+'"]').click();
    check(await tipPage.locator('#supportPayLink').getAttribute('href')===expected,
      scenario.name+' incorrect PayPal link for '+amount);
    check(await tipPage.locator('[data-amount="'+amount+'"]').getAttribute('aria-pressed')==='true',
      scenario.name+' amount selection is not accessible');
  }
  // Popup is invoked from a direct checkout click, without requesting real PayPal.
  await tipPage.evaluate(()=>{
    window.__checkoutPopup={};
    window.open=(url,name,features)=>{
      window.__checkoutPopup={url,name,features};
      return {opener:window,location:{replace:dest=>{window.__checkoutPopup.destination=dest}},
        focus:()=>{window.__checkoutPopup.focused=true}};
    };
  });
  await tipPage.locator('[data-amount="5"]').click();
  await tipPage.locator('#supportPayLink').click();
  const popup=await tipPage.evaluate(()=>window.__checkoutPopup);
  check(popup.name==='criloPaypalCheckout'&&popup.features.includes('popup=yes')&&
    popup.destination===urls['5']&&popup.focused,
    scenario.name+' hosted PayPal popup did not open from a direct click: '+JSON.stringify(popup));
  check(tipPage.url().endsWith('/support.html'),
    scenario.name+' checkout popup navigated the underlying game');
  check(!tipErrors.length,scenario.name+' pastel tip script errors: '+tipErrors.join('; '));
  await tipPage.close();
  check(!errors.length,scenario.name+' JavaScript errors: '+errors.join('; '));
  // Confirm the homepage presents the new game before the original Domain card
  // and that the promotional card fits all ten actual browser viewport sizes.
  const home=await context.newPage();
  await home.route('**/*.js*',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:''
  }));
  await home.route('https://cdn.jsdelivr.net/**',route=>route.abort());
  await home.goto(url.replace('shape-of-sound.html','index.html'),{waitUntil:'load'});
  const gameCards=await home.evaluate(()=>{
    const sound=document.getElementById('soundHomeGame');
    const domain=document.querySelector('#more-games a[href="domain/"]');
    if(!sound||!domain)return null;
    const card=sound.getBoundingClientRect(),icon=sound.querySelector('.sound-home-art')?.getBoundingClientRect();
    return {soundHref:sound.getAttribute('href'),
      before:!!(sound.compareDocumentPosition(domain)&Node.DOCUMENT_POSITION_FOLLOWING),
      cards:document.querySelectorAll('#more-games .game-card').length,
      title:sound.querySelector('h2')?.textContent,
      domainDescription:domain.querySelector('p')?.textContent,
      card:card.toJSON(),domain:domain.getBoundingClientRect().toJSON(),icon:icon?.toJSON(),
      vw:innerWidth,scrollWidth:document.documentElement.scrollWidth};
  });
  check(!!gameCards,scenario.name+' homepage game card or Domain card missing');
  check(gameCards.before&&gameCards.soundHref==='shape-of-sound.html'&&
    gameCards.title==='The Shape of Sound'&&gameCards.cards>=2,
    scenario.name+' Shape of Sound not a separate game before Domain');
  check(gameCards.domainDescription?.includes('Five rounds')&&
    !gameCards.domainDescription?.includes('Put its current files'),
    scenario.name+' Domain card should describe the playable game, not the old placeholder');
  check(gameCards.scrollWidth<=gameCards.vw+2,
    scenario.name+' homepage overflow '+JSON.stringify(gameCards));
  check(Math.abs(gameCards.card.width-gameCards.domain.width)<=1,
    scenario.name+' MORE GAMES cards must be the same width '+JSON.stringify(gameCards));
  check(Math.abs(gameCards.card.height-gameCards.domain.height)<=1,
    scenario.name+' MORE GAMES cards must be the same height '+JSON.stringify(gameCards));
  check(gameCards.card.left>=-2&&gameCards.card.right<=gameCards.vw+2,
    scenario.name+' sound homepage card clipped '+JSON.stringify(gameCards));
  check(!!gameCards.icon&&gameCards.icon.left>=gameCards.card.left-2&&
    gameCards.icon.right<=gameCards.card.right+2,
    scenario.name+' sound card illustration overflow');
  if(scenario.name==='desktop-wide'||scenario.name==='iphone-portrait'){
    const image=await home.locator('#more-games').screenshot({type:'jpeg',quality:53});
    console.log('HOMEPAGE_GAMES_SCREENSHOT_B64 '+scenario.name+' '+image.toString('base64'));
  }
  await home.locator('#soundHomeGame').click();
  check(home.url().endsWith('/shape-of-sound.html'),
    scenario.name+' sound game card failed to navigate directly to its own game');
  check(await home.locator('#shape-of-sound').isVisible(),
    scenario.name+' Shape of Sound anchor target missing');
  console.log('PASS_HOME '+scenario.name+' — Shape of Sound navigates to standalone game without overflow');
  await home.close();
  console.log('PASS '+scenario.name+' '+scenario.width+'x'+scenario.height+' — sound/layout/tap/audio/merge/loop/save/reset/pastel tips/PayPal');
  runs++;await context.close();await browser.close();
 }
 console.log('PASS: '+runs+' real rendered browser viewports; no purchases or user-data mutations.');
}
main().then(()=>server.close()).catch(e=>{console.error(e);server.close();process.exit(1)});
