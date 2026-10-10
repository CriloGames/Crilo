'use strict';
/* Crilo: 100 synthetic moderation controls, 50 benign and 50 violations.
 REAL: deterministic pixel-shape analyzers. TRANSCRIBED: OCR text assumed.
 INJECTED: recognized QR / model output, NOT decoder or AI inference.
 No database calls, bans, moderation actions, or paid services. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),root=path.resolve(__dirname,'../..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const shapes={};
vm.runInNewContext(read('moderation-shape-review.js'),{self:shapes});
vm.runInNewContext(read('moderation-genital-review.js'),{self:shapes});
const page={addEventListener(){}};
vm.runInNewContext(read('moderation-feed-scanner.js'),{
 window:page,document:{getElementById(){return null},hidden:true,addEventListener(){}},
 setTimeout(){},setInterval(){},console
});
const {classifyText,classifyVisual,REASONS}=page.CriloLocalSafety;
const W=160,H=160;
function drawing(draw,rotation=0){
 const pixel=new Uint8ClampedArray(W*H*4);pixel.fill(255);
 const t=rotation*Math.PI/180,cs=Math.cos(t),sn=Math.sin(t);
 function dot(x,y){
  const u=Math.round(80+(x-80)*cs-(y-80)*sn);
  const v=Math.round(80+(x-80)*sn+(y-80)*cs);
  for(const [dx,dy] of [[0,0],[1,0],[0,1],[-1,0],[0,-1]]){
   const xx=u+dx,yy=v+dy;if(xx<0||xx>=W||yy<0||yy>=H)continue;
   const i=(yy*W+xx)*4;pixel[i]=pixel[i+1]=pixel[i+2]=18;
  }
 }
 function line(x1,y1,x2,y2){
  const steps=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)*3));
  for(let k=0;k<=steps;k++){const t=k/steps;dot(x1+(x2-x1)*t,y1+(y2-y1)*t)}
 }
 function oval(cx,cy,rx,ry,deg=0){
  const t=deg*Math.PI/180,cos=Math.cos(t),sin=Math.sin(t);
  for(let a=0;a<Math.PI*2;a+=.006){
   const x=rx*Math.cos(a),y=ry*Math.sin(a);
   dot(cx+x*cos-y*sin,cy+x*sin+y*cos);
  }
 }
 function rect(x,y,w,h){
  line(x,y,x+w,y);line(x+w,y,x+w,y+h);
  line(x+w,y+h,x,y+h);line(x,y+h,x,y);
 }
 draw({dot,line,oval,rect});return pixel;
}
const examples=[];
function add(expected,category,label,input,method){
 examples.push({id:examples.length+1,expected,category,label,input,method});
}
const benignText=[
'Hello there','I love ducks','A week of fun','Nice drawing',
'A little flower','The common denominator','A corn field',
'Welcome home','I drew a smiley','Math equations are cool',
'The sunset is pretty','The company is here','No links today',
'My cat likes naps','Enjoy the game'
];
for(const s of benignText)add('clean','benign text',s,s,'transcribed-ocr');
const badText={
 profanity:['fuck','sh!t','What the fuck','bitch','asshole',
 'S H I T','d1ckhead','you bastard','f u c k','motherfucker'],
 link:['crilo.com','Crile Com','Farm lauh\nCoan','pornhub.com',
 'www.website.net','https://example.org','discord.gg/hello',
 'Example dot com','Crilo c om','my-site.corn','t.me/secret','site.example.io'],
 abuse:['kill yourself','heil hitler','white power','nazi',
 'gas the people','N A Z I','Go kill yourself','Heil Hitler']
};
for(const [category,list] of Object.entries(badText))
 for(const s of list)add('violation',category,s,s,'transcribed-ocr');
const art={
 blank:(a,n)=>{if(n===1)a.dot(80,80);if(n===2)a.line(78,78,80,78);if(n===3)a.dot(100,100)},
 face:(a,n)=>{
  const shift=n%3*2;a.oval(47+shift,51,n===2?7:12,15+n%3);
  a.oval(110-shift,53,11,15+n%4);
  a.line(40,97,58,104);a.line(58,104,88,106);a.line(88,106,121,99);
  if(n%2===0){a.line(89,104,87,126);a.line(87,126,95,132);a.line(95,132,103,119)}
 },
 flower:(a,n)=>{
  for(let k=0;k<5;k++){
   const r=2*Math.PI*k/5;a.oval(80+23*Math.cos(r),66+22*Math.sin(r),13+n%3,12)
  }
  a.oval(80,66,8,8);a.line(80,96,80,142);
  a.oval(67,119,15,7,-25);a.oval(91,129,14,6,25)
 },
 dumbbell:(a,n)=>{a.oval(44,69,12+n%4,15);a.oval(113,69,12,15+n%3);
  a.line(57,69,101,69);if(n%2)a.line(55,73,100,73)},
 abstract:(a,n)=>{
  for(let k=0;k<3;k++){const y=46+k*26;
   a.line(36+(k*n)%13,y,72+(k*11)%37,y+18);a.oval(105,y,9+(k+n)%5,8,27)}
 },
 leaf:(a,n)=>{a.oval(80,79,29,46,n%2?25:-25);a.line(80,46,80,113);
  a.line(80,70,61,58);a.line(80,82,101,68);a.line(80,95,65,101)},
 geometry:(a,n)=>{
  if(n<2){a.oval(80,80,47,47);a.oval(80,80,25,25)}
  else if(n===2){a.rect(40,45,81,75);a.line(40,45,121,120)}
  else if(n===3){for(let k=0;k<5;k++)a.line(80,24,80+(k-2)*17,137)}
  else {a.oval(57,58,19,17);a.oval(105,58,21,19);a.oval(81,109,20,18)}
 }
};
const benignCounts={blank:4,face:8,flower:5,dumbbell:5,abstract:4,leaf:4,geometry:5};
for(const [name,count] of Object.entries(benignCounts))
 for(let n=0;n<count;n++)add('clean',name,name+' '+(n+1),
  drawing(a=>art[name](a,n)), 'actual-pixels');
function penis(a,n){
 const dx=n%3*2;
 a.oval(57+dx,47+n%3,16+n%3,14+n%2);
 a.oval(100+dx,49+n%4,17+n%2,16+n%2);
 if(n<4)a.oval(79+dx,98,12+n%3,39+(n%2)*3);
 else {a.oval(77+dx,100,13,37,9+(n%3)*6);a.line(81,73,89,80)}
}
function vulva(a,n){
 if(n<4){a.oval(80,81,29+n%4,48+(n%3)*3,n%2?10:0);
  a.oval(80,81,11+n%2,29+(n%3)*2)}
 else{a.oval(80,81,24+n%4,48+n%3,n%2?13:0);
  a.line(80,55,80+(n%2?5:0),110);
  if(n===6)a.line(80,63,73,92)}
}
for(let n=0;n<8;n++)add('violation','genital/penis','penis '+(n+1),
 drawing(a=>penis(a,n),[0,0,20,40,0,15,70,90][n]),'actual-pixels');
for(let n=0;n<8;n++)add('violation','genital/vulva','vulva '+(n+1),
 drawing(a=>vulva(a,n),[0,0,16,40,0,20,60,90][n]),'actual-pixels');
for(let n=0;n<2;n++)add('violation','extremist symbol','symbol '+(n+1),[
 {label:'A hand drawn Nazi swastika or extremist hate symbol',score:0.58+n*.05},
 {label:'A harmless abstract scribble',score:0.12}
],'injected-vision');
for(let n=0;n<2;n++)add('violation','QR','QR '+(n+1),true,'injected-qr');
assert.equal(examples.length,100);
assert.equal(examples.filter(x=>x.expected==='clean').length,50);
assert.equal(examples.filter(x=>x.expected==='violation').length,50);
const results=[];
for(const e of examples){
 let reasons=[],special=null,legacy=false,blank=false;
 if(e.method==='transcribed-ocr')reasons=classifyText(e.input);
 else if(e.method==='injected-vision'){
  const r=classifyVisual(e.input);if(r.reason)reasons.push(r.reason);
 }else if(e.method==='injected-qr'){if(e.input)reasons.push(REASONS.qr)}
 else if(e.method==='actual-pixels'){
  let ink=0;for(let i=0;i<W*H;i++)if(e.input[4*i]<185)ink++;
  blank=ink<W*H*.0015;
  if(!blank){
   const old=shapes.CriloShapeReview.analyze(e.input,W,H);
   special=shapes.CriloGenitalReview.analyzePixels(e.input,W,H);
   legacy=old.suspected===true;
   if(!special.benignFace&&(legacy||special.suspected))reasons.push(REASONS.genital);
  }
 }
 const flagged=reasons.length>0;
 results.push({id:e.id,category:e.category,label:e.label,method:e.method,
  expected:e.expected,actual:flagged?'REVIEW SUGGESTED':'NO FLAGS',
  correct:flagged===(e.expected==='violation'),
  reasons:[...new Set(reasons)],
  ...(e.method==='actual-pixels'?{shape:special?.type||null,benignFace:!!special?.benignFace,legacy,blank}:{})
 });
}
function metrics(items){
 const TP=items.filter(x=>x.expected==='violation'&&x.actual==='REVIEW SUGGESTED').length;
 const TN=items.filter(x=>x.expected==='clean'&&x.actual==='NO FLAGS').length;
 const FP=items.filter(x=>x.expected==='clean'&&x.actual==='REVIEW SUGGESTED').length;
 const FN=items.filter(x=>x.expected==='violation'&&x.actual==='NO FLAGS').length;
 const pct=(n,d)=>d?Math.round(10000*n/d)/100:null;
 return {total:items.length,TP,TN,FP,FN,sensitivity_pct:pct(TP,TP+FN),
  specificity_pct:pct(TN,TN+FP),accuracy_pct:pct(TP+TN,items.length)};
}
const report={generated_at:new Date().toISOString(),name:'100-drawing controlled moderation benchmark',
 limitations:'NOT a real browser OCR/QR/SigLIP test. Text is supplied as transcribed OCR, QR/vision outcomes injected. Pixel shapes use current actual JS geometry detectors. Metrics are synthetic-control performance only.',
 overall:metrics(results),
 actual_pixel_shapes:metrics(results.filter(x=>x.method==='actual-pixels')),
 transcribed_OCR:metrics(results.filter(x=>x.method==='transcribed-ocr')),
 injected_sensors:metrics(results.filter(x=>x.method.startsWith('injected-'))),
 categories:[...new Set(results.map(x=>x.category))].map(category=>({category,...metrics(results.filter(x=>x.category===category))})),
 failures:results.filter(x=>!x.correct),
 cases:results};
console.log('OVERALL '+JSON.stringify(report.overall));
console.log('PIXEL SHAPES '+JSON.stringify(report.actual_pixel_shapes));
console.log('TRANSCRIBED TEXT '+JSON.stringify(report.transcribed_OCR));
console.log('INJECTED QR/VISION '+JSON.stringify(report.injected_sensors));
console.log('MISCLASSIFIED '+JSON.stringify(report.failures));
if(process.env.CRILO_QA_REPORT_PATH){
 fs.writeFileSync(process.env.CRILO_QA_REPORT_PATH,JSON.stringify(report,null,2)+'\n');
 console.log('REPORT '+process.env.CRILO_QA_REPORT_PATH);
}
if(process.env.CRILO_QA_STRICT==='1'){
 assert.equal(report.overall.FP,0,'False positives');
 assert.equal(report.overall.FN,0,'False negatives');
}
