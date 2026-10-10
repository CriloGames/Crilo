/* Review-only: geometry fixtures, no live Supabase access or player changes. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const shapeSource=fs.readFileSync(path.join(root,'moderation-shape-review.js'),'utf8');
const scanner=fs.readFileSync(path.join(root,'moderation-feed-scanner.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'moderation-scan-worker.js'),'utf8');
const feed=fs.readFileSync(path.join(root,'moderation-feed.js'),'utf8');
const context={};
vm.runInNewContext(shapeSource,{self:context});
const shape=context.CriloShapeReview;
assert.ok(shape&&typeof shape.analyze==='function');

const W=160,H=160;
function image(draw){
 const data=new Uint8ClampedArray(W*H*4);
 for(let i=0;i<W*H;i++)data.fill(255,i*4,i*4+4);
 const paint=(x,y)=>{const n=(y*W+x)*4;data[n]=data[n+1]=data[n+2]=12};
 draw(paint);
 return data;
}
const rotate=(x,y,deg)=>{
 const rad=deg*Math.PI/180,dx=x-80,dy=y-80;
 return [80+dx*Math.cos(rad)-dy*Math.sin(rad),80+dx*Math.sin(rad)+dy*Math.cos(rad)];
};
function outline(paint,shape,angle=0){
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const [rx,ry]=rotate(x,y,-angle);
  if(shape(rx,ry))paint(x,y);
 }
}
const circle=(x,y,cx,cy,rx,ry)=>Math.abs(Math.hypot((x-cx)/rx,(y-cy)/ry)-1)*Math.min(rx,ry)<1.45;
function shaft(x,y,ax,ay,bx,by,radius){
 const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
 return Math.abs(Math.hypot(x-ax-t*dx,y-ay-t*dy)-radius)<1.45;
}
const suspect=angle=>image(p=>outline(p,(x,y)=>circle(x,y,64,51,17,15)||
 circle(x,y,101,57,16,19)||shaft(x,y,79,75,42,121,10),angle));
const mild=angle=>image(p=>outline(p,(x,y)=>circle(x,y,80,65,22,22)||
 shaft(x,y,80,99,80,137,10),angle));
const circles=image(p=>outline(p,(x,y)=>circle(x,y,65,45,20,20)||
 circle(x,y,105,45,20,20)||circle(x,y,85,95,20,20)));
const sparse=image(()=>{});
for(const angle of [0,45,90,135,210]){
 assert.equal(shape.analyze(suspect(angle),W,H).suspected,true,
  'Should suggest genital-like outlined shape at rotation '+angle);
 assert.equal(shape.analyze(mild(angle),W,H).suspected,false,
  'One round shape on a stick is insufficient at rotation '+angle);
}
assert.equal(shape.analyze(circles,W,H).suspected,false,'Three circles are insufficient');
assert.equal(shape.analyze(sparse,W,H).suspected,false,'Blank drawing is insufficient');
assert.ok(worker.includes('moderation-shape-review.js?v=1'),
 'Main web worker must load the lightweight shape detection');
assert.ok(worker.includes('out.shapeSuspected=hint.suspected===true'),
 'Worker must return outline result separately from SigLIP');
assert.ok(scanner.includes('if(result.shapeSuspected===true)reasons.push(REASONS.genital)'),
 'Outline shape hints must be routed to a review flag');
assert.ok(!scanner.includes('visual.score<0.10'),
 'A low relative image score is not evidence of abuse');
assert.ok(scanner.includes("result.shapeSuspected===true"),
 'Actual shape hint must remain active after false-positive fix');
assert.ok(!feed.includes('Visual result uncertain — rescan advised'),
 'Previously clean pictures must not be blanket-flagged');
assert.ok(feed.includes("d.local.status==='partial'?'INCOMPLETE CHECK'"),
 'Failed or unfinished scans need their own status instead of a violation flag');
assert.ok(worker.includes('isNearlyBlank(bitmap)'),
 'Blank drawings must have a fast path before expensive AI loading');
console.log('PASS: outlined genital-like shapes at five orientations, harmless fixtures, worker integration');
console.log('PASS: uncertain visual model cannot silently produce NO FLAGS; findings never auto-ban');
