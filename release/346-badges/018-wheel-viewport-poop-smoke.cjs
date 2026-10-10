/* The active wheel must fit from its pointer to the full SPIN button
 * on ordinary mobile and desktop viewport heights, with no changes to
 * official Daily randomness, badges or saved run data. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const demo=fs.readFileSync(path.join(root,'beetle-tricks.html'),'utf8');
assert.ok(html.includes('style.css?v=80'));
assert.ok(html.includes('game.js?v=60'));
assert.ok(demo.includes('style.css?v=80'));
assert.ok(html.indexOf('class="wheel-stage"')<html.indexOf('id="spinButton"'),
 'The active stack must be wheel > score > counters > mode > SPIN');
assert.ok(html.indexOf('id="wheelScorePanel"')<html.indexOf('class="stats wheel-counts"'));
assert.ok(html.indexOf('class="stats wheel-counts"')<html.indexOf('id="spinButton"'));
assert.ok(css.includes('body.wheel-run-active .wheel-wrap{'));
assert.ok(css.includes('calc(100dvh - 395px)'),'Desktop size must respond to viewport height');
assert.ok(css.includes('calc(100dvh - 335px)'),'Mobile wheel must respond to viewport height');
assert.ok(css.includes('body.wheel-run-active .wheel-stage{scroll-margin-top:98px}'));
assert.ok(css.includes('body.wheel-run-active .draw-panel.locked-panel{display:none}'),
 'Do not leave a disabled drawing panel above active play');
assert.ok(css.includes('body.wheel-run-active #testBanner{display:none!important}'),
 'Only one owner Test Run banner should be on screen');
assert.ok(css.includes('#ownerActiveMode:not(.hidden)'));
assert.ok(css.includes('body.wheel-run-active #spinButton{min-height:49px'));
assert.ok(game.includes("if(!document.body?.classList?.contains('wheel-run-active'))"),
 'Resize-and-scroll must happen once per run');
assert.ok(game.includes("stage?.scrollIntoView?.({behavior:window.matchMedia"),
 'The wheel pointer must be aligned below the sticky header');
assert.ok(game.includes("document.body?.classList?.remove('wheel-run-active');serverSessionId=null;"),
 'Reset compact mode when a new Daily or owner test begins');
assert.ok(game.includes("lockDrawing();\n// Focus the play surface"),
 'Drawing must stay editable until the first spin');
function wheelWidth(W,H){
 const mobile=W<=600;
 const preferred=Math.max(mobile?210:225,H-(mobile?335:395));
 return Math.min(mobile?W*.90:W*.88,600,preferred);
}
for(const [W,H] of [[320,560],[320,650],[375,620],[390,740],
 [768,650],[1024,720],[1280,768],[1494,800],[1920,1080]]){
 const mobile=W<=600,topOffset=mobile?85:98;
 const elementsBudget=mobile?238:269;
 const wheel=wheelWidth(W,H);
 assert.ok(wheel>0&&wheel<=600&&wheel<=W*.9,'Wheel must stay within screen width');
 assert.ok(topOffset+wheel+elementsBudget<=H,
  'Keep wheel through SPIN within viewport at '+W+'×'+H+
  ', estimated stack '+(topOffset+wheel+elementsBudget));
}
assert.ok(css.includes('left:calc(46.74% + 46px)'), 'Desktop poop position');
assert.ok(css.includes('left:calc(46.74% + 40px)'), 'Mobile poop position');
assert.ok(css.includes('0%,74.2%{opacity:0')&&css.includes('74.6%,88%{opacity:1'));
for(const [W,bodyWidth,offset] of [[320,65,40],[375,65,40],[428,65,40],
 [768,74,46],[1024,74,46],[1494,74,46],[1920,74,46]]){
 const firstRight=W-bodyWidth-8;
 const beetleRear=firstRight+(8-firstRight)*(74.6-50)/(96-50)+bodyWidth;
 const poopX=.4674*W+offset;
 assert.ok(poopX>beetleRear&&poopX-beetleRear<14,
  'Poop must appear within 14px behind beetle at '+W+'px, gap '+(poopX-beetleRear));
}
assert.ok(css.includes('[class*="beetle-right-"] .crilo-beetle-dropping')&&
 css.includes('[class*="beetle-left-"] .crilo-beetle-dropping'),
 'Special turns must always suppress poop');
console.log('PASS: 9 viewport sizes, first-spin-only wheel alignment, intact score HUD, 7 poop offsets and suppressed special-turn poop.');
