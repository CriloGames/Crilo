'use strict';
// Regression: first sign-in can create a profile with column-scoped grants.
// No live credentials, usernames, or production data are used.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const game=fs.readFileSync('game.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const start=game.indexOf('async function saveProfile(){');
const end=game.indexOf('function startTest(',start);
assert.ok(start>=0&&end>start,'Profile signup handler not found');
const source=game.slice(start,end);
assert.doesNotMatch(source,/\.upsert\s*\(/,'New profiles must not update the protected id column');
const gameVersion=index.match(/game\.js\?v=(\d+)/);
assert.ok(gameVersion&&Number(gameVersion[1])>=112,
 'The signup fix must bypass existing game.js caches');
function setup(mode,returnPath=''){
 const returnClasses=new Set(['hidden']);
 const returnLink={href:'',textContent:'',classList:{
  contains:name=>returnClasses.has(name),
  toggle:(name,show)=>show?returnClasses.add(name):returnClasses.delete(name)
 },removeAttribute(name){if(name==='href')this.href=''}};
 const elements={
  signupReturnLink:returnLink,
  usernameInput:{value:'fernfernfern'},
  nameColorInput:{value:'#A5CE93'},
  profileStatus:{textContent:''},
  saveProfileBtn:{disabled:false}
 };
 const writes=[],reads=[],closed=[];
 let refreshed=0,reloaded=0;
 const db={
  from(table){
   assert.equal(table,'profiles');
   return {
    async insert(payload){
     writes.push({kind:'insert',payload});
     if(mode==='taken'||mode==='existing')return {error:{code:'23505',message:'Duplicate'}};
     if(mode==='denied')return {error:{code:'42501',message:'Permission denied'}};
     return {error:null};
    },
    select(fields){
     assert.equal(fields,'id');
     return {eq(key,value){
      reads.push([key,value]);
      return {async maybeSingle(){
       return {data:mode==='existing'?{id:'my-user-id'}:null,error:null};
      }};
     }};
    },
    update(payload){
     writes.push({kind:'update',payload});
     return {eq:async(key,id)=>{
      reads.push([key,id]);return {error:null};
     }};
    }
   };
  }
 };
 const saved=new Map(returnPath?[['crilo_signup_return',returnPath]]:[]);
 const context={
  $:id=>elements[id],
  sessionStorage:{getItem:key=>saved.get(key)||null,removeItem:key=>saved.delete(key)},
  Crilo:{validateUsername:value=>value.length>=3?null:'Invalid username',
   refreshIdentity:async()=>{refreshed++}},
  criloDB:db,
  user:{id:'my-user-id'},
  close:id=>closed.push(id),
  location:{pathname:'/index.html',search:'',reload(){reloaded++},replace(){reloaded++}}
 };
 const save=vm.runInNewContext(source+';saveProfile',context,{filename:'game.js'});
 return {save,elements,writes,reads,closed,returnLink,saved,getState:()=>({refreshed,reloaded})};
}
(async()=>{
 let x=setup('success');
 await x.save();
 assert.deepEqual(JSON.parse(JSON.stringify(x.writes)),[{
  kind:'insert',payload:{id:'my-user-id',username:'fernfernfern',name_color:'#A5CE93'}
 }],'Initial profile must use INSERT with only permitted columns');
 assert.deepEqual(x.getState(),{refreshed:1,reloaded:0});
 assert.deepEqual(x.closed,['profileModal']);
 assert.equal(x.elements.saveProfileBtn.disabled,false);
 x=setup('taken');await x.save();
 assert.deepEqual(x.getState(),{refreshed:0,reloaded:0});
 assert.match(x.elements.profileStatus.textContent,/username is taken/);
 x=setup('existing');await x.save();
 assert.deepEqual(JSON.parse(JSON.stringify(x.writes[1])),{
  kind:'update',payload:{username:'fernfernfern',name_color:'#A5CE93'}
 },'Existing own profile may update editable columns without changing id');
 assert.deepEqual(x.reads,[['id','my-user-id'],['id','my-user-id']]);
 assert.deepEqual(x.getState(),{refreshed:1,reloaded:0});
 x=setup('denied');await x.save();
 assert.match(x.elements.profileStatus.textContent,/Permission denied/);
 assert.deepEqual(x.getState(),{refreshed:0,reloaded:0});
 x=setup('success','/friends.html?invite=invite123');await x.save();
 assert.equal(x.getState().reloaded,0,'Saving a new profile must not navigate or reload');
 assert.equal(x.returnLink.href,'/friends.html?invite=invite123');
 assert.match(x.returnLink.textContent,/friend invitation/);
 assert.equal(x.returnLink.classList.contains('hidden'),false);
 assert.equal(x.saved.has('crilo_signup_return'),false);
 x=setup('success','//outside.example');await x.save();
 assert.equal(x.returnLink.classList.contains('hidden'),true,'External return links must remain hidden');
 x=setup('success');x.elements.usernameInput.value='x';await x.save();
 assert.equal(x.writes.length,0,'Invalid usernames must be rejected before a write');
 console.log('PASS: first profile INSERT, username collision, existing-user fallback, error path and safe column allowlist.');
})().catch(e=>{console.error(e);process.exitCode=1});
