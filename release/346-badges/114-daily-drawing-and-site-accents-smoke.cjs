'use strict';
/* Protect the Daily finished panel, owner Test Run reset, and shared accents.
   Uses a tiny DOM harness for editor controls; no network, auth or DB writes. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('game.js'),html=read('index.html'),css=read('play-accents.css');
const from=js.indexOf('function setDrawingPanelMode(mode){');
const to=js.indexOf('async function spin()',from);
assert.ok(from>=0&&to>from,'Editor state functions missing');
const makeClassList=()=>({items:new Set(),add(x){this.items.add(x)},remove(x){this.items.delete(x)},
 toggle(x,yes){if(yes)this.add(x);else this.remove(x)},contains(x){return this.items.has(x)}});
const makeNode=()=>({textContent:'',disabled:false,classList:makeClassList()});
const names=['drawPanel','drawPanelTitle','drawPanelDescription','drawSafetyNote','drawPanelOverlayTitle','wheelWrap'];
const nodes=Object.fromEntries(names.map(n=>[n,makeNode()]));
const buttons=Array.from({length:9},makeNode);
const tools=buttons.slice(0,2);
tools[0].dataset={tool:'pen'};tools[1].dataset={tool:'fill'};
tools[0].classList.add('active');
tools.forEach(button=>button.setAttribute=(key,value)=>{button[key]=value});
nodes.drawPanel.querySelectorAll=sel=>{
 if(sel==='button,input,select')return buttons;
 assert.equal(sel,'.drawing-tool');return tools;
};
const sandbox={
 $:id=>nodes[id],drawingLocked:false,drawTool:'pen',
 stopDrawing(){},stopPixelStroke(){},closeDrawingColorPicker(){},hideDrawPlaceholder(){}
};
const code=js.slice(from,to);
const api=vm.runInNewContext(code+';({setDrawingPanelMode,lockDrawing,unlockDrawing,isLocked:()=>drawingLocked})',sandbox);
api.setDrawingPanelMode('ready');
assert.equal(nodes.drawPanelTitle.textContent,'Draw on your wheel');
assert.equal(nodes.drawPanelOverlayTitle.textContent,'');
api.lockDrawing();
assert.ok(api.isLocked());
assert.ok(buttons.every(b=>b.disabled),'All buttons including Undo/Redo must lock');
assert.ok(nodes.drawPanel.classList.contains('locked-panel'));
api.setDrawingPanelMode('complete');
assert.equal(nodes.drawPanelTitle.textContent,"Today's Daily is complete");
assert.equal(nodes.drawPanelOverlayTitle.textContent,"Today's Daily is complete");
assert.ok(tools.every(button=>!button.classList.contains('active')),
 'Completed Daily must clear all selected drawing tools');
assert.ok(tools.every(button=>button['aria-pressed']==='false'),
 'Completed Daily must expose no pressed drawing tool');
assert.ok(nodes.drawPanel.classList.contains('daily-finished'));
assert.ok(buttons.every(b=>b.disabled));
api.unlockDrawing();
assert.equal(api.isLocked(),false);
assert.equal(nodes.drawPanelTitle.textContent,'Draw on your wheel');
assert.equal(nodes.drawPanel.classList.contains('daily-finished'),false);
assert.ok(tools[0].classList.contains('active')&&!tools[1].classList.contains('active'),
 'New Test Runs must restore Pen selection');
assert.equal(nodes.drawPanelOverlayTitle.textContent,'');
assert.equal(nodes.drawPanel.classList.contains('locked-panel'),false);
assert.equal(nodes.wheelWrap.classList.contains('locked'),false);
assert.ok(buttons.every(b=>!b.disabled),'New owner test must re-enable editor');
api.lockDrawing();api.setDrawingPanelMode('test-complete');
assert.equal(nodes.drawPanelTitle.textContent,'Test Run finished');
assert.equal(nodes.drawPanelOverlayTitle.textContent,'Test Run finished');
api.unlockDrawing();
assert.equal(nodes.drawPanelTitle.textContent,'Draw on your wheel');
assert.match(js,/if\(data\)\{lockDrawing\(\);setDrawingPanelMode\(data\.blocked\?'unavailable':'complete'\)/,
 'Reloading a saved Daily must lock even blank drawing, without mislabeling blocked runs');
assert.match(js,/setDrawingPanelMode\(guestRun\?'guest-complete':isTest\?'test-complete':'complete'\)/,
 'Run completion must show the right user/owner/guest state');
assert.match(js,/function startTest\([^)]*\)\{[^\n]*unlockDrawing\(\)/,
 'Each owner test must reset the editor and its visual state');
assert.match(js,/if\(drawingLocked\)\{\s*dctx\.clearRect\(0,0,drawing\.width,drawing\.height\);\s*showDrawPlaceholder\(\);undoStack=\[\];redoStack=\[\];\s*\}\s*unlockDrawing\(\);/,
 'Fresh Dailies must clear prior artwork and fully unlock the drawing panel');
assert.ok(html.includes('id="drawPanelTitle"')&&html.includes('id="drawPanelDescription" role="status"')&&
 html.includes('class="draw-finished-overlay" aria-hidden="true"'),
 'Screen readers must be notified when drawing availability changes');
assert.ok(css.includes('#drawPanel.daily-finished')&&
 css.includes('html[data-theme="dark"] #drawPanel.daily-finished'),
 'Finished panel must be light gray with a matching subdued night appearance');
assert.match(css,/#drawPanel\.daily-finished>\.draw-finished-overlay\{[\s\S]*?align-items:center;justify-content:center/,
 'Completion overlay must be centered over the editing tools');
assert.match(css,/#drawPanel\.daily-finished \.drawing-tool\.active\{[\s\S]*?background:#f1f1f4!important/,
 'A stale active class cannot leak black into finished editor');
assert.match(css,/background:rgba\(221,224,230,\.77\);color:#925e69/,
 'Light-mode overlay should reveal disabled tools under dusty pastel-red text');
assert.match(css,/background:rgba\(41,46,55,\.79\);color:#d5a0a8/,
 'Dark-mode overlay must remain muted and transparent');
assert.match(css,/font-size:clamp\(19px,2\.3vw,27px\)/,
 'Completion title should be smaller than the previous oversized heading');
assert.match(css,/body\.wheel-run-active #drawPanel\.daily-finished\{[\s\S]*?display:flex!important;visibility:visible!important;opacity:1!important/,
 'Completed editor must become visible after wheel-run-active hides drawing controls');
const pages=['index.html','leaderboard.html','ducks.html','badge-sets.html',
 'profile.html','settings.html','friends.html','support.html',
 'shape-of-sound.html','domain/index.html','privacy.html','terms.html',
 'moderation.html','beetle-tricks.html','owner-analytics.html',
 'badge-art-audit.html','owner-dataset-lab.html','private-nsfw-qa.html'];
for(const p of pages){
 const link=(p.startsWith('domain/')?'../':'')+'play-accents.css?v=6';
 assert.ok(read(p).includes('href="'+link+'"'),p+' has no shared accent stylesheet');
}
assert.equal(read('CNAME').trim(),'crilo.fun');
assert.match(css,/pointer-events:none/,'Decorative lines may not intercept input');
assert.match(css,/@media\(max-width:600px\)/,'Phone accents need smaller sizes');
console.log('DAILY_DRAWING_AND_SITE_ACCENTS_PASS: full panel lock, completed state, refreshed Daily, guest/test states, Test Run reset, 18 pages, mobile/night styles');
