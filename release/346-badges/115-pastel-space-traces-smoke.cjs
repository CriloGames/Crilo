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
for(const border of ['border-top:2.5px solid','border-left:2.5px solid',
 'border-right:2.5px solid','border-bottom:2.5px solid']){
 assert.ok(css.includes(border),'Missing edge-following ribbon: '+border);
}
assert.ok(css.includes('border-top-left-radius:calc(var(--trace-radius,22px) + 6px)'));
assert.ok(css.includes('border-bottom-right-radius:calc(var(--trace-radius,22px) + 6px)'));
assert.ok(css.includes('min(var(--trace-head,57%),calc(100% - 12px))'),
 'Long side traces must be capped to their actual card');
assert.ok(css.includes('min(var(--trace-tail,37%),calc(100% - 12px))'),
 'Short traces must be capped to their actual card');
assert.ok(css.includes('pointer-events:none'));
assert.ok(css.includes('--trace-head-echo:195px')&&css.includes('--trace-tail-echo:149px'),
 'Layered echo lengths must vary between panels');
assert.ok(css.includes('html[data-theme="dark"]'));
assert.ok(css.includes('@media(max-width:600px)'));
console.log('PASTEL_BORDER_RIBBONS_PASS: no freehand SVGs, layered card borders only, responsive and both themes');
