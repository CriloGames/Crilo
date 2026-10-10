'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),ctx={};
vm.runInNewContext(fs.readFileSync(path.join(root,'moderation-shape-review.js'),'utf8'),{self:ctx});
vm.runInNewContext(fs.readFileSync(path.join(root,'moderation-genital-review.js'),'utf8'),{self:ctx});
const w=160,h=160;
function fixture(draw){
 const pixels=new Uint8ClampedArray(w*h*4);pixels.fill(255);
 const mark=(x,y)=>{const i=4*(y*w+x);pixels[i]=pixels[i+1]=pixels[i+2]=0};
 const oval=(cx,cy,rx,ry)=>{for(let y=0;y<h;y++)for(let x=0;x<w;x++)
  if(Math.abs(Math.hypot((x-cx)/rx,(y-cy)/ry)-1)*Math.min(rx,ry)<1.5)mark(x,y)};
 const stroke=(x0,y0,x1,y1)=>{for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const dx=x1-x0,dy=y1-y0,t=Math.max(0,Math.min(1,((x-x0)*dx+(y-y0)*dy)/(dx*dx+dy*dy)));
  if(Math.hypot(x-x0-t*dx,y-y0-t*dy)<1.7)mark(x,y)}};
 draw(oval,stroke);return pixels;
}
const cases=[
 ['shape A','penis',f=>{f(64,45,19,16);f(105,45,20,17);f(82,96,13,42)}],
 ['shape B','penis',(f,l)=>{f(65,45,18,17);f(105,51,20,19);f(52,103,10,47);l(59,59,73,76)}],
 ['shape C','vulva',f=>{f(81,80,35,62);f(81,80,12,39)}],
 ['shape D','vulva',(f,l)=>{f(82,82,26,54);l(82,56,82,111)}],
 ['face',null,f=>{f(65,48,12,12);f(104,48,12,12);f(85,114,48,16)}],
 ['flower',null,(f,l)=>{f(81,42,14,18);f(62,60,16,14);f(101,60,16,14);f(81,79,14,18);l(81,100,81,146)}],
 ['dumbbell',null,(f,l)=>{f(61,49,16,16);f(110,49,16,16);l(86,63,86,140)}],
 ['blank',null,()=>{}]
];
// Reproduce the specific false-positive pattern: two eyes, a broad curved
// smile, and a hanging tongue (without using private player image bytes).
const smileTongue=fixture((oval,stroke)=>{
 oval(52,51,10,12);oval(109,50,11,12);
 stroke(47,91,67,98);stroke(67,98,94,99);stroke(94,99,120,94);
 stroke(85,100,86,124);stroke(86,124,97,117);stroke(97,117,99,97);
});
// Visual-geometry regression for the real-world failure: one eye is
// noticeably taller/tilted (its enclosed region has ratio > 1.75).
// Earlier scanner versions ignored that eye and misread the tongue below.
const tiltedEyesTongue=fixture((oval,stroke)=>{
 oval(44,52,10,15);oval(110,51,10,19);
 stroke(36,97,54,103);stroke(54,103,87,106);stroke(87,106,125,101);
 stroke(87,103,83,127);stroke(83,127,89,137);
 stroke(89,137,98,127);stroke(98,127,98,103);
});
const elongated=ctx.CriloShapeReview.regions(tiltedEyesTongue,w,h);
assert.ok(elongated.some(x=>x.ratio>1.75&&x.ratio<2.2),
 'Fixture must contain the tall/tilted eye that escaped v6 face checking');
const tiltedFace=ctx.CriloGenitalReview.analyzePixels(tiltedEyesTongue,w,h);
assert.equal(tiltedFace.suspected,false,'Tilted-eye smiley is not genitalia');
assert.equal(tiltedFace.benignFace,true,
 'Both eyes and broad smile must veto tongue-as-shaft detection');
const face=ctx.CriloGenitalReview.analyzePixels(smileTongue,w,h);
assert.equal(face.suspected,false,'Smiley with tongue must not be flagged');
assert.equal(face.benignFace,true,'Smiley must trigger the conservative face veto');
for(const [name,expected,paint] of cases){
 const observed=ctx.CriloGenitalReview.analyzePixels(fixture(paint),w,h);
 assert.equal(observed.type,expected,name+': '+JSON.stringify(observed));
}
const scanner=fs.readFileSync(path.join(root,'moderation-feed-scanner.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'moderation-scan-worker.js'),'utf8');
assert.ok(worker.includes("importScripts('moderation-genital-review.js?v=4')"));
assert.ok(worker.includes('if(out.benignFace)'), 'Both outline detectors must honor face veto');
assert.ok(scanner.includes('result.genitalSuspected===true'));
assert.ok(scanner.includes("result.genitalType==='vulva'"));
console.log('PASS: tilted-eye tongue smile, 8 geometry controls, worker wiring');
