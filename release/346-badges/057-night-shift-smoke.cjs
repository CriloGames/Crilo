/* Crilo support page: no gameplay gate, beautiful motion-safe abstract backdrop,
   separate optional PayPal payments and preservation of original sound game. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'support.html'),'utf8');
const css=fs.readFileSync(path.join(root,'support-pastel.css'),'utf8');
const js=fs.readFileSync(path.join(root,'support-pastel.js'),'utf8');
const music=fs.readFileSync(path.join(root,'shape-of-sound.html'),'utf8');
assert.equal((html.match(/id="supportPayLink"/g)||[]).length,1,'Exactly one voluntary PayPal checkout');
assert.equal((html.match(/data-amount="/g)||[]).length,4,'Preserve the four existing tip amounts');
assert.ok(html.includes('href="index.html#more-games"'),'Back to Crilo link');
assert.ok(html.includes('support-pastel.css?v=8')&&html.includes('support-pastel.js?v=7'),'Cache-busted visual assets');
assert.ok(html.includes('family=Manrope')&&css.includes('font-family:"Manrope"'),'Modern UI typography');
assert.ok(html.includes('class="dreamscape"')&&html.includes('id="dreamscape"'),'Background as a decorative scene');
assert.ok(html.includes('aria-hidden="true"')&&html.includes('viewBox="0 0 1600 1000"'),'Accessible original ribbon artwork');
for(const sel of ['portal-left','portal-right','op-wheel-a','op-wheel-b','orb-top','orb-bottom','wave-one','wave-two','wave-three','light-grain']){
 assert.ok(html.includes(sel),'Missing layered composition '+sel);
}
for(const item of ['repeating-conic-gradient','repeating-radial-gradient','.flow-art','.glass-orb','.light-pool','.portal','.tip-card','@media(prefers-reduced-motion:reduce)']){
 assert.ok(css.includes(item),'Missing original design/motion-safety asset '+item);
}
assert.ok(css.includes('animation:none!important')&&css.includes('pointer-events:none'),'Respect reduced motion and keep decor inert');
assert.ok(js.includes('prefers-reduced-motion: reduce')&&js.includes('pointer: fine'),'Pointer parallax must be disabled on touch and reduced motion');
assert.ok(!/fetch\(|\.rpc\(|supabase|paypal\.com|window\.open|localStorage|location\.href/i.test(js),
 'Visual effect must not use backend, checkout or storage');
for(const bad of ['shapeCanvas','shapeSurprise','stackProgress','data-depth-layer','data-add-shape','id="nightShift"','id="soundStage"','Stack Lab']){
 assert.ok(!html.includes(bad),'Remove old interaction/game interface '+bad);
}
assert.ok(html.includes("window.open('about:blank'")&&html.includes('popup=yes')&&html.includes('popup.opener=null'),
 'Keep prior isolated PayPal checkout popup');
assert.ok(html.includes('if(!popup)window.location.assign(checkout.href)'),
 'Payment must still be accessible when popup is blocked');
assert.ok(music.includes('id="soundStage"')&&!music.includes('supportPayLink'),'Sound game remains separate');
assert.ok(html.includes("location.hash==='#shape-of-sound'"),'Existing old game links redirect');
console.log('PASS: Original pastel optical background, optional checkout, homepage link and accessible reduced-motion presentation.');
