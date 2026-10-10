/* Regression: game view is sized BEFORE the first spin; the viewport
 * never auto-scrolls while a wheel spin animates. No live credentials needed.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const demo=fs.readFileSync(path.join(root,'beetle-tricks.html'),'utf8');
assert.ok(html.includes('style.css?v=83')&&html.includes('game.js?v=62'));
assert.ok(demo.includes('style.css?v=83'));
assert.match(html,/name="viewport" content="width=device-width,initial-scale=1"/);
assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
assert.ok(html.indexOf('class="wheel-stage"')<html.indexOf('id="spinButton"'));
assert.ok(html.indexOf('id="wheelScorePanel"')<html.indexOf('class="stats wheel-counts"'));
assert.ok(html.indexOf('class="stats wheel-counts"')<html.indexOf('id="spinButton"'));
assert.ok(css.includes('body.wheel-session-fit .wheel-wrap'));
assert.ok(css.includes('var(--crilo-wheel-fit,320px)'));
assert.ok(css.includes('body.wheel-session-fit .wheel-hud'));
assert.ok(css.includes('body.wheel-session-fit #ownerActiveMode:not(.hidden)'));
assert.ok(css.includes('body.wheel-session-fit #spinButton'));
assert.ok(css.includes('body.wheel-session-fit.wheel-run-active .draw-panel.locked-panel{'));
assert.ok(css.includes('display:flex!important;visibility:hidden;opacity:0;pointer-events:none'));
assert.ok(css.includes('body.wheel-session-fit.wheel-run-active #testBanner:not(.hidden){'));
assert.ok(css.includes('touch-action:manipulation'));
assert.ok(css.includes('.modal-card input:not([type=color]),.modal-card select,'));
assert.ok(css.includes('.text-input{font-size:16px}'));
assert.ok(css.includes('-webkit-text-size-adjust:100%'));
assert.ok(game.includes('function beginRun(alignPlay=false)'));
assert.ok(game.includes('update();fitPlayViewport(alignPlay)'));
assert.ok(game.includes('beginRun(true)'),'Owner choice must focus play screen');
assert.ok(game.includes('document.body?.classList?.add(\'wheel-run-active\')'));
assert.ok(!game.includes('scrollIntoView'),'First spin must not trigger Safari smooth auto-scroll');
const spinArea=game.slice(game.indexOf('lockDrawing();\n// Never scroll'),game.indexOf('spinning=true;',game.indexOf('lockDrawing();\n// Never scroll')));
assert.ok(!spinArea.includes('scrollTo(')&&!spinArea.includes('requestAnimationFrame('));
assert.ok(game.includes('Math.abs((window.innerWidth||0)-playLayoutWidth)>18'));
assert.ok(game.includes('window.innerWidth>700&&Math.abs(h-playLayoutHeight)>70'),
 'Do not relayout when iPhone browser toolbars change height');

// Exercise the actual viewport-fit function with realistic DOM geometry.
const start=game.indexOf('let playLayoutWidth=0,playLayoutHeight=0;');
const stop=game.indexOf('function beginRun(alignPlay=false)',start);
assert.ok(start>=0&&stop>start,'Find sizing implementation');
const implementation=game.slice(start,stop);
for(const scenario of [
 {label:'iPhone SE',w:320,h:568,header:68,below:240},
 {label:'iPhone 13 mini',w:375,h:635,header:68,below:245},
 {label:'iPhone 15',w:393,h:730,header:68,below:255},
 {label:'Landscape mobile',w:667,h:390,header:68,below:190},
 {label:'Minimized laptop',w:920,h:660,header:92,below:265},
 {label:'Desktop small',w:1280,h:720,header:68,below:265},
 {label:'Maximized laptop',w:1440,h:900,header:68,below:270},
 {label:'Large monitor',w:1920,h:1080,header:68,below:270}
]){
 let y=120,size=450,resizeHandler,scrolls=0,session=false;
 const classSet=new Set();
 const classList={add(name){classSet.add(name)},contains(name){return classSet.has(name)}};
 const body={classList,style:{setProperty(key,value){
  assert.equal(key,'--crilo-wheel-fit');size=parseInt(value,10);
 }}};
 const header={getBoundingClientRect:()=>({height:scenario.header})};
 const stage={getBoundingClientRect:()=>({top:550-y,bottom:550-y+size})};
 const button={getBoundingClientRect:()=>({bottom:550-y+size+scenario.below})};
 const document={body,documentElement:{clientWidth:scenario.w,style:{scrollBehavior:''}},
  querySelector:sel=>sel==='.wheel-stage'?stage:sel==='.topbar'?header:null};
 const window={innerWidth:scenario.w,innerHeight:scenario.h,
  visualViewport:{height:scenario.h},scrollY:y,
  addEventListener:(event,callback)=>{if(event==='resize')resizeHandler=callback},
  scrollTo(options){scrolls++;y=options.top;this.scrollY=y;assert.equal(options.behavior,'instant')}};
 let spinning=false;
 const source=implementation+';return {fitPlayViewport,metrics:()=>({playLayoutWidth,playLayoutHeight})}';
 const f=new Function('document','window','$','requestAnimationFrame','spinning',source);
 const script=f(document,window,id=>id==='spinButton'?button:null,cb=>cb(),spinning);
 script.fitPlayViewport(true);
 const expected=Math.max(140,Math.floor(Math.min(600,scenario.w-24,
  scenario.h-scenario.header-Math.max(180,scenario.below)-53)));
 assert.equal(size,expected,scenario.label+' diameter');
 assert.ok(size<=scenario.w-24,scenario.label+' horizontally clipped');
 assert.ok(scenario.header+size+scenario.below+53<=scenario.h+1||
  (size===140&&scenario.h<scenario.header+scenario.below+193),
  scenario.label+' pointer or button cut off');
 assert.equal(scrolls,1,scenario.label+' alignment should happen once');
 assert.equal(y,Math.max(0,550-scenario.header-25),scenario.label+' sticky header offset');
 assert.ok(classSet.has('wheel-session-fit'),scenario.label+' run class');
 resizeHandler();
 assert.equal(scrolls,1,scenario.label+' resize should not scroll on iPhone');
 console.log('PASS '+scenario.label+': '+scenario.w+'x'+scenario.h+
  ', wheel '+size+'px, top '+y+', visible through SPIN');
}
console.log('PASS: iPhone pinch accessibility, no spin-time auto-scroll, stable locked drawing and test banner.');
