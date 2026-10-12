'use strict';
/* Guard Crilo Play's decorative accent rails without touching gameplay.
   The real Chromium/WebKit viewport audits cover the computed page layout. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const home=read('index.html');
const css=read('play-accents.css');
const wheel=read('game.js');
const main=read('style.css');

assert.match(home,/href="play-accents\.css\?v=\d+"/,'Play page must load accent stylesheet');
assert.ok(home.indexOf('play-accents.css')>home.indexOf('night-pages.css'),
  'Accent styles must load after theme and page styles');
assert.doesNotMatch(home,/class="[^"]*crilo-pastel-decorative/i,
  'Decoration is CSS-only and must not be added to the accessible DOM');
for(const selector of ['#drawPanel::before','#drawPanel::after',
  '.wheel-stage::before','#more-games::before','#more-games::after']){
  assert.ok(css.includes(selector),'Missing a short accent: '+selector);
}
assert.ok(css.includes('pointer-events:none'),
  'Decorative strokes may not intercept canvas, wheel or card clicks');
assert.ok(css.includes('body.wheel-session-fit .wheel-stage::before')&&
  css.includes('--crilo-wheel-fit'),
  'Wheel accents must follow the actual wheel size during official runs');
assert.ok(css.includes('@media(max-width:600px)'),'320px phones need shorter corners');
assert.ok(css.includes('html[data-theme="dark"]'),'Dark-mode accents must stay subdued');
assert.ok(css.includes('-webkit-mask:')&&css.includes('mask:'),
  'Broken wheel arcs must render in WebKit and Chromium');
assert.ok(css.includes('transparent 197deg 360deg'),
  'Wheel arcs must stop rather than make a full circle');
assert.ok(!/\b(?:position:\s*fixed|animation:|box-shadow:)\b/.test(css),
  'Background accents must remain static and unobtrusive');
const sourceWheelColors=[...wheel.matchAll(/#[a-f\d]{6}/gi)].map(m=>m[0].toLowerCase());
for(const color of ['#c9f1df','#9bd9ef','#dfc8f6','#ffc8a8','#ffb8d2']){
  assert.ok(sourceWheelColors.includes(color),'Accent is outside original wheel palette: '+color);
  assert.ok(css.includes(color),'Missing original pastel: '+color);
}
assert.ok(main.includes('.wheel-stage{position:relative')&&main.includes('.draw-panel{'),
  'CSS anchors must continue matching the actual game');
console.log('PLAY_ACCENTS_PASS: interrupted pastel corners, wheel fit, mobile, both themes, palette and pointer safety');
