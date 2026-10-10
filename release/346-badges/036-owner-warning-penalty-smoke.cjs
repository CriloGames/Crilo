'use strict';
/* Read-only regression: violation penalty interfaces and player-visible flows.
 No real account, run, badge, moderation write, or paid request. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const sql=read('release/346-badges/035-drawing-violation-warning.sql');
const feed=read('moderation-feed.js'),home=read('game.js'),
 profile=read('profile.js'),app=read('app.js'),leader=read('leaderboard.js');
const html=read('moderation.html'),index=read('index.html'),profileHTML=read('profile.html'),
 css=read('style.css');
for(const required of [
 'CREATE TABLE IF NOT EXISTS public.crilo_daily_penalties',
 'CREATE TABLE IF NOT EXISTS public.crilo_account_warnings',
 'CREATE TABLE IF NOT EXISTS public.crilo_moderation_notices',
 'CREATE OR REPLACE FUNCTION public.crilo_owner_penalize_daily',
 'CREATE OR REPLACE FUNCTION public.crilo_reject_penalized_daily',
 'CREATE OR REPLACE FUNCTION public.crilo_warning_current_streak',
 'CREATE OR REPLACE FUNCTION public.crilo_my_daily_penalty',
 'CREATE OR REPLACE FUNCTION public.crilo_my_moderation_notices',
 'CREATE OR REPLACE FUNCTION public.crilo_read_moderation_notice',
 'CREATE OR REPLACE FUNCTION public.crilo_public_warning_status'
 ])assert.ok(sql.includes(required),required+' absent');
assert.ok(sql.includes('PRIMARY KEY(user_id,daily_period)'),'Penalty must be locked to original daily period');
assert.ok(sql.includes('original_run_id bigint NOT NULL UNIQUE'),'Never penalize same run twice');
assert.ok(sql.includes('RLS')||sql.includes('ROW LEVEL SECURITY'));
assert.match(sql,/IF auth\.uid\(\) IS NULL OR NOT EXISTS\([\s\S]*?is_owner=true/);
assert.match(sql,/DELETE FROM public\.daily_runs d WHERE d\.id=p_run_id/);
assert.match(sql,/DELETE FROM public\.user_badges ub WHERE ub\.user_id=v_user AND ub\.run_id=p_run_id/);
assert.match(sql,/DELETE FROM public\.featured_badges fb/);
assert.match(sql,/last_streak_reset_at=clock_timestamp\(\)/);
assert.match(sql,/UPDATE public\.player_stats SET current_streak=public\.crilo_warning_current_streak/);
assert.match(sql,/INSERT INTO public\.crilo_moderation_notices/);
assert.match(sql,/WHERE id=p_id AND user_id=auth\.uid\(\)/,'Notice acknowledgement must be owner-scoped');
assert.ok(!sql.includes('INSERT INTO public.crilo_banned_accounts'),
 'First warning must never automatically ban the user');
assert.ok(sql.includes("BEFORE INSERT ON public.daily_runs"),'Blocked period must enforce through database trigger');
assert.ok(sql.includes("crilo_begin_server_spin_session"),'Must block beginning another server spin session');
assert.ok(sql.includes("crilo_server_spin(uuid)"),'Must reject already-open sessions in penalized periods');
assert.ok(sql.includes("crilo_profile_metrics(uuid)"),'Profile current streak must read reset cutoff');
assert.ok(feed.includes("'crilo_owner_penalize_daily'"),'Drawing Review must use one atomic penalty RPC');
assert.ok(leader.includes("'crilo_owner_penalize_daily'"),'Leaderboard must require reasoned penalty');
assert.ok(leader.includes("if(source==='official'){")&&leader.includes("p_reason:selected[1]"),
 'Official leaderboard removal must require an owner-selected penalty reason');
assert.ok(html.includes('id="reviewViolationReason"'),'Owner should choose violation category');
assert.ok(profile.includes("'crilo_public_warning_status'"),'Public profile flag must use owner-controlled reason');
assert.ok(profileHTML.includes('id="publicAccountWarning"'),'Public warning container missing');
assert.ok(css.includes('.crilo-warning-popover'),'Accessible hover/focus warning explanation missing');
assert.ok(index.includes('game.js?v=70'));
assert.ok(profileHTML.includes('profile.js?v=96'));
assert.ok(app.includes('crilo_my_moderation_notices'));
assert.ok(app.includes('crilo_read_moderation_notice'));
assert.ok(app.includes('DAILY DRAWING REMOVED — ACCOUNT FLAGGED'));

// Execute the actual Home Daily eligibility function with a fake signed-in
// player. The backend blocks these periods too: UI is only helpful feedback.
const begin=home.indexOf('async function checkPlayed(){');
const end=home.indexOf('\nfunction ',begin+1);
assert.ok(begin>=0&&end>begin,'Could not isolate Home Daily check');
const runFunction=home.slice(begin,end);
function nodeFactory(){
 const nodes=new Map();
 return id=>{
  if(!nodes.has(id)){
   const flags=new Set(['hidden']);
   nodes.set(id,{textContent:'',disabled:false,title:'',
    classList:{add:x=>flags.add(x),remove:x=>flags.delete(x),contains:x=>flags.has(x)},
    querySelector:()=>({textContent:''})});
  }
  return nodes.get(id);
 };
}
async function homeCase(blocked){
 const $=nodeFactory();let starts=0;
 const criloDB={
  rpc:async(name,args)=>{
   assert.equal(name,'crilo_my_daily_penalty');assert.equal(args.p_period,'2026-10-10');
   return {data:blocked?{blocked:true,reason:'Sexual or genital drawing'}:{blocked:false},error:null};
  },
  from(name){assert.equal(name,'daily_runs');
   return {select(){return this},eq(){return this},maybeSingle:async()=>({data:null,error:null})};
  }
 };
 const f=new Function('$','user','profile','criloDB','Crilo','beginRun',
  'let officialRun=null;'+runFunction+'; return checkPlayed')(
   $, {id:'u1'},{is_owner:false},criloDB,{dailyPeriod:()=> '2026-10-10'},
   ()=>{starts++});
 await f();
 return {starts,nodes:$};
}
(async()=>{
 const blocked=await homeCase(true);
 assert.equal(blocked.starts,0,'Penalty must not display a playable wheel');
 assert.ok(blocked.nodes('playedText').textContent.includes('one official warning'));
 assert.ok(blocked.nodes('playedText').textContent.includes('cannot replay'));
 assert.ok(blocked.nodes('spinButton').classList.contains('hidden'));
 const clean=await homeCase(false);
 assert.equal(clean.starts,1,'New clean Daily period should be playable');

 // Isolate the live bell rendering code and provide one account-only notice
 // alongside a mock pending friend request.
 const start=app.indexOf('async function updateFriendBell(){');
 const stop=app.indexOf("window.addEventListener('crilo-friends-changed'",start);
 assert.ok(start>=0&&stop>start,'Could not isolate shared bell');
 const dom=new Map(),get=id=>{
  if(!dom.has(id)){
   const flags=new Set(['hidden']);
   dom.set(id,{id,innerHTML:'',textContent:'',style:{},dataset:{},
    classList:{add:v=>flags.add(v),remove:v=>flags.delete(v),
     toggle(v,on){if(on)flags.add(v);else flags.delete(v)},
     contains:v=>flags.has(v)}});
  }return dom.get(id);
 };
 const host={insertBefore(){}};
 get('friendBellWrap');
 const document={
  querySelector:q=>q==='.header-actions'?host:null,getElementById:get
 };
 let acknowledged=null;
 const criloDB={
  from:()=>({select(){return this},eq(){return this},order(){return this},limit:async()=>({data:[],error:null})}),
  rpc:async(name,args)=>{
   if(name==='crilo_my_moderation_notices')
    return {data:[{id:31,daily_period:'2026-10-10',
     reason:'Sexual or genital drawing',removed_score:84,
     created_at:'2026-10-10T12:00:00Z',read_at:null}],error:null};
   if(name==='crilo_read_moderation_notice'){
    acknowledged=args.p_id;return {data:true,error:null};
   }
   throw Error('Unexpected bell RPC '+name);
  }
 };
 const clock=()=>new Date('2026-10-10T13:00:00Z');
 const bell=new Function('Crilo','criloDB','document','esc','relativeTime',
  app.slice(start,stop)+';return updateFriendBell')(
   {user:{id:'victim'}},criloDB,document,x=>String(x).replace(/</g,'&lt;'),
   ()=> '1H AGO');
 await bell();
 assert.equal(get('friendBellCount').textContent,'1');
 assert.ok(get('friendBellItems').innerHTML.includes('Sexual or genital drawing'));
 assert.ok(get('friendBellItems').innerHTML.includes('84 points'));
 assert.ok(get('friendBellItems').innerHTML.includes('one official warning'));
 // No automatic acknowledgment before a real click.
 assert.equal(acknowledged,null);
 // Guard event delegation: a notice can only be marked read by its owner.
 assert.ok(get('friendBellItems').innerHTML.includes('data-moderation-notice="31"'));
 await get('friendBellItems').onclick({target:{closest:()=>({dataset:{moderationNotice:'31'}})}});
 assert.equal(acknowledged,31,'Only the tapped notice can be acknowledged');
 console.log('PASS: locked Daily vs next eligible period, public one-warning flag, private notice, owner reason');
 console.log('PASS: atomic penalty SQL, badges and points cleanup, cutoff streak, no auto bans');
})().catch(e=>{console.error(e);process.exitCode=1});
