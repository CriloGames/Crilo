/* Regression: the wheel is fitted BEFORE play, never resized on a spin.
 * Simulate desktop/laptop/iPhone viewport geometry without live credentials.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const demo=fs.readFileSync(path.join(root,'beetle-tricks.html'),'utf8');
assert.ok(html.includes('style.css?v=83')&&html.includes('game.js?v=63'));
assert.ok(demo.includes('style.css?v=83'));
assert.match(html,/name="viewport" content="width=device-width,initial-scale=1"/);
assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
assert.ok(html.indexOf('class="wheel-stage"')<html.indexOf('id="spinButton"'));
assert.ok(html.indexOf('id="wheelScorePanel"')<html.indexOf('class="stats wheel-counts"'));
assert.ok(html.indexOf('class="stats wheel-counts"')<html.indexOf('id="spinButton"'));
assert.ok(css.includes('body.wheel-session-fit .wheel-wrap'));
assert.ok(css.includes('var(--crilo-wheel-fit,320px)'));
assert.ok(css.includes('body.wheel-session-fit #spinButton'));
assert.ok(css.includes('touch-action:manipulation'));
assert.ok(css.includes('.text-input{font-size:16px}'));
assert.ok(css.includes('-webkit-text-size-adjust:100%'));
assert.ok(game.includes('function beginRun(alignPlay=false)'));
assert.ok(game.includes('update();if(alignPlay)alignPlayViewport()'));
assert.ok(game.includes('resetSegments();update();fitPlayViewport();'),
 'Fit the wheel on initial page load before Daily/Test starts');
assert.ok(!game.includes('document.body?.classList?.add(\'wheel-run-active\')'),
 'A SPIN must never switch to a second wheel layout');
assert.ok(!game.includes('scrollIntoView'),'No smooth scroll when spinning');
const spinArea=game.slice(game.indexOf('lockDrawing();\n// Keep the same diameter'),
 game.indexOf('spinning=true;',game.indexOf('lockDrawing();\n// Keep the same diameter')));
assert.ok(spinArea&&!spinArea.includes('fitPlayViewport(')&&!spinArea.includes('scrollTo('));
assert.ok(game.includes('Math.abs((window.innerWidth||0)-playLayoutWidth)>18'));
assert.ok(game.includes('window.innerWidth>700&&Math.abs(h-playLayoutHeight)>70'));

// Exercise the real sizing code: one size at initial load, the SAME size
// when choosing a mode and pressing SPIN; deliberate window resize may refit.
const start=game.indexOf('let playLayoutWidth=0,playLayoutHeight=0;');
const stop=game.indexOf('function beginRun(alignPlay=false)',start);
assert.ok(start>=0&&stop>start,'Find layout implementation');
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
 let y=120,size=450,resizeHandler,scrolls=0;
 const classSet=new Set();
 const body={classList:{add(n){classSet.add(n)},contains:n=>classSet.has(n)},
  style:{setProperty(key,value){assert.equal(key,'--crilo-wheel-fit');size=parseInt(value,10)}}};
 const header={getBoundingClientRect:()=>({height:scenario.header})};
 const stage={getBoundingClientRect:()=>({top:550-y,bottom:550-y+size})};
 const button={getBoundingClientRect:()=>({bottom:550-y+size+scenario.below})};
 const document={body,documentElement:{clientWidth:scenario.w,style:{scrollBehavior:''}},
  querySelector:sel=>sel==='.wheel-stage'?stage:sel==='.topbar'?header:null};
 const window={innerWidth:scenario.w,innerHeight:scenario.h,
  visualViewport:{height:scenario.h},scrollY:y,
  addEventListener:(event,callback)=>{if(event==='resize')resizeHandler=callback},
  scrollTo(options){scrolls++;y=options.top;this.scrollY=y;assert.equal(options.behavior,'instant')}};
 const script=new Function('document','window','$','requestAnimationFrame','spinning',
  implementation+';return {fitPlayViewport,alignPlayViewport}')(
  document,window,id=>id==='spinButton'?button:null,cb=>cb(),false);
 script.fitPlayViewport(); // Called on site load, long before the first SPIN.
 const budget=Math.max(scenario.w<=700?260:300,scenario.below);
 const expected=Math.max(140,Math.floor(Math.min(600,scenario.w-24,
  scenario.h-scenario.header-budget-60)));
 assert.equal(size,expected,scenario.label+' initial diameter');
 assert.ok(size<=scenario.w-24,scenario.label+' horizontally clipped');
 assert.ok(scenario.header+size+budget+60<=scenario.h+1||
  (size===140&&scenario.h<scenario.header+budget+200),
  scenario.label+' full SPIN button should fit');
 const firstSize=size;
 script.alignPlayViewport(); // Mode selection scrolls without resizing.
 assert.equal(size,firstSize,scenario.label+' wheel changed after run selection');
 assert.equal(scrolls,1,scenario.label+' alignment at run selection');
 assert.equal(y,Math.max(0,550-scenario.header-25),scenario.label+' sticky header offset');
 resizeHandler(); // Same size viewport, no resize or scroll.
 assert.equal(size,firstSize,scenario.label+' wheel changed without viewport change');
 assert.equal(scrolls,1,scenario.label+' unintended auto-scroll');
 assert.ok(classSet.has('wheel-session-fit'),scenario.label+' initial fit class');
 console.log('PASS '+scenario.label+': '+scenario.w+'x'+scenario.h+
  ', wheel remains '+size+'px before and after play begins');
}
console.log('PASS: stable single-size wheel, Safari zoom prevention and full SPIN button visibility.');
