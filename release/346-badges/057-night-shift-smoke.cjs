/* Night Shift static acceptance checks: gameplay stays free and PayPal is separate. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../..');
const read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const html=read('support.html'),js=read('night-shift.js'),css=read('night-shift.css');
assert.match(html,/id="nightShift"/);
assert.ok(html.indexOf('id="nightShift"')<html.indexOf('id="soundStage"'),'Night Shift before sound playground');
for(const id of ['nightScene','nightLights','nightReplay','nightSoundToggle','nightTipMount','nightProgress','nightStatus','soundStage','supportPayLink']){
 assert.ok(html.includes('id="'+id+'"'),'Missing important control '+id);
}
assert.equal((html.match(/id="supportPayLink"/g)||[]).length,1,'Exactly one checkout link, never duplicate tips');
assert.equal((html.match(/class="support-amount(?: selected)?"/g)||[]).length,4,'Four PayPal denominations');
assert.equal((html.match(/data-night-clue="/g)||[]).length,2,'Two independent scary clues');
assert.equal((html.match(/data-night-wheel="danger"/g)||[]).length,5,'Five skull wheel positions');
assert.equal((html.match(/data-night-wheel="safe"/g)||[]).length,1,'Only one safe wheel position');
assert.ok(html.includes('night-shift.js?v=1')&&html.includes('night-shift.css?v=1'),'Night Shift assets are loaded');
assert.ok(html.includes('href="https://www.paypal.com/ncp/payment/75LUCY8GEAF84"'),'Existing initial PayPal link remains');
assert.ok(js.includes("mount.appendChild(tip)"),'Move existing, trusted tip card rather than cloning it');
assert.ok(js.includes("mount.hidden=false")&&js.includes("lights.addEventListener('click'"),'One-click skip must reveal optional tips');
assert.ok(js.includes('prefers-reduced-motion'),'Replay supports reduced-motion');
assert.ok(css.includes('@media(max-width:520px)')&&css.includes('@media(prefers-reduced-motion:reduce)'),'Mobile and reduced-motion support');
assert.ok(!/fetch\(|\.rpc\(|supabase|paypal\.com|window\.open|location\.href/i.test(js),'Horror game cannot call payment or backend');
console.log('PASS: Free Night Shift, two clues, six-piece wheel, direct tip access and isolated payment checkout.');
