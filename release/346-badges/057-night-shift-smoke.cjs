/* Support: intentional print-design backdrop, voluntary PayPal only. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'support.html'),'utf8');
const css=fs.readFileSync(path.join(root,'support-pastel.css'),'utf8');
const music=fs.readFileSync(path.join(root,'shape-of-sound.html'),'utf8');
assert.equal((html.match(/id="supportPayLink"/g)||[]).length,1,'Exactly one checkout');
assert.equal((html.match(/data-amount="/g)||[]).length,4,'Four voluntary tip options');
assert.ok(html.includes('href="index.html#more-games"'),'Back to main site link');
assert.ok(html.includes('support-pastel.css?v=9'),'Refresh redesigned static art CSS');
assert.ok(html.includes('family=Manrope')&&css.includes('font-family:"Manrope"'),'Preserve familiar typography');
assert.ok(html.includes('class="print-field"')&&html.includes('aria-hidden="true"'),'Artwork must be decorative');
for(const mark of ['orbit-left','orbit-right','poster-loop','poster-stripes','poster-checks','poster-sun','poster-swoop','field-mark','paper-grain']){
 assert.ok(html.includes(mark),'Missing distinct authored graphic element '+mark);
}
assert.ok(html.includes('viewBox="0 0 700 410"'),'An intentional hand-authored outline needs its vector path');
for(const mark of ['repeating-conic-gradient','repeating-linear-gradient','repeating-radial-gradient','.poster-orbit','.poster-loop','.tip-card','@media(prefers-reduced-motion:reduce)']){
 assert.ok(css.includes(mark),'Missing screen-print style '+mark);
}
assert.ok(!css.includes('backdrop-filter')&&!css.includes('filter:blur('),
 'No glass cards or generic out-of-focus glowing blobs');
assert.ok(css.includes('background:#fffdf9')&&css.includes('border:2px solid var(--ink)'),
 'Checkout should look like solid printed paper with ink outlines');
for(const bad of ['shapeCanvas','shapeSurprise','stackProgress','data-depth-layer','data-add-shape','portal-iris','glass-orb','light-pool']){
 assert.ok(!html.includes(bad),'Retired game/glossy decoration returned: '+bad);
}
assert.ok(!html.includes('support-pastel.js?v=7'),'No unnecessary moving-pointer effect');
assert.ok(html.includes("window.open('about:blank'")&&html.includes('popup=yes')&&html.includes('popup.opener=null'),
 'Keep safe one-time hosted PayPal popup');
assert.ok(html.includes('if(!popup)window.location.assign(checkout.href)'),'Accessible popup-block fallback');
assert.ok(music.includes('id="soundStage"')&&!music.includes('supportPayLink'),'Standalone music game unaffected');
assert.ok(html.includes("location.hash==='#shape-of-sound'"),'Legacy music links preserved');
console.log('PASS: Intentional paper/ink op-art background, four optional amounts, safe PayPal popup, back navigation.');
