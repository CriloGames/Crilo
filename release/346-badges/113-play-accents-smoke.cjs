'use strict';
/* Border ribbon regression: all pastel strokes must hug existing panels. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('play-accents.css'),wheel=read('game.js'),home=read('index.html');
assert.match(home,/href="play-accents\.css\?v=\d+"/);
for(const target of ['#drawPanel','#more-games .game-card',
 '.leader-main .best-card','.leader-main .leader-panel',
 '.duck-page .duck-progress','.page-shell .settings-card',
 '.page-shell .profile-card','.crilo-legal-main .crilo-legal-paper',
 '.pastel-world .tip-card','.sound-page .sound-app',
 '.shell #gameScreen .card']){
 assert.ok(css.includes(target),'Missing border host: '+target);
}
assert.ok(css.includes('pointer-events:none'),'Accent edges cannot intercept input');
assert.ok(css.includes('border-top-left-radius:calc(var(--trace-radius'),
 'Top rail must bend around real border radii');
assert.ok(css.includes('border-bottom-right-radius:calc(var(--trace-radius'),
 'Bottom rail must turn around actual corners');
assert.ok(css.includes('--trace-head:76%')&&css.includes('--trace-tail:73%'),
 'Long and short edge segments must be varied');
assert.ok(css.includes('top:-5px;left:-5px')&&css.includes('right:-5px;bottom:-5px'),
 'Both accent anchors must sit beyond the outside edge of their cards');
assert.ok(css.includes('background:none;')&&!css.includes('background:linear-gradient('),
 'Remove all former inside-the-card inset gradients');
assert.ok(css.includes('filter:var(--trace-head-stack,drop-shadow(-6px -6px')&&
 css.includes('filter:var(--trace-tail-stack,drop-shadow(6px 6px'),
 'Optional stacked strokes should copy only the painted OUTSIDE edges');
assert.ok(css.includes('.hero .played-panel')&&
 css.includes('.sound-page .sound-inspector'),
 'More existing bordered boxes should have asymmetric accents');
assert.ok(css.includes('.page-shell .badge-card')&&
 css.includes('.analytics-main .analytics-cards > *')&&
 css.includes('.sound-page .support-card')&&
 css.includes('.collection-page .collection-card'),
 'Expanded coverage must include actual bordered badge, analytics, set and game support cards');
assert.ok(!css.includes('.collection-page .collection-list')&&
 !css.includes('.analytics-main .analytics-controls'),
 'Do not draw detached lines around unbordered collection or analytics containers');
assert.ok(css.includes('.collection-page .collection-card{position:relative;overflow:visible}')&&
 css.includes('.collection-card:nth-child(even)::before'),
 'Set-card strokes must stay visible while alternating corners to prevent overlap');
for(const key of ['--play-line-mint-deep','#8ab9a5','--play-line-blue-deep',
 '--play-line-lilac-deep','--play-line-peach-deep','--play-line-pink-deep']){
 assert.ok(css.includes(key),'Missing darker inner color pairing: '+key);
}
assert.ok(css.includes('color-mix(in srgb,var(--trace-first')&&
 css.includes('color-mix(in srgb,var(--trace-last'),
 'Darker inner strokes must use corresponding outer pastel hues');
assert.ok(css.includes('--trace-third:37%')&&css.includes('top:-19px;left:-19px'),
 'Some cards should have three exterior strokes of unequal length');
assert.ok(css.includes('@media(max-width:600px)'),'Narrow-phone rules must be present');
assert.ok(css.includes('html[data-theme="dark"]'),'Muted dark-mode colors must be present');
assert.doesNotMatch(css,/pastel-(?:space|play)-traces(?:-night)?\.svg/,
 'Floating SVG ornament backgrounds should no longer be referenced');
assert.doesNotMatch(css,/\b(?:position:\s*fixed|animation:|box-shadow:)\b/,
 'Decorations must stay static and noninteractive');
for(const color of ['#c9f1df','#9bd9ef','#dfc8f6','#ffc8a8','#ffb8d2']){
 assert.ok(wheel.includes(color),'Color outside wheel palette: '+color);
 assert.ok(css.includes(color),'Accent palette lost '+color);
}
console.log('PLAY_ACCENTS_PASS: rounded border layers, echo lines, long/short segments, theme and responsive safety');
