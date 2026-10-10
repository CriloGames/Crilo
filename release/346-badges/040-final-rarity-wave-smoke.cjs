/* Final HUD audio-synced visual wave, without a real DOM or paid assets.
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
assert.ok(start>=0&&end>start,'Cannot isolate the production score/rarity animation');
const animationSource=game.slice(start,end);
function node(text){
 const set=new Set(),attrs={};
 const el={textContent:text,children:[],style:{minWidth:''},
  classList:{add:k=>set.add(k),remove:k=>set.delete(k),contains:k=>set.has(k)},
  getAttribute:k=>attrs[k]??null,setAttribute:(k,v)=>{attrs[k]=v},
  removeAttribute:k=>{delete attrs[k]},
  getBoundingClientRect:()=>({width:text.length*20}),
  replaceChildren(...els){this.children=els;this.textContent=els.map(n=>n.textContent).join('')}
 };
 return el;
}
const els={score:node('20'),scoreTierText:node('COMMON')},timers=[];
let reducedMotion=false;
const document={createElement:()=>({textContent:'',className:'',attrs:{},
 style:{setProperty(k,v){this[k]=v}},setAttribute(k,v){this.attrs[k]=v}})};
const window={matchMedia:()=>({matches:reducedMotion})};
const helpers=new Function('$','document','window','setTimeout',
 animationSource+'\nreturn {playFinalScoreWave,resetFinalCelebration,notes:CRILO_FINAL_RARITY_NOTES};')(
 id=>els[id],document,window,(callback,delay)=>{timers.push({callback,delay})});
assert.equal(Object.keys(helpers.notes).length,7,'All seven melodies share animation timing');
const elapsed=helpers.playFinalScoreWave('common');
assert.ok(elapsed>=800&&elapsed<=1800,'Wave should be smooth but not overlong');
assert.deepEqual(els.score.children.map(x=>x.textContent),['2','0']);
assert.deepEqual(els.scoreTierText.children.map(x=>x.textContent),'COMMON'.split(''));
assert.equal(els.score.getAttribute('aria-label'),'20');
assert.equal(els.scoreTierText.getAttribute('aria-label'),'COMMON');
assert.equal(els.score.style.minWidth,'40px','Score width must be reserved to prevent shifting');
assert.equal(els.scoreTierText.style.minWidth,'120px','Rarity width must be reserved');
for(const id of ['score','scoreTierText']){
 const glyphs=els[id].children;
 assert.ok(glyphs.every(g=>g.attrs['aria-hidden']==='true'));
 assert.ok(glyphs.every(g=>g.style['--crilo-pop-delay']?.endsWith('ms')));
 for(let i=1;i<glyphs.length;i++)
  assert.ok(parseInt(glyphs[i].style['--crilo-pop-delay'])>
   parseInt(glyphs[i-1].style['--crilo-pop-delay']),'Wave must flow character by character');
}
const commonLetterDelays=els.scoreTierText.children.map(x=>x.style['--crilo-pop-delay']);
const commonLetterClasses=els.scoreTierText.children.map(x=>x.className);
assert.ok(commonLetterClasses.every(x=>x.includes('crilo-final-letter')));

for(const tier of Object.keys(helpers.notes)){
 helpers.resetFinalCelebration();
 els.score.textContent='12,345';
 els.scoreTierText.textContent=tier.toUpperCase();
 const duration=helpers.playFinalScoreWave(tier);
 assert.ok(duration>0,'No animation for '+tier);
 assert.equal(els.score.children.length,6);
 assert.equal(els.scoreTierText.children.length,tier.length);
 assert.equal(els.score.textContent,'12,345','Do not change final score');
 assert.equal(els.scoreTierText.textContent,tier.toUpperCase());
}
const lastTimer=timers.at(-1);lastTimer.callback();
assert.equal(els.score.textContent,'12,345');
assert.equal(els.scoreTierText.textContent,'MYTHIC');
assert.ok(!els.score.classList.contains('crilo-final-animate'));
assert.ok(!els.scoreTierText.classList.contains('crilo-final-animate'));
assert.equal(els.score.getAttribute('aria-label'),null);
assert.equal(els.scoreTierText.getAttribute('aria-label'),null);
reducedMotion=true;
assert.equal(helpers.playFinalScoreWave('mythic'),0,'Reduced-motion preference must disable wave');
assert.equal(els.score.children.length,6,'No new animation nodes under reduced motion');
assert.ok(!els.score.classList.contains('crilo-final-animate'));

assert.ok(css.includes('@keyframes crilo-final-score-pop'));
assert.ok(css.includes('@keyframes crilo-final-rarity-wave'));
assert.ok(css.includes('animation-delay:var(--crilo-pop-delay,0ms)'));
assert.ok(css.includes('.crilo-final-digit,.crilo-final-letter{animation:none!important}'));
assert.ok(html.includes('id="score"')&&html.includes('id="scoreTierText"'));
assert.ok(game.includes("if(spins<=0){")&&game.includes("playFinalScoreWave(rarity().color);"));
assert.ok(game.includes("setTimeout(()=>{if(guestRun&&!user)open('guestFinishModal');},Math.max(0,lastFinalAnimationMs))"));
console.log('PASS: seven rarity tiers have a smooth per-character synchronized wave.');
console.log('PASS: score digits pop, letters flow, labels and HUD widths stay stable.');
console.log('PASS: cleanup, reduced-motion and delayed guest overlay preserve UX.');
