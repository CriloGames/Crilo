'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'wheel-neon-rings.css'),'utf8');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
assert.match(html,/href="wheel-neon-rings\.css\?v=3"/);
for(const id of ['wheelNeonOuter','wheelNeonInner'])
 assert.match(html,new RegExp('id="'+id+'"[^>]*aria-hidden="true"'));
assert.match(html,/<canvas id="drawing"[^>]+><\/canvas><span class="wheel-neon-ring wheel-neon-outer"/);
assert.match(css,/\.wheel-neon-outer\s*\{inset:1\.05%\}/);
assert.match(css,/\.wheel-neon-inner\s*\{inset:calc\(33% - 15px\);z-index:4\}/);
assert.match(css,/conic-gradient\(/);
assert.match(css,/mask-image:radial-gradient/);
assert.match(css,/inset:calc\(33% - 15px\)/,
 'Inner neon should keep a fixed 15px radial offset from the 34% drawing canvas');
assert.match(css,/\.wheel-neon-inner::after\s*\{[\s\S]*?transparent calc\(100% - 6px\)/,
 'Restrict the inner halo to avoid drifting across the artwork');
assert.match(css,/@keyframes criloWheelNeonColors/);
assert.match(css,/hue-rotate\(360deg\)/);
assert.match(css,/@media\s*\(prefers-reduced-motion:reduce\)/);
assert.match(css,/pointer-events:none/);
assert.match(css,/\.wheel-neon-ring::after\s*\{[\s\S]*?filter:blur\(/);
assert.match(css,/\.wheel-neon-inner::after\s*\{[\s\S]*?filter:blur\(3px\)/);
assert.match(css,/html\[data-theme="dark"\] \.wheel-wrap \.wheel-neon-outer/);
assert.match(game,/function drawWheel\(\)/);
console.log('WHEEL_NEON_RINGS_PASS: bright stationary pastel trims, dark and reduced-motion handling');
