'use strict';
const a=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('release/346-badges/067-wheel-reset-overflow-guard.sql','utf8');
function section(name){const i=src.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(');
 a.ok(i>=0,'Missing '+name);const e=src.indexOf('$function$;',i);a.ok(e>i);return src.slice(i,e);}
const period=section('set_crilo_daily_period'),spin=section('crilo_server_spin'),
 replay=section('crilo_validate_daily_run_replay'),badges=section('crilo_v3_run_matches');
a.match(period,/s\.id=new\.verified_spin_session_id/);
a.match(period,/s\.user_id=new\.user_id/);
a.match(period,/s\.finished_at is not null/);
a.match(period,/new\.daily_period:=v_period/);
a.match(period,/new\.run_date:=v_period/);
a.match(spin,/interval '22 hours 30 minutes'/);
a.match(spin,/s\.daily_period IS DISTINCT FROM/);
a.match(spin,/s\.spin_count>=500 OR s\.score>=9007199254740991/);
a.match(spin,/s\.remaining_spins:=0/);
a.match(spin,/LEAST\(9007199254740991::numeric-s\.score,base::numeric\*s\.multiplier\)/);
a.match(spin,/LEAST\(9007199254740991::numeric,s\.score::numeric\*2\)/);
a.match(spin,/LEAST\(9007199254740991::numeric,s\.multiplier::numeric\*3\)/);
a.match(replay,/NEW\.verified_spin_session_id IS NOT NULL/);
a.match(replay,/seen=500 OR replay_score>=9007199254740991/);
a.match(badges,/if i>500 then return false/);
console.log('PASS: completed session day binding, 30-minute reset grace, 500-spin/max-safe-score terminal proof and replay parity.');
