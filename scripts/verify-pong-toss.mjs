// Node.js 20+. Run: node scripts/verify-pong-toss.mjs
// Static configuration and physics tests, NOT proof of full 3D playability.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('ping-pong-toss.js',root),'utf8');
const html=fs.readFileSync(new URL('pong-toss.html',root),'utf8');
const css=fs.readFileSync(new URL('ping-pong-toss.css',root),'utf8');
const cut=(a,b)=>{
 const i=source.indexOf(a),j=source.indexOf(b,i+a.length);
 assert(i>=0&&j>i,'Missing physics function '+a);return source.slice(i,j);
};
new Function(source);
// Keyboard shortcuts belong to the canvas/page, never a focused button,
// link, form field or other interactive game UI. Test the production guard
// expression against representative native and ARIA controls.
const keydownSource=cut("document.addEventListener('keydown',e=>{",
 "document.addEventListener('keyup',e=>{");
const guardMatch=keydownSource.match(/const inUI=([\s\S]*?);\n if\(inUI\|\|/);
assert(guardMatch,'Pong Toss keydown handler must preserve focused UI controls');
const inUI=new Function('focused',
 "const tag=focused?.tagName||'';return ("+guardMatch[1]+");");
for(const tagName of ['BUTTON','A','INPUT','TEXTAREA','SELECT','SUMMARY'])
 assert.equal(inUI({tagName}),true,'Keyboard hotkeys must skip focused '+tagName);
assert.equal(inUI({tagName:'DIV',isContentEditable:true}),true,
 'Keyboard hotkeys must skip editable elements');
assert.equal(inUI({tagName:'DIV',closest:()=>({})}),true,
 'Keyboard hotkeys must skip ARIA button/slider/link controls');
for(const tagName of ['CANVAS','BODY'])
 assert.equal(inUI({tagName,closest:()=>null}),false,
  'Keyboard aiming/Space charging must remain available on '+tagName);
assert.match(css,/\.pt-viewport:has\(\.pt-canvas:focus-visible\)/,
 'Tabbing to the 3D canvas should show a visible focus indicator');
const pieces=[
 cut('const PROJECTILES=[',"let projectileId='ping'"),
 cut('const STAGES=[','let settings=stageSettings(level);'),
 ...[
  ['function newDiscFlightState(','function windAt('],
  ['function windAt(','// Deterministic, physically visible target travel.'],
  ['function targetLocation(','// Pads act like REAL bounce surfaces'],
  ['function bounceContact(','// A moving gate has one pose'],
  ['function barrierPose(','function resolveEnvironment('],
  ['function cupSurfaceCollision(','function hoopRimCollision('],
  ['function hoopRimCollision(','function airForce('],
  ['function airForce(','function wallCollision('],
  ['function wallCollision(','function hoopMotion('],
  ['function hoopMotion(','function padRebound('],
  ['function padRebound(','function missingRequiredContact('],
  ['function missingRequiredContact(','function resolvePadAndPlatform('],
  ['function resolvePadAndPlatform(','function paintAim(']
 ].map(([a,b])=>cut(a,b))
];
const globals=[
 "const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,LAUNCH_Z=4.25,LAUNCH_Y=1.32;",
 "const chapterIndex=n=>Math.min(4,Math.floor((n-1)/10)),chapter=n=>({color:chapterIndex(n)});",
 "let settings={},projectileId='ping',physicsProfile={},GRAVITY=10.65,BALL_R=.095,frisbeeTilt=0,aimYaw=0,simTime=0,impactRing=null;",
 "let pads=[],padPlatforms=[],wallPads=[],hoops=[],fanFields=[],physicsGrid=new Map(),physicsGlobal=[],physicsMoving=[];",
 "const el={status:{}};function hear(){}function message(){}function updateObjective(){}function updateBounceCount(){}function reactToColleague(){}",
 "function lidFraction(t){return .5+.5*Math.sin(t*1.8+settings.n*.67);}"
];
function sweep(){
 let count=0,checks=0,shots=0;const failures=[];
 const ok=(valid,msg)=>{checks++;if(!valid&&failures.length<25)failures.push(msg);};
 const finite=x=>Object.values(x).every(v=>typeof v!=='number'||Number.isFinite(v));
 const ball=(x=0,y=2,z=0)=>({x,y,z,vx:0,vy:-6,vz:-5,
  wallHits:0,springHits:0,bankHits:0,hoopsPassed:0,
  disc:projectileId==='frisbee'?newDiscFlightState():undefined});
 for(const p of PROJECTILES)for(let n=1;n<=50;n++){
  count++;const tag=p.id+'/'+n;
  settings=stageSettings(n);projectileId=p.id;physicsProfile=p;
  GRAVITY=p.gravity;BALL_R=p.radius;frisbeeTilt=0;aimYaw=0;
  pads=[];padPlatforms=[];wallPads=[];hoops=[];fanFields=[];
  ok(settings.n===n&&settings.d>0,tag+' stage config');
  ok(settings.radius>p.radius*.7,tag+' target radius');
  ok(settings.padCount===settings.springFractions.length,tag+' pads');
  ok(settings.wallCount===settings.wallPlan.length,tag+' walls');
  ok(settings.barrierCount===settings.barrierPlan.length,tag+' moving gates');
  for(const [i,plan] of settings.barrierPlan.entries()){
   const [style,t,x,amp]=plan;
   const pose=barrierPose({style,centerX:settings.x*t+x,centerY:2.1,
    amp:amp||.4,speed:.72+i*.18+settings.tier*.035,phase:i*1.8+n*.17},1);
   ok(finite(pose),tag+' moving hazard finite');
  }
  for(let k=0;k<16;k++){
   const yaw=Math.atan2(settings.x,settings.d)+(k%4-1.5)*.08,
    pitch=.18+Math.floor(k/4)*.2,power=.18+(k%4)*.2,
    speed=(5.6+8.2*power)*p.speed;
   frisbeeTilt=p.id==='frisbee'?[-.55,-.22,.22,.55][k%4]:0;
   const b=ball(0,LAUNCH_Y,LAUNCH_Z);
   b.vx=Math.sin(yaw)*Math.cos(pitch)*speed;
   b.vy=Math.sin(pitch)*speed;b.vz=-Math.cos(yaw)*Math.cos(pitch)*speed;
   let valid=true;
   for(let i=0;i<120;i++){
    const h=.015;
    applyProjectileForces(b,h,i*h,{x:0,y:0});
    b.x+=b.vx*h;b.y+=b.vy*h;b.z+=b.vz*h;
    if(!finite(b)||b.disc&&!finite(b.disc)){valid=false;break}
    if(b.y<-.35)break;
   }
   shots++;ok(valid,tag+' flight NaN');
  }
  frisbeeTilt=0;
  for(const [x,y,z] of [[0,1,0],[0,-1,0],[1,0,0]]){
   const b=ball();b.vx=-5*x;b.vy=-5*y;b.vz=-5*z;
   ok(bounceContact(b,x,y,z,.03,.56,.12,0,0,0,true)&&finite(b),
    tag+' generic collision');
  }
  const grip={12:[.30],45:[.13],47:[.30],48:[.28,.14],50:[.36,.28]};
  for(let i=0;i<settings.padCount;i++){
   const f=settings.springFractions[i],
    x=settings.x*f+(settings.padCount>1?(i===0?-.15:(settings.secondPadOffset??.1)):0),
    z=LAUNCH_Z-settings.d*f,y=1.14+(settings.padCount>1&&i===1?.16:0),
    close=settings.padCount===1&&f>=.67;
   pads.push({type:'spring',index:i,x,z,y:y+.05,r:.71,
    forwardGrip:grip[n]?.[i]??(close?.30:.53),sideGrip:close?.27:.79});
  }
  if(settings.bankRequired)pads.push({type:'bank',x:settings.bankX,z:settings.bankZ,y:1.22,r:.88});
  for(const pad of pads){
   const b=ball(pad.x,pad.y+BALL_R-.03,pad.z);
   if(pad.type==='spring')b.springHits=pad.index;
   ok(resolvePadAndPlatform(b,{x:pad.x,y:pad.y+BALL_R+.09,z:pad.z},true,.12),
    tag+' pad contact');
   if(pad.type==='spring')ok(b.springHits===pad.index+1,tag+' spring order');
   if(pad.type==='bank')ok(b.bankHits===1,tag+' bank credit');
  }
  for(let i=0;i<settings.wallCount;i++){
   const w=settings.wallPlan[i],x=w.side*(w.x||2.16),z=LAUNCH_Z-settings.d*w.fraction;
   wallPads=[{x,z,y:2.42,length:w.length||3.65,height:3.55,index:i}];
   const b=ball(x-w.side*.08,2.42,z);b.vx=w.side*6;b.wallHits=i;
   ok(wallCollision(b,{x:x-w.side*.4,y:2.42,z},true)&&b.wallHits===i+1,
    tag+' wall bank');
  }
  wallPads=[];
  for(let i=0;i<settings.hoops;i++){
   const f=settings.hoops===1?.39:i===0?.24:.40;
   const ring={baseX:settings.x*f,baseY:2.1,z:LAUNCH_Z-settings.d*f,
    r:settings.hoops>1?.86:.93,phase:i*1.8+n*.16};
   hoops.push(ring);
  }
  for(let i=0;i<hoops.length;i++){
   const ring=hoops[i],pos=hoopMotion(ring,0),
    b=ball(pos.x,pos.y,ring.z-.20);
   b.hoopsPassed=i;b.vz=-5;
   checkHoopCross({x:pos.x,y:pos.y,z:ring.z+.20},b,0,true);
   ok(b.hoopsPassed===i+1,tag+' hoop');
  }
  const at=targetLocation(0),top=at.y+settings.targetHeight,b=ball(at.x,top-BALL_R-.02,at.z);
  b.wallHits=settings.wallCount;b.bankHits=settings.bankRequired?1:0;
  b.springHits=settings.padCount;b.hoopsPassed=settings.hoops;
  ok(cupEntryGate(b,top-BALL_R+.07,0,true).missing===null,tag+' credited scoring');
  const bypass=ball(at.x,top-BALL_R-.02,at.z),missing=missingRequiredContact(bypass);
  if(missing)ok(cupEntryGate(bypass,top-BALL_R+.07,0,true).missing===missing,
   tag+' must complete trick first');
  if(p.id==='frisbee'){
   const a=ball(),b=ball();a.vx=7;b.vx=-7;
   bounceContact(a,-1,0,0,.03,.75,.1,0,0,0,true);
   bounceContact(b,1,0,0,.03,.75,.1,0,0,0,true);
   ok(a.disc.trimBank<0&&b.disc.trimBank>0,tag+' frisbee rebound orientation');
  }
 }
 return {count,checks,shots,failures};
}
const results=new Function(globals.join('\n')+pieces.join('\n')+'return ('+sweep.toString()+')();')();
assert.equal(results.count,250);
assert.deepEqual(results.failures,[]);
assert(source.includes("const STORE='crilo_pong_toss_50_v1'"));
for(const theme of ['dark','light'])
 assert(css.includes('html[data-theme="'+theme+'"] body.pt-page{'));
for(const id of new Set([...source.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1])))
 assert(html.includes('id="'+id+'"'),'Missing HTML control '+id);
// Verify actual cursor aim functions, rather than duplicating the formulas.
const aimCode=cut('function inputAim(','function startCharge(');
const aimProbe=new Function([
 'const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));',
 'const LAUNCH_Z=4.25,MAX_AIM_YAW=1.02;',
 'const FRISBEE_MAX_YAW=1.34,FRISBEE_MIN_PITCH=-.18,FRISBEE_MAX_PITCH=1.28;',
 'const el={canvas:{getBoundingClientRect:()=>({left:0,top:0,width:1000,height:700})}};',
 'const settings={n:1,d:5,x:1,wallPlan:[],springRequired:false,bankRequired:false};',
 "let target={x:1},projectileId='ping',charging=false,aimPowerLocked=false;",
 'let lastMouseAimPoint=null,aimYaw=0,aimPitch=.7,power=.32,updates=0;',
 'const idealPower=()=>.4+Math.abs(aimYaw)*.08;',
 'const updatePower=()=>{updates++;};',
 aimCode,
 'const cursor={clientX:640,clientY:260};',
 'trackMouseAim(cursor);',
 'const initial={yaw:aimYaw,pitch:aimPitch,power,updates};',
 'target.x=-4;',
 'trackMouseAim(cursor);',
 'const afterIdle={yaw:aimYaw,pitch:aimPitch,power,updates};',
 'trackMouseAim({clientX:641,clientY:260});',
 'const afterOnePixel={yaw:aimYaw,pitch:aimPitch,power};',
 'aimPowerLocked=true;power=.76;',
 'trackMouseAim({clientX:642,clientY:260});',
 'const afterShot={yaw:aimYaw,pitch:aimPitch,power};',
 'return {initial,afterIdle,afterOnePixel,afterShot};'
].join('\n'))();
assert.deepEqual(aimProbe.afterIdle,aimProbe.initial,
 'A stationary mouse or moving cup must not reset the aim');
assert(Math.abs(aimProbe.afterOnePixel.yaw-aimProbe.initial.yaw)<.01,
 'A moving cup must not shift the mouse aim baseline');
assert.equal(aimProbe.afterShot.power,.76,
 'Mouse correction after throw must retain the last shot power');
// Reproduce the regression: a high recommended/previous strength used to
// become the minimum for the NEXT throw. A brief tap must now be light on
// every level, regardless of automatic trajectory suggestions.
const chargeCode=cut('function startCharge(','// Aborted touch/keyboard gestures');
const chargeProbe=new Function([
 'let playing=true,paused=false,flight=false,charging=false;',
 'let chargeSource=null,chargeFrom=0,chargeStartPower=0,chargeAnchor=0;',
 'let lastChargeAimPreview=0,gesture=null,power=.92,aimPowerLocked=true;',
 'const performance={now:()=>0};',
 'const getGameAudio=()=>{},hear=()=>{},updatePower=()=>{};',
 'const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));',
 chargeCode,
 "startCharge('pointer');",
 'const instant=power;',
 'chargeTick(100);const tap=power;',
 'chargeTick(1000);const medium=power;',
 'chargeTick(2000);const maximum=power;',
 'charging=false;power=.98;',
 "startCharge('keyboard');const retry=power;",
 'return {instant,tap,medium,maximum,retry};'
].join('\n'))();
assert.equal(chargeProbe.instant,.06,'A fresh charge must start at 6%');
assert(chargeProbe.tap>.06&&chargeProbe.tap<.14,
 'A quick tap must actually throw gently: '+JSON.stringify(chargeProbe));
assert(chargeProbe.medium>.50&&chargeProbe.medium<.75,
 'Medium holds must still reach controllable intermediate strength');
assert.equal(chargeProbe.maximum,1,'Long holds must still reach full power');
assert.equal(chargeProbe.retry,.06,
 'A previous full-power throw must not prevent light retry throws');
assert(source.includes("if(e.pointerType==='touch')flickAim(e);")&&
 source.includes("else trackMouseAim(e);"),
 'Mouse release must not apply the relative touch flick');
assert(source.includes('loadLevel(level,{keepAim:true})'),
 'Restart must preserve the aiming line');
// Deterministic late-frisbee route witnesses, using the REAL glide,
// impacted-disc and spring-rebound functions from the game. The previous
// level-48 second plate retained 14% of forward velocity; the frisbee
// could hit both springs but stall short of the elevated cup. Include
// mandatory ring clearance on level 47 and both sequential pads on 48.
// This is a core-flight regression, not a substitute for visual WebGL QA.
const lateSections=[
 cut('const STAGES=[','let settings=stageSettings(level);'),
 cut('function makeVelocity(','function windAt('),
 cut('function windAt(','// Deterministic, physically visible target travel.'),
 cut('function targetLocation(','// Pads act like REAL bounce surfaces'),
 cut('function padRebound(','// Shared by live flight')
].join('\n');
const latePaths=new Function([
 'const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),LAUNCH_Z=4.25,LAUNCH_Y=1.32;',
 'const chapterIndex=n=>Math.min(4,Math.floor((n-1)/10)),chapter=n=>({color:0x8ae1cd});',
 "let projectileId='frisbee',physicsProfile={speed:1.07,gravity:9.8,pad:1.03,air:1.25},",
 'GRAVITY=9.8,BALL_R=.125,frisbeeTilt=0,aimYaw=0,aimPitch=.4,settings={},level=47;',
 lateSections,
 `const routes=[
 {n:47,yaw:-.07553259887419518,pitch:.4289970292476938,
  power:.15668390152044592,tilt:-.1242188704898581,
  shift:2.4109215047210455},
 {n:48,yaw:.14500233882515512,pitch:.2968657734105363,
  power:.07456723073497415,tilt:-.01991021486464888,
  shift:.0700331018306315}
 ];
 function flight(route){
  settings=stageSettings(route.n);
  aimYaw=route.yaw;aimPitch=route.pitch;frisbeeTilt=route.tilt;
  const v=makeVelocity(route.power),
   b={x:0,y:LAUNCH_Y,z:LAUNCH_Z,...v,
    disc:newDiscFlightState(),springHits:0,hoopsPassed:0};
  const grips=route.n===47?[.50]:[.55,.56];
  const pads=settings.springFractions.map((f,i)=>({
   type:'spring',index:i,
   x:settings.x*f+(settings.padCount>1?
    (i===0?-.15:settings.secondPadOffset??.10):0),
   z:LAUNCH_Z-settings.d*f,
   y:1.14+(i===1&&settings.padCount>1?.16:0)+.05,
   r:.71,forwardGrip:grips[i],sideGrip:.79
  }));
  const hoops=[];
  for(let i=0;i<settings.hoops;i++){
   const f=settings.hoops===1?.39:i===0?.24:.40;
   const pitch=settings.springRequired?.32:settings.bankRequired?.31:.70;
   const dist=settings.d*f,
    range=settings.springRequired?LAUNCH_Z-settings.springZ:
     Math.hypot(settings.d,settings.x);
   const height=settings.springRequired?1.21+BALL_R:
    .19+settings.topPad+settings.targetHeight-BALL_R;
   const speed=Math.sqrt(Math.max(1,GRAVITY*range*range/
    Math.max(.08,2*Math.cos(pitch)**2*
     (range*Math.tan(pitch)+LAUNCH_Y-height))));
   const effective=(clamp((speed/physicsProfile.speed-5.6)/8.2,.06,.97)*8.2+5.6)*
    physicsProfile.speed;
   const flightTime=dist/(Math.cos(pitch)*effective);
   const y=clamp(LAUNCH_Y+Math.sin(pitch)*effective*flightTime-
    GRAVITY*flightTime*flightTime*.5,1.05,5.4);
   hoops.push({x:settings.x*f,y,z:LAUNCH_Z-dist,r:.93});
  }
  for(let j=0;j<580;j++){
   const h=.014,time=j*h+route.shift,previous={x:b.x,y:b.y,z:b.z};
   applyProjectileForces(b,h,time,{x:0,y:0});
   b.x+=b.vx*h;b.y+=b.vy*h;b.z+=b.vz*h;
   if(b.vz<0&&b.hoopsPassed<hoops.length){
    const hoop=hoops[b.hoopsPassed];
    if(previous.z>=hoop.z&&b.z<=hoop.z){
     const f=clamp((previous.z-hoop.z)/(previous.z-b.z),0,1);
     const x=previous.x+(b.x-previous.x)*f,
      y=previous.y+(b.y-previous.y)*f;
     if(Math.hypot(x-hoop.x,y-hoop.y)<hoop.r-BALL_R*.75)
      b.hoopsPassed++;
    }
   }
   if(b.vy<0)for(const pad of pads){
    const plane=pad.y+BALL_R;
    if(previous.y<plane-.002||b.y>plane)continue;
    const f=clamp((previous.y-plane)/(previous.y-b.y),0,1);
    const x=previous.x+(b.x-previous.x)*f,
     z=previous.z+(b.z-previous.z)*f;
    if(Math.hypot(x-pad.x,z-pad.z)>
     pad.r+BALL_R*.9*Math.max(.65,Math.cos(Math.abs(b.disc.bank))))continue;
    if(pad.index!==b.springHits)continue;
    b.x=x;b.z=z;b.y=plane+.002;
    applyDiscImpact(b,0,1,0,b.vy,
     (x-pad.x)/pad.r,(z-pad.z)/pad.r,.9);
    Object.assign(b,padRebound(b,pad));
    b.springHits++;
    break;
   }
   if(b.springHits===settings.padCount&&
    b.hoopsPassed===settings.hoops&&b.vy<0){
    const at=targetLocation(time),top=at.y+settings.targetHeight;
    if(previous.y>=top-BALL_R&&b.y<=top-BALL_R){
     const dist=Math.hypot(b.x-at.x,b.z-at.z);
     if(dist<settings.radius-BALL_R*.7)
      return {level:route.n,scored:true,springs:b.springHits,
       hoops:b.hoopsPassed,dist};
    }
   }
   if(b.y<-.3||b.z<settings.targetZ-5.3||b.z>LAUNCH_Z+3)break;
  }
  return {level:route.n,scored:false,
   springs:b.springHits,hoops:b.hoopsPassed};
 }
 return routes.map(flight);`
].join('\n'))();
for(const route of latePaths){
 assert(route.scored,'Frisbee route blocked on level '+route.level+
  ': '+JSON.stringify(route));
 assert.equal(route.springs,route.level===48?2:1);
 assert.equal(route.hoops,route.level===47?1:0);
}
console.log('PASS: late frisbee routes hit required springs/ring and moving cup',
 JSON.stringify(latePaths));

console.log('PASS:',results.count,'combinations,',results.shots,
 'flight simulations,',results.checks,'checks.');
console.log('NOTE: these isolated mechanics tests do not verify every complete 3D scoring route.');
