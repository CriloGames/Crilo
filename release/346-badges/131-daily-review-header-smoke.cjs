'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const game=fs.readFileSync('game.js','utf8');
const home=fs.readFileSync('index.html','utf8');
const fit=fs.readFileSync('header-continuity.js','utf8');
const style=fs.readFileSync('header-fit.css','utf8');
assert.match(home,/id="reviewDailyBtn"[^>]*class="small-btn daily-review-btn hidden"/);
assert.match(home,/aria-controls="result"/);
assert.match(home,/daily-review\.css\?v=\d+/);
assert.match(game,/function renderResult\(r,stored=null\)/);
assert.match(game,/id,score,spins,upgrades,doubles,ducks,extra_spins,best_roll_points,rarity_label,rarity_score,rarity_odds,results,drawing,daily_period/);
assert.match(game,/async function showSavedDailyBadges\(record\)/);
assert.match(game,/\.eq\('run_id',record\.id\)/);
assert.match(game,/await showNewBadges\(prior,\{review:true\}\)/);
assert.match(game,/function toggleDailyReview\(\)/);
assert.match(game,/\$\('reviewDailyBtn'\)\.addEventListener\('click',toggleDailyReview\)/);
assert.match(game,/!data\|\|!!data\.blocked/);
assert.match(game,/reviewDailyBtn'\)\.classList\.add\('hidden'\)/);
assert.match(fit,/const needed=.*brand/);
assert.match(fit,/nav\.scrollWidth\+actions\.scrollWidth/);
assert.match(fit,/new MutationObserver\(scheduleHeaderFit\)/);
assert.match(style,/crilo-header-inline/);
assert.match(style,/crilo-header-stacked/);
assert.match(style,/\.topbar\.crilo-header-stacked nav\{[\s\S]*?justify-content:space-evenly!important/,
 'Only stacked desktop nav should distribute links evenly');
assert.match(style,/@media\(max-width:700px\)\{[\s\S]*?\.topbar nav\{[\s\S]*?justify-content:space-evenly/,
 'Narrowed or zoomed navigation must distribute links evenly');
for(const page of ['index.html','ducks.html','leaderboard.html','profile.html','settings.html','friends.html','badge-sets.html','moderation.html','owner-analytics.html','shape-of-sound.html','domain/index.html']){
 const html=fs.readFileSync(page,'utf8');
 assert.match(html,/header-fit\.css\?v=2/,'Missing shared dynamic header CSS: '+page);
 assert.match(html,/header-continuity\.js\?v=6/,'Old header JS cache: '+page);
}
console.log('DAILY_REVIEW_HEADER_SMOKE_PASS saved review, secure badge links, responsive shared header');