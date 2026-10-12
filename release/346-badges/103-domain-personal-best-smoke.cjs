'use strict';
/* One unified personal-best list. Scores remain server-protected for storage,
 * but verification is not part of the player's Domain UI or personal rankings. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const profile=fs.readFileSync('profile.js','utf8');
const page=fs.readFileSync('profile.html','utf8');
const domain=fs.readFileSync('domain/game.js','utf8');
const domainPage=fs.readFileSync('domain/index.html','utf8');
assert.match(page,/profile\.js\?v=100/);
assert.match(domainPage,/game\.js\?v=13/);
assert.match(profile,/\.eq\('game_key','domain'\)\.order\('score',\{ascending:false\}\)\.limit\(25\)/);
assert.ok(!profile.includes('Legacy / local (unverified)'));
assert.ok(!profile.includes('No server-verified Domain scores yet'));
assert.ok(!domain.includes('future verified scores'));
assert.ok(!domain.includes('Verifying your score on the server'));
assert.ok(!domain.includes('Verified! Your score'));
assert.ok(!domain.includes('Server-verified score:'));
assert.ok(domain.includes("crilo_submit_domain_score"),'Keep server integrity checks when saving');
const start=profile.indexOf('let local=[];\nif(target===Crilo.user?.id)');
const end=profile.indexOf("\nwindow.addEventListener('crilo-auth-ready',load);",start);
assert.ok(start>0&&end>start,'Unable to locate personal best display function');
const chunk=profile.slice(start,end).replace(/}\s*$/,'');
const render=new Function('target','Crilo','localStorage','domainScores','$',
 chunk+';return $("domainTop").innerHTML;');
function scenario(name,stored,local,expected,other=false){
 const domainTop={innerHTML:''};
 const Crilo={user:{id:'my-account'}};
 const localStorage={getItem(key){
  assert.equal(key,'crilo_domain_top5');
  return JSON.stringify(local);
 }};
 // The extraction shares production code unchanged, only redirecting the
 // 'domainTop' DOM lookup to our test element.
 const out=render(other?'someone-else':'my-account',Crilo,localStorage,
  stored.map(score=>({score})),id=>{
   assert.equal(id,'domainTop');return domainTop;
  });
 const values=[...out.matchAll(/class="domain-score-number">([\d,]+)<small/g)]
  .map(m=>Number(m[1].replaceAll(',','')));
 assert.deepEqual(values,expected,name+' wrong personal Top 5');
 assert.equal(values.length,Math.min(5,expected.length));
 assert.ok(!/Verified|Unverified|Legacy|server-verif/i.test(out),
  name+' should not expose storage/verification labels');
 for(let i=0;i<expected.length;i++){
  assert.ok(out.includes('class="domain-rank">#'+(i+1)),
   name+' must have correct rank numbers');
 }
 if(!expected.length)assert.match(out,/No Domain scores yet/);
}
scenario('no scores',[],[],[]);
scenario('legacy on-device only',[],[3252,3252,1022,1022,909],[3252,3252,1022,1022,909]);
scenario('saved scores only',[4020,3100,2500],[],[4020,3100,2500]);
scenario('server and local identical run',[3252,1022,909],[3252,1022,909],[3252,1022,909]);
scenario('genuine repeated server records',[3252,3252,1022],[3252,1022,1022],[3252,3252,1022,1022]);
scenario('combine all sources and sort',[2000,1500,4000],[3900,2500,1000,4200,4050],[4200,4050,4000,3900,2500]);
scenario('invalid historical entries',[-1,NaN,5001,4550],[Infinity,'bad',0,5040],[4550,0]);
scenario('other player never sees my local results',[99,55],[5000,4000],[99,55],true);
console.log('DOMAIN_PERSONAL_BESTS_PASS: unified Top 5, duplicates, missing data, privacy, cache, and safe server save.');
