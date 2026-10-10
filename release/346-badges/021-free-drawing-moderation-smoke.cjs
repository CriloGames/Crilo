/* Read-only tests: NO calls to Supabase, live data, bans or paid services. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const text=path=>fs.readFileSync(require('node:path').join(root,path),'utf8');
const page=text('moderation.html');
const scanner=text('moderation-feed-scanner.js');
const feed=text('moderation-feed.js');
const css=text('style.css');
for(const id of ['reviewScanStatus','reviewScannerDetails','reviewFilter','reviewFindings',
 'reviewApprove','reviewRemove','reviewBan','reviewRetry','deleteRunWithBan','showOwnerTests']){
 assert.ok(page.includes('id="'+id+'"'),id+' is missing from review UI');
}
assert.match(page,/moderation-feed\.js\?v=5/);
assert.match(page,/moderation-feed-scanner\.js\?v=3/);
assert.match(page,/style\.css\?v=89/);
assert.ok(css.includes('.crilo-review-scan-box'), 'Scanner layout should fit mobile and desktop');
assert.ok(css.includes('.crilo-review-reasons'), 'Scan reason labels missing');
assert.ok(scanner.includes('jsqr@1.4.0'), 'Local QR decoder missing');
assert.ok(scanner.includes('tesseract.js@5.1.1'), 'On-device OCR missing');
assert.ok(scanner.includes('siglip-base-patch16-224'), 'On-device image comparator missing');
assert.ok(scanner.includes('crilo_owner_local_scan_save'), 'Scan records not being persisted');
assert.ok(scanner.includes('crilo_owner_local_scan_jobs'), 'Unscanned drawings not being queued');
assert.ok(feed.includes('crilo_owner_local_scan_report'), 'Review feed cannot load findings');
assert.ok(feed.includes('crilo_owner_drawing_decision'), 'Owner approval/deletion missing');
assert.ok(feed.includes('owner-ban-drawing-account'), 'Owner-only account ban endpoint missing');
assert.ok(feed.includes('FINAL CONFIRMATION'), 'Irreversible decisions need second confirmation');
assert.ok(feed.includes('if(!d||d.is_test)return'), 'Test runs must be immune to account actions');
assert.ok(feed.includes('p_is_test:!!d.is_test'), 'Test scan retries must stay isolated');
for(const script of [feed,scanner]){
 assert.doesNotMatch(script,/api\.openai\.com|OPENAI_API_KEY|\/functions\/v1\/owner-scan-drawings/,
  'Review page must not invoke the old paid AI endpoint');
}
const callbacks=new Map();
const window={addEventListener:(type,cb)=>callbacks.set(type,cb)};
const document={getElementById:()=>null,addEventListener(){},hidden:true};
vm.runInNewContext(scanner,{window,document,setTimeout(){},setInterval(){},console,Image:class{}},
 {filename:'moderation-feed-scanner.js'});
const safe=window.CriloLocalSafety;
assert.ok(safe&&typeof safe.classifyText==='function');
assert.deepEqual(Array.from(safe.classifyText('Hello, little duck!')),[]);
assert.deepEqual(Array.from(safe.classifyText('FUCK this')),['Profanity']);
assert.deepEqual(Array.from(safe.classifyText('b!tch')),['Profanity']);
assert.deepEqual(Array.from(safe.classifyText('f.u.c.k')),['Profanity']);
assert.deepEqual(Array.from(safe.classifyText('s h i t')),['Profanity']);
assert.deepEqual(Array.from(safe.classifyText('damn')),['Profanity']);
assert.deepEqual(Array.from(safe.classifyText('Visit website dot com')),['Website or link']);
assert.deepEqual(Array.from(safe.classifyText('https://example.xyz')),['Website or link']);
assert.deepEqual(Array.from(safe.classifyText('join discord.gg/abc')),['Website or link']);
assert.deepEqual(Array.from(safe.classifyText('heil hitler')),['Hateful or abusive text']);
const labels=safe.candidateLabels;
const harmless=safe.classifyVisual([
 {label:labels[2],score:0.28},{label:labels[8],score:0.62}
]);
assert.equal(harmless.reason,null,'Do not treat a harmless relative match as positive');
const suspicious=safe.classifyVisual([
 {label:labels[2],score:0.75},{label:labels[8],score:0.07}
]);
assert.equal(suspicious.reason,'Possible genital drawing');
const suspectedQR=safe.classifyVisual([
 {label:labels[7],score:0.70},{label:labels[10],score:0.07}
]);
assert.equal(suspectedQR.reason,'Possible QR-like image');
assert.equal(safe.classifyVisual([]).reason,null);
console.log('PASS: local text, link, hate, QR, advisory visual selection and owner-safe review interface');
console.log('PASS: paid API calls absent; scanning is local and manual enforcement is separate');
