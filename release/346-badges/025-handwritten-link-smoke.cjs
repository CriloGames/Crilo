/* Offline OCR-link regression: no network, Supabase, or moderation actions. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(base,'moderation-feed-scanner.js'),'utf8');
const page=fs.readFileSync(path.join(base,'moderation.html'),'utf8');
const win={addEventListener(){}};
const doc={getElementById:()=>null,addEventListener(){},hidden:true};
vm.runInNewContext(source,{
 window:win,document:doc,console,setTimeout(){},setInterval(){}
});
const {classifyText,looksLikeHandwrittenLink}=win.CriloLocalSafety;
const flagged=[
 'Crile Com',          // OCR of a handwritten domain without a visible dot
 'Farm lauh\nCoan',    // OCR of a poorly written .com and broken host
 'Crilo.com',
 'example dot com',
 'crilo co m',
 'Crilo c om',
 'my-site.corn',
 'https://site.net',
 'www.example.org',
 'discord.gg/abc',
 'a little site Coan'
];
const clean=[
 '',
 'Hello, little duck!',
 'A little flower',
 'I made a happy face',
 'welcome home',
 'the company is here',
 'a corn field',
 'the common denominator',
 'Coan',
 'cartoon sun',
 'drawing a house',
 'my fun duck',
 'I like to draw',
 'nothing to see here'
];
for(const x of flagged){
 assert.ok(classifyText(x).includes('Website or link'),
  JSON.stringify(x)+' should be suggested for link review');
}
for(const x of clean){
 assert.ok(!classifyText(x).includes('Website or link'),
  JSON.stringify(x)+' should not be suggested for link review');
}
assert.equal(looksLikeHandwrittenLink('Crile Com'),true);
assert.equal(looksLikeHandwrittenLink('Farm lauh\nCoan'),true);
assert.match(page,/moderation-feed-scanner\.js\?v=14/);
assert.ok(source.includes('crilo_owner_local_scan_jobs_v6'));
assert.ok(source.includes('crilo_owner_local_scan_save_v6'));
assert.ok(source.includes('classifyText(result.ocrText)'));
assert.doesNotMatch(source,/api\.openai\.com|OPENAI_API_KEY|owner-scan-drawings/);
console.log('PASS: '+flagged.length+' positive URL/OCR fixtures and '+clean.length+
 ' negative text controls, v5 scan queue and local-only operation');
