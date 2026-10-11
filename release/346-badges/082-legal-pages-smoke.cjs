'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const pages=["index.html","leaderboard.html","ducks.html","badge-sets.html","friends.html","profile.html","settings.html","support.html","shape-of-sound.html","beetle-tricks.html","owner-analytics.html"];
const read=x=>fs.readFileSync(x,'utf8');
const privacy=read('privacy.html'),terms=read('terms.html'),sitemap=read('sitemap.xml');
const css=read('legal.css');
for(const filename of [...pages,'privacy.html','terms.html']){
 const s=read(filename);
 for(const text of ['href="privacy.html"','href="terms.html"','crilogame@gmail.com','legal.css?v='])assert.ok(s.includes(text),filename+' missing '+text);
 assert.equal((s.match(/<footer\b/g)||[]).length,1,filename+' should show one footer');
 assert.match(s,/<\/body>/i);
}
assert.match(read('index.html'),/class="crilo-auth-legal"/);
assert.match(read('index.html'),/class="crilo-beetle-track"/);
assert.match(read('index.html'),/legal\.css\?v=6/,'Balanced footer layout must bypass cached CSS');
const footer=read('index.html').split('<footer class="crilo-site-footer"')[1].split('</footer>')[0];
const nav=footer.split('<nav class="crilo-legal-nav"')[1].split('</nav>')[0];
assert.equal((nav.match(/<a /g)||[]).length,3,'Footer must have exactly three legal links');
assert.doesNotMatch(nav,/<span[^>]*>·<\/span>/,'Remove separator dots causing perceived uneven spacing');
assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,
 'Desktop links should occupy three equal visual columns');
assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
 'Mobile links should use two symmetric columns');
assert.match(css,/\.crilo-legal-nav a:last-of-type\{\s*grid-column:1 \/ -1;/,
 'Contact must center under the first two links on mobile');
assert.ok(!css.includes('translateX(5px)'),'Remove ad hoc optical offsets');

assert.match(read('index.html'),/id="bugBeetle"/);
for(const p of [privacy,terms]){
 assert.match(p,/Last updated October 11, 2026/);
 assert.match(p,/class="crilo-legal-paper"/);
 assert.doesNotMatch(p,/support@crilo\.fun/);
}
assert.match(privacy,/Crilo does not sell users’ personal information/);
assert.match(privacy,/before putting them into effect/);
assert.match(privacy,/Global Privacy Control/);
assert.match(privacy,/do not submit a persistent visitor ID/);
assert.match(privacy,/Delete Account/);
assert.match(terms,/Do not cheat/);
assert.match(terms,/Tips through PayPal are completely voluntary/);
assert.match(sitemap,/https:\/\/crilo\.fun\/privacy\.html/);
assert.match(sitemap,/https:\/\/crilo\.fun\/terms\.html/);
assert.match(css,/@media\(max-width:600px\)/);
console.log('PASS: privacy and terms pages, real support contact, sign-in notice and shared links; no removal of beetle footer.');
