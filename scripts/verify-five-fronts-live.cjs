/* Five Fronts online regression: authoritative 2–6-player rules plus page contracts.
 * Does not authenticate real players or write to Supabase. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const E=require('../five-fronts-core.js');
const original=read('five-fronts.js');
const online=read('five-fronts-live.js');
const html=read('five-fronts-live.html');
const engine=read('supabase/functions/five-fronts-live/engine.js');
const server=read('supabase/functions/five-fronts-live/index.js');
const migration=read('supabase/migrations/20261117160000_five_fronts_live_rooms.sql');
new Function(online);
new Function(server.replace(/^import .*?;\s*$/gm,'').replace(/Deno\.serve\([\s\S]*$/,''));
const pure=read('five-fronts-core.js');
const inner=pure.slice(pure.indexOf(" 'use strict';"),pure.lastIndexOf('\n});'));
assert.equal(engine,'// Server-side twin of five-fronts-core.js. No client-supplied game state is accepted.\nconst E=(()=>{\n'+inner+'\n})();\nexport default E;\n',
 'Edge engine must match the tested browser engine byte for byte');
for(const id of [...new Set([...online.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]))]){
 assert.ok(html.includes('id="'+id+'"'),'Missing live control: '+id);
}
for(const id of ['ffCreateRoom','ffJoinRoom','ffLiveRoom','ffInviteCode','ffCopyInvite','ffStartLive',
 'ffReturnBattle','ffLeaveLobby','ffSeats','ffMap','ffResources','ffStatePicker','ffCouncilModal']){
 assert.ok(html.includes('id="'+id+'"'),'Missing live UI '+id);
}
assert.match(html,/name="robots" content="noindex,nofollow"/,
 'Unlisted live rooms must not enter search engines while testing');
assert.match(html,/five-fronts-core\.js\?v=3/);
assert.match(html,/five-fronts-live\.js\?v=1/);
assert.match(online,/criloDB\.functions\.invoke\('five-fronts-live'/);
assert.match(online,/\.on\('postgres_changes'/);
assert.match(online,/crypto\.randomUUID\(\)/);
assert.match(online,/crilo-ff-live-room:/);
assert.doesNotMatch(online,/localStorage\.setItem\([^)]*JSON\.stringify\(match\)/,
 'Clients may not locally author a server game snapshot');
assert.match(server,/admin\.auth\.getUser\(token\)/);
assert.match(server,/crilo_banned_accounts/);
assert.match(server,/userId!==userId|user_id===userId/);
assert.match(server,/\.eq\("revision",room\.revision\)/,
 'Atomic revision match is required for concurrent multiplayer writes');
assert.match(server,/executeCommand\(game,member\.seat,/,
 'All commands must be applied as the authenticated seat');
assert.match(server,/recentActions/,
 'Retrying an already accepted command must not apply it twice');
assert.match(server,/origin&&!ALLOWED\.has\(origin\)/);
assert.doesNotMatch(server,/params\.game|body\.game|clientGame/,
 'Clients cannot send their own world state to the server');
assert.match(migration,/enable row level security/);
assert.match(migration,/ff_room_member_read/);
assert.match(migration,/ff_player_self_read/);
assert.match(migration,/revoke all on public\.ff_live_rooms,public\.ff_live_players from anon,authenticated;/);
assert.match(migration,/alter publication supabase_realtime add table public\.ff_live_rooms/);
const sharedView=read('five-fronts.html');
assert.match(sharedView,/href="five-fronts-live.html"/);
assert.match(read('test-games.html'),/href="five-fronts.html"/,
 'Keep the original solo entry intact');
assert.match(original,/function readSave\(\)/,
 'Do not delete existing private single-player saved games');

for(let players=2;players<=6;players++)for(let seed=1;seed<=10;seed++){
 const g=E.createMatch({countries:players,seed:1000+seed,online:true,fast:true});
 assert.equal(g.online,true);
 assert.equal(g.states.length,players*5);
 for(let seat=0;seat<players;seat++){
  assert.equal(E.ownedCount(g,seat),5);
  assert.equal(g.states.filter(s=>s.owner===seat&&s.capital).length,1);
 }
 const finalSeat=players-1;
 const capital=g.states.find(s=>s.owner===finalSeat&&s.capital);
 const other=g.states.find(s=>s.owner===0);
 assert.equal(E.train(g,finalSeat,capital.id).ok,true,
  'Players in later seats must control their own states');
 assert.equal(E.train(g,finalSeat,other.id).ok,false,
  'A member cannot recruit inside another player’s territory');
 const forbidden=g.states.find(s=>s.owner===finalSeat);
 assert.equal(E.march(g,0,forbidden.id,other.id,20).ok,false,
  'Player 1 must not issue Player '+players+' army orders');
 for(let step=0;step<60;step++)E.advance(g,5);
 assert.equal(g.time>=300,true);
 for(let seat=0;seat<players;seat++){
  const offer=g.pendingStrategies[seat];
  assert.ok(offer&&offer.options.length===3,'Every human seat has its own policy');
 }
 assert.equal(E.train(g,finalSeat,capital.id).ok,false,
  'One nation must choose its own directive before giving orders');
 assert.equal(E.applyStrategy(g,finalSeat,g.pendingStrategies[finalSeat].options[0]).ok,true);
 assert.equal(g.pendingStrategies[finalSeat],undefined);
 assert.ok(g.pendingStrategies[0],'The other human council must remain open');
 const before=g.time;
 E.advance(g,5);
 assert.ok(g.time>before,'The whole battle must keep running while a rival chooses a policy');
 assert.equal(g.countries[0].lastAction,'Preparing defenses',
  'AI must never take commands for human players in live games');
 for(let guard=0;guard<450&&!g.ended;guard++){
  for(const key of Object.keys(g.pendingStrategies||{})){
   const seat=Number(key);
   if(E.ownedCount(g,seat))E.applyStrategy(g,seat,g.pendingStrategies[seat].options[0]);
  }
  E.advance(g,5);
 }
 assert.ok(g.ended,'A live game must finish even if players disconnect');
 assert.ok(Number.isInteger(g.winner)&&g.winner>=0&&g.winner<players);
 assert.ok(g.time<=g.limit+1e-6);
}
console.log('PASS Five Fronts LIVE: 2–6 authenticated human seats, no AI, one winner, per-seat economy and councils, reconnect/lobby and safe Edge contracts');
