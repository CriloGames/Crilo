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
console.log('PASS:',results.count,'combinations,',results.shots,
 'flight simulations,',results.checks,'checks.');
console.log('NOTE: these isolated mechanics tests do not verify every complete 3D scoring route.');
