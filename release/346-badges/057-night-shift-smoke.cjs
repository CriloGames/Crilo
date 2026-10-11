/* Keep Crilo Spinning — free 3D shape playground smoke checks. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'support.html'),'utf8');
const css=fs.readFileSync(path.join(root,'support-pastel.css'),'utf8');
const js=fs.readFileSync(path.join(root,'support-pastel.js'),'utf8');
const music=fs.readFileSync(path.join(root,'shape-of-sound.html'),'utf8');
assert.match(html,/id="supportPayLink"/);
assert.equal((html.match(/id="supportPayLink"/g)||[]).length,1,'Exactly one PayPal checkout');
assert.equal((html.match(/data-amount="/g)||[]).length,4,'Keep four voluntary amounts');
assert.ok(!html.includes('id="nightShift"')&&!html.includes('id="soundStage"'),'No old embedded games');
assert.ok(!html.includes('id="accountBtn"')&&!html.includes('app.js'),'No sign-in required');
assert.ok(html.includes('support-pastel.css?v=6')&&html.includes('support-pastel.js?v=5'),'New gameplay assets');
assert.ok(html.includes('family=Manrope')&&css.includes('font-family:"Manrope"'),'Clean modern font');
assert.ok(css.includes('.tip-card h1 span{display:block;color:#9b78b0'),'Headline unchanged');
for(const id of ['shapeCanvas','shapeStatus','shapeGravity','shapeReset','shapeDelete']){
 assert.ok(html.includes('id="'+id+'"'),'Missing shape control '+id);
}
for(const kind of ['cube','slab','cylinder','sphere','prism','arch']){
 assert.ok(html.includes('data-add-shape="'+kind+'"'),'Missing shape palette slot '+kind);
 assert.ok(kind==='cube'?css.includes('.toy-front')&&css.includes('.toy-side'):css.includes('.toy-shape.type-'+kind),'Missing 3D rendering for '+kind);
}
for(const z of ['1','2','3']){
 assert.ok(html.includes('data-depth-layer="'+z+'"'),'Missing depth layer '+z);
}
assert.ok(css.includes('.toy-top')&&css.includes('.toy-side')&&css.includes('.toy-front'),
 'Shapes need separately shaded 3D top, side and front');
assert.ok(css.includes('.toy-handle.at-nw')&&css.includes('.toy-handle.at-ne')&&
 css.includes('.toy-handle.at-sw')&&css.includes('.toy-handle.at-se'),
 'Four resize corners');
assert.ok(js.includes('setPointerCapture')&&js.includes('pointermove')&&js.includes('data-resize'),
 'Drag and resize must use real pointer interactions');
assert.ok(js.includes('requestAnimationFrame(tick)')&&js.includes('const overlap=')&&js.includes('s.layer!==other.layer'),
 'Gravity and same-depth stacking collisions are required');
assert.ok(js.includes('localStorage.setItem')&&js.includes('localStorage.getItem'),
 'Keep arrangements when visitors return');
assert.ok(css.includes('.pastel-world .tip-card')&&css.includes('z-index:700'),
 'Smaller PayPal card stays in front of toys');
assert.ok(css.includes('@media(max-width:500px)')&&css.includes('prefers-reduced-motion:reduce'),
 'Mobile and reduced-motion layouts');
assert.ok(!/fetch\(|\.rpc\(|supabase|paypal\.com|window\.open|location\.href/i.test(js),
 'The toy game must never request payment or backend resources');
assert.ok(music.includes('id="soundStage"')&&!music.includes('supportPayLink'),
 'The Shape of Sound remains a separate game');
assert.ok(html.includes("location.hash==='#shape-of-sound'"),'Preserve old Shape of Sound links');
console.log('PASS: Free 3D shape playground with gravity, resizing, layers and frontmost optional PayPal checkout.');
