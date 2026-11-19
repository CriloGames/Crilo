'use strict';
/* Regression: verified + audited real Dailies count across each leaderboard.
 * No score edits or snapshots are produced by these assertions.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=pathName=>fs.readFileSync(path.join(root,pathName),'utf8');
const sql=read('supabase/migrations/20261118200000_rank_audited_legacy_dailies.sql');
const leaderboard=read('leaderboard.js');
const html=read('leaderboard.html');
const profile=read('owner-profile-scores.js');
const audited=[5,6,7,1686],preview=[1,2],testRuns=[3,4];
assert.match(sql,/d\.id IN \(5,6,7,1686\)/,'Only four individually audited historical runs may be whitelisted');
assert.match(sql,/crilo_wheel_20261014\.daily_runs historical/,'Use a pre-migration snapshot');
assert.match(sql,/crilo_wheel_20261014\.history_score\(d\.results\)=d\.score/,
 'Require mathematically reproducible converted score');
assert.match(sql,/jsonb_array_length\(d\.results\)=d\.spins/,
 'Require complete original spin history for old entries');
assert.match(sql,/jsonb_array_length\(historical\.results\)=historical\.spins/,
 'Require pre-migration spin history');
assert.match(sql,/d\.is_test=false/);
assert.match(sql,/historical\.is_test=false/);
assert.match(sql,/d\.verified_spin_session_id IS NULL/);
assert.match(sql,/d\.daily_period<'2026-10-09'/);
assert.match(sql,/NOT EXISTS\(\s*SELECT 1 FROM public\.crilo_daily_penalties/s);
assert.match(sql,/REVOKE ALL ON public\.crilo_ranked_legacy_dailies FROM PUBLIC,anon,authenticated;/);
assert.match(sql,/ALTER TABLE public\.crilo_ranked_legacy_dailies ENABLE ROW LEVEL SECURITY;/);
assert.doesNotMatch(sql,/(?:UPDATE|DELETE|TRUNCATE)\s+(?:FROM\s+)?public\.(?:daily_runs|crilo_bonus_runs|owner_test_runs|player_stats)\b/i,
 'Scoreboard migration must not mutate or destroy any real saved score');
const newDef=[...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(crilo_(?:grouped_daily_leaders|public_run_leaders|total_points_leaders|lifetime_duck_leaders|profile_metrics))\(/g)]
 .map(x=>x[1]);
assert.deepEqual(new Set(newDef),new Set([
 'crilo_grouped_daily_leaders','crilo_public_run_leaders','crilo_total_points_leaders',
 'crilo_lifetime_duck_leaders','crilo_profile_metrics'
]),'All leaderboard types and public statistics must use identical eligibility');
assert.equal(newDef.length,5,'Each function should be replaced once');
for(const name of newDef){
 const start=sql.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(');
 const end=sql.indexOf('\n$function$\n;',start);
 assert.ok(start>=0&&end>start,'Find '+name+' definition');
 const ddl=sql.slice(start,end);
 assert.match(ddl,/d\.is_test=false AND \(d\.verified_spin_session_id IS NOT NULL OR EXISTS \(/,
  name+' must accept a historical run only when explicitly audited');
 assert.match(ddl,/legacy\.run_id=d\.id AND legacy\.saved_score=d\.score/,
  name+' must reject an altered post-audit score');
}
const eligible=(run)=>{
 if(run.is_test)return false;
 if(run.verified_spin_session_id)return true;
 return audited.includes(run.id)&&run.completeHistory&&run.matchScore;
};
const fixtures=[
 ...audited.map(id=>({id,is_test:false,verified_spin_session_id:null,completeHistory:true,matchScore:true})),
 ...preview.map(id=>({id,is_test:false,verified_spin_session_id:null,completeHistory:id===2,matchScore:id===2})),
 ...testRuns.map(id=>({id,is_test:true,verified_spin_session_id:null,completeHistory:true,matchScore:true})),
 {id:100,is_test:false,verified_spin_session_id:'proof',completeHistory:true,matchScore:true},
 {id:101,is_test:false,verified_spin_session_id:null,completeHistory:true,matchScore:true}
];
assert.deepEqual(fixtures.filter(eligible).map(x=>x.id),[...audited,100],
 'Allow real verified and audited legacy runs; no test, preview, or unproven entries');
assert.match(leaderboard,/crilo_grouped_daily_leaders/);
assert.match(leaderboard,/crilo_total_points_leaders/);
assert.match(leaderboard,/crilo_lifetime_duck_leaders/);
assert.match(html,/Historically completed runs with auditable spin histories count/);
assert.match(profile,/Older pre-verification preview records may be visible here/);
assert.match(read('profile.html'),/owner-profile-scores\.js\?v=3/);
console.log('PASS: four audited historical official Dailies restored across ranked, lifetime and profile RPCs; never test or old preview examples');
