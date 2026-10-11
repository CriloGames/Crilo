/* Static regression for the deployed guest bug-report hardening and core server authority.
 * Does not access live credentials or mutate any player records. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const report=read('release/346-badges/058-bug-report-edge/index.ts');
const harden=read('release/346-badges/059-security-linter-hardening.sql');
const serverGate=read('release/346-badges/003-verified-official-run-gate.sql');
const owner=read('release/346-badges/052-owner-totp-destructive-rpc-guard.sql');
const client=read('domain/game.js');
const config=read('supabase-config.js');
const frontend=['app.js','game.js','leaderboard.js','profile.js','friends.js','domain/game.js','supabase-config.js'].map(read).join('\n');
assert.ok(report.includes('"Access-Control-Allow-Origin":origin')&&report.includes('"Vary":"Origin"'),
 'Bug reports must not be cross-origin readable from arbitrary sites');
assert.ok(report.includes('Cross-site reporting is not allowed')&&report.includes('clientOrigin==="https://www.crilo.fun"'),
 'Both supported Crilo origins and no foreign origins');
assert.ok(report.includes('rpc("crilo_accept_bug_report"')&&report.includes('await readBoundedJson(req)'),
 'Bug-report intake must be atomic and enforce an actual request-byte limit');
assert.ok(report.includes('BUG_REPORT_COOLDOWN')&&report.includes('BUG_REPORT_DUPLICATE')&&report.includes('BUG_REPORT_RATE_LIMIT'),
 'Server transaction must reject burst, duplicate and excessive requests');
assert.ok(report.includes('const ipHash=')&&report.includes('new TextEncoder().encode'),
 'Bug reporter must not store raw client IP address');
assert.ok(report.includes('createClient(SUPABASE_URL,SERVICE_KEY') &&
 !/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/.test(frontend),
 'Service-role credentials belong in Edge secrets, never shipped JavaScript');
assert.ok(harden.includes("ALTER FUNCTION crilo_badge_prelaunch.ping() SET search_path = '';"),
 'Missing applied search-path hardening migration');
assert.ok(serverGate.includes('verified_spin_session_id')&&serverGate.includes('zy_crilo_verify_attached_spin_session')&&frontend.includes("rpc('crilo_server_spin'"),
 'Official Daily outcomes must be server-authoritative');
assert.ok(owner.includes("auth.jwt()->>'aal' IS DISTINCT FROM 'aal2'"),
 'Owner moderation requires elevated MFA');
assert.ok(client.includes("rpc('crilo_submit_domain_score'")&&!client.includes(".from('game_scores').insert("),
 'Domain score cannot be directly submitted to public table');
console.log('PASS: Guarded optional bug-report endpoint, duplicate/cooldown control, and no shipped server secrets.');
console.log('PASS: Authoritative Daily spins, owner MFA and protected Domain score insertion.');
console.log('LIMITATION: Published Domain answers permit advance lookup; server-issued hidden questions remain necessary for cheat-resistant rankings.');
