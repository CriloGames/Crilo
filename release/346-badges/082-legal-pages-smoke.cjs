'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const pages=["index.html","leaderboard.html","ducks.html","badge-sets.html","friends.html","profile.html","settings.html","support.html","shape-of-sound.html","beetle-tricks.html","owner-analytics.html"];
const secondary=[...pages.filter(x=>x!=="index.html"),"privacy.html","terms.html"];
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
assert.match(read('index.html'),/© 2026 CriloGames\. All rights reserved\./,'Owner copyright notice must appear on homepage');
assert.match(read('LICENSE'),/Copyright \(c\) 2026 CriloGames/);
assert.match(read('LICENSE'),/PROPRIETARY SOURCE CODE AND ASSETS/);
assert.match(read('LICENSE'),/Third-party libraries/);
assert.match(read('README.md'),/© 2026 CriloGames\. All rights reserved\./);
assert.match(read('README.md'),/\[LICENSE\]\(LICENSE\)/);
assert.match(read('CNAME'),/^crilo\.fun\s*$/,'Copyright changes must not change the live domain');
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

const sharedNav='<nav class="crilo-legal-nav" aria-label="Legal and contact links"><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Service</a><a href="mailto:crilogame@gmail.com?subject=Crilo%20Inquiry">Contact</a></nav>';
for(const filename of secondary){
 const file=read(filename);
 const foot=file.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0] || '';
 assert.ok(foot.startsWith('<footer class="crilo-simple-footer" aria-label="Crilo footer">'),filename+' footer does not use shared layout');
 assert.ok(foot.includes(sharedNav),filename+' footer links differ from the homepage design');
 assert.ok(foot.includes('<small class="crilo-legal-copy">© 2026 CriloGames. All rights reserved.</small>'),filename+' missing copyright');
 assert.match(file,/legal\.css\?v=7/,filename+' needs fresh shared footer stylesheet');
 assert.equal((foot.match(/<a /g)||[]).length,3,filename+' should retain exactly three legal links');
 assert.ok(!foot.includes('aria-hidden="true">·'),filename+' still has decorative separator dots');
}
assert.match(css,/\.crilo-simple-footer \.crilo-legal-nav\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(css,/@media\(max-width:600px\)\{[\s\S]*?\.crilo-simple-footer \.crilo-legal-nav\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.ok(css.includes('.crilo-simple-footer .crilo-legal-nav a:last-of-type{'),'Mobile contact link should be centered');
assert.ok(read('index.html').includes('class="crilo-beetle-track"'),'Homepage beetle remains unchanged');

assert.match(read('index.html'),/id="bugBeetle"/);
for(const p of [privacy,terms]){
 assert.match(p,/Last updated October (11|12), 2026/);
 assert.match(p,/class="crilo-legal-paper"/);
 assert.doesNotMatch(p,/support@crilo\.fun/);
}
assert.match(privacy,/Crilo does not sell users’ personal information/);
assert.match(privacy,/before putting them into effect/);
assert.match(privacy,/Global Privacy Control/);
assert.match(privacy,/do not submit a persistent visitor ID/);
assert.match(privacy,/Delete Account/);
assert.match(terms,/Do not cheat/);
assert.match(terms,/CriloGames reserves rights in original, copyrightable Crilo source code/);
assert.match(terms,/players’ rights in their own drawings and submissions/);
assert.match(terms,/Tips through PayPal are completely voluntary/);
assert.match(sitemap,/https:\/\/crilo\.fun\/privacy\.html/);
assert.match(sitemap,/https:\/\/crilo\.fun\/terms\.html/);
assert.match(css,/@media\(max-width:600px\)/);
console.log('PASS: privacy and terms pages, real support contact, sign-in notice and shared links; no removal of beetle footer.');
