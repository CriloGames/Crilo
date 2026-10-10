/* Stale-session ban enforcement and legitimate verified Domain badge tests. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql=read('release/346-badges/050-deny-banned-stale-sessions.sql');
const game=read('domain/game.js');
const domainPage=read('domain/index.html');
for(const fn of [
 'crilo_begin_server_spin_session',
 'crilo_server_spin',
 'crilo_v3_record_event',
 'crilo_set_featured_badge',
 'send_friend_request'
])assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.'+fn+'('),fn+' must be locked');
assert.ok((sql.match(/public\.crilo_banned_accounts/g)||[]).length>=5,
 'Every exposed write path needs a persisted ban check, even with a cached JWT');
assert.ok(sql.includes("p_event='domain_set'")&&sql.includes("is_verified=true"),
 'A Domain badge must require a valid server-saved score');
assert.ok(sql.includes("p_event='badge_filter'")&&sql.includes('public.featured_badges'),
 'A featured badge exploration credit must require an actual featured badge');
const saved=game.indexOf("rpc('crilo_submit_domain_score'");
const badge=game.indexOf("CriloBadgeEvents?.track('domain_set')");
assert.ok(saved>=0&&badge>saved,'Domain badge credit must follow server verification');
assert.ok(!game.includes("syncDomainScore();window.CriloBadgeEvents?.track('domain_set')"),
 'Never award a completed-set badge before the score is verified');
assert.ok(domainPage.includes('game.js?v=11'),
 'Domain page must not load the old preverification badge code');
console.log('PASS: banned sessions cannot spin, send requests, change featured badges or claim new exploration badges.');
console.log('PASS: Domain-set badge credit follows a successful server-verified Domain score.');
