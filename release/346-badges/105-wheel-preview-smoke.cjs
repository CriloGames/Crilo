'use strict';
/* Read-only checks for the two-step Wheel artwork preview. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const leader=fs.readFileSync('leaderboard.html','utf8');
const profile=fs.readFileSync('profile.html','utf8');
const leadJS=fs.readFileSync('leaderboard.js','utf8');
const history=fs.readFileSync('spin-history.js','utf8');
const preview=fs.readFileSync('wheel-preview.js','utf8');
const css=fs.readFileSync('wheel-preview.css','utf8');
for(const [name,html] of [['leaderboard',leader],['Statistics',profile]]){
 assert.match(html,/wheel-preview\.css\?v=1/,'No shared responsive style in '+name);
 assert.match(html,/wheel-preview\.js\?v=1/,'No shared expanded drawing behavior in '+name);
 assert.equal((html.match(/wheel-preview\.js\?v=1/g)||[]).length,1,'Double-loaded viewer in '+name);
}
assert.match(leader,/leaderboard\.js\?v=\d+/,'Leaderboard script is loaded with a cache-busting version');
assert.match(profile,/spin-history\.js\?v=13/);
assert.ok(leader.includes('id="bestDrawing"'),'Top score art remains');
assert.match(leader,/id="bestDrawing"[^>]+role="button"[^>]+tabindex="0"/);
assert.match(leadJS,/CriloWheelPreview\?\.openFrom\(wheel\)/);
assert.match(leadJS,/CriloWheelPreview\?\.openFrom\(\$\('bestDrawing'\)\)/);
assert.match(history,/CriloWheelPreview\?\.openFrom\(wheel\)/);
assert.ok(!leadJS.includes('img.animate('),'Leaderboard thumbnail must not spin immediately');
assert.ok(!history.includes('image.animate('),'History thumbnail must not spin immediately');
assert.match(leadJS,/blank-wheel\.svg/);
assert.match(history,/blank-wheel\.svg/);
assert.match(preview,/dialog\.showModal\(\)/);
assert.match(preview,/wheelButton\.addEventListener\('click'/);
assert.match(preview,/image\.animate\(/);
assert.match(preview,/prefers-reduced-motion/);
assert.match(preview,/image\.src=src/);
assert.match(preview,/dialog\.addEventListener\('close'/);
assert.match(preview,/if\(event\.target===dialog\)close\(\)/);
assert.match(preview,/data:image/);
assert.doesNotMatch(preview,/criloDB|\.rpc\(|localStorage|fetch\(/,'Viewing cannot affect official Daily data');
assert.match(css,/#criloWheelPreview|\.crilo-wheel-preview-dialog/);
assert.match(css,/@media\(max-width:480px\)/);
console.log('WHEEL_PREVIEW_SMOKE_PASS: two step wheel expansion, exact artwork, safe close, no score writes.');
