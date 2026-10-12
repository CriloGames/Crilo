'use strict';
/* Daily editor state regression: no visible overlay text, controls stay
   disabled until a fresh Daily or owner Test Run. No live database needed. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('game.js'),html=read('index.html'),css=read('daily-drawing-state.css');
const begin=js.indexOf('function setDrawingPanelMode(mode){');
const end=js.indexOf('async function spin()',begin);
assert.ok(begin>=0&&end>begin,'Drawing editor state functions missing');
const makeClassList=()=>({
  items:new Set(),add(x){this.items.add(x)},remove(x){this.items.delete(x)},
  toggle(x,value){value?this.add(x):this.remove(x)},contains(x){return this.items.has(x)}
});
const makeNode=()=>({textContent:'',disabled:false,classList:makeClassList()});
const nodes=Object.fromEntries(['drawPanel','drawPanelTitle','drawPanelDescription',
 'drawSafetyNote','wheelWrap'].map(key=>[key,makeNode()]));
const buttons=Array.from({length:9},makeNode),tools=buttons.slice(0,2);
tools[0].dataset={tool:'pen'};tools[1].dataset={tool:'fill'};
tools[0].classList.add('active');
for(const b of tools)b.setAttribute=(name,value)=>{b[name]=value};
nodes.drawPanel.querySelectorAll=selector=>{
 if(selector==='.drawing-tool')return tools;
 assert.equal(selector,'button,input,select');
 return buttons;
};
const sandbox={
 $:key=>nodes[key],drawingLocked:false,drawTool:'pen',
 stopDrawing(){},stopPixelStroke(){},closeDrawingColorPicker(){},hideDrawPlaceholder(){}
};
const api=vm.runInNewContext(js.slice(begin,end)+
 ';({setDrawingPanelMode,lockDrawing,unlockDrawing,isLocked:()=>drawingLocked})',sandbox);
api.setDrawingPanelMode('ready');
assert.equal(nodes.drawPanelTitle.textContent,'Draw on your wheel');
api.lockDrawing();
assert.ok(api.isLocked()&&buttons.every(b=>b.disabled),
 'All editor controls, including Undo/Redo, must be locked');
api.setDrawingPanelMode('complete');
assert.equal(nodes.drawPanelTitle.textContent,"Today's Daily is complete",
 'Accessible completion text should remain in the live region');
assert.ok(nodes.drawPanel.classList.contains('daily-finished'));
assert.ok(tools.every(b=>!b.classList.contains('active')&&b['aria-pressed']==='false'),
 'Neither Pen nor Fill may remain selected during completion');
assert.ok(buttons.every(b=>b.disabled),'Completion controls must remain disabled');
api.unlockDrawing();
assert.ok(!api.isLocked()&&!nodes.drawPanel.classList.contains('daily-finished'));
assert.equal(nodes.drawPanelTitle.textContent,'Draw on your wheel');
assert.ok(buttons.every(b=>!b.disabled),'New owner Test Run must re-enable controls');
assert.ok(tools[0].classList.contains('active'),'New run must restore Pen selection');
api.lockDrawing();api.setDrawingPanelMode('test-complete');
assert.equal(nodes.drawPanelTitle.textContent,'Test Run finished');
api.unlockDrawing();
assert.equal(nodes.drawPanelTitle.textContent,'Draw on your wheel');
api.lockDrawing();api.setDrawingPanelMode('guest-complete');
assert.ok(nodes.drawPanel.classList.contains('daily-finished'));
api.unlockDrawing();
assert.match(js,/if\(data\)\{lockDrawing\(\);setDrawingPanelMode\(data\.blocked\?'unavailable':'complete'\)/,
 'Refreshed finished Dailies must remain disabled');
assert.match(js,/setDrawingPanelMode\(guestRun\?'guest-complete':isTest\?'test-complete':'complete'\)/,
 'Guest, owner Test and official runs must remain distinct');
assert.match(js,/function startTest\([^)]*\)\{[^\n]*unlockDrawing\(\)/,
 'Each owner Test Run must reset the editor');
assert.match(js,/if\(drawingLocked\)\{\s*dctx\.clearRect\(0,0,drawing\.width,drawing\.height\);\s*showDrawPlaceholder\(\);undoStack=\[\];redoStack=\[\];\s*\}\s*unlockDrawing\(\);/,
 'A truly new Daily clears the previous drawing and unlocks the editor');
assert.match(html,/id="drawPanelDescription" role="status" aria-live="polite"/,
 'Completion information must remain accessible');
assert.doesNotMatch(html,/drawPanelOverlayTitle|draw-finished-overlay/,
 'No visible completion text overlay may be in the DOM');
assert.doesNotMatch(js,/drawPanelOverlayTitle/,
 'The runtime should not reference removed overlay text elements');
assert.match(css,/#drawPanel\.daily-finished>div:first-child\{opacity:0\}/,
 'Hide the old heading without removing its accessible message');
assert.match(css,/#drawPanel\.daily-finished::after\{[\s\S]*?background:rgba\(215,219,225,\.43\)/,
 'Finished state must use a light, translucent, text-free gray scrim');
assert.match(css,/html\[data-theme="dark"\] #drawPanel\.daily-finished::after\{\s*background:rgba\(55,60,70,\.39\)/,
 'Dark mode must use a restrained translucent gray');
assert.match(css,/#drawPanel\.daily-finished \.drawing-tool\.active\{[\s\S]*?background:#f2f3f5!important/,
 'A stale active Pen button cannot bleed through');
assert.match(css,/body\.wheel-run-active #drawPanel\.daily-finished\{[\s\S]*?display:flex!important/,
 'Finished editor must become visible after wheel spin');
assert.equal(read('CNAME').trim(),'crilo.fun');
console.log('DAILY_DRAWING_STATE_PASS: text-free translucent overlay, controls locked, owner Test resets, both themes');
