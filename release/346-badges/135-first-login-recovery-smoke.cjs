'use strict';
// No real email, user creation or production database writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const game=fs.readFileSync('game.js','utf8');
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/app\.js\?v=56/);
const gameVersion=html.match(/game\.js\?v=(\d+)/);
assert.ok(gameVersion&&Number(gameVersion[1])>=112,
 'Initial sign-in client must use a sufficiently recent game bundle');
assert.match(html,/\bid="emailInput"[^>]*type="email"[^>]*autocomplete="email"/);
assert.match(game,/emailInput'\)\.addEventListener\('keydown'/);
const section=(src,start,end)=>{const a=src.indexOf(start),b=src.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'Find '+start);return src.slice(a,b);};
const send=section(game,'async function sendMagicLink(){','async function saveProfile(){');
const focusCount={value:0};
let mode='success',sent=[];
const input={value:'new@example.test',checkValidity(){return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.value)},focus(){focusCount.value++}};
const button={disabled:false},status={textContent:''};
const auth={signInWithOtp:async args=>{sent.push(args);
 if(mode==='error')return {error:{message:'Rate limit reached'}};
 if(mode==='offline')throw Error('Network unavailable');
 return {error:null};
}};
const run=vm.runInNewContext(send+';sendMagicLink',{
 $:id=>({emailInput:input,sendLinkBtn:button,authStatus:status})[id],
 criloDB:{auth},location:{origin:'https://crilo.fun',pathname:'/index.html'}
});
(async()=>{
 input.value='not-an-email';await run();
 assert.equal(sent.length,0);assert.match(status.textContent,/valid email/);assert.equal(button.disabled,false);
 input.value='new@example.test';mode='success';await run();
 assert.equal(sent.length,1);
 assert.equal(sent[0].email,'new@example.test');
 assert.equal(sent[0].options.emailRedirectTo,'https://crilo.fun/index.html');
 assert.match(status.textContent,/sign-in or confirmation link/);
 assert.equal(button.disabled,false);
 mode='error';await run();assert.match(status.textContent,/Rate limit reached/);assert.equal(button.disabled,false);
 mode='offline';await run();assert.match(status.textContent,/Network unavailable/);assert.equal(button.disabled,false);
 button.disabled=true;await run();assert.equal(sent.length,3,'Ignore concurrent sends');button.disabled=false;
 const first=section(app,'let identityGeneration=0;','// Friend activity notifications');
 function identityScenario({path='/friends.html',query='?invite=test123',profile=null,profileError=null,banned=false}={}){
  const session={user:{id:'account-1'}},returnPaths=[],saved=new Map(),events=[];
  const state={user:null,profile:null,authResolved:false};
  const db={
   auth:{getSession:async()=>({data:{session}}),signOut:async()=>({error:null})},
   rpc:async()=>({data:banned,error:null}),
   from:table=>{assert.equal(table,'profiles');return{select(){return this},eq(){return this},
    maybeSingle:async()=>({data:profile,error:profileError})}}
  };
  const context={
   identityGeneration:0,criloDB:db,authHeaderReady:false,Crilo:state,renderAccount(){},
   applyTheme(){},navigateAfterAuth(){throw Error('Unexpected navigation')},
   console:{error(){}},sessionStorage:{setItem:(k,v)=>saved.set(k,v)},
   location:{pathname:path,search:query,replace:value=>returnPaths.push(value)},
   window:{dispatchEvent:event=>events.push(event)},
   CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail}}
  };
  const load=vm.runInNewContext(first+';loadIdentity',context);
  return {load,returnPaths,saved,events,state};
 }
 const absent=identityScenario();
 await absent.load();
 assert.deepEqual(absent.returnPaths,['/index.html']);
 assert.equal(absent.saved.get('crilo_signup_return'),'/friends.html?invite=test123');
 assert.equal(absent.events.length,0,'Do not expose incomplete account on other pages');
 const home=identityScenario({path:'/index.html',query:''});
 await home.load();
 assert.equal(home.returnPaths.length,0);
 assert.equal(home.state.user.id,'account-1');
 assert.equal(home.state.profile,null,'Play page must receive missing profile and open onboarding');
 assert.equal(home.events[0].type,'crilo-auth-ready');
 const existing=identityScenario({profile:{id:'account-1',username:'Returning'}});
 await existing.load();
 assert.equal(existing.returnPaths.length,0);
 assert.equal(existing.state.profile.username,'Returning');
 const outage=identityScenario({profileError:{message:'Database unavailable'}});
 await outage.load();
 assert.equal(outage.returnPaths.length,0,'Do not interpret DB outage as a new signup');
 const ban=identityScenario({banned:true});
 await ban.load();
 assert.equal(ban.state.user,null,'Account ban must remain enforced');
 console.log('AUTH_FIRST_RUN_SMOKE_PASS: new signup, returning login, email failure recovery, existing account, missing profile, invitation return and ban check');
})().catch(error=>{console.error(error);process.exitCode=1});
