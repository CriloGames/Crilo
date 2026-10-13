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
assert.match(index,/game\.js\?v=109/,'The signup fix must bypass existing game.js caches');
function setup(mode){
 const elements={
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
 const context={
  $:id=>elements[id],
  Crilo:{validateUsername:value=>value.length>=3?null:'Invalid username',
   refreshIdentity:async()=>{refreshed++}},
  criloDB:db,
  user:{id:'my-user-id'},
  close:id=>closed.push(id),
  location:{reload(){reloaded++}}
 };
 const save=vm.runInNewContext(source+';saveProfile',context,{filename:'game.js'});
 return {save,elements,writes,reads,closed,getState:()=>({refreshed,reloaded})};
}
(async()=>{
 let x=setup('success');
 await x.save();
 assert.deepEqual(JSON.parse(JSON.stringify(x.writes)),[{
  kind:'insert',payload:{id:'my-user-id',username:'fernfernfern',name_color:'#A5CE93'}
 }],'Initial profile must use INSERT with only permitted columns');
 assert.deepEqual(x.getState(),{refreshed:1,reloaded:1});
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
 assert.deepEqual(x.getState(),{refreshed:1,reloaded:1});
 x=setup('denied');await x.save();
 assert.match(x.elements.profileStatus.textContent,/Permission denied/);
 assert.deepEqual(x.getState(),{refreshed:0,reloaded:0});
 x=setup('success');x.elements.usernameInput.value='x';await x.save();
 assert.equal(x.writes.length,0,'Invalid usernames must be rejected before a write');
 console.log('PASS: first profile INSERT, username collision, existing-user fallback, error path and safe column allowlist.');
})().catch(e=>{console.error(e);process.exitCode=1});
