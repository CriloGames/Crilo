/* Support page Stack Lab acceptance: no sign-in or paid gameplay. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'support.html'),'utf8');
const css=fs.readFileSync(path.join(root,'support-pastel.css'),'utf8');
const js=fs.readFileSync(path.join(root,'support-pastel.js'),'utf8');
const music=fs.readFileSync(path.join(root,'shape-of-sound.html'),'utf8');
assert.match(html,/id="supportPayLink"/);
assert.equal((html.match(/id="supportPayLink"/g)||[]).length,1,'Exactly one optional PayPal checkout');
assert.equal((html.match(/data-amount="/g)||[]).length,4,'Four payment amounts preserved');
assert.ok(!html.includes('id="nightShift"')&&!html.includes('id="soundStage"'),'No unrelated embedded games');
assert.ok(!html.includes('id="accountBtn"')&&!html.includes('app.js'),'No sign-in gate');
assert.ok(html.includes('support-pastel.css?v=7')&&html.includes('support-pastel.js?v=6'),'Asset versions updated');
assert.ok(html.includes('href="index.html#more-games"'),'A direct route back home is required');
assert.ok(html.includes('family=Manrope')&&css.includes('font-family:"Manrope"'));
for(const id of ['shapeCanvas','shapeStatus','shapeSurprise','shapeReset','shapeDelete','stackProgress','stackFill','stackBest','stackCelebrate']){
 assert.ok(html.includes('id="'+id+'"'),'Missing Stack Lab control '+id);
}
for(const type of ['cube','slab','cylinder','sphere','prism','arch']){
 assert.ok(html.includes('data-add-shape="'+type+'"'),'Missing shape button '+type);
 assert.ok(type==='cube'?css.includes('.toy-front'):css.includes('.toy-shape.type-'+type),'3D type rendering '+type);
}
assert.ok(!html.includes('data-depth-layer')&&!html.includes('id="shapeGravity"'),'Remove artificial depth layers and gravity toggle');
assert.ok(css.includes('.toy-top')&&css.includes('.toy-side')&&css.includes('.toy-front'),'Visible shaded 3D faces');
assert.ok(css.includes('.toy-shape.type-cylinder .toy-side,.toy-shape.type-cylinder .toy-glint{display:none}'),
 'Cylinder cannot have detached side panel');
assert.ok(css.includes('.toy-handle.at-nw')&&css.includes('.toy-handle.at-se'),'Four resize corners');
assert.ok(js.includes('setPointerCapture')&&js.includes('pointermove')&&js.includes('held.w*factor')&&js.includes('aspect(s.type,newW)'),
 'Pointer drag and aspect-preserving resize');
assert.ok(js.includes('requestAnimationFrame(physics)')&&js.includes('supportOverlap(s,b)')&&js.includes('stackDepth(s)'),
 'Gravity, collision stacks and score');
assert.ok(js.includes('Stack complete!')&&js.includes('goal+=goal<5?2:3'),'Free game with escalating tower goals');
assert.ok(js.includes('localStorage.setItem')&&js.includes('localStorage.getItem'),'Save progress locally');
assert.ok(css.includes('z-index:700')&&css.includes('.pastel-world .tip-card'),'Donation card is frontmost');
assert.ok(css.includes('@media(max-width:550px)')&&css.includes('prefers-reduced-motion:reduce'),'Mobile and reduced-motion treatment');
assert.ok(!/fetch\(|\.rpc\(|supabase|paypal\.com|window\.open|location\.href/i.test(js),'Shape gameplay makes no paid requests');
assert.ok(html.includes("window.open('about:blank'")&&html.includes('popup=yes')&&html.includes('popup.opener=null'),
 'PayPal popup must use isolated browsing context');
assert.ok(html.includes('if(!popup)window.location.assign(checkout.href)'),'Popup-blocker fallback required');
assert.ok(music.includes('id="soundStage"')&&!music.includes('supportPayLink'),'Original music game untouched');
assert.ok(html.includes("location.hash==='#shape-of-sound'"),'Old shared music links still resolve');
console.log('PASS: Stack Lab has proportional 3D blocks, gravity, score challenge, back navigation and safe popup checkout.');
