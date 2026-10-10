'use strict';
/* Supplemental 45 OCR-transcription validation cases.
 Recognized strings originate from Tesseract 5.5.0 run on 45 generated
 160x160 images enlarged to 620px. This checks detection AFTER OCR;
 it does not re-run Tesseract or claim browser Tesseract equivalence. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(path.resolve(__dirname,'../..'),'moderation-feed-scanner.js'),'utf8');
const scope={addEventListener(){}};
vm.runInNewContext(source,{window:scope,
 document:{getElementById(){return null},hidden:true,addEventListener(){}},
 console,setTimeout(){},setInterval(){}});
const samples=[
 ['benign','Heilo there'],['benign','I love ducks'],['benign','A week of fun'],
 ['benign','Nice drawing'],['benign','A little flower'],
 ['benign','The common\ndenominator'],['benign','A corn field'],
 ['benign','Welcome home'],['benign','| drew a smiley'],
 ['benign','Math equations\nare cool'],['benign','The sunset js\nPretty'],
 ['benign','The campany is\nhere'],['benign','No links today'],
 ['benign','My cat Likes maps'],['benign','Enjoy the game'],
 ['profanity','Tuck'],['profanity','shit'],['profanity','What the fuck'],
 ['profanity','bitch'],['profanity','asshole'],['profanity','SH [T'],
 ['profanity','dickhead'],['profanity','you bastard'],['profanity','fuck'],
 ['profanity','motherfucker'],
 ['link','Crilo.com'],['link','Crile Com'],['link','Farm Lauh\nCoan'],
 ['link','pormhub.com'],['link','www. webs ite.net'],
 ['link','Nttps://example. org'],['link','discord.gg/hello'],
 ['link','Example dot com'],['link','Crilo c om'],
 ['link','my-site.corn'],['link','t.me/secret'],['link','site.example.io'],
 ['abuse','kill yourself'],['abuse','heil hitler'],['abuse','white power'],
 ['abuse','Nazi'],['abuse','gas the people'],['abuse','NAZI'],
 ['abuse','Go kill yourself'],['abuse','Heil Hitler']
];
assert.equal(samples.length,45);
const results=samples.map(([category,text],i)=>({id:i+1,category,ocr:text,
 reasons:scope.CriloLocalSafety.classifyText(text)}));
const bad=results.filter(x=>x.category!=='benign'),
      good=results.filter(x=>x.category==='benign');
const tp=bad.filter(x=>x.reasons.length).length,fn=bad.filter(x=>!x.reasons.length),
 tn=good.filter(x=>!x.reasons.length).length,fp=good.filter(x=>x.reasons.length);
assert.equal(tp,29,'Expect 29 recognized violations after OCR');
assert.equal(fn.length,1,'One OCR false negative intentionally documented');
assert.equal(fn[0].ocr,'Tuck','OCR erases the profanity entirely');
assert.equal(tn,15,'No false positives from harmless OCR outputs');
assert.equal(fp.length,0,'No false positives from harmless OCR outputs');
assert.deepEqual(Array.from(scope.CriloLocalSafety.classifyText('Tuck')),[],
 'Do NOT start flagging ordinary Tuck as profanity to chase the false negative');
assert.ok(scope.CriloLocalSafety.classifyText('SH [T').includes('Profanity'));
console.log('PASS: generated-image Tesseract OCR stress: 29/30 violations flagged, 15/15 benign clear');
console.log('KNOWN LIMIT: Profanity recognized as "Tuck" cannot safely be inferred from OCR text alone.');
