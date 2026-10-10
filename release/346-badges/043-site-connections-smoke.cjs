/* Crilo cross-page connectivity audit — static, no player or DB mutation.
 * Run: node release/346-badges/043-site-connections-smoke.cjs
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const pages=['index.html','leaderboard.html','ducks.html','badge-sets.html',
 'profile.html','friends.html','settings.html','moderation.html','support.html','domain/index.html'];
const load=p=>fs.readFileSync(path.join(root,p),'utf8');
const pagesSource=Object.fromEntries(pages.map(p=>[p,load(p)]));
let checkedLinks=0;
for(const [page,html] of Object.entries(pagesSource)){
 const base=path.dirname(path.join(root,page));
 const links=[...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(m=>m[1]);
 for(const url of links){
  if(/^(?:https?:|mailto:|tel:|data:|#|\/\/)/i.test(url))continue;
  const clean=url.split(/[?#]/)[0];
  if(!clean)continue;
  const file=path.resolve(base,clean);
  assert.ok(fs.existsSync(file)||fs.existsSync(path.join(file,'index.html')),
   'Broken local resource on '+page+': '+url);
  checkedLinks++;
 }
}
for(const page of pages.filter(p=>p!=='domain/index.html')){
 const html=pagesSource[page];
 assert.ok(html.includes('id="accountBtn"')&&html.includes('id="accountMenu"'),
  'Broken or missing account header on '+page);
 assert.ok(html.includes('app.js?v=39'),'Stale/missing shared authentication script on '+page);
}
assert.ok(pagesSource['friends.html'].includes('friends.js?v=11'));
for(const id of ['copyInviteBtn','inviteLink','invitationNotice','friendSearch','searchBtn'])
 assert.ok(pagesSource['friends.html'].includes('id="'+id+'"'),'Friends control missing: '+id);
const friends=load('friends.js'),app=load('app.js');
assert.ok(friends.includes('friends.html?invite=')&&!friends.includes('/add/'),
 'Friends invitations must land on a hosted page, not a dead route');
assert.ok(friends.includes("criloDB.rpc('get_crilo_player_by_code'"),
 'Incoming invitation must resolve by account code');
assert.ok(friends.includes("criloDB.rpc('send_friend_request'"),
 'Invite action must send the official server-side friend request');
assert.ok(friends.includes("navigator.clipboard?.writeText"),
 'Copy invite button must actually copy a link');
assert.ok(app.includes("location.search).get('invite')"),
 'Cross-page magic-link sign-in must preserve invitation code');
const catalog=load('badge-collection.js'),sets=load('badge-sets.js'),events=load('badge-events.js'),profile=load('profile.js');
assert.ok(catalog.includes('window.CriloBadgeCollection='),
 'Profile and Collections must reuse one badge formatting model');
assert.ok(sets.includes('event.isTrusted')&&sets.includes('!set.open')&&!sets.includes("addEventListener('toggle'"),
 'Auto-opened badge sets must not award exploration badges without a real player click');
assert.ok(sets.includes("track('badge_detail')")&&!sets.includes("track('badge_filter')"),
 'Collection category expansion must not accidentally award Featured Badge change');
assert.ok(profile.includes("track('badge_filter')")&&profile.includes('crilo_set_featured_badge'),
 'Featured Badge change must be awarded only through a successful slot save');
assert.ok(!events.includes("if(node.closest('.badge-set summary'))"),
 'Badge Detail trigger must not rely on removed profile markup');
for(const page of ['index.html','leaderboard.html','ducks.html','badge-sets.html',
 'profile.html','settings.html','domain/index.html'])
 assert.ok(pagesSource[page].includes('badge-events.js?v=4'),
  'Updated badge exploration listeners not loaded on '+page);
assert.ok(pagesSource['badge-sets.html'].includes('badge-sets.js?v=7'),
 'Collection trigger cache must be current');
for(const id of ['ownerScoreManager','ownerScoreList','ownerScoreStatus'])
 assert.ok(pagesSource['profile.html'].includes('id="'+id+'"'),
  'Owner official run manager missing its UI: '+id);
assert.ok(pagesSource['profile.html'].includes('owner-profile-scores.js?v=2'),
 'Owner score manager exists but was never loaded');
const owner=load('owner-profile-scores.js');
assert.ok(owner.includes("criloDB.rpc('crilo_owner_penalize_daily'"),
 'Owner profile deletion must not bypass flags, streak reset and notification');
assert.ok(!owner.includes("criloDB.rpc('crilo_owner_delete_profile_run'"),
 'Owner profile cannot use the silent legacy deletion RPC');
assert.ok(owner.includes('reasons.find(')&&owner.includes('FINAL CONFIRMATION'),
 'A violation reason and final confirmation are mandatory');
const migration=load('release/346-badges/042-reject-legacy-official-delete.sql');
assert.ok(migration.includes('crilo_owner_delete_profile_run')&&
 migration.includes('crilo_owner_moderate_run')&&
 migration.includes("IF p_source='official' THEN")&&
 migration.includes("USING ERRCODE='22023'"),
 'Legacy official-score deletion must be rejected at the database boundary');
assert.ok(pagesSource['support.html'].includes('app.js?v=39'),
 'Support page must connect to shared sign-in rather than show a disconnected header');
console.log('PASS: '+pages.length+' site pages and '+checkedLinks+' internal asset/route links resolve.');
console.log('PASS: sign-in headers and friend invitation/copy actions are connected.');
console.log('PASS: Badge Detail/Featured Badge triggers, profile owner controls, reasoned deletion and Support sign-in are connected.');
