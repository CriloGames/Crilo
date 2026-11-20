/* One-time email sign-in: mocked Supabase; no real emails or real user data. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const game=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const begin=app.indexOf('  // Supabase enforces a per-address cooldown.');
const end=app.indexOf('  // Fixed-format, database-owned username ink.',begin);
assert.ok(begin>=0&&end>begin,'Shared cooldown helper is present before auth UI');
const source=app.slice(begin,end);
assert.match(game,/window\.CriloMagicLink\.send\(/,
 'Home and other pages must share exactly one magic-link sender');
assert.match(app,/window\.CriloMagicLink\.send\(/,
 'Shared account pages must use the same sender');
assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB/i,
 'Do not persist typed sign-in emails for cooldowns');
let clock=1000000000000,intervals=[],calls=[],mode='success';
class FakeDate extends Date{static now(){return clock}}
const statuses=[];
const auth={
 signInWithOtp:async payload=>{
  calls.push(payload);
  if(mode==='limited')return {error:{code:'over_email_send_rate_limit',status:429,
   message:'For security purposes, you can only request this after 213 seconds.'}};
  if(mode==='not-allowed')return {error:{code:'email_address_not_authorized',
   message:'Email address not authorized'}};
  if(mode==='network')throw Error('Network unavailable');
  if(mode==='generic')return {error:{code:'provider_failed',message:'Provider unavailable'}};
  return {error:null};
 }
};
const mock={window:{},Date:FakeDate,criloDB:{auth},
 setInterval:fn=>{intervals.push(fn);return intervals.length},console};
vm.runInNewContext(source,mock,{filename:'app.js:magic-link'});
const api=mock.window.CriloMagicLink;
assert.ok(api&&typeof api.send==='function'&&typeof api.remaining==='function');
function form(address='not-an-email'){
 const handlers=new Map();
 const input={
  value:address,
  checkValidity(){return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.value)},
  addEventListener:(name,fn)=>handlers.set(name,fn),
  focus(){this.focused=true}
 };
 const button={disabled:false},status={dataset:{},textContent:''};
 return {
  input,button,status,
  edit(value){input.value=value;handlers.get('input')?.()},
  run:()=>api.send({input,button,status,redirectTo:'https://crilo.fun/index.html'})
 };
}
(async()=>{
 const f=form();
 await f.run();
 assert.equal(calls.length,0,'Invalid addresses must never request email');
 assert.match(f.status.textContent,/valid email/);
 f.edit('player@example.test');
 await f.run();
 assert.equal(calls.length,1,'A valid address sends one request');
 assert.equal(calls[0].email,'player@example.test');
 assert.equal(calls[0].options.emailRedirectTo,'https://crilo.fun/index.html');
 assert.equal(f.button.disabled,true,'Prevent resend before cooldown ends');
 assert.match(f.status.textContent,/Check your email inbox and spam/);
 assert.match(f.status.textContent,/5:00/);
 await f.run();
 assert.equal(calls.length,1,'Repeat click must never cause another SMTP attempt');
 clock+=1000;
 intervals.forEach(fn=>fn());
 assert.match(f.status.textContent,/4:59/);
 f.edit('other@example.test');
 assert.equal(f.button.disabled,false,'A corrected email should not be locked out');
 mode='limited';
 await f.run();
 assert.equal(calls.length,2);
 assert.equal(f.button.disabled,true);
 assert.match(f.status.textContent,/3:33/,'Use Supabase supplied retry window');
 await f.run();
 assert.equal(calls.length,2,'Repeated 429 retries must not reach Supabase again');
 clock+=213000;
 intervals.forEach(fn=>fn());
 assert.equal(f.button.disabled,false,'Restore button as soon as server countdown passes');
 assert.match(f.status.textContent,/request another/i);
 mode='not-allowed';
 await f.run();
 assert.equal(f.button.disabled,false,'SMTP setup issues should not lock the submit button');
 assert.match(f.status.textContent,/custom email sender/);
 f.edit('third@example.test');
 mode='network';
 await f.run();
 assert.equal(f.button.disabled,false);
 assert.match(f.status.textContent,/Network unavailable/);
 f.edit('fourth@example.test');
 mode='generic';
 await f.run();
 assert.equal(f.button.disabled,false);
 assert.match(f.status.textContent,/Provider unavailable/);
 const other=form('player@example.test');
 await other.run();
 assert.equal(calls.length,5,'Cooldown tracked across same-page forms for same email');
 assert.equal(other.button.disabled,true);
 // User can request again when the five-minute success cooldown ends.
 clock+=88000;
 intervals.forEach(fn=>fn());
 assert.equal(other.button.disabled,false);
 mode='success';
 await other.run();
 assert.equal(calls.length,6,'Send again only after enough time has elapsed');
 console.log('PASS: link send accepted, five-minute cooldown, no duplicate requests, server 429 recovery, corrected address, SMTP errors, offline handling and expiry.');
})().catch(error=>{console.error(error);process.exitCode=1});
