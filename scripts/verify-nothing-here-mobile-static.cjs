/* Offline regression for mobile pickup targeting and touch inventory.
 * This executes only the pure input helpers; full Playwright QA runs separately.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const three=read('secrets-3d-preview.js'),game=read('cube-secrets.js');
const html=read('secrets.html'),css=read('nothing-here-mobile.css');
const start=three.indexOf('function pickTouchAction(clientX,clientY){');
const end=three.indexOf('\n\n/* Accessible physical inspection:',start);
assert.ok(start>0&&end>start,'Missing occlusion-safe mobile touch picker');
const code=three.slice(start,end);
const rect={left:0,top:0,right:300,bottom:300,width:300,height:300};
const raycast=(x,y)=>
 Math.hypot(x-100,y-100)<=3?'pickup:tooth':
 Math.hypot(x-110,y-100)<=2?'front':
 Math.hypot(x-150,y-150)<=3?'gear-small':null;
const picker=new Function('renderer','pickVisibleAction',
 code+'\nreturn pickTouchAction;')(
 {domElement:{getBoundingClientRect:()=>rect}},raycast);
assert.equal(picker(100,100),'pickup:tooth','Exact touches collect');
assert.equal(picker(107,100),'pickup:tooth','Small fingertip offsets still collect');
assert.equal(picker(115,100),'pickup:tooth','Phone-sized pickup tolerance covers a larger fingertip offset');
assert.equal(picker(110,100),'pickup:tooth','Drawer casing does not steal a nearby pickup tap');
assert.equal(picker(150,150),'gear-small','A precise mechanic is not stolen by pickup tolerance');
assert.equal(picker(0,0),null,'Nothing invisible can be picked up at the edge');
assert.equal(picker(200,200),null,'Empty space is still empty');
assert.match(three,/if\(e\.pointerType==="touch"\)\s*\{\s*touchPointers\.add\(e\.pointerId\)/);
assert.match(three,/if\(multiTouchGesture\)/);
assert.match(three,/pointerType==="touch"\?17:9/);
assert.match(three,/pointerType==="touch"\?17:7/);
assert.match(three,/clearHover\(\);\n\},true\); \/\/ Run before OrbitControls/);
assert.match(three,/start\?\.inspected/);
assert.match(three,/stopInspectTimer\(\);clickStart=null/);

const a=game.indexOf('let pocketTouchStart=null,pocketTouchActivation=null;');
const b=game.indexOf('// Chromium can project',a);
assert.ok(a>0&&b>a,'Missing mobile inventory tap handlers');
const handlers=game.slice(a,b);
let selected=null,activated=[],flute=0;
const take=item=>{
 activated.push(item);
 selected=selected===item?null:item;
};
const openFlute=()=>flute++;
const pocket=new Function('take','openFlute',
 handlers+'\nreturn {clickInventory,pocketPointerDown,pocketPointerUp}')(take,openFlute);
function target(id){
 const element={dataset:{item:id},draggable:true};
 return {element,closest:()=>element};
}
function event(type,item,id=5,x=40,y=50,detail=1){
 return {type,pointerType:'touch',isPrimary:true,pointerId:id,
  clientX:x,clientY:y,detail,target:item};
}
function tap(item,detail=1){
 pocket.pocketPointerDown(event('pointerdown',item));
 pocket.pocketPointerUp(event('pointerup',item));
 pocket.clickInventory(event('click',item,5,40,50,detail));
}
const thread=target('thread');
tap(thread,0);
assert.equal(selected,'thread','One physical touch holds the item');
assert.deepEqual(activated,['thread'],
 'Safari synthetic clicks with detail=0 must not immediately deselect a touched item');
assert.equal(thread.element.draggable,false,'Touch disables native item drag');
tap(thread);
assert.equal(selected,null,'Second touch releases item');
assert.deepEqual(activated,['thread','thread']);
pocket.pocketPointerDown(event('pointerdown',thread));
pocket.pocketPointerUp(event('pointerup',thread,5,80,90));
assert.equal(activated.length,2,'A swipe/scroll must not select inventory');
pocket.clickInventory({...event('click',thread,5,80,90,0),pointerType:''});
assert.equal(selected,'thread','Keyboard synthetic click remains functional');
const fluteTarget=target('flute');
tap(fluteTarget);
assert.equal(flute,1,'Touch opens flute controls exactly once');

assert.match(html,/cube-secrets\.js\?v=94/);
assert.match(html,/secrets-3d-preview\.js\?v=282/);
assert.match(html,/nothing-here-mobile\.css\?v=1/);
assert.match(css,/touch-action:none/);
assert.match(css,/min-height:48px/);
assert.match(css,/#ncModalClose/);
const catalogText=game.split('const catalog=[')[1]?.split('];')[0]||'';
const names=[...catalogText.matchAll(/^\s*\['([^']+)'/gm)].map(m=>m[1]);
assert.equal(names.length,60,'All 60 original discoveries must remain');
assert.equal(new Set(names).size,60);
console.log('PASS Nothing Here mobile static: accurate one-tap pickup, drag-free inventory, scroll/swipe safety, keyboard, flute, gestures, full 60-secret catalog');
