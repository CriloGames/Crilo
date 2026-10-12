/* Real Chromium interaction test for the independently rendered Crilo score share dialog.
 * Uses synthetic auth and stubbed verified run; does not touch the live database. */
'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('share-result.js','utf8');
async function scenario(browser,{signedIn,completed,verified,played=false}){
 const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
 const status=completed?'Official Daily saved. See how you ranked.':'Private test run saved.';
 await page.setContent('<!doctype html><html><head><style>.hidden{display:none}</style></head><body><div id="message">'+status+'</div>'+
 '<div id="result" class="'+(played?'hidden':'result')+'"><div id="resultEyebrow">'+(completed?'DAILY COMPLETE':'TEST RUN COMPLETE')+'</div>'+
 '<div class="result-actions"></div></div>'+
 '<div id="playedPanel" class="'+(played?'played-panel':'played-panel hidden')+'">'+(played?'Official Daily complete':'')+
 '<span id="playedText"></span></div></body></html>');
 await page.evaluate(({signedIn,verified})=>{
  window.Crilo={user:signedIn?{id:'synthetic-user'}:null};
  window.__qaCopied='';
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__qaCopied=text}}});
  const query={select(){return this},eq(){return this},not(){return this},order(){return this},limit(){return this},
   async maybeSingle(){return {data:verified?{score:142,spins:12,ducks:3,upgrades:2,daily_period:'2026-10-11',verified_spin_session_id:'proof'}:null,error:null}}};
  window.criloDB={from(){return query}};
 },{signedIn,verified});
 await page.addScriptTag({content:source});
 if(!signedIn||!completed&&!played){
  assert.equal(await page.locator('#criloShareResult').isVisible(),false,'Never offer sharing to guests or private tests');
  await page.close();return;
 }
 const button=played?'#criloSharePlayed':'#criloShareResult';
 await page.locator(button).waitFor({state:'visible'});
 await page.locator(button).click();
 if(verified){
  await page.locator('#criloShareDialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#criloShareCanvas').getAttribute('width'),'1080');
  const text=await page.evaluate(()=>document.getElementById('criloShareCanvas').toDataURL());
  assert.ok(text.startsWith('data:image/png;base64,')&&text.length>10000,'Card was not drawn as a real image');
  await page.locator('#criloShareCopy').click();
  await page.waitForFunction(()=>window.__qaCopied.includes('142 points'));
  assert.ok((await page.evaluate(()=>window.__qaCopied)).includes('https://crilo.fun/'));
  const dl=page.waitForEvent('download');
  await page.locator('#criloShareSave').click();
  assert.match((await dl).suggestedFilename(),/crilo-daily-2026-10-11\.png/);
  // Native sharing must happen within the Share button's original gesture.
  await page.evaluate(()=>{
   Object.defineProperty(navigator,'canShare',{configurable:true,value:payload=>!!payload.files?.length});
   Object.defineProperty(navigator,'share',{configurable:true,value:payload=>{
    window.__qaNativeShare={
     activated:!!navigator.userActivation?.isActive,
     filename:payload.files?.[0]?.name||null,
     score:payload.text
    };
    return Promise.resolve();
   }});
  });
  await page.locator('#criloShareNative').click();
  await page.waitForFunction(()=>!!window.__qaNativeShare);
  const native=await page.evaluate(()=>window.__qaNativeShare);
  assert.equal(native.activated,true,'Native share must run inside the click gesture');
  assert.equal(native.filename,'crilo-daily.png','Native sharing should send the generated image');
  assert.ok(native.score.includes('142 points'),'Native sharing must preserve the verified score');
 }else{
  await page.waitForFunction(()=>document.getElementById('message').textContent.includes('not saved yet'));
  assert.equal(await page.locator('#criloShareDialog').count(),0,'No proof must not create a fake share card');
 }
 await page.close();
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const [name,opt] of [
   ['official', {signedIn:true,completed:true,verified:true}],
   ['returning-player', {signedIn:true,completed:false,verified:true,played:true}],
   ['no-proof', {signedIn:true,completed:true,verified:false}],
   ['owner-private-test', {signedIn:true,completed:false,verified:false}],
   ['guest', {signedIn:false,completed:true,verified:false}],
  ]){
   await scenario(browser,opt);console.log('PASS: share dialog '+name);
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
