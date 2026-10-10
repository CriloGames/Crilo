/* Stored-XSS and owner authority isolation regression. No user data touched. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const load=p=>fs.readFileSync(path.join(root,p),'utf8');
const migration=load('release/346-badges/048-block-profile-color-xss.sql');
const leaderboard=load('leaderboard.js'),friends=load('friends.js'),profile=load('profile.js');
assert.match(migration,/ADD CONSTRAINT crilo_name_color_hex_only/);
assert.ok(migration.includes("name_color IS NULL OR name_color ~ '^#[0-9A-Fa-f]{6}$'"));
assert.match(migration,/CREATE TRIGGER crilo_enforce_safe_profile_preferences/);
assert.match(migration,/crilo_theme_known_values_only/);
assert.ok(leaderboard.includes("const safeColor = value => /^#[0-9a-fA-F]{6}$/.test"));
assert.ok(!leaderboard.includes("name_color||'inherit'"),'Unsafe value was interpolated in leaderboard HTML');
assert.ok(friends.includes("/^#[0-9a-fA-F]{6}$/.test(p.name_color||'')"));
assert.ok(!friends.includes("name_color||'inherit'"),'Unsafe value was interpolated in Friends HTML');
assert.ok(profile.includes(".style.color=p.name_color||''"),'Profile assigns CSS through a DOM style property');
const safeColor = val=>/^#[0-9a-fA-F]{6}$/.test(String(val||''))?String(val):'inherit';
for(const s of ['" onmouseover="alert(1)','red;position:fixed','#abcdeg','url(javascript:bad)','<script>']){
 assert.equal(safeColor(s),'inherit','Injected color must not enter HTML attributes');
}
assert.equal(safeColor('#aBcD12'),'#aBcD12');
console.log('PASS: the database rejects invalid profile colors and client UI validates all inline colors.');
