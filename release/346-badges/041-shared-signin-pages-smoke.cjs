/* Shared header sign-in on every Crilo page: DOM + Supabase stub checks.
 * No real email is sent; this test never touches production user data.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const pages=['index.html','leaderboard.html','ducks.html','badge-sets.html',
 'profile.html','friends.html','settings.html','moderation.html'];
for(const page of pages){
 const html=fs.readFileSync(path.join(root,page),'utf8');
 assert.match(html,/\bid="accountBtn"/,'Missing account button on '+page);
 assert.match(html,/\bid="accountMenu"/,'Missing account dropdown on '+page);
 assert.match(html,/app\.js\?v=38/,'Old cached script on '+page);
}
assert.match(app,/window\.addEventListener\('crilo-signin-request'/);
assert.match(app,/document\.addEventListener\('click',e=>/);

function createPage(home=false){
 const nodeMap=new Map(),events=new Map(),sent=[],created=[];
 class Fake{
  constructor(id=''){this.id=id;this.textContent='';this.value='';this.disabled=false;
   this.hidden=false;this.style={};this.dataset={};this.children=[];this.handlers=new Map();
   this.classNames=new Set(['hidden']);
   this.classList={
    add:(x)=>this.classNames.add(x),remove:(x)=>this.classNames.delete(x),
    contains:(x)=>this.classNames.has(x),
    toggle:(x)=>{if(this.classNames.has(x)){this.classNames.delete(x);return false;}
     this.classNames.add(x);return true;}
   };
  }
  addEventListener(k,fn){const list=this.handlers.get(k)||[];list.push(fn);this.handlers.set(k,list)}
  dispatch(k,event){return Promise.all((this.handlers.get(k)||[]).map(fn=>fn(event)))}
  focus(){this.focused=true}
  contains(x){return this===x}
  appendChild(x){this.children.push(x);created.push(x);return x}
  querySelector(sel){this.nodes=this.nodes||new Map();if(!this.nodes.has(sel))this.nodes.set(sel,new Fake(sel));return this.nodes.get(sel)}
  setAttribute(key,val){this[key]=val}
  checkValidity(){return this.value.includes('@')&&this.value.includes('.')}
 }
 const account=new Fake('accountBtn'),menu=new Fake('accountMenu');
 nodeMap.set('accountBtn',account);nodeMap.set('accountMenu',menu);
 if(home)nodeMap.set('authModal',new Fake('authModal'));
 const document={
  documentElement:{dataset:{},style:{}},body:new Fake('body'),hidden:false,
  getElementById:(id)=>nodeMap.get(id)||null,createElement:id=>new Fake(id),
  querySelector:(sel)=>sel==='.modal-backdrop:not(.hidden)'?
   (created.find(n=>n.id==='criloSharedAuthModal'&&!n.classList.contains('hidden'))||null):null,
  querySelectorAll:()=>[],addEventListener:(name,fn)=>{
   const key='doc:'+name,items=events.get(key)||[];items.push(fn);events.set(key,items)}
 };
 const winEvents=new Map();
 const window={scrollY:0,scrollTo:()=>{},addEventListener:(name,fn)=>{
  const fns=winEvents.get(name)||[];fns.push(fn);winEvents.set(name,fns);
 },dispatchEvent:(event)=>{
  for(const fn of winEvents.get(event.type)||[])fn(event);
  return true;
 }};
 const auth={
  getSession:async()=>({data:{session:null},error:null}),
  signInWithOtp:async args=>{sent.push(args);return{error:null}},
  signOut:async()=>({error:null}),onAuthStateChange:()=>{}
 };
 const db={auth,rpc:async()=>({data:false,error:null}),from:()=>({
  select(){return this},eq(){return this},maybeSingle:async()=>({data:null,error:null})
 })};
 const location={origin:'https://crilo.fun',pathname:'/leaderboard.html',search:'',hash:''};
 const context={
  window,document,location,criloDB:db,
  localStorage:{getItem:()=>null,setItem(){}},history:{replaceState(){}},
  CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail}},
  MutationObserver:class{observe(){}},
  setTimeout(){return 0},setInterval(){return 0},
  URLSearchParams,Date,console:{log(){},error(){},warn(){}}
 };
 vm.runInNewContext(app,context,{filename:'app.js'});
 const click=()=>{for(const fn of events.get('doc:click')||[])fn({target:account})};
 return {window,account,menu,document,created,sent,click,auth,Fake};
}
(async()=>{
 const page=createPage();
 page.click();
 assert.equal(page.created.length,1,'Header sign-in should create modal on other pages');
 const modal=page.created[0];
 assert.equal(modal.id,'criloSharedAuthModal');
 assert.equal(modal.classList.contains('hidden'),false);
 assert.ok(modal.innerHTML.includes('criloSharedAuthEmail'),'Modal needs email input');
 assert.ok(modal.innerHTML.includes('criloSharedAuthSend'),'Modal needs send button');
 assert.ok(modal.querySelector('#criloSharedAuthEmail').focused,'Focus on email entry');
 page.click();
 assert.equal(page.created.length,1,'Clicking sign-in twice must reuse the same modal');
 const email=modal.querySelector('#criloSharedAuthEmail');
 const form=modal.querySelector('#criloSharedAuthForm');
 const status=modal.querySelector('#criloSharedAuthStatus');
 const send=modal.querySelector('#criloSharedAuthSend');
 let prevented=false;
 await form.dispatch('submit',{preventDefault:()=>{prevented=true}});
 assert.ok(prevented);
 assert.equal(page.sent.length,0,'Empty email must not send anything');
 assert.match(status.textContent,/valid email/);
 email.value='player@example.com';
 await form.dispatch('submit',{preventDefault(){}});
 assert.equal(page.sent.length,1);
 assert.equal(page.sent[0].email,'player@example.com');
 assert.equal(page.sent[0].options.emailRedirectTo,'https://crilo.fun/leaderboard.html');
 assert.equal(send.disabled,false,'Submit button must be available after response');
 assert.match(status.textContent,/Check your email/);
 page.auth.signInWithOtp=async()=>({error:{message:'Rate limit reached'}});
 await form.dispatch('submit',{preventDefault(){}});
 assert.match(status.textContent,/Rate limit reached/,'Backend error visible');
 assert.equal(send.disabled,false);
 page.window.dispatchEvent({type:'crilo-auth-error',detail:{message:'expired'}});
 assert.match(status.textContent,/expired/,'Callback errors visible on non-home pages');
 modal.querySelector('[data-shared-auth-close]').dispatch('click',{});
 assert.equal(modal.classList.contains('hidden'),true);
 assert.ok(page.account.focused,'Close returns focus to sign-in button');
 page.click();
 assert.equal(modal.classList.contains('hidden'),false);
 page.window.dispatchEvent({type:'crilo-auth-ready',detail:{user:{id:'signedin'},profile:{username:'Player'}}});
 assert.equal(modal.classList.contains('hidden'),true,'Sign-in closes the shared modal');
 page.window.Crilo.user={id:'signedin'};
 page.click();
 assert.equal(modal.classList.contains('hidden'),true,'Signed-in button must not reopen login');
 assert.equal(page.menu.classList.contains('hidden'),false,'Signed-in button opens account menu');
 const home=createPage(true);
 home.click();
 assert.equal(home.created.length,0,'Do not duplicate home page existing auth modal');
 console.log('PASS: all eight header pages load shared sign-in code.');
 console.log('PASS: nonhome sign-in modal opens, focuses, and sends correct OTP redirect.');
 console.log('PASS: validation, error handling, close/focus, login menu and home isolation.');
})().catch(error=>{console.error(error);process.exitCode=1});
