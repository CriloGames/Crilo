/* Permission and score-forgery regression: static controls only; no user data changed.
 * Run: node release/346-badges/047-owner-score-security-smoke.cjs
 * Run separately against production DB to verify effective role grants.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const domain=read('domain/game.js'),page=read('domain/index.html'),
 profile=read('profile.js'),profilePage=read('profile.html'),
 app=read('app.js'),config=read('supabase-config.js');
const scores=read('release/346-badges/044-domain-score-server-verification.sql');
const owner=read('release/346-badges/045-exclusive-owner-role.sql');
const triggers=read('release/346-badges/046-seal-trigger-only-rpcs.sql');
const publicData=JSON.parse(read('domain/domains.json'));
assert.equal(publicData.length,500,'Canonical Domain prices unexpectedly changed');
const match=scores.match(/FROM jsonb_to_recordset\(\$domains\$(.*?)\$domains\$::jsonb\)/s);
assert.ok(match,'Server answer list missing');
const secretAnswers=JSON.parse(match[1]);
assert.equal(secretAnswers.length,publicData.length);
const master=new Map(publicData.map(d=>[d.domain.toLowerCase(),d]));
for(const answer of secretAnswers){
 const existing=master.get(answer.domain);
 assert.ok(existing,'Unexpected domain '+answer.domain);
 assert.equal(Number(answer.price),Number(existing.answer_price_usd));
 assert.equal(answer.kind,existing.price_type);
}
assert.match(scores,/REVOKE INSERT,UPDATE,DELETE ON public\.game_scores FROM PUBLIC,anon,authenticated/);
assert.match(scores,/REVOKE ALL\(score,details,created_at,user_id,game_key,id\) ON public\.game_scores FROM authenticated/);
assert.match(scores,/IF uid IS NULL OR auth\.role\(\) <> 'authenticated'/);
assert.match(scores,/score_total:=score_total\+points/);
assert.match(scores,/IF row_count<>5 OR sale_count<>3 OR estimate_count<>2/);
assert.match(scores,/slider<0 OR slider>1000 OR dom=ANY\(used\)/);
assert.match(scores,/INSERT INTO public\.game_scores\(user_id,game_key,score,details,is_verified\)/);
assert.match(scores,/GRANT EXECUTE ON FUNCTION public\.crilo_submit_domain_score\(jsonb\) TO authenticated/);
assert.ok(domain.includes("rpc('crilo_submit_domain_score'"),'Game must use server-approved score RPC');
assert.ok(!/from\(['"]game_scores['"]\)\.insert/.test(domain),'Never let browser write Domain leaderboard rows');
assert.ok(domain.includes("slider:Number($('priceSlider').value)"),'Send slider, not a claimed points total');
assert.ok(page.includes('domainSaveStatus')&&page.includes('game.js?v=10'));
assert.ok(profile.includes(".eq('is_verified',true)")&&profile.includes(".eq('is_verified',false)"));
assert.ok(profile.includes('Legacy / local (unverified)'), 'Legacy scores must be visibly untrusted');
assert.ok(profilePage.includes('profile.js?v=97'));
assert.match(owner,/CREATE UNIQUE INDEX IF NOT EXISTS crilo_exactly_one_owner_guard/);
assert.match(owner,/WHERE is_owner IS TRUE/);
assert.match(owner,/REVOKE UPDATE \(account_code,username_changed_at\)/);
assert.match(triggers,/REVOKE EXECUTE ON FUNCTION/);
assert.ok(!/sb_secret_|SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(config),'Never embed service credentials in shipped client');
assert.ok(config.includes('sb_publishable_'),'Client must use publishable token');
assert.ok(app.includes("select('id,username,name_color,theme,sound_enabled,is_owner,account_code')"),'Owner UI reads server role');
console.log('PASS: 500 authoritative domain prices match the shipped game data.');
console.log('PASS: forged Domain scores cannot use direct client INSERT/UPDATE; server recomputes five rounds.');
console.log('PASS: verified scores, legacy labels, unique owner authority and internal RPC seals.');
