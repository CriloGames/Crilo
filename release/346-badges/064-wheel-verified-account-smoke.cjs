'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const s=fs.readFileSync('release/346-badges/064-wheel-verified-account-guard.sql','utf8');
for(const fn of ['crilo_begin_server_spin_session','crilo_server_spin','crilo_get_server_spin_state','enforce_crilo_run_mode']){
 const a=s.indexOf('CREATE OR REPLACE FUNCTION public.'+fn+'('),z=s.indexOf('$function$;',a);
 assert.ok(a>=0&&z>a,'Missing '+fn);
 const fragment=s.slice(a,z);
 for(const proof of [/auth\.users au/,/au\.is_anonymous IS FALSE/,/au\.email_confirmed_at IS NOT NULL/,/au\.banned_until/,/JOIN public\.profiles pr/])
  assert.match(fragment,proof,fn+' must verify account identity');
}
console.log('PASS: all four Daily entry/gate functions reject anonymous, unverified, suspended or profileless users.');
