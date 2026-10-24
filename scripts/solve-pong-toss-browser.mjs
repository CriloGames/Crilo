// Targeted browser solver: search real 3D collisions and winning routes for all
// 50 levels with each of the 5 throwables. Runs on a GitHub Actions runner.
// Every reported WIN is a reproduced 3D-geometry scoring trajectory.
import fs from 'node:fs';
import {chromium} from 'playwright';
const rawJs=fs.readFileSync(new URL('../ping-pong-toss.js',import.meta.url),'utf8');
const rawHtml=fs.readFileSync(new URL('../pong-toss.html',import.meta.url),'utf8');
const hooks="\nwindow.__pongAudit={\n ready:()=>hasRenderer&&!!renderer&&!!scene,\n set:(n,id)=>{\n  const p=PROJECTILES.find(p=>p.id===id);\n  if(!p)throw Error('Missing mode '+id);\n  unlocked=50;projectileId=id;physicsProfile=p;\n  BALL_R=p.radius;GRAVITY=p.gravity;\n  loadLevel(n);\n  return {level,mode:projectileId,colliders:physicsBodies.length,\n   pads:pads.length,walls:wallPads.length,hoops:hoops.length,\n   gates:obstacles.filter(x=>x.type==='barrier').length,\n   target:!!cupGroup,renderer:hasRenderer,defaultYaw:aimYaw,\n   plane:settings.targetZ,sceneMeshes:group.children.length};\n },\n throw:(yaw,pitch,power,tilt=0,delay=0)=>{\n  aimYaw=yaw;aimPitch=pitch;frisbeeTilt=tilt;\n  const velocity=makeVelocity(power);\n  const b={x:launchOffset(),y:LAUNCH_Y,z:LAUNCH_Z,\n   vx:velocity.vx,vy:velocity.vy,vz:velocity.vz,\n   springHits:0,bankHits:0,wallHits:0,hoopsPassed:0,contacts:0};\n  if(projectileId==='frisbee')b.disc=newDiscFlightState();\n  let closest=100,requiredHits=0;\n  const step=.014;\n  for(let i=0;i<600;i++){\n   const t=delay+i*step,old={x:b.x,y:b.y,z:b.z};\n   const fan=airForce(b.x,b.y,b.z,t);\n   applyProjectileForces(b,step,t,fan);\n   b.x+=b.vx*step;b.y+=b.vy*step;b.z+=b.vz*step;\n   wallCollision(b,old,true);\n   checkHoopCross(old,b,t+step,true);\n   hoopRimCollision(b,t+step,true);\n   resolvePadAndPlatform(b,old,true,t+step);\n   resolveEnvironment(b,true,t+step);\n   const at=targetLocation(t+step),top=at.y+settings.targetHeight;\n   requiredHits=Math.max(requiredHits,\n    b.springHits+b.wallHits+b.bankHits+b.hoopsPassed);\n   closest=Math.min(closest,Math.hypot(b.x-at.x,b.z-at.z,(b.y-top)*.75));\n   const gate=cupEntryGate(b,old.y,t+step,true);\n   if(gate.entered&&!gate.missing&&\n    (!settings.lid||lidFraction(t+step)>.61))\n    return {won:true,requiredHits,closest:0};\n   cupSurfaceCollision(b,true,t+step);\n   if(![b.x,b.y,b.z,b.vx,b.vy,b.vz].every(Number.isFinite))\n    throw Error('Nonfinite trajectory in '+projectileId+' level '+level);\n   if(b.y<-.35||Math.abs(b.x)>8.3||b.z<settings.targetZ-5.3||\n     b.z>LAUNCH_Z+3)return {won:false,requiredHits,closest};\n  }\n  return {won:false,requiredHits,closest};\n }\n};\n";
const marker='loadLevel(level);\nawait init();';
if(rawJs.split(marker).length!==2)throw Error('Game init marker changed');
const injected=rawJs.replace(marker,'loadLevel(level);\n'+hooks+'\nawait init();');
const html=rawHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,m=>
 m.includes('ping-pong-toss.js')?m:'');
const browser=await chromium.launch({headless:true,args:[
 '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 '--enable-webgl','--disable-dev-shm-usage','--disable-gpu-sandbox'
]});
const failures=[],summary=[],errors=[],base='http://127.0.0.1:4173/';
try{
 for(const mode of ['ping','frisbee','basketball','heavy','light']){
  const page=await browser.newPage({viewport:{width:1160,height:780},deviceScaleFactor:1});
  page.on('pageerror',e=>{if(errors.length<30)errors.push(mode+': '+e.message)});
  await page.route('**/pong-toss.html*',r=>r.fulfill({
   status:200,contentType:'text/html',body:html
  }));
  await page.route('**/ping-pong-toss.js*',r=>r.fulfill({
   status:200,contentType:'text/javascript',body:injected
  }));
  await page.goto(base+'pong-toss.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.__pongAudit?.ready(),null,{timeout:90000});
  await page.evaluate(()=>{window.requestAnimationFrame=()=>0});
  let built=0,attempted=0,winners=0;const unsolved=[];
  for(let n=1;n<=50;n++){
   try{
    const result=await page.evaluate(({n,mode})=>{
     const stat=window.__pongAudit.set(n,mode);
     if(!stat.renderer||!stat.target||stat.colliders<10||stat.sceneMeshes<10)
      throw Error('Level did not build its real collidable 3D scene');
     let seed=(n*8171+mode.length*32911)>>>0;
     const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
     const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
     const needed=stat.pads+stat.walls+stat.hoops;
     const targetYaw=stat.defaultYaw;
     const frisbee=mode==='frisbee',maxShots=n>=40?1000:n>=20?600:320;
     const elites=[];let attempts=0,winner=null,best=1e9,bestHits=0;
     for(let k=0;k<maxShots;k++){
      const exploratory=k<100||k%8===0||elites.length===0;
      let yaw,pitch,power,tilt=0,delay=0;
      if(exploratory){
       yaw=clamp(targetYaw+(random()-.5)*(n>30?1.45:.90),-1.30,1.30);
       pitch=frisbee?(-.14+random()*1.36):(.13+random()*.92);
       power=.06+random()*.91;
       tilt=frisbee?-.68+random()*1.36:0;
       delay=random()*4.6;
      }else{
       const v=elites[Math.floor(random()*Math.min(elites.length,8))];
       const radius=k>maxShots*.75?.26:k>maxShots*.4?.57:1;
       yaw=clamp(v.yaw+(random()-.5)*.22*radius,-1.3,1.3);
       pitch=clamp(v.pitch+(random()-.5)*.23*radius,frisbee?-.16:.13,
        frisbee?1.28:1.04);
       power=clamp(v.power+(random()-.5)*.26*radius,.06,.97);
       tilt=frisbee?clamp(v.tilt+(random()-.5)*.30*radius,-.69,.69):0;
       delay=clamp(v.delay+(random()-.5)*1.6*radius,0,5);
      }
      const r=window.__pongAudit.throw(yaw,pitch,power,tilt,delay);
      attempts++;
      const fit=r.closest+Math.max(0,needed-r.requiredHits)*4.5;
      if(fit<best)best=fit;
      bestHits=Math.max(bestHits,r.requiredHits);
      if(r.won){
       winner={yaw:+yaw.toFixed(4),pitch:+pitch.toFixed(4),
        power:+power.toFixed(4),tilt:+tilt.toFixed(4),
        delay:+delay.toFixed(3),shot:attempts};
       break;
      }
      if(Number.isFinite(fit)){
       elites.push({yaw,pitch,power,tilt,delay,fit});
       elites.sort((a,b)=>a.fit-b.fit);
       if(elites.length>12)elites.pop();
      }
     }
     return {mode,n,attempts,winner,best:+best.toFixed(3),bestHits,needed};
    },{n,mode});
    built++;attempted+=result.attempts;
    if(result.winner)winners++;
    else unsolved.push({n,best:result.best,hits:result.bestHits,need:result.needed});
    console.log('SOLVER',mode,n,result.winner?'WIN':'UNPROVEN',
     result.attempts,'tries','best',result.best,'hits',
     result.bestHits+'/'+result.needed,
     result.winner?JSON.stringify(result.winner):'');
   }catch(e){
    failures.push({mode,n,problem:String(e).slice(0,300)});
    console.log('SOLVER ERROR',mode,n,String(e).slice(0,120));
   }
  }
  summary.push({mode,built,attempted,winners,unsolved});
  await page.close();
 }
}finally{await browser.close();}
console.log(JSON.stringify({summary,failures:failures.slice(0,30),errors},null,2));
if(failures.length||errors.length||summary.some(x=>x.built!==50))
 process.exitCode=1;
