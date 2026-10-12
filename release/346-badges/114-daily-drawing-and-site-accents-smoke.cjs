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
 'drawSafetyNote','drawCompleteHeading','drawCompleteDetail','wheelWrap'].map(key=>[key,makeNode()]));
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
assert.equal(nodes.drawPanelTitle.textContent,'Drawing Studio');
api.lockDrawing();
assert.ok(api.isLocked()&&buttons.every(b=>b.disabled),
 'All editor controls, including Undo/Redo, must be locked');
api.setDrawingPanelMode('complete');
assert.equal(nodes.drawPanelTitle.textContent,"Today's Daily is complete",
 'Accessible completion text should remain in the live region');
assert.ok(nodes.drawPanel.classList.contains('daily-finished'));
assert.equal(nodes.drawCompleteHeading.textContent,'Daily complete · Drawing locked');
assert.match(nodes.drawCompleteDetail.textContent,/next Daily/,
 'The completion badge must explain when drawing becomes available again');
assert.ok(tools.every(b=>!b.classList.contains('active')&&b['aria-pressed']==='false'),
 'Neither Pen nor Fill may remain selected during completion');
assert.ok(buttons.every(b=>b.disabled),'Completion controls must remain disabled');
api.unlockDrawing();
assert.ok(!api.isLocked()&&!nodes.drawPanel.classList.contains('daily-finished'));
assert.equal(nodes.drawPanelTitle.textContent,'Drawing Studio');
assert.ok(buttons.every(b=>!b.disabled),'New owner Test Run must re-enable controls');
assert.ok(tools[0].classList.contains('active'),'New run must restore Pen selection');
api.lockDrawing();api.setDrawingPanelMode('test-complete');
assert.equal(nodes.drawPanelTitle.textContent,'Test Run finished');
assert.equal(nodes.drawCompleteHeading.textContent,'Test Run finished · Drawing locked');
assert.match(nodes.drawCompleteDetail.textContent,/another Test Run/);
api.unlockDrawing();
assert.equal(nodes.drawPanelTitle.textContent,'Drawing Studio');
api.lockDrawing();api.setDrawingPanelMode('guest-complete');
assert.ok(nodes.drawPanel.classList.contains('daily-finished'));
assert.equal(nodes.drawCompleteHeading.textContent,'Guest Daily complete · Drawing locked');
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
assert.match(html,/id="drawCompleteNote" class="draw-complete-note" aria-hidden="true"/,
 'Visible status must be inside the drawing panel rather than over the canvas');
for(const id of ['ownerCompleteRecap','ownerCompleteScore',
 'ownerCompleteNext','resultNextDaily','resultNextCountdown']){
 assert.ok(html.includes('id="'+id+'"'),'Missing completed-run summary element '+id);
}
assert.match(js,/function showDailyRecap\(record,mode='official'\)/,
 'Saved Daily recap helper must exist');
assert.match(js,/function syncDailyCountdown\(clock\)/,
 'Countdown should reuse existing next-reset timer');
assert.match(html,/daily-drawing-state\.css\?v=18/,'Play must use updated drawing stylesheet');
assert.match(html,/game\.js\?v=96/,'Play must load the updated state and viewport logic');
assert.ok(!html.includes('dailyCompleteDetails')&&!html.includes('completedDailyScore'),
 'No redundant completion tiles should remain in the page');
assert.ok(css.includes('#drawPanel.locked-panel .recent-colors {visibility:hidden!important}'),
 'Locked drawing must reserve recent swatch space without showing colors');
assert.ok(!html.includes('score-motion.js')&&!html.includes('score-motion.css'),
 'Play page must not load the repeating score-digit bobbing assets');
assert.ok(css.includes('#wheelScorePanel .wheel-score-amount{')&&
 css.includes('font-size:clamp(35px,4.3vw,49px)'),
 'Play score should be a little smaller on desktop');
assert.ok(css.includes('font-size:clamp(31px,7.5vw,43px)'),
 'Play score should be slightly smaller on phones');
assert.match(js,/const desktopCap=viewportWidth>=1024/,
 'Wheel size must be calculated once with a more compact desktop cap');
assert.match(css,/\.hero #playedPanel\{margin-top:11px;padding:15px 18px\}/,
 'Run completion panel should sit nearer the stats without losing its controls');
assert.doesNotMatch(html,/drawPanelOverlayTitle|draw-finished-overlay/,
 'No visible completion text overlay may be in the DOM');
assert.doesNotMatch(js,/drawPanelOverlayTitle/,
 'The runtime should not reference removed overlay text elements');
assert.match(css,/#drawPanel\.daily-finished>div:first-child\{[\s\S]*?opacity:1!important/,
 'The new lock badge must remain legible above the transparent scrim');
assert.match(css,/#drawPanel\.daily-finished #drawPanelDescription,[\s\S]*?position:absolute!important/,
 'Keep old accessible status available but visually hidden');
assert.match(css,/#drawPanel\.daily-finished \.draw-complete-note\{[\s\S]*?display:flex/,
 'Only completed runs should reveal the inline status');
assert.match(css,/#drawPanel\.daily-finished::after\{[\s\S]*?background:rgba\(215,219,225,\.43\)/,
 'Finished state must use a light, translucent, text-free gray scrim');
assert.match(css,/html\[data-theme="dark"\] #drawPanel\.daily-finished::after\{\s*background:rgba\(55,60,70,\.39\)/,
 'Dark mode must use a restrained translucent gray');
assert.match(css,/#drawPanel\.daily-finished \.drawing-tool\.active\{[\s\S]*?background:#f2f3f5!important/,
 'A stale active Pen button cannot bleed through');
assert.match(css,/body\.wheel-run-active #drawPanel\.daily-finished\{[\s\S]*?display:flex!important/,
 'Finished editor must become visible after wheel spin');
assert.match(css,/grid-template-columns:minmax\(220px,250px\) minmax\(0,1fr\)/,
 'Copy and tools should fit side by side on desktop');
assert.match(css,/\.hero #drawPanel:not\(\.draw-unavailable\)>\.draw-actions \{[\s\S]*?flex-direction:column;/,
 'Toolbar and recent color strip should sit on separate rows');
assert.match(css,/#drawPanel:not\(\.draw-unavailable\) \.draw-toolbar-main \{[\s\S]*?display:flex;/,
 'All original toolbar controls must share one horizontal line');
assert.match(css,/#drawPanel:not\(\.draw-unavailable\) \.draw-toolbar-row \{[\s\S]*?display:contents!important;/,
 'Former two-row wrappers must flatten into a single toolbar');
assert.match(css,/width:122px;/,
 'Center mode selector should shrink a little without hiding its selection');
assert.match(css,/font-size:10\.3px;/,
 'Buttons should be slightly smaller');
assert.match(css,/@media \(max-width:840px\)/,
 'Below desktop size, drawing instructions should stack above the controls');
assert.match(css,/@media \(max-width:600px\)/,
 'Phone controls must wrap safely');
assert.doesNotMatch(css,/grid-template-columns:max-content max-content max-content;/,
 'Uneven three-column control grid must stay removed');
assert.match(css,/#drawPanel:not\(\.draw-unavailable\) \.draw-actions #drawMode \{[\s\S]*?display:inline-block!important/,
 'Original draw mode dropdown stays visible when drawing is locked');
assert.ok(html.includes('class="draw-toolbar-row draw-toolbar-primary"')&&
 html.includes('class="draw-toolbar-row draw-toolbar-secondary"'),
 'Keep existing tool groups and bindings intact');
assert.ok(html.includes('data-tool="eraser"'),
 'Eraser must remain beside Pen and Fill');
assert.match(css,/#drawPanel:not\(\.draw-unavailable\) \.draw-toolbar-main \.recent-colors \{[\s\S]*?display:flex!important/,
 'Recent swatch area must stay rendered even before painting');
assert.match(css,/max-width:101px;/,
 'Five recent swatch circles must fit their reserved width');
assert.match(js,/if\(recentPaintColors\.length>5\)recentPaintColors\.length=5/,
 'Color history must be capped at five colors');
assert.ok(html.includes('class="draw-toolbar-main"'),
 'Toolbar controls must be grouped before the separate recent-colors strip');
assert.ok(html.includes('Up to five recently used drawing colors'),
 'Recent colors should have an accessible description');
assert.ok(html.indexOf('id="clearDrawing"')<html.indexOf('id="drawMode"')&&
 html.indexOf('id="drawColor"')<html.indexOf('id="drawRecentColors"'),
 'Clear belongs beside Undo/Redo and recent swatches must replace Clear at the far right');
assert.match(css,/#drawPanel:not\(\.draw-unavailable\) \.draw-toolbar-main \.recent-colors \{[\s\S]*?flex:0 0 106px;/,
 'Recent colors reserve exactly the same toolbar width with zero through five colors');
assert.match(css,/#drawPanel:not\(\.draw-unavailable\) \.draw-toolbar-main \.recent-color-empty-slot \{[\s\S]*?border:/,
 'Empty placeholder circles should keep the recent swatch strip full');
assert.match(css,/#drawPanel\.locked-panel \.recent-colors \{visibility:hidden!important\}/,
 'Locking artwork must hide swatches without collapsing their allocated space');
assert.match(js,/slot\.className='recent-color-empty-slot'/,
 'Client must render inert placeholders for unused recent slots');
assert.match(css,/font-size:9\.1px;/,
 'Short warning should remain visually subordinate to the Drawing Studio title');
assert.match(js,/ready:\['Drawing Studio','Draw first\. Your first spin locks the drawing\.'\]/,
 'Shorter first-spin explanation should be retained');
assert.match(js,/host\.parentElement\.classList\.toggle\('has-colors',recentPaintColors\.length>0\)/,
 'Recent swatch container must track actually used colors');
assert.match(js,/if\(kind==='main'\)continue;/,
 'Do not display an empty recent colors placeholder');
assert.match(js,/globalCompositeOperation=drawTool==='eraser'\?'destination-out':'source-over'/,
 'Eraser must remain genuinely transparent');
assert.match(js,/mode==='ready'&&button\.dataset\.tool===drawTool/,
 'Locked Pen and Fill buttons must not look active');
assert.match(html,/Inappropriate art risks an account ban\./,
 'Shortened account-ban warning must remain visible');
assert.match(css,/html\[data-theme="dark"\] \.hero #drawPanel:not\(\.daily-finished\):not\(\.locked-panel\):not\(\.draw-unavailable\)/,
 'Dark mode styling must remain present');

console.log('DAILY_DRAWING_STATE_PASS: text-free translucent overlay, controls locked, owner Test resets, both themes');
