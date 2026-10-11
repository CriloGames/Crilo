'use strict';
/* Prevent accidental publishing of secrets in the GitHub Pages web root.
 * Read-only: never prints credentials, contacts services, or alters files.
 * Public anon/publishable Supabase keys are intentionally not classified
 * as secrets; service-role credentials and private keys are. */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..');
const allowed=new Set(['.html','.htm','.js','.mjs','.css','.json','.svg','.txt','.webmanifest','.xml']);
const nonWebDirs=new Set(['.git','.github','node_modules','release','sql','docs','research','emails']);
const signatures=[
  ['Supabase service secret',/sb_secret_[a-zA-Z0-9_-]{16,}/],
  ['Stripe live secret',/sk_live_[a-zA-Z0-9]{16,}/],
  ['Resend live secret',/re_[a-zA-Z0-9]{24,}/],
  ['GitHub personal token',/ghp_[a-zA-Z0-9]{30,}/],
  ['GitHub fine-grained token',/github_pat_[a-zA-Z0-9_]{40,}/],
  ['Private-key PEM',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Service-role env reference in browser JS',/\bSUPABASE_SERVICE_ROLE_KEY\b/],
  ['Server secret env reference in browser JS',/\bRESEND_API_KEY\b/]
];
let examined=0;
function inspect(dir,relative=''){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const rel=path.join(relative,entry.name),full=path.join(dir,entry.name);
  if(entry.isDirectory()){
   if(relative===''&&nonWebDirs.has(entry.name))continue;
   inspect(full,rel);continue;
  }
  if(!entry.isFile())continue;
  if(/^(?:\.env(?:\..+)?|credentials(?:\..+)?|id_rsa|id_ed25519)$/i.test(entry.name))
   throw new Error('Secret-like file must not be committed to the public site: '+rel);
  if(!allowed.has(path.extname(entry.name).toLowerCase()))continue;
  const contents=fs.readFileSync(full,'utf8');
  // SQL migrations and serverless functions have their own secure secret
  // handling; only client-deployable assets are scanned here.
  for(const [name,pattern] of signatures){
   if(pattern.test(contents)){
    throw new Error(name+' detected in publicly deployed file '+rel+
       '. Remove and rotate the credential immediately.');
   }
  }
  examined++;
 }
}
inspect(ROOT);
assert.ok(examined>=20,'Scanner did not walk the public site tree');
console.log('PASS: '+examined+' deployable text assets contain no known server secrets or private keys.');
