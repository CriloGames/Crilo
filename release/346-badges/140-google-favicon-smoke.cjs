'use strict';
// Google's favicon in organic search requires a crawlable, square site icon
// advertised by the HOME page. Protect the exact root file and canonical URL.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const expected='<link rel="icon" type="image/png" sizes="48x48" href="https://crilo.fun/favicon.png">';
const pages=[
 'index.html','leaderboard.html','ducks.html','friends.html','profile.html',
 'settings.html','badge-sets.html','support.html','privacy.html','terms.html',
 'shape-of-sound.html','beetle-tricks.html','moderation.html',
 'owner-analytics.html','domain/index.html'
];
const png=fs.readFileSync('favicon.png');
assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10],'Favicon must be a real PNG');
const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
assert.equal(width,height,'Google favicon must be square');
assert.ok(width>=48,'Prefer a 48px+ favicon for readable Google search results');
assert.ok(png.length>100,'Icon file must not be blank');
assert.equal(fs.readFileSync('CNAME','utf8').trim(),'crilo.fun','Do not change website domain');
const robots=fs.readFileSync('robots.txt','utf8');
assert.match(robots,/User-agent:\s*\*/);
assert.match(robots,/Allow:\s*\//);
assert.doesNotMatch(robots,/Disallow:\s*\/(?:$|favicon)/m,'Google must be able to request the icon');
const home=fs.readFileSync('index.html','utf8');
assert.match(home,/<link rel="canonical" href="https:\/\/crilo\.fun\/"/);
for(const page of pages){
 const html=fs.readFileSync(page,'utf8');
 assert.equal(html.split(expected).length-1,1,page+': use one consistent PNG link');
 assert.doesNotMatch(html,/<link\s+rel="icon"[^>]*favicon\.ico/i,page+': avoid two conflicting search icon candidates');
}
console.log('CRILO_GOOGLE_FAVICON_OK '+width+'x'+height+' pixel, square, crawlable root icon; '+pages.length+' pages agree');
