/* Crilo's support page is now an intentionally simple pastel tip page.
   Regression verifies that no game mechanics or sign-in gate remain. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'support.html'),'utf8');
const css=fs.readFileSync(path.join(root,'support-pastel.css'),'utf8');
const js=fs.readFileSync(path.join(root,'support-pastel.js'),'utf8');
const music=fs.readFileSync(path.join(root,'shape-of-sound.html'),'utf8');
assert.match(html,/id="supportPayLink"/);
assert.match(html,/id="shapeCanvas"/);
assert.match(html,/class="tip-card"/);
assert.equal((html.match(/id="supportPayLink"/g)||[]).length,1);
assert.equal((html.match(/data-amount="/g)||[]).length,4);
assert.ok(!html.includes('id="nightShift"')&&!html.includes('id="soundStage"'),'Old games must be removed from tip page');
assert.ok(!html.includes('id="accountBtn"')&&!html.includes('app.js'),'No sign-in or account UI');
assert.ok(html.includes('support-pastel.css?v=1')&&html.includes('support-pastel.js?v=1'));
assert.ok(css.includes('.shape.flower')&&css.includes('.shape.heart')&&css.includes('.shape.bean'),'Pastel shape variety');
assert.ok(css.includes('@media(max-width:650px)')&&css.includes('prefers-reduced-motion:reduce'),'Responsive reduced-motion art');
assert.ok(js.includes('const pieces=230'),'Page should be full of layered pastel shapes');
assert.ok(!/fetch\(|\.rpc\(|supabase|paypal\.com|window\.open|location\.href/i.test(js),'Decorations must remain entirely offline');
assert.ok(music.includes('id="soundStage"')&&!music.includes('supportPayLink'),'Music game stays standalone');
assert.ok(html.includes("location.hash==='#shape-of-sound'"),'Previously shared music links must keep working');
console.log('PASS: Tip page has one optional PayPal checkout, 230 pastel stickers, no account or other game.');
