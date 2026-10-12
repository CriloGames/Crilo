'use strict';
/* The old free-space doodle asset check is replaced with a border-only audit.
   Keep all decoration inside card rails; none may be placed on body or hero. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('play-accents.css');
assert.doesNotMatch(css,/background-image:url\(/,
 'No full-page or hero background artwork is allowed');
assert.doesNotMatch(css,/(?:^|\n)\s*(?:body|\.hero|\.wheel-stage)::(?:before|after)\s*\{/,
 'No decorative free-floating elements outside card borders');
assert.doesNotMatch(css,/pastel-(?:space|play)-traces(?:-night)?\.svg/,
 'Obsolete freeform SVGs must not be used');
for(const border of ['border-top:2.5px solid var(--trace-first-deep',
 'border-left:2.5px solid var(--trace-first-deep',
 'border-right:2.5px solid var(--trace-last-deep',
 'border-bottom:2.5px solid var(--trace-last-deep']){
 assert.ok(css.includes(border),'Nearest stroke must be dark: '+border);
}
assert.ok(css.includes('--trace-shade-ink:#364251')&&
 css.includes('--trace-shade-ink:#10151d'),
 'Darkening colors must work in both light and dark modes');
assert.ok(css.includes('border-top-left-radius:calc(var(--trace-radius,22px) + 5px)'));
assert.ok(css.includes('border-bottom-right-radius:calc(var(--trace-radius,22px) + 5px)'));
assert.ok(css.includes('min(var(--trace-head,57%),calc(100% - 10px))'),
 'Long side traces must be capped to their actual card');
assert.ok(css.includes('min(var(--trace-tail,37%),calc(100% - 10px))'),
 'Short traces must be capped to their actual card');
assert.ok(css.includes('pointer-events:none'));
assert.ok(css.includes('--trace-head:76%')&&css.includes('--trace-tail:73%'),
 'Border stroke lengths vary by surface');
assert.ok(css.includes('filter:var(--trace-head-stack,none)')&&
 css.includes('filter:var(--trace-tail-stack,none)'),
 'Cards must not default to double strokes everywhere');
assert.ok(css.includes('--trace-head-stack:drop-shadow(-6px -6px 0 var(--trace-first')&&
 css.includes('--trace-tail-stack:drop-shadow(6px 6px 0 var(--trace-last'),
 'Selected double strokes must keep the lighter line outside the dark inner line');
for(const pattern of ['7n + 1','7n + 2','7n + 3','7n + 5','7n + 6','7n + 7']){
 assert.ok(css.includes(':nth-child('+pattern+')'),
  'Missing deterministic variety: '+pattern);
}
assert.ok(css.includes('display:none!important'),
 'Some corners must be intentionally absent, making true one-line cards');
assert.ok(css.includes('top:-19px;left:-19px')&&css.includes('--trace-third:37%'),
 'Selected cards must support three offset lines with asymmetric lengths');
assert.ok(css.includes('@media(max-width:1180px)'),
 'Tablet and phone must suppress wide three-line offsets');
assert.ok(css.includes('html[data-theme="dark"]'));
assert.ok(css.includes('@media(max-width:600px)'));
console.log('PASTEL_BORDER_RIBBONS_PASS: varied one, two and three line cards, border-only safety, both themes');
