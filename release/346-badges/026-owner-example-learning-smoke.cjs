'use strict';
/* Pure local testing: never modifies players, runs, or example DB. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),root=path.resolve(__dirname,'../..');
const featureCode=fs.readFileSync(path.join(root,'moderation-example-features.js'),'utf8');
const feedback=fs.readFileSync(path.join(root,'moderation-feedback.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'moderation-scan-worker.js'),'utf8');
const scanner=fs.readFileSync(path.join(root,'moderation-feed-scanner.js'),'utf8');
const feed=fs.readFileSync(path.join(root,'moderation-feed.js'),'utf8');
const page=fs.readFileSync(path.join(root,'moderation.html'),'utf8');
const rootObj={};vm.runInNewContext(featureCode,{self:rootObj});
const features=rootObj.CriloExampleFeatures;
function art(type,offset=0){
 const w=160,h=160,p=new Uint8ClampedArray(w*h*4);p.fill(255);
 function draw(x,y){if(x<0||x>=w||y<0||y>=h)return;let k=(y*w+x)*4;p[k]=p[k+1]=p[k+2]=0}
 function oval(cx,cy,rx,ry){for(let t=0;t<Math.PI*2;t+=.01)
  draw(Math.round(cx+rx*Math.cos(t)),Math.round(cy+ry*Math.sin(t)))}
 function line(x1,y1,x2,y2){let len=Math.hypot(x2-x1,y2-y1);for(let t=0;t<=len;t+=0.5){
  let x=Math.round(x1+(x2-x1)*t/len),y=Math.round(y1+(y2-y1)*t/len);
  draw(x,y);draw(x+1,y)}}
 if(type==='anatomy'){
  oval(53+offset,40+offset,18,16);oval(101+offset,41+offset,18,16);
  oval(75+offset,96+offset,15,45);
 }else if(type==='face'){
  oval(55,60,10,10);oval(108,60,10,10);
  line(49,100,86,111);line(86,111,117,97);
 }
 return features.fingerprint(p,w,h);
}
const positive=art('anatomy'),shifted=art('anatomy',3),face=art('face');
assert.match(positive,/^[0-9a-f]{64}$/);
assert.equal(art('blank'),null,'Never learn blank square');
let samples=[{verdict:'inappropriate',category:'genitalia',fingerprint:positive}];
assert.equal(features.classify(positive,samples).category,'genitalia');
assert.equal(features.classify(shifted,samples).category,'genitalia');
assert.equal(features.classify(face,samples),null,'Distinct smiley should not inherit anatomy flag');
samples.push({verdict:'safe',category:'safe',fingerprint:shifted});
assert.equal(features.classify(shifted,samples),null,'Owner safe feedback must override close bad neighbor');
assert.equal(features.classify('invalid',samples),null);
assert.equal(features.distance(positive,positive),0);
assert.ok(scanner.includes('crilo_owner_example_list'),'Owner-labeled gallery must be loaded');
assert.ok(scanner.includes('learnedCategory'),'Worker predictions must reach scanner advisory reason');
assert.ok(worker.includes('CriloExampleFeatures.classify'),'Worker must use local fingerprint matching');
assert.ok(worker.includes('moderation-example-features.js?v=1'));
assert.ok(feedback.includes('crilo_owner_example_save'),'Owner must be able to add example');
assert.ok(feedback.includes('crilo_owner_example_delete'),'Owner must be able to undo label');
assert.ok(feedback.includes("p_verdict:verdict"),'Safe and inappropriate labels supported');
assert.ok(feed.includes('dismissedKeys.add(key(d))'),'Successful owner action should disappear immediately');
assert.ok(feed.includes('refreshQueued=true'),'Busy refresh should not drop important updates');
for(const id of ['reviewExampleBad','reviewExampleSafe','reviewExampleCategory',
 'reviewExampleRemove','reviewExampleStatus'])assert.ok(page.includes('id="'+id+'"'));
assert.match(page,/moderation-feedback\.js\?v=1/);
assert.match(page,/moderation-example-features\.js\?v=1/);
console.log('PASS: fingerprint, similar-positive match, unrelated smiley clear, safe veto, blank ignore');
console.log('PASS: owner-only labeling/undo and optimistic successful-decision redraw wiring');
