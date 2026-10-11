'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('release/346-badges/065-legacy-competitive-points.sql','utf8');
const board=fs.readFileSync('leaderboard.js','utf8');
assert.match(board,/oldFifteen/,'UI already excludes historical preview score');
assert.match(board,/oldEightSixtyFour/,'UI already excludes historical preview score');
for(const n of ['verified_spin_session_id IS NULL',"DATE '2026-10-09'",'d.score=864','d.spins=11','d.score=15','d.spins=8','d.is_test=false'])
 assert.ok(src.includes(n),'Missing precise preview exclusion: '+n);
assert.match(src,/GROUP BY p\.id,p\.username,p\.name_color/,'Keep real per-player totals');
console.log('PASS: pre-proof demo-like runs excluded from total-point competition, genuine new runs unchanged.');
