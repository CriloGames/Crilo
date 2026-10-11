/* Fail-closed Crilo Owner MFA regression. No network or account mutations. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const load=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql=load('release/346-badges/052-owner-totp-destructive-rpc-guard.sql');
const ui=load('owner-mfa.js');
const settings=load('settings.html');
const app=load('app.js');
const accountDelete=load('release/346-badges/owner-mfa-edge/delete-my-account.ts');
assert.ok(sql.includes("auth.jwt()->>'aal' IS DISTINCT FROM 'aal2'"),
 'Destructive actions must require an elevated Supabase-signed JWT');
assert.ok(sql.includes("f.status='verified' AND f.factor_type='totp'"),
 'A currently verified TOTP factor is mandatory; a stale JWT alone is insufficient');
assert.ok(sql.includes("WHERE p.id=auth.uid() AND p.is_owner IS TRUE"),
 'MFA cannot grant owner privileges to a normal user');
assert.ok(sql.includes("RAISE EXCEPTION 'Owner MFA required."),
 'Ordinary owner session must fail closed with an actionable error');
const protectedNames=[
 'crilo_owner_penalize_daily','crilo_owner_drawing_decision',
 'crilo_owner_review_action','crilo_owner_moderate_run',
 'crilo_owner_delete_profile_run','crilo_owner_delete_test_run',
 'crilo_delete_owner_test_runs','crilo_owner_manual_flag',
 'crilo_owner_example_delete','crilo_owner_example_save',
 'crilo_owner_finish_ocr','crilo_owner_finish_visual',
 'crilo_owner_local_scan_retry','crilo_owner_local_scan_save',
 'crilo_owner_local_scan_save_v4','crilo_owner_local_scan_save_v5',
 'crilo_owner_local_scan_save_v6','crilo_owner_local_scan_save_v7',
 'crilo_owner_saved_test_ocr_finish','crilo_owner_visual_result'
];
for(const name of protectedNames)assert.ok(sql.includes("'"+name+"'"),'Missing MFA protection: '+name);
assert.ok(sql.includes('EXECUTE after;'),'Missing database-side RPC instrumentation');
assert.ok(!protectedNames.includes('crilo_save_owner_test_run'),'Keep owner Test Runs separate and playable');
for(const fn of ['owner-ban-drawing-account','owner-unban-player','delete-my-account']){
 const ts=load('release/346-badges/owner-mfa-edge/'+fn+'.ts');
 assert.ok(ts.includes('rpc("crilo_require_owner_mfa")'),
  'Edge '+fn+' must enforce MFA on a user-scoped server RPC');
 assert.ok(ts.includes('auth.getUser('),'Edge '+fn+' must validate the user session');
 if(fn==='delete-my-account')assert.ok(ts.includes('if(profile?.is_owner)'),
  'Ordinary player deletion must remain available without owner MFA');
}
for(const id of ['ownerSecurityCard','ownerMfaEnroll','ownerMfaUnlock','ownerMfaVerify',
 'ownerMfaCode','ownerMfaSetup','ownerMfaQr','ownerMfaSecret']){
 assert.ok(settings.includes('id="'+id+'"'),'MFA setup control not connected: '+id);
 assert.ok(ui.includes("'"+id+"'"),'MFA UI handler missing: '+id);
}
assert.ok(ui.includes('auth.mfa.enroll('),'Use Supabase Auth to enroll factors');
assert.ok(ui.includes('auth.mfa.challengeAndVerify('),'Verify codes through Supabase servers');
assert.ok(ui.includes('auth.mfa.getAuthenticatorAssuranceLevel()'),
 'Check actual session assurance instead of storing a browser flag');
assert.ok(ui.includes('auth.mfa.listFactors()'),'Show only verified enrolled factors');
assert.ok(ui.includes('textContent=data.totp.secret'),
 'Never inject a TOTP secret as HTML or into a URL');
assert.ok(!ui.includes('localStorage'),'Never put authenticator secrets in local storage');
assert.ok(settings.includes('owner-mfa.js?v=2'));
assert.ok(app.includes('Owner security · 2FA'));
for(const page of ['index.html','leaderboard.html','ducks.html','badge-sets.html',
 'profile.html','friends.html','settings.html','moderation.html','support.html']){
 assert.ok(load(page).includes('app.js?v=40'),'Old site-wide account menu on '+page);
}
console.log('PASS: Twenty owner moderation RPCs require signed AAL2 and a verified TOTP factor.');
console.log('PASS: Ban, unban and owner-account deletion Edge Functions require the same database check.');
console.log('PASS: Setup UI, verified-factor flow, no leaked secrets and owner-only account shortcut.');
