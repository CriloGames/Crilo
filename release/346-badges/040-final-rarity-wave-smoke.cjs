/* Regression: a single restrained final-score seal, no character splitting.
 * Run: node release/346-badges/040-final-rarity-wave-smoke.cjs
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=game.indexOf('const CRILO_FINAL_RARITY_NOTES=');
const end=game.indexOf('\nfunction sound(kind,tier=null){',start);
assert.ok(start>=0&&end>start,'Cannot isolate production final-score logic');
const source=game.slice(start,end);
function classes(){
 const set=new Set();
 return {add:k=>set.add(k),remove:k=>set.delete(k),contains:k=>set.has(k)};
}
let layouts=0,reducedMotion=false;
const panel={dataset:{rarity:'common'},classList:classes(),
 get offsetWidth(){layouts++;return 200;}};
const score={textContent:'20'},rarity={textContent:'COMMON'},timers=[];
const els={wheelScorePanel:panel,score,scoreTierText:rarity};
const helper=new Function('$','window','setTimeout',source+
 '\nreturn {playFinalScoreWave,resetFinalCelebration,notes:CRILO_FINAL_RARITY_NOTES};')(
 key=>els[key],{matchMedia:()=>({matches:reducedMotion})},
 (callback,delay)=>{timers.push({callback,delay})});
assert.equal(Object.keys(helper.notes).length,7,'Seven rarity sounds must remain');
const duration=helper.playFinalScoreWave('common');
assert.equal(duration,880,'Ending should not be a long animation');
assert.equal(layouts,1,'A real final spin restarts its one-time effect');
assert.ok(panel.classList.contains('crilo-final-settle'));
assert.equal(score.textContent,'20');
assert.equal(rarity.textContent,'COMMON');
assert.equal(score.children,undefined,'Never replace the score text with animated glyphs');
assert.equal(rarity.children,undefined,'Never replace rarity text with glyphs');
assert.equal(timers.at(-1).delay,940);
timers.at(-1).callback();
assert.ok(!panel.classList.contains('crilo-final-settle'),'End state must be still');
for(const tier of Object.keys(helper.notes)){
 panel.dataset.rarity=tier;score.textContent='12,345';
 rarity.textContent=tier.toUpperCase();
 assert.equal(helper.playFinalScoreWave(tier),880,'One animation for '+tier);
 assert.ok(panel.classList.contains('crilo-final-settle'));
 assert.equal(score.textContent,'12,345');
 assert.equal(rarity.textContent,tier.toUpperCase());
 helper.resetFinalCelebration();
 assert.ok(!panel.classList.contains('crilo-final-settle'),'New run must clear effect');
}
panel.dataset.rarity='rare';
assert.equal(helper.playFinalScoreWave('mythic'),0,'Do not reveal a mismatched tier');
reducedMotion=true;
assert.equal(helper.playFinalScoreWave('rare'),0,'Reduced motion should skip effect');
assert.ok(!panel.classList.contains('crilo-final-settle'));
reducedMotion=false;
helper.playFinalScoreWave('rare');
const stale=timers.at(-1);
helper.resetFinalCelebration();
helper.playFinalScoreWave('rare');
stale.callback();
assert.ok(panel.classList.contains('crilo-final-settle'),
 'Delayed cleanup from the previous run must not clear a new celebration');
assert.ok(css.includes('@keyframes crilo-final-score-settle'));
assert.ok(css.includes('@keyframes crilo-final-frame-ink'));
assert.ok(css.includes('@keyframes crilo-final-underline'));
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
assert.ok(!css.includes('.crilo-final-digit{'),'Old per-glyph animation must be removed');
assert.match(html,/style\.css\?v=\d+/);
assert.match(html,/game\.js\?v=\d+/);
assert.ok(game.includes("if(spins<=0){")&&game.includes("playFinalScoreWave(rarity().color);"));
assert.ok(game.includes("setTimeout(()=>{if(guestRun&&!user)open('guestFinishModal');},Math.max(0,lastFinalAnimationMs))"));
console.log('PASS: score and tier stay unchanged through one restrained ending.');
console.log('PASS: seven rarity levels, reduced motion, new runs and guest-delay cleanup.');
