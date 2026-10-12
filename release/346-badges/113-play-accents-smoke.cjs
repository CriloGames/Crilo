'use strict';
/* Regression: the experimental pastel border lines have been retired.
   Every page stays undecorated; only Play loads the Daily disabled state. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pages=['index.html','leaderboard.html','ducks.html','badge-sets.html',
 'profile.html','settings.html','friends.html','support.html',
 'shape-of-sound.html','domain/index.html','privacy.html','terms.html',
 'moderation.html','beetle-tricks.html','owner-analytics.html',
 'badge-art-audit.html','owner-dataset-lab.html','private-nsfw-qa.html'];
for(const page of pages){
 const html=read(page);
 assert.doesNotMatch(html,/play-accents\.css/,
  page+' must not load former decorative borders');
 assert.doesNotMatch(html,/pastel-(?:space|play)-traces(?:-night)?\.svg/,
  page+' must not use free-floating ornament art');
 if(page==='index.html'){
  assert.match(html,/href="daily-drawing-state\.css\?v=\d+"/,
   'Only the Play page needs the finished-Daily overlay styles');
  assert.doesNotMatch(html,/class="draw-finished-overlay"/,
   'Remove the old completion text overlay element');
 }else{
  assert.doesNotMatch(html,/daily-drawing-state\.css/,
   page+' should not load drawing-only styles');
 }
}
assert.ok(!fs.existsSync(path.join(root,'play-accents.css')),
 'Delete the unused line stylesheet, not merely hide it');
const css=read('daily-drawing-state.css');
assert.doesNotMatch(css,/--play-line-|--trace-|border-top-left-radius:calc\(/,
 'The drawing state stylesheet cannot revive decorative ribbons');
assert.doesNotMatch(css,/drop-shadow\(/,
 'No layered pastel edge effects');
assert.match(css,/#drawPanel\.daily-finished::after\{/,
 'The finished state should use a single translucent scrim');
assert.match(css,/pointer-events:none/,
 'Scrim must never intercept interaction');
console.log('NO_PASTEL_LINES_PASS: 18 pages clean; only Play shows a compact disabled editor notice');
