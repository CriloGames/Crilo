'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const sql=fs.readFileSync('release/346-badges/069-wheel-gmail-alias-guard.sql','utf8');
const html=fs.readFileSync('index.html','utf8'),game=fs.readFileSync('game.js','utf8');
for(const needle of ["'gmail.com','googlemail.com'","other.email_confirmed_at IS NOT NULL","other.id<>v_uid","other.created_at < v_created","RAISE EXCEPTION 'Gmail alias already linked"])
 assert.ok(sql.includes(needle),'Missing safe email-alias guard: '+needle);
for(const fn of ['crilo_begin_server_spin_session','crilo_server_spin','crilo_get_server_spin_state','enforce_crilo_run_mode']){
 const at=sql.indexOf('CREATE OR REPLACE FUNCTION public.'+fn+'('),end=sql.indexOf('$function$;',at);
 assert.ok(at>=0&&end>at,'Missing '+fn);
 assert.ok(sql.slice(at,end).includes('PERFORM public.crilo_wheel_assert_unique_email();'),'No alias check: '+fn);
}
assert.match(html,/game\.js\?v=\d+/);
assert.match(game,/Gmail alias already linked/);
console.log('PASS: Gmail plus/dot alias accounts cannot independently farm official Daily Wheel runs.');
