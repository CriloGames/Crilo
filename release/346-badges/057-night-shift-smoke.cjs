/* Support page: small authentic wheel accents and familiar Crilo visual motifs. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'support.html'),'utf8');
const css=fs.readFileSync(path.join(root,'support-pastel.css'),'utf8');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const music=fs.readFileSync(path.join(root,'shape-of-sound.html'),'utf8');
assert.equal((html.match(/id="supportPayLink"/g)||[]).length,1,'Exactly one checkout');
assert.equal((html.match(/data-amount="/g)||[]).length,4,'Four voluntary tip options');
assert.ok(html.includes('href="index.html#more-games"'),'Back to main site link');
assert.ok(html.includes('support-pastel.css?v=11'),'Refresh site-matched decorative CSS');
assert.ok(html.includes('family=Manrope')&&css.includes('font-family:"Manrope"'),'Keep readable familiar typography');
assert.ok(html.includes('class="crilo-shape-field"')&&html.includes('aria-hidden="true"'),'Artwork must be decorative');
assert.equal((html.match(/class="crilo-mini-wheel wheel-/g)||[]).length,8,'Eight small wheel motifs');
assert.ok(html.includes('id="criloMiniWheel"')&&html.includes('href="#criloMiniWheel"'),'All wheels reuse the same real segment art');
assert.equal((html.match(/stroke-linejoin="round"\/><text /g)||[]).length,12,
  'Use 12 accurately colored and labeled wheel sectors');
const paletteMatch=game.match(/const palette=\[([^;]+)\];/);
assert.ok(paletteMatch,'Main game wheel palette must exist');
for(const color of ['#ffd86b','#9bd9ef','#ffb8d2','#c6dcff','#c8f4bd','#efc5ef','#aee9f4','#fff0a8','#c9f1df','#dfc8f6','#ffc8a8']){
 assert.ok(paletteMatch[1].includes(color),'Main wheel missing color '+color);
 assert.ok(html.includes('fill="'+color+'"'),'Decorative wheels must match main wheel color '+color);
}
for(const category of ['crilo-pill','crilo-blob','crilo-ring','crilo-spark','crilo-badge','crilo-duck','crilo-number']){
 assert.ok(html.includes(category)&&css.includes('.'+category),'Site-shaped decorative item missing '+category);
}
assert.equal((html.match(/class="crilo-duck duck-/g)||[]).length,3,'Cute yellow Crilo ducks');
assert.ok(html.includes('>×2</span>')&&html.includes('>+2</span>')&&html.includes('>UP!</span>'),
 'Familiar wheel rewards must decorate background');
assert.ok(!css.includes('.poster-orbit')&&!css.includes('.poster-checks'),
 'Oversized poster wheels/checker fields must be removed');
assert.ok(css.includes('background:#fffdf9')&&css.includes('border:2px solid var(--ink)'),
 'Keep clean printed donation card');
assert.ok(!html.includes('shapeCanvas')&&!html.includes('data-add-shape')&&!html.includes('stackProgress'),
 'Do not restore previous games');
assert.ok(html.includes("window.open('about:blank'")&&html.includes('popup=yes')&&html.includes('popup.opener=null'),
 'Keep optional isolated checkout popup');
assert.ok(html.includes('if(!popup)window.location.assign(checkout.href)'),'Keep popup-blocker fallback');
assert.ok(music.includes('id="soundStage"')&&!music.includes('supportPayLink'),'Standalone music game unaffected');
assert.ok(html.includes("location.hash==='#shape-of-sound'"),'Legacy music links preserved');
console.log('PASS: Eight mini Crilo wheel illustrations, familiar game motifs, optional checkout, and standalone music game.');
