'use strict';
/* The old decorative-edge audit now guards the deliberately simpler look. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const css=fs.readFileSync(path.join(root,'daily-drawing-state.css'),'utf8');
assert.match(css,/#drawPanel\.daily-finished\{/,
 'Completed editor should still look unavailable');
assert.match(css,/#drawPanel\.daily-finished::after\{/,
 'One gray translucent scrim should cover the completed editor');
assert.match(css,/background:rgba\(215,219,225,\.43\)/,
 'Light mode scrim should show the underlying disabled controls');
assert.match(css,/background:rgba\(55,60,70,\.39\)/,
 'Dark mode scrim should show the underlying disabled controls');
assert.match(css,/#drawPanel\.daily-finished>div:first-child\{[\s\S]*?opacity:1!important/,
 'The small completion label stays readable above the gray wash');
assert.match(css,/#drawPanel\.daily-finished \.draw-complete-copy strong\{/,
 'The lock reason is visible as a compact inline label');
assert.match(css,/#drawPanel\.daily-finished #drawPanelDescription,[\s\S]*?clip:rect\(0,0,0,0\)!important/,
 'The original accessible status is visually hidden without being removed');
assert.doesNotMatch(css,/content:\s*["'](?:Today|Test)/,
 'No completion text may be painted by CSS');
assert.doesNotMatch(css,/(?:filter:\s*drop-shadow|border-top:2\.5px|--trace-)/,
 'No decorative layered border lines may return');
assert.match(css,/\.drawing-tool\.active\{/,
 'Stale selected Pen/Fill styles must stay neutral');
assert.match(css,/body\.wheel-run-active #drawPanel\.daily-finished\{/,
 'Wheel layout should still reveal the disabled editor on completion');
assert.equal(fs.readFileSync(path.join(root,'CNAME'),'utf8').trim(),'crilo.fun');
console.log('QUIET_DAILY_EDITOR_PASS: clean border, compact lock note, translucent gray in both themes');
