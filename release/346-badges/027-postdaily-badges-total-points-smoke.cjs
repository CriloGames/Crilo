/* Integration smoke: newly awarded badges, stats cleanup, lifetime points.
   All sample DB calls are mocks; no player account or run is written. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const index=file('index.html'),home=file('game.js'),profile=file('profile.js');
const profileHTML=file('profile.html'),leaderHTML=file('leaderboard.html');
const leader=file('leaderboard.js'),collectionSource=file('badge-collection.js');
const styles=file('style.css');
assert.match(index,/id="newBadgePanel"/);
assert.match(index,/id="dailyBadgePreviewDialog"/);
assert.match(index,/badge-collection\.js\?v=4/);
assert.match(index,/badge-collection\.css\?v=9/);
assert.match(index,/game\.js\?v=71/);
assert.match(profileHTML,/profile\.js\?v=97/);
assert.match(leaderHTML,/leaderboard\.js\?v=37/);
assert.match(leaderHTML,/data-tab="points">TOTAL POINTS/);
assert.match(styles,/\.stat-tile\.stat-total-points/);
assert.match(styles,/\.new-badge-list \.badge-top-chip\.new-badge-item/);
assert.ok(!profile.includes("['Best Daily Rank',s.best_daily_rank"));
assert.ok(!profile.includes("['Daily Wins',s.daily_wins"));
assert.ok(!profile.includes("['Podiums',s.podium_finishes"));
assert.ok(!profile.includes("['Top 10s',s.top_10_finishes"));
assert.ok(profile.includes("['Total Points',statsError&&metricsError?"));
assert.ok(profile.includes("'Total Points':'Your lifetime point total"));
assert.ok(home.includes("if(!isTest){const before=await criloDB.from('user_badges')"));
assert.ok(home.includes("if(priorBadges)await showNewBadges(priorBadges)"));
assert.ok(home.includes("if(isTest){\n // A Test Run must never fall through"));
assert.ok(!leader.includes("if(tab==='points')q="),
 'Cumulative points must not be computed from the highest single run');
assert.ok(leader.includes("crilo_total_points_leaders"));
assert.ok(leader.includes("setBestScoreRarity(null); // cumulative points"));

// Execute the very same shared collection model as Statistics.
const wrapper={};
vm.runInNewContext(collectionSource,{window:wrapper});
const collection=wrapper.CriloBadgeCollection;
const dom=new Map(),n=id=>{
 if(!dom.has(id)){
  const hidden=new Set(['hidden']);
  dom.set(id,{id,innerHTML:'',textContent:'',href:'',dataset:{},open:false,
   classList:{add:x=>hidden.add(x),remove:x=>hidden.delete(x),contains:x=>hidden.has(x)},
   showModal(){this.open=true},close(){this.open=false},focus(){this.focused=true}});
 }
 return dom.get(id);
};
const catalog=[
 {id:1,badge_key:'old',name:'Previously Earned',category:'Wheel',description:'Before this Daily',
  requirement:{rarity:'common'}},
 {id:2,badge_key:'fresh',name:'Brand New',category:'Wheel',description:'Complete a new Daily',
  requirement:{rarity:'rare'}},
 {id:3,badge_key:'fresh2',name:'Second Reward',category:'Score rarity',
  description:'An extra achievement',requirement:{rarity:'epic'}}
];
let awards=[{badge_id:1},{badge_id:'2'},{badge_id:3}];
const queries=[];
const db={from(table){
 const q={select(x){queries.push([table,'select',x]);return q},
  eq(){return q},
  in(column,ids){queries.push([table,'in',column,ids]);return q},
  then(cb){return Promise.resolve({data:table==='user_badges'?awards:
    catalog.filter(b=>b.id!==1),error:null}).then(cb)}};
 return q;
}};
const start=home.indexOf('async function showNewBadges(prior){'),
      stop=home.indexOf('function renderResult(r){',start);
assert.ok(start>=0&&stop>start);
const show=new Function('criloDB','$','Crilo','window','user',
 home.slice(start,stop)+';return showNewBadges')(
 db,n,{esc:x=>String(x).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')},
 {CriloBadgeCollection:collection},{id:'daily-player'});
(async()=>{
 await show(new Set(['1']));
 assert.equal(n('newBadgePanel').open,true);
 assert.equal(n('newBadgePanel').classList.contains('hidden'),false);
 assert.equal(n('newBadgeCount').textContent,'2 NEW BADGES UNLOCKED');
 assert.match(n('newBadgeList').innerHTML,/Brand New/);
 assert.match(n('newBadgeList').innerHTML,/Second Reward/);
 assert.doesNotMatch(n('newBadgeList').innerHTML,/Previously Earned/);
 assert.match(n('newBadgeList').innerHTML,/data-badge-rarity="rare"/);
 assert.match(n('newBadgeList').innerHTML,/data-badge-rarity="epic"/);
 const event={target:{closest:()=>({dataset:{badgeKey:'fresh'}})}};
 n('newBadgeList').onclick(event);
 assert.equal(n('dailyBadgePreviewDialog').open,true);
 assert.match(n('dailyBadgePreviewCard').innerHTML,/Complete a new Daily/);
 assert.match(n('dailyBadgePreviewCard').innerHTML,/data-badge-rarity="rare"/);
 assert.match(n('dailyBadgePreviewOpenSet').href,/badge=fresh/);
 n('dailyBadgePreviewClose').onclick();
 assert.equal(n('dailyBadgePreviewDialog').open,false);
 assert.ok(queries.some(q=>q[0]==='badges'&&q[1]==='in'&&q[3].length===2),
  'Only newly earned badge IDs should be looked up');
 // All awards were already owned before this Daily: the dropdown stays hidden.
 n('newBadgePanel').classList.add('hidden');
 await show(new Set(['1','2','3']));
 assert.equal(n('newBadgePanel').classList.contains('hidden'),true);
 console.log('PASS: only post-Daily new badges in rarity dropdown and exact Stats preview');
 console.log('PASS: no Test Run badge awarding, no stat tiles for difficult leaderboard placements');
})().catch(error=>{console.error(error);process.exitCode=1});
