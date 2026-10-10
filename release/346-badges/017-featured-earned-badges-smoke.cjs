/* Regression: the featured badge picker uses only earned active badges,
 * shows true rarity colors, persists immediate visual updates, and moves/removes
 * selected badges without changing the account's actual badge awards. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const script=fs.readFileSync(path.join(root,'profile.js'),'utf8');
const modelScript=fs.readFileSync(path.join(root,'badge-collection.js'),'utf8');
const html=fs.readFileSync(path.join(root,'profile.html'),'utf8');
const css=fs.readFileSync(path.join(root,'badge-collection.css'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'catalog-rules.json'),'utf8'));
const badges=catalog.map((b,i)=>({
 id:i+1,badge_key:b.key,name:b.name||b.key,description:b.condition||'',
 category:b.category||'other',requirement:{rarity:b.rarity||'common'},
 is_secret:Boolean(b.is_secret),sort_order:i+1
}));
assert.equal(badges.length,346);
assert.match(html,/id="featuredBadgeOptions"/);
assert.match(html,/id="featuredBadgeSearch"/);
assert.match(html,/id="featuredClear"/);
assert.match(html,/badge-collection\.css\?v=9/);
assert.match(html,/profile\.js\?v=95/);
assert.match(css,/\.featured-slot\.featured-filled\[data-badge-rarity\]/);
assert.match(css,/\.featured-pick-option\{/);
assert.ok(!css.includes('.featured-pick-option{--crilo-badge-accent:'),
 'A generic picker color would override individual badge rarities');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);
function fixture(earnedCount,preFeatured=[]){
 const nodes=new Map(),events={},saved=[];
 function node(id){
  if(nodes.has(id))return nodes.get(id);
  const states=new Set(['hidden']);
  const el={id,innerHTML:'',textContent:'',value:'',href:'',dataset:{},style:{},disabled:false,
   classList:{
    add(...xs){xs.forEach(x=>states.add(x))},
    remove(...xs){xs.forEach(x=>states.delete(x))},
    contains:x=>states.has(x),toggle(){return false}},
   addEventListener(){},querySelectorAll(){return []},
   querySelector(selector){return {focus(){el.lastFocusedChild=selector}}},
   contains(){return true},focus(){this.focused=true}};
  nodes.set(id,el);return el;
 }
 const user={id:'fixture-player',username:'Fixture',name_color:'#151515',account_code:'QA',is_owner:false};
 const owned=badges.slice(0,earnedCount).map((b,i)=>({
  badge_id:b.id,earned_at:new Date(Date.UTC(2026,9,9)+i*1000).toISOString()
 }));
 const tables={profiles:[user],badges,user_badges:owned,featured_badges:preFeatured,
  game_scores:[],daily_runs:[]};
 const db={from(table){
  const rows=tables[table]||[];
  const q={select(){return q},eq(){return q},order(){return q},limit(){return q},in(){return q},
   maybeSingle:async()=>({data:rows[0]||null,error:null}),
   single:async()=>({data:rows[0]||null,error:null}),
   then(ok,bad){return Promise.resolve({data:rows,error:null}).then(ok,bad)}};
  return q;
 },rpc:async(name,args)=>{
  if(name==='crilo_set_featured_badge'){saved.push(args);return {data:null,error:null}}
  return {data:name==='get_crilo_player_stats'?[{}]:{},error:null};
 }};
 const win={addEventListener:(n,fn)=>{events[n]=fn},
  CriloRarity:{classify:()=>({label:'common'})},CriloBadgeEvents:{track(){}}};
 const ctx={window:win,document:{getElementById:node,
  createElement:()=>node('created'),querySelectorAll:()=>[]},
  location:{search:''},URLSearchParams,Crilo:{user:{id:user.id},profile:user,esc},
  criloDB:db,localStorage:{getItem:()=>null},console,confirm:()=>false};
 vm.runInNewContext(modelScript,ctx,{filename:'badge-collection.js',timeout:1500});
 vm.runInNewContext(script,ctx,{filename:'profile.js',timeout:1500});
 return {node,events,saved,win};
}
function chooseSlot(instance,position){
 instance.node('featuredBadges').onclick({
  target:{closest:()=>({dataset:{position:String(position)},focus(){}})}});
}
function chooseBadge(instance,id){
 instance.node('featuredBadgeOptions').onclick({
  target:{closest:()=>({dataset:{badgeId:String(id)}})}});
}
async function run(){
 for(const count of [0,1,82,346]){
  const instance=fixture(count);
  await instance.events['crilo-auth-ready']();
  const rows=instance.node('featuredBadges').innerHTML;
  assert.equal((rows.match(/class="featured-slot/g)||[]).length,5);
  chooseSlot(instance,1);
  const options=instance.node('featuredBadgeOptions').innerHTML;
  assert.equal((options.match(/class="featured-pick-option/g)||[]).length,count,
   count+' earned selection count');
  for(const badge of badges.slice(count)){
   assert.ok(!options.includes('data-badge-id="'+badge.id+'"'),
    'An unearned badge must never be offered');
  }
  if(count===0){
   assert.match(options,/No earned badges yet/);
   assert.equal(instance.node('featuredSave').disabled,true);
  }else{
   assert.ok(options.includes('data-badge-rarity="'+
    instance.win.CriloBadgeCollection.rarity(badges[0])+'"'));
  }
  console.log('PASS '+count+' earned badges: picker offers exactly '+count+', never locked');
 }
 const fixtureWithExisting=fixture(82,[{position:1,badge_id:4}]);
 await fixtureWithExisting.events['crilo-auth-ready']();
 const row=fixtureWithExisting.node('featuredBadges');
 assert.ok(row.innerHTML.includes('data-badge-rarity="'+
  fixtureWithExisting.win.CriloBadgeCollection.rarity(badges[3])+'"'));
 assert.ok(row.innerHTML.includes(badges[3].name),'Saved featured badge renders on first load');

 // Slot 2: the badge already in slot 1 must look faded and be disabled,
 // but must still show its original rarity color and where it is featured.
 chooseSlot(fixtureWithExisting,2);
 const grid=fixtureWithExisting.node('featuredBadgeOptions');
 const originalMarkup=grid.innerHTML;
 const alreadyFeatured=originalMarkup.match(/<button[^>]*data-badge-id="4"[^>]*>[\s\S]*?<\/button>/)?.[0];
 assert.ok(alreadyFeatured,'Featured badge remains visible in search');
 assert.match(alreadyFeatured,/is-already-featured/,'Already-featured badge must be dimmed');
 assert.match(alreadyFeatured,/disabled/,'Already-featured badge cannot be selected');
 assert.match(alreadyFeatured,/Already featured · Slot 1/,'Explain why selection is unavailable');
 assert.match(alreadyFeatured,/data-badge-rarity="/,'Keep original rarity on dimmed badge');
 chooseBadge(fixtureWithExisting,4); // Mock a forged click on a disabled item
 assert.equal(fixtureWithExisting.node('featuredBadgeSelect').value,'',
  'Click cannot select the badge assigned to another slot');
 assert.equal(fixtureWithExisting.saved.length,0);

 // Defense in depth: a manually modified hidden input must also fail.
 fixtureWithExisting.node('featuredBadgeSelect').value='4';
 await fixtureWithExisting.node('featuredSave').onclick();
 assert.equal(fixtureWithExisting.saved.length,0,'Duplicate save must be rejected before RPC');
 assert.match(fixtureWithExisting.node('featuredStatus').textContent,/already featured/);
 fixtureWithExisting.node('featuredBadgeSelect').value='';

 // Choosing a different earned badge fills slot 2 without changing slot 1.
 chooseBadge(fixtureWithExisting,5);
 await fixtureWithExisting.node('featuredSave').onclick();
 assert.deepEqual(JSON.parse(JSON.stringify(fixtureWithExisting.saved[0])),
  {p_position:2,p_badge_id:5});
 let slots=row.innerHTML.split('<button type="button" class="featured-slot');
 assert.ok(slots[1].includes(badges[3].name),'Original slot remains populated');
 assert.ok(slots[2].includes(badges[4].name),'Second slot shows distinct badge');
 assert.equal(slots.length,6);

 // Editing slot 1: its own selected badge stays bright and selectable.
 chooseSlot(fixtureWithExisting,1);
 const ownMarkup=grid.innerHTML.match(/<button[^>]*data-badge-id="4"[^>]*>[\s\S]*?<\/button>/)?.[0];
 assert.ok(ownMarkup,'Own featured badge option exists');
 assert.doesNotMatch(ownMarkup,/is-already-featured/,'Current slot remains available');
 assert.doesNotMatch(ownMarkup,/disabled/,'Current badge can be reselected');
 assert.match(ownMarkup,/is-selected/,'Current badge remains selected');

 // Clearing slot 1 makes that badge selectable elsewhere again.
 await fixtureWithExisting.node('featuredClear').onclick();
 // The clear handler dispatches an async RPC but intentionally returns no promise.
 // Let its mocked RPC and post-save rendering finish before inspecting the slots.
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(fixtureWithExisting.saved[1].p_badge_id,null);
 slots=row.innerHTML.split('<button type="button" class="featured-slot');
 assert.ok(!slots[1].includes(badges[3].name),'Old badge removed');
 chooseSlot(fixtureWithExisting,2);
 const freed=grid.innerHTML.match(/<button[^>]*data-badge-id="4"[^>]*>[\s\S]*?<\/button>/)?.[0];
 assert.ok(freed);
 assert.doesNotMatch(freed,/is-already-featured|disabled/,'Freed badge is available again');
 chooseBadge(fixtureWithExisting,4);
 await fixtureWithExisting.node('featuredSave').onclick();
 assert.deepEqual(JSON.parse(JSON.stringify(fixtureWithExisting.saved[2])),
  {p_position:2,p_badge_id:4});
 assert.ok(row.innerHTML.includes(badges[3].name),'Previously featured badge can be reused once removed');
 assert.ok(css.includes('.featured-pick-option.is-already-featured:disabled'));
 console.log('PASS: already-featured badge dimmed and disabled; duplicate click/save rejected; own slot available; clearing frees selection.');
}
run().catch(e=>{console.error(e);process.exitCode=1});
