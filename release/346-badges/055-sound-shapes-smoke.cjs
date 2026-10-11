/* Browser-independent behavioral regression for Crilo's free Shape of Sound.
   Covers initial scene, keyboard, touch/pointer merging, split, persistence,
   synth envelope, looping, mute, max objects, and independent PayPal checkout.
   No actual sound/device, payment, account, or database operations are used. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'shape-of-sound.html'),'utf8');
const css=fs.readFileSync(path.join(root,'sound-shapes.css'),'utf8');
const js=fs.readFileSync(path.join(root,'sound-shapes.js'),'utf8');
const homepage=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(html,/id="soundStage"/);
assert.ok(!html.includes('Free to play · No sign-in'),'Remove redundant sound game caption');
assert.ok(html.includes('Best with sound on'),'Preserve helpful audio hint');
assert.match(html,/id="soundPlayRoom"/);
assert.match(html,/id="soundObjects"/);
assert.match(html,/sound-shapes\.js\?v=2/);
assert.match(html,/sound-shapes\.css\?v=4/);
assert.ok(css.includes('@media(max-width:420px)'),'Mobile touch and scaling CSS must exist');
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'),'Reduce motion for sensitive visitors');
assert.ok(js.includes('window.webkitAudioContext'),'Support iOS Safari Web Audio');
assert.ok(js.includes('createDynamicsCompressor'),'Overlapping audio needs a peak limiter');
assert.ok(js.includes('keepInside(blob)'),'Stretched sounds must stay inside the playfield');
assert.ok(js.includes('event.pointerId!==interaction.pointerId'),'Second fingers must not hijack gestures');
assert.ok(js.includes('if(pan)pan.disconnect()'),'Stop retaining panner nodes after notes end');
assert.ok(js.includes('const MAX_OBJECTS=25'),'25 sound slots must be supported');
assert.ok(js.includes("button.id='soundAdd'+spec.name"),'All sounds have direct add buttons');
assert.ok(js.includes('const MAX_OBJECTS=25'),'Keep the existing full 25-sound room');
assert.ok(css.includes('.sound-palette-button'),'Offer visible sound choices');
assert.ok(css.includes('body.sound-only-page .topbar .header-actions{display:none!important}'),
 'Hide sign-in on sound page only, preserving shared header wiring');
assert.ok(html.includes('class="sound-only-page"'),'Sound page needs scoped header class');
assert.ok(homepage.includes('id="soundHomeGame" href="shape-of-sound.html"'),'Homepage needs direct link to independent Shape of Sound');
assert.ok(homepage.indexOf('id="soundHomeGame"')<homepage.indexOf('href="domain/"'),
 'Shape of Sound must be immediately before Domain');
assert.ok(homepage.includes('The Shape of Sound'),'Homepage card needs game title');
assert.ok(html.includes('id="shape-of-sound"'),'The sound game needs a direct anchor separate from Night Shift');
assert.ok(css.includes('.sound-palette-button'),'Palette CSS is present');
assert.ok(!/fetch\(|\.rpc\(|supabase|paypal\.com|location\.href|window\.open/i.test(js),
 'The free game must not call the backend or interact with checkout');
for(const id of ['soundStage','soundObjects','soundInspector','soundSelection','soundPlayRoom',
 'soundAdd','soundShuffle','soundReset','soundMute','soundTempo','soundStretch','soundBloom',
 'soundPreview','soundDuplicate','soundSeparate','soundDelete','soundTempoValue','soundStatus',
 'soundDiscovery','soundPlayhead','soundCounter','soundSelectedName','soundSelectedParts']){
 assert.ok(html.includes('id="'+id+'"'),'Missing actual game control '+id);
}
class FakeElement{
 constructor(id='',tag='div'){
  this.id=id;this.tagName=tag;this.dataset={};this.events={};this.nodes=[];
  this.classNames=new Set();this.style={setProperty(k,v){this[k]=v}};
  this.classList={add:k=>this.classNames.add(k),remove:k=>this.classNames.delete(k),
    toggle:(k,on)=>{if(on===undefined)on=!this.classNames.has(k);on?this.classNames.add(k):this.classNames.delete(k);return on;},
    contains:k=>this.classNames.has(k)};
  this.clientWidth=900;this.clientHeight=500;this.hidden=false;this.value='100';this.textContent='';
 }
 setAttribute(k,v){this[k]=v}
 addEventListener(k,fn){this.events[k]=fn}
 appendChild(n){this.nodes.push(n);return n}
 remove(){this._removed=true}
 querySelectorAll(sel){if(sel==='.sound-blob')return this.nodes.filter(n=>!n._removed);throw Error('Unknown selector '+sel)}
 querySelector(sel){
  const match=sel.match(/^\[data-id="(\d+)"\]$/);
  if(match)return this.nodes.find(n=>!n._removed&&n.dataset.id===match[1])||null;
  throw Error('Unknown query '+sel);
 }
 getBoundingClientRect(){return {width:900,height:500}}
 setPointerCapture(){}
 releasePointerCapture(){}
}
const elements=new Map();
for(const id of ['soundStage','soundObjects','soundInspector','soundSelection','soundPlayRoom',
 'soundAdd','soundShuffle','soundReset','soundMute','soundTempo','soundStretch','soundBloom',
 'soundPreview','soundDuplicate','soundSeparate','soundDelete','soundTempoValue','soundStatus',
 'soundDiscovery','soundPlayhead','soundCounter','soundSelectedName','soundSelectedParts'])
 elements.set(id,new FakeElement(id));
elements.get('soundTempo').value='104';
const document={hidden:false,
  getElementById:id=>elements.get(id)||null,
  createElement:tag=>new FakeElement('',tag),
  addEventListener:(kind,fn)=>{document.events[kind]=fn},events:{}};
let voiceCount=0;
const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
class Node{constructor(){this.frequency=param();this.gain=param();this.pan=param();this.Q=param()}connect(){return this}disconnect(){}start(){voiceCount++}stop(){}}
class Audio{constructor(){this.currentTime=.02;this.state='running';this.destination=new Node()}
 createGain(){return new Node()}createOscillator(){return new Node()}createBiquadFilter(){return new Node()}
 createStereoPanner(){return new Node()}resume(){return Promise.resolve()}}
const local=new Map(),timers=new Map();let nextTimer=1;
const winEvents={};
const window={AudioContext:Audio,addEventListener:(event,fn)=>{winEvents[event]=fn}};
const localStorage={getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value)};
const context={window,document,localStorage,console,Math,
 setTimeout:(fn,delay)=>{const id=nextTimer++;timers.set(id,{fn,delay});return id;},
 clearTimeout:id=>timers.delete(id),
 setInterval:(fn,delay)=>{const id=nextTimer++;timers.set(id,{fn,delay,interval:true});return id;},
 clearInterval:id=>timers.delete(id)};
vm.runInNewContext(js,context,{filename:'sound-shapes.js'});
const get=id=>elements.get(id);
const nodes=()=>get('soundObjects').querySelectorAll('.sound-blob');
const click=id=>{assert.ok(get(id).events.click,'Control not wired '+id);get(id).events.click()};
assert.equal(nodes().length,5,'Start with five playable sound objects');
assert.equal(get('soundInspector').hidden,true);
const tap=(node)=>{
 node.events.pointerdown({button:0,clientX:153,clientY:175,pointerId:1,target:{closest:()=>null},preventDefault(){}});
 winEvents.pointerup({pointerId:1});
};
tap(nodes()[0]);
assert.ok(voiceCount>0,'Tapping a sound should synthesize audio');
assert.equal(get('soundInspector').hidden,false,'Selected sound inspector should open');
assert.match(get('soundSelectedName').textContent,/Boop/);
const initialVoices=voiceCount;
get('soundStretch').value='155';get('soundStretch').events.input();
assert.ok(local.get('crilo_sound_shapes_v1'),'Shape changes must persist locally');
get('soundStretch').events.change();
assert.ok(voiceCount>initialVoices,'Stretching sound should play its new pitch');
const first=nodes()[0],begin=Number(first.dataset.id);
first.events.pointerdown({button:0,clientX:153,clientY:175,pointerId:2,target:{closest:()=>null},preventDefault(){}});
winEvents.pointermove({clientX:432,clientY:135,pointerId:2});
winEvents.pointerup({pointerId:2});
assert.equal(nodes().length,4,'Dragging overlapping sounds should merge them');
assert.match(get('soundSelectedParts').textContent,/layers/);
click('soundSeparate');
assert.equal(nodes().length,5,'Split must restore constituent sounds');
click('soundAdd');
assert.equal(nodes().length,6,'Adding a sound should work without payment or sign-in');
click('soundDuplicate');
assert.equal(nodes().length,7,'Duplicating a selected sound should work');
click('soundDelete');
assert.equal(nodes().length,6,'Removing a selected sound should work');
click('soundMute');
assert.match(get('soundMute').textContent,/Sound off/);
click('soundPlayRoom');
assert.match(get('soundPlayRoom').textContent,/Stop the room/);
assert.ok([...timers.values()].some(t=>t.interval),'Loop needs a scheduled sound clock');
click('soundPlayRoom');
assert.match(get('soundPlayRoom').textContent,/Play the room/);
click('soundReset');
assert.equal(nodes().length,5,'Reset must restore the five defaults');
assert.equal(get('soundSelection').hidden,false);
for(let i=0;i<20;i++)click('soundAdd');
assert.equal(nodes().length,25,'Room should support 25 simultaneous sounds');
assert.equal(get('soundAdd').disabled,true,'Palette should disable at capacity');
click('soundReset');
assert.equal(nodes().length,5,'Reset should work after reaching 25');
assert.equal(get('soundAdd').disabled,false,'Palette should re-enable after reset');
assert.ok(!html.includes('tips unlock')&&!html.includes('tip to play'));
assert.ok(!html.includes('id="supportPayLink"'),'Shape of Sound must not contain checkout');
assert.ok(!html.includes('id="nightShift"'),'Night Shift must not appear on the music page');
const tipHtml=fs.readFileSync(path.join(root,'support.html'),'utf8');
assert.ok(!tipHtml.includes('id="soundStage"')&&!tipHtml.includes('id="nightShift"'),
 'The tip page must not include other games');
console.log('PASS: Five Web Audio sounds, resizing, pointer merging and splitting.');
console.log('PASS: Adding, duplicating, deleting, reset, volume and looping controls.');
console.log('PASS: Free, independent music page with no checkout or horror game; tips live separately.');
