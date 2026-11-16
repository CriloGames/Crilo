/* Cross-page owner tab and beetle footer regression.
 * Run: node scripts/verify-owner-nav-footer.cjs
 * Does not contact Supabase or modify user sessions.
 */
'use strict';
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const read=path=>readFileSync(join(__dirname,'..',path),'utf8');
const navCode=read('header-continuity.js');
const authCode=read('app.js');
const ambientCode=read('secret-wheel-ambient.js');
const navStyles=read('header-fit.css');
const pages=['index.html','leaderboard.html','ducks.html','profile.html',
 'badge-sets.html','friends.html','settings.html','moderation.html',
 'owner-analytics.html','test-games.html','five-fronts.html','secrets.html',
 'shape-of-sound.html','pong-toss.html','domain/index.html'];
for(const p of pages){
 const html=read(p);
 assert.match(html,/header-continuity\.js\?v=8/,p+' needs prepaint owner nav');
 assert.match(html,/app\.js\?v=58/,p+' must confirm owner permissions');
 assert.match(html,/header-fit\.css\?v=5/,p+' needs pending-tab styling');
}
assert.match(authCode,/testLink\.classList\.remove\('crilo-owner-pending'\)/);
assert.match(authCode,/Crilo\.profile\?\.is_owner===true/);
assert.match(navStyles,/crilo-owner-test-link\.crilo-owner-pending\{/);
assert.match(ambientCode,/footer\.getBoundingClientRect\(\)\.bottom\+window\.scrollY/);
assert.doesNotMatch(ambientCode,/Math\.max\(document\.body\.scrollHeight/);
assert.match(authCode,/secret-wheel-ambient\.js\?v=7/);
assert.match(read('index.html'),/bugBeetleTrack/);

// Minimal real execution of the actual header prepaint script with a cached
// owner, a cached non-owner, and a standalone-game header.
const makeClassList=()=>{
 const list=new Set();
 return {
  add:x=>list.add(x),remove:x=>list.delete(x),contains:x=>list.has(x),
  toggle:(x,enabled)=>{
   if(enabled===undefined)enabled=!list.has(x);
   if(enabled)list.add(x);else list.delete(x);
   return enabled;
  }
 };
};
const makeElement=tag=>({
 tagName:tag.toUpperCase(),style:{},dataset:{},classList:makeClassList(),
 attributes:{},textContent:'',tabIndex:0,
 setAttribute(k,v){this.attributes[k]=String(v)},
 removeAttribute(k){delete this.attributes[k];if(k==='tabindex')this.tabIndex=0},
 appendChild(child){(this.children||=([])).push(child);return child}
});
function runHeader(owner,standalone=false){
 const snapshot={userId:'owner-fixture',name:'owner_fixture',color:'#345678',
  letters:null,count:0,owner,time:Date.now()};
 const memory=new Map([['crilo-header-preview-v2',JSON.stringify(snapshot)]]);
 const nav=makeElement('nav');
 nav.querySelector=s=>nav.children?.find(child=>'#'+child.id===s)||null;
 const button=makeElement('button'),body=makeElement('body');
 body.classList.contains=x=>x==='crilo-standalone'&&standalone;
 const document={
  body,
  getElementById:id=>id==='accountBtn'?button:nav.querySelector('#'+id),
  querySelector:s=>s==='.topbar nav'?nav:null,
  createElement:makeElement,
  createDocumentFragment:()=>({append(){}})
 };
 const window={addEventListener(){}};
 const sessionStorage={
  getItem:k=>memory.get(k)||null,
  setItem:(k,v)=>memory.set(k,v),
  removeItem:k=>memory.delete(k)
 };
 const location={pathname:'/test-games.html'};
 const MutationObserver=class{observe(){}};
 new Function('document','window','sessionStorage','location',
  'MutationObserver','requestAnimationFrame','innerWidth',navCode)(
   document,window,sessionStorage,location,MutationObserver,()=>0,1280);
 const link=nav.querySelector('#ownerTestGamesNav');
 if(owner){
  assert.ok(link,'Owner nav must exist on first paint');
  assert.equal(link.textContent,'TEST GAMES');
  assert.equal(link.href,'test-games.html');
  assert.equal(link.classList.contains('active'),true);
  assert.equal(link.classList.contains('crilo-owner-pending'),true);
  assert.equal(link.attributes['aria-disabled'],'true');
  assert.equal(link.tabIndex,-1);
  const user={id:'owner-fixture'};
  const profile={id:user.id,username:'owner_fixture',name_color:'#345678',
   is_owner:true,name_letter_colors:null};
  window.CriloHeaderContinuity.save(user,profile);
  assert.equal(link.classList.contains('crilo-owner-pending'),false);
  assert.equal(link.attributes['aria-disabled'],undefined);
  assert.equal(link.tabIndex>=0,true);
  assert.equal(nav.querySelector('#ownerTestGamesNav'),link,
   'Verified auth should reuse the exact same node instead of flickering');
 }else assert.equal(link,undefined,'Non-owner must never see owner preview');
 return true;
}
runHeader(true);
runHeader(true,true);
runHeader(false);

// Execute the actual ambient layer, not a copied height formula. An
// artificially enormous document.scrollHeight mimics the original bug.
function runAmbient(){
 const frames=[],events={};
 const makeNode=tag=>{
  const el=makeElement(tag);
  el.hidden=false;el.style.setProperty=(k,v)=>{el.style[k]=v};
  el.append=child=>el.appendChild(child);
  el.contains=()=>false;
  Object.defineProperty(el,'offsetWidth',{get:()=>20});
  return el;
 };
 const footer={getBoundingClientRect:()=>({bottom:620})};
 let layer=null;
 const document={
  readyState:'complete',
  head:{append(){}},
  body:{scrollHeight:7200,append(el){layer=el}},
  documentElement:{scrollHeight:9000},
  createElement:makeNode,
  querySelector:s=>s==='body > footer'?footer:null,
  querySelectorAll:()=>[]
 };
 const window={
  scrollY:0,
  addEventListener(k,callback){events[k]=callback}
 };
 const location={pathname:'/index.html'};
 const raf=cb=>{frames.push(cb);return frames.length};
 const animate=()=>{let count=0;while(frames.length&&count++<100)frames.shift()()};
 new Function('document','window','location','requestAnimationFrame',
  'innerWidth','scrollX','scrollY','setTimeout','clearTimeout',ambientCode)(
   document,window,location,raf,1400,0,0,()=>1,()=>{});
 animate();
 assert.equal(layer.style.height,'620px',
  'Ambient wheels must end at the beetle, not the document scrollHeight');
 document.body.scrollHeight=12000;
 document.documentElement.scrollHeight=16000;
 window.CriloAmbientWheels.refresh();
 animate();
 assert.equal(layer.style.height,'620px',
  'Repeated ambient layouts must not grow blank space below the footer');
}
runAmbient();
console.log('PASS Owner nav prepaint: guest isolation, no first-paint flicker, auth activation; beetle is ambient bottom boundary');
