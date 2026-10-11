'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const sql=fs.readFileSync('release/346-badges/060-friend-ban-throttle.sql','utf8');
const names=['accept_friend_request','decline_friend_request','remove_crilo_friend','send_friend_request','update_crilo_settings'];
for(let i=0;i<names.length;i++){
 const name=names[i],next=names[i+1];
 const start=sql.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(');
 assert.ok(start>=0,'Missing function '+name);
 const end=next?sql.indexOf('CREATE OR REPLACE FUNCTION public.'+next+'(',start+20):sql.indexOf('-- Public/PostgREST',start+20);
 assert.ok(end>start,'Missing end boundary '+name);
 const definition=sql.slice(start,end);
 assert.match(definition,/SECURITY DEFINER SET search_path TO ''/,'Fixed search path: '+name);
 assert.match(definition,/auth\.uid\(\) IS NULL/,'Reject unsigned caller: '+name);
 assert.match(definition,/crilo_banned_accounts/,'Enforce current ban registry: '+name);
 assert.match(sql,new RegExp('REVOKE EXECUTE ON FUNCTION public\\.'+name+'\\('),'Revoke PUBLIC and anon: '+name);
}
const send=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.send_friend_request('),sql.indexOf('CREATE OR REPLACE FUNCTION public.update_crilo_settings('));
assert.match(send,/pg_advisory_xact_lock/,'Serialize concurrent requests');
assert.match(send,/interval '1 hour'/,'Require hourly rate cap');
assert.match(send,/interval '3 seconds'/,'Require burst limit');
assert.match(send,/sender_id=me AND updated_at/,'Rate cap scoped to sender');
const settings=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.update_crilo_settings('),sql.indexOf('-- Public/PostgREST'));
assert.match(settings,/WHERE id=auth\.uid\(\)/,'Only update the signed-in account');
console.log('PASS: 5 protected account RPCs; serialized friend-request throttling; no client-only ban checks.');
