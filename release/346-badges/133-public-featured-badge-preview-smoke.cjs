'use strict';
/* Featured badge previews: owner editing stays private; any player can open
 * a different player's earned featured badge, including those outside Top 50. */
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const source=fs.readFileSync('profile.js','utf8');
const shared=fs.readFileSync('badge-collection.js','utf8');
const page=fs.readFileSync('profile.html','utf8');
const css=fs.readFileSync('badge-collection.css','utf8');
const defs=JSON.parse(fs.readFileSync('release/346-badges/catalog-rules.json','utf8'));
assert.equal(defs.length,346);
assert.match(page,/profile\.js\?v=103/);
assert.match(page,/badge-collection\.css\?v=10/);
assert.match(css,/\.featured-slot\.featured-viewable\{cursor:pointer\}/);
const badges=defs.map((b,i)=>({id:i+1,badge_key:b.key,name:b.name,
 description:b.condition,category:b.category,requirement:{rarity:b.rarity},
 is_secret:false,sort_order:i+1}));
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allEarned=badges.map((b,i)=>({badge_id:b.id,earned_at:new Date(1770000000000+i*1000).toISOString()}));
function fixture({mine=false,featuredBadge=badges[0],missingBadge=false}={}){
 const events={},nodes=new Map(),calls=[];
 function node(id){
  if(nodes.has(id))return nodes.get(id);
  const classes=new Set(['hidden']);
  const el={id,innerHTML:'',textContent:'',href:'',value:'',dataset:{},
   classList:{add(x){classes.add(x)},remove(x){classes.delete(x)},contains(x){return classes.has(x)},toggle(){return false}},
   querySelector(){return {focus(){}}},querySelectorAll(){return []},
   contains(){return true},focus(){this.focused=true},open:false,
   showModal(){this.open=true},close(){this.open=false;this.onclose?.()}};
  nodes.set(id,el);return el;
 }
 const player={id:'profile-owner',username:'OwnerOfBadges',name_color:'#17191e',is_owner:false};
 const viewer=mine?player:{id:'visitor',username:'Visitor',name_color:'#17191e',is_owner:false};
 const earned=missingBadge?allEarned.filter(b=>b.badge_id!==featuredBadge.id):allEarned;
 const tables={profiles:[player],badges,user_badges:earned,
  featured_badges:[{user_id:player.id,position:1,badge_id:featuredBadge.id}],
  daily_runs:[],game_scores:[]};
 const db={from(name){
  const data=tables[name]||[];
  const q={select(){return q},eq(){return q},in(){return q},order(){return q},limit(){return q},
   maybeSingle:async()=>({data:data[0]||null,error:null}),
   single:async()=>({data:data[0]||null,error:null}),
   then(ok,bad){return Promise.resolve({data,error:null}).then(ok,bad)}};
  return q;
 },rpc:async(name,args)=>{
  calls.push(name);
  return {data:name==='get_crilo_player_stats'?[{}]:{},error:null};
 }};
 const context={window:{addEventListener(name,fn){events[name]=fn},
  CriloRarity:{classify:()=>({label:'common'})}},
  document:{getElementById:node,querySelectorAll:()=>[],createElement:()=>node('created')},
  location:{search:mine?'':'?id=profile-owner'},URLSearchParams,
  Crilo:{user:viewer,profile:viewer,esc:escape},criloDB:db,
  localStorage:{getItem:()=>null},console,confirm:()=>false};
 vm.runInNewContext(shared,context,{filename:'badge-collection.js',timeout:2000});
 vm.runInNewContext(source,context,{filename:'profile.js',timeout:2000});
 return {events,node,calls,model:context.window.CriloBadgeCollection};
}
async function test(){
 const tmp=fixture();
 const top=tmp.model.bestEarned(badges,allEarned,50);
 assert.equal(top.length,50);
 const featuredBadge=badges.find(b=>!top.some(t=>t.badge_key===b.badge_key));
 assert.ok(featuredBadge,'Need a featured badge outside Top 50 to catch filtering bugs');
 const guest=fixture({featuredBadge});
 await guest.events['crilo-auth-ready']();
 const markup=guest.node('featuredBadges').innerHTML;
 assert.match(markup,/class="featured-slot featured-viewable featured-filled"/);
 assert.ok(markup.includes('data-badge-key="'+escape(featuredBadge.badge_key)+'"'));
 assert.ok(markup.includes('View '+escape(featuredBadge.name)+' badge details'));
 assert.equal(markup.match(/<button type="button" class="featured-slot/g).length,5);
 assert.equal((markup.match(/ disabled/g)||[]).length,4,'Unfilled visitor slots remain inactive');
 let returned=false;
 const slot={dataset:{badgeKey:featuredBadge.badge_key},focus(){returned=true}};
 guest.node('featuredBadges').onclick({target:{closest:()=>slot}});
 assert.equal(guest.node('badgePreviewDialog').open,true,'Visitor click should open badge details');
 assert.equal(guest.node('badgePreviewCard').innerHTML,
  guest.model.tileHTML(featuredBadge,true,escape,{expanded:true,interactive:false}),
  'Featured badge detail must be identical to collection detail');
 assert.ok(guest.node('badgePreviewOpenSet').href.endsWith(
  'id=profile-owner&badge='+encodeURIComponent(featuredBadge.badge_key)));
 guest.node('badgePreviewClose').onclick();
 assert.equal(returned,true,'Closing the details dialog restores focus to the chosen slot');
 assert.ok(!guest.calls.includes('crilo_set_featured_badge'),
  'Viewing another player must not call the mutation RPC');
 const unearned=fixture({featuredBadge,missingBadge:true});
 await unearned.events['crilo-auth-ready']();
 assert.equal(unearned.node('featuredBadges').innerHTML.includes('featured-viewable'),false,
  'Inconsistent/unearned featured badges must never expose secret details');
 const mine=fixture({mine:true,featuredBadge});
 await mine.events['crilo-auth-ready']();
 assert.match(mine.node('featuredBadges').innerHTML,/featured-editable featured-filled/);
 assert.doesNotMatch(mine.node('featuredBadges').innerHTML,/featured-viewable/);
 mine.node('featuredBadges').onclick({target:{closest:()=>({dataset:{position:'1'},focus(){}})}});
 assert.equal(mine.node('featuredPicker').classList.contains('hidden'),false,
  'Clicking own featured slot must still open the editor');
 assert.equal(mine.node('badgePreviewDialog').open,false);
 console.log('PUBLIC_FEATURED_BADGE_PREVIEW_PASS visitor, Top 50 overflow, detail/deep link, focus, locked slots, owner picker');
}
test().catch(e=>{console.error(e);process.exitCode=1});
