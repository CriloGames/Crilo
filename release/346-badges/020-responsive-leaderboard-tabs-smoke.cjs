/* Responsive leaderboard category strip: static CSS and simulated DOM events.
 * No real devices or user accounts are accessed in these checks. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'leaderboard.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const source=fs.readFileSync(path.join(root,'leaderboard-tabs.js'),'utf8');
/* Every main navigation page shares the same motion-safe wordmark styling. */
const brandPages=['index.html','leaderboard.html','ducks.html','profile.html',
 'settings.html','friends.html','support.html','badge-sets.html'];
for(const pageName of brandPages){
 const pageHTML=fs.readFileSync(path.join(root,pageName),'utf8');
 assert.ok(pageHTML.includes('class="brand"'),pageName+' shared wordmark missing');
 assert.ok(pageHTML.includes('style.css?v='+(['index.html','leaderboard.html','profile.html'].includes(pageName)?'96':'96')),pageName+' current shared CSS reference');
}
assert.ok(css.includes('animation:criloLogoSheen 10s ease-in-out infinite'),
 'The quiet Crilo rainbow sheen animation should be present');
assert.ok(css.includes('@keyframes criloLogoSheen'),'Wordmark sweep keyframes missing');
assert.ok(css.includes('-webkit-text-fill-color:currentColor;'),
 'Reduced-motion fallback must keep the wordmark readable');

assert.match(html,/style\.css\?v=96/);
assert.match(html,/leaderboard-tabs\.js\?v=2/);
assert.match(html,/id="leaderTabs"/);
assert.match(html,/id="leaderTabPrev"/);
assert.match(html,/id="leaderTabNext"/);
assert.equal((html.match(/class="leader-tab(?: active)?"/g)||[]).length,7);
assert.match(css,/\.leader-tabs-wrap \.leader-tabs\{[\s\S]*?flex-wrap:nowrap/);
assert.match(css,/\.leader-tabs-wrap \.leader-tab\{[\s\S]*?white-space:nowrap/);
assert.match(css,/overflow-x:auto/);
assert.ok(css.includes('.leader-tabs-wrap.tabs-fit .leader-tabs{justify-content:space-evenly}'),
 'Tabs should spread evenly on wide screens, not bunch on the left');
assert.ok(css.includes('font-size:clamp(12px,1.13vw,18px)'),
 'Desktop category labels should be more legible');
assert.match(css,/\.leader-tab-scroll\[hidden\]\{display:none!important\}/);
const widths=[320,375,393,430,600,768,820,1024,1180,1280,1440,1920];
function simulate(width){
 const handlers=new Map();
 const node=id=>{
  if(!handlers.has(id))handlers.set(id,{});
  const e=handlers.get(id);
  e.id=id;e.handlers=e.handlers||{};
  e.hidden=e.hidden??true;e.disabled=e.disabled??false;
  e.addEventListener=(name,fn)=>e.handlers[name]=fn;
  return e;
 };
 const prev=node('leaderTabPrev'),next=node('leaderTabNext'),strip=node('leaderTabs'),wrap=node('wrap');
 const classes=new Set();
 wrap.classList={toggle(name,on){if(on)classes.add(name);else classes.delete(name)},contains:name=>classes.has(name)};
 wrap.clientWidth=width;
 strip.scrollWidth=1330;
 strip.scrollLeft=0;
 strip.clientWidth=width;
 strip.scrollBy=({left})=>{
  strip.scrollLeft=Math.max(0,Math.min(strip.scrollWidth-strip.clientWidth,strip.scrollLeft+left));
  strip.handlers.scroll?.();
 };
 strip.getBoundingClientRect=()=>({left:0,right:strip.clientWidth});
 const tabs=Array.from({length:7},(_,i)=>({
  handlers:{},getBoundingClientRect:()=>({left:i*190-strip.scrollLeft,right:(i+1)*190-strip.scrollLeft}),
  addEventListener(name,fn){this.handlers[name]=fn}
 }));
 strip.querySelectorAll=()=>tabs;
 const doc={getElementById:node,querySelector:()=>wrap,fonts:{ready:Promise.resolve()}};
 const window={addEventListener(name,fn){this.events[name]=fn},events:{},visualViewport:{addEventListener(){}}};
 vm.runInNewContext(source,{document:doc,window,Math,ResizeObserver:class{observe(){}},console},
  {filename:'leaderboard-tabs.js'});
 const overflow=width<1330;
 assert.equal(prev.hidden,!overflow,width+'px: left arrow visibility');
 assert.equal(next.hidden,!overflow,width+'px: right arrow visibility');
 assert.equal(wrap.classList.contains('tabs-fit'),!overflow,
  width+'px: fully visible categories should get centered spacing');
 if(overflow){
  assert.equal(prev.disabled,true,width+'px initially cannot scroll left');
  assert.equal(next.disabled,false,width+'px can scroll right');
  strip.clientWidth=Math.max(1,width-64);
  next.handlers.click();
  assert.ok(strip.scrollLeft>0,width+'px next arrow moves strip');
  prev.handlers.click();
  assert.equal(strip.scrollLeft,0,width+'px previous arrow returns to start');
  tabs[6].handlers.click();
  assert.ok(strip.scrollLeft>0,width+'px selecting far-right tab reveals it');
 }else{
  assert.equal(prev.disabled,true);
  assert.equal(next.disabled,true);
 }
 wrap.clientWidth=1400;strip.clientWidth=1400;strip.scrollLeft=0;
 window.events.resize();
 assert.equal(prev.hidden,true,width+'px resize to wide hides arrows');
 assert.ok(wrap.classList.contains('tabs-fit'),width+'px resize centers the categories');
 wrap.clientWidth=320;strip.clientWidth=260;
 window.events.orientationchange();
 assert.equal(next.hidden,false,width+'px narrow orientation restores arrows');
 assert.equal(wrap.classList.contains('tabs-fit'),false,
  width+'px narrow orientation should revert to left-aligned scrolling');
 console.log('PASS: '+width+'px overflow controls, swipe strip, selection and resize states');
}
for(const width of widths)simulate(width);
console.log('PASS: all seven tabs stay on one nonwrapping scrollable row at tested simulated widths.');
