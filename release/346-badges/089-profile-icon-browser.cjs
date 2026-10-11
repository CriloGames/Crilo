'use strict';
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
(async()=>{
 const server=http.createServer(serve);await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let cases=0;const pass=x=>{cases++;console.log('PASS profile icon: '+x)};
 async function context(loggedIn,width){
  const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
  const mocked=mockSupabase.replace('loggedIn:false','loggedIn:'+loggedIn);
  await ctx.addInitScript({content:mocked});
  await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await ctx.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
  return ctx;
 }
 try{
  for(const width of [320,390,768,1280]){
   const ctx=await context(true,width),page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/profile.html',{waitUntil:'domcontentloaded',timeout:12000});
   await page.waitForFunction(()=>document.getElementById('profileName').textContent==='CriloQA',{timeout:10000});
   assert.ok(await page.locator('#avatarEditBtn').isVisible(),'Owner profile must allow edits');
   assert.ok(await page.locator('#avatar').isEnabled(),'Avatar tile itself should be clickable');
   assert.equal(await page.locator('#avatar').innerText(),'C','Default must be username initial');
   await page.locator('#avatar').click();
   assert.ok(await page.locator('#avatarEditorModal').isVisible(),'Avatar icon editor did not open');
   assert.equal(await page.locator('.avatar-editor-option').count(),9);
   assert.equal(await page.locator('#avatarColorOptions .avatar-editor-swatch').count(),8);
   assert.equal(await page.locator('#avatarInkOptions .avatar-editor-swatch').count(),8);
   const bounds=await page.locator('.avatar-editor-card').boundingBox();
   assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+1,'Editor clipped on '+width);
   const dimensions=await Promise.all(['#avatarUseInitial','#avatarCustomLetter']
     .map(selector=>page.locator(selector).boundingBox()));
   assert.ok(dimensions.every(Boolean)&&Math.abs(dimensions[0].height-dimensions[1].height)<1,
     'Initial button and letter/number input must have exactly matching heights at '+width);
   assert.ok((await page.locator('label[for="avatarCustomLetter"]').innerText()).includes('number'),
     'Letter and number support must be explained');
   const first=await page.locator('#avatarEditorPreview').getAttribute('aria-label');
   assert.ok(first.includes('C'),'Initial preview incorrect');
   await page.locator('#avatarCustomLetter').fill('7');
   assert.equal(await page.locator('#avatarEditorPreview').innerText(),'7',
     'Single-digit numeric icon did not preview');
   pass('initial avatar and nine illustration choices, eight colors at '+width+'px');
   await page.locator('[data-symbol="icon:duck"]').click();
   await page.locator('[data-color="#DFECFF"]').click();
   await page.locator('[data-ink="#2D567F"]').click();
   assert.equal(await page.locator('#avatarEditorPreview').evaluate(el=>getComputedStyle(el).color),'rgb(45, 86, 127)');
   assert.equal(await page.locator('[data-symbol="icon:duck"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('[data-color="#DFECFF"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#avatarEditorPreview svg').count(),1,'Icon preview missing');
   await page.locator('#avatarEditorSave').click();
   await page.waitForFunction(()=>document.getElementById('avatarEditorModal').classList.contains('hidden'));
   assert.equal(await page.locator('#avatar svg').count(),1,'Saved illustration missing');
   const saved=await page.evaluate(()=>window.__qa.requests.filter(x=>x[0]==='rpc'&&x[1]==='crilo_update_profile_icon_v2'));
   assert.equal(saved.length,1,'Icon save should call one server RPC');
   assert.deepEqual(saved[0][2],{p_symbol:'icon:duck',p_background:'#DFECFF',p_ink:'#2D567F'});
   pass('saved duck + sky icon, verified RPC payload '+width+'px');
   await page.locator('#avatarEditBtn').click();
   await page.locator('#avatarCustomLetter').fill('Z');
   assert.equal(await page.locator('#avatarEditorPreview').innerText(),'Z');
   await page.locator('[data-color="#FFF0A8"]').click();
   assert.ok(await page.locator('[data-ink="#FFF0A8"]').isDisabled(),'Identical ink and background must not be selectable');
   await page.locator('#avatarEditorCancel').click();
   assert.ok(await page.locator('#avatarEditorModal').isHidden());
   assert.equal(await page.locator('#avatar svg').count(),1,'Cancel must preserve saved icon');
   await page.locator('#avatarEditBtn').click();
   await page.locator('#avatarCustomLetter').fill('Z');
   await page.locator('#avatarEditorSave').click();
   await page.waitForFunction(()=>document.getElementById('avatarEditorModal').classList.contains('hidden'));
   assert.equal(await page.locator('#avatar').innerText(),'Z');
   await page.locator('#avatar').click();
   await page.locator('#avatarUseInitial').click();
   await page.locator('#avatarEditorSave').click();
   await page.waitForFunction(()=>document.getElementById('avatarEditorModal').classList.contains('hidden'));
   assert.equal(await page.locator('#avatar').innerText(),'C');
   pass('cancel, custom letter, reset to initial '+width+'px');
   assert.deepEqual(errors,[],'Unexpected profile errors '+width);
   await ctx.close();
  }
  // Other people's profiles remain visible, but never expose the editor.
  const ctx=await context(false,390),page=await ctx.newPage();
  await page.goto(origin+'/profile.html?id=11111111-1111-4111-8111-111111111111',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('profileName').textContent==='CriloQA');
  assert.ok(await page.locator('#avatarEditBtn').isHidden(),'Guest must not see edit action');
  assert.ok(await page.locator('#avatar').isDisabled(),'Guest must not be able to edit');
  pass('guest can view but not change another user icon');
  await ctx.close();
  console.log('PROFILE_ICON_BROWSER_PASS '+cases+' scenarios');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(e=>{console.error('PROFILE_ICON_BROWSER_FAIL',e);process.exitCode=1});
