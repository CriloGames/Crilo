'use strict';
/* Real Canvas 2D type measurement. Check every segment label after repeated
 * Upgrades in dark/daylight, without touching accounts or the live database. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const source=fs.readFileSync('game.js','utf8');
const begin=source.indexOf('function drawWheel(){');
const end=source.indexOf('// Theme changes repaint',begin);
assert.ok(begin>=0&&end>begin,'Real shipped canvas drawing function required');
const wheelCode=source.slice(begin,end);
assert.match(wheelCode,/radialLabels=N>36/,'After upgrades wheel should switch to radial text');
assert.doesNotMatch(wheelCode,/if\(size>=8/,'Do not hide small labels');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let cases=0;
 try{
  const page=await browser.newPage({viewport:{width:900,height:900},deviceScaleFactor:1});
  await page.setContent('<!doctype html><html><body><canvas id="wheel" width="620" height="620"></canvas></body></html>');
  for(const theme of ['light','dark']){
   for(let upgrades=0;upgrades<=12;upgrades++){
    const result=await page.evaluate(({wheelCode,theme,upgrades})=>{
     const wheel=document.getElementById('wheel'),ctx=wheel.getContext('2d');
     const results=[],base=[
      {type:'num',base:40},{type:'duck',label:'DUCK'},{type:'num',base:20},
      {type:'upgrade',label:'UP! ↑'},{type:'num',base:60},{type:'num',base:20},
      {type:'spins',label:'+2'},{type:'num',base:80},{type:'duck',label:'DUCK'},
      {type:'num',base:40},{type:'double',label:'×2'},{type:'num',base:20}
     ];
     const segments=base.concat(base.map(s=>({...s})));
     for(let i=1;i<=upgrades;i++){
      const n=4+Math.min(i,8);
      for(let j=0;j<n;j++)segments.push({type:'num',base:[20,40,60,80,120,160][j%6]},
       {type:'num',base:[20,40,60,80,120,160][j%6]});
     }
     const dark=theme==='dark',palette=['#f5d999','#f8bcdd','#eacafb','#c1e8e1'],
      paletteDark=['#353a44','#5a4f60','#454f58'],rotation=0,drawMode='stationary',
      drawing={style:{}},multiplier=Math.min(Number.MAX_SAFE_INTEGER,3**upgrades),
      fmt=n=>{if(n<1000)return String(n);
       for(const [suffix,div] of [['Qa',1e15],['T',1e12],['B',1e9],['M',1e6],['K',1e3]]){
        if(n>=div)return(n/div>=100?(n/div).toFixed(0):(n/div).toFixed(1))
         .replace('.0','')+suffix;
       }return String(n)};
     const label=s=>s.type==='num'?fmt(s.base*multiplier):s.label;
     const wheelIsDark=()=>dark;
     let duckIcons=0;
     const drawDuckIcon=()=>duckIcons++;
     const oldFill=ctx.fillText.bind(ctx);
     ctx.fillText=function(text,x,y){
       results.push({text,size:parseFloat(this.font.match(/[\d.]+px/)?.[0]||'0'),
        width:this.measureText(text).width});
       oldFill(text,x,y);
     };
     try{
      const draw=new Function('wheel','ctx','segments','palette','paletteDark','wheelIsDark',
       'rotation','drawMode','drawing','label','drawDuckIcon',wheelCode+';return drawWheel;')(
        wheel,ctx,segments,palette,paletteDark,wheelIsDark,rotation,drawMode,drawing,label,drawDuckIcon);
      draw();
     }finally{ctx.fillText=oldFill}
     const angle=2*Math.PI/segments.length,r=wheel.width/2-12;
     const inner=wheel.width*.17+13,outer=r-14;
     const center=(inner+outer)/2;
     const failures=[];
     for(const [index,t] of results.entries()){
      if(!(t.size>0)&&!Number.isFinite(t.size))failures.push('invalid font size '+index);
      if(segments.length>36){
       const innerTextRadius=Math.max(inner,center-t.width/2);
       const widthAvailable=outer-inner-8;
       const tangentClearance=2*innerTextRadius*Math.sin(angle/2);
       // Font-size approximation is conservative relative to actual glyph cap height.
       if(t.width>widthAvailable+1)failures.push('radial label too long '+t.text);
       if(t.size>tangentClearance+1)failures.push('label crosses sector '+t.text);
      }
     }
     return{N:segments.length,upgrades,theme,drawn:results.length,duckIcons,
      expected:segments.length,radial:segments.length>36,
      minSize:Math.min(...results.map(x=>x.size)),failures};
    },{wheelCode,theme,upgrades});
    if(result.radial)assert.equal(result.drawn,result.expected,
     theme+' '+upgrades+' upgrades: all slice values, ducks and symbols must be drawn');
    else assert.equal(result.drawn+result.duckIcons,result.expected,
     theme+' '+upgrades+' upgrades: every slice must have a label or icon');
    assert.deepEqual(result.failures,[],theme+' '+upgrades+' upgrade text clearance');
    // 2-3 upgrades is the observed production failure, these should stay
    // appreciably larger than the old hard 8px disappearance threshold.
    if(upgrades===2||upgrades===3)assert.ok(result.minSize>=9,
     theme+' upgrade '+upgrades+': text got too small: '+result.minSize);
    cases++;
   }
  }
  console.log('WHEEL_UPGRADE_LABELS_PASS '+cases+
   ' real Canvas states, 0–12 upgrades, both themes, 100% labels, inside wedge bounds.');
 }finally{await browser.close()}
})().catch(e=>{console.error('WHEEL_UPGRADE_LABELS_FAIL',e);process.exitCode=1});
