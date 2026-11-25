(() => {
  'use strict';
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const mix = (a, b, k) => a + (b - a) * k;
  const smooth = t => t * t * (3 - 2 * t);
  let canvas, ctx, scenery, observer, frame, width = 1, height = 1, pixelRatio = 1;
  let altitude = 0, pullback = 0, mean = null, motion, pull, lastPaint = -100, backgroundKey = '';
  let reduced = false, reducedQuery, cliffLayer, skyLayer, skyKey='', followAltitude=0, followX=null, lastFrame=0, contact=null;
  function random(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  function shape(c, points, fill) {
    c.beginPath();
    points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  }
  function line(c, points, color, weight = 1) {
    c.beginPath();
    points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y));
    c.strokeStyle = color;
    c.lineWidth = weight;
    c.stroke();
  }
  function oval(c,x,y,rx,ry,color) {
    c.beginPath();
    c.ellipse(x,y,rx,ry,0,0,Math.PI*2);
    c.fillStyle = color;
    c.fill();
  }
  function pine(c,x,y,h,color,lit) {
    const w=h*.205;
    shape(c, [[x,y-h],[x+w*.32,y-h*.65],[x+w*.17,y-h*.68],[x+w*.64,y-h*.41],[x+w*.4,y-h*.45],[x+w,y-h*.11],[x+w*.12,y-h*.18],[x+w*.09,y],[x-w*.09,y],[x-w*.08,y-h*.17],[x-w,y-h*.1],[x-w*.43,y-h*.43],[x-w*.72,y-h*.39],[x-w*.22,y-h*.68],[x-w*.38,y-h*.64]],color);
    if (lit) shape(c, [[x,y-h],[x-1,y-h*.69],[x-w*.15,y-h*.68],[x-w*.45,y-h*.46],[x-w*.28,y-h*.48],[x-w*.71,y-h*.18],[x-w,y-h*.10],[x-w*.43,y-h*.43],[x-w*.72,y-h*.39],[x-w*.22,y-h*.68],[x-w*.38,y-h*.64]],lit);
  }
  function backdrop(c,u) {
    const sky=c.createLinearGradient(0,0,0,650);
    sky.addColorStop(0, '#79abb2'); sky.addColorStop(.39,'#b9cdc0');
    sky.addColorStop(.69,'#f5d7a8'); sky.addColorStop(1,'#edbb87');
    c.fillStyle=sky; c.fillRect(0,0,1000,650);
    // The sky warms as the climber gains altitude.
    const light=clamp(altitude/1000);
    if(light>0){
      const glow=c.createLinearGradient(0,0,0,470);
      glow.addColorStop(0,'rgba(62,73,124,'+(light*.54)+')');
      glow.addColorStop(.56,'rgba(245,165,118,'+(light*.62)+')');
      glow.addColorStop(1,'rgba(255,215,163,0)');
      c.fillStyle=glow;c.fillRect(0,0,1000,470);
    }
    const sunY=118+light*57;
    c.save(); c.translate(213,sunY); c.scale(1,1);
    const halo=c.createRadialGradient(0,0,18,0,0,88);
    halo.addColorStop(0,'rgba(255,238,183,0.42)'); halo.addColorStop(1,'rgba(255,238,183,0)');
    c.fillStyle=halo; c.fillRect(-90,-90,180,180); oval(c,0,0,26,26,'#ffeac1'); c.restore();
    const rng=random(29);
    for(let i=0;i<13;i++){
      const x=rng()*1080-60,y=32+rng()*160,w=25+rng()*115;
      shape(c,[[x,y],[x+w*.20,y-3],[x+w*.34,y-3],[x+w*.48,y-7],[x+w*.69,y-5],[x+w*.73,y-3],[x+w,y],[x+w*.67,y+2],[x+w*.08,y+2]],'rgba(255,244,213,.44)');
    }
    // Individual overlapping ridges give the valley depth as the camera rises.
    c.save(); c.translate(0,u*48);
    shape(c,[[-5,257],[47,232],[77,243],[125,210],[165,239],[213,211],[261,226],[309,186],[334,204],[415,163],[483,206],[523,182],[574,201],[674,167],[727,197],[790,164],[876,206],[953,172],[1005,208],[1005,650],[-5,650]],'#a7bbaf');
    const peaks = [[-144,345,370,131],[18,251,248,158],[157,360,377,252],[370,320,275,175],[530,340,312,193],[760,355,330,173]];
    for(const [x,y,w,h] of peaks) {
      const p=(a,b)=>[x+a*w,y+b*h];
      shape(c,[p(0,.38),p(.11,.18),p(.21,.03),p(.26,.045),p(.385,-.34),p(.423,-.33),p(.51,-.6),p(.55,-.57),p(.627,-.42),p(.667,-.43),p(.77,-.18),p(.82,-.17),p(1,.15),p(1,1),p(0,1)],'#8dada9');
      shape(c,[p(.51,-.6),p(.55,-.57),p(.627,-.42),p(.667,-.43),p(.77,-.18),p(.82,-.17),p(1,.15),p(.99,.59),p(.78,.36),p(.70,.01),p(.60,-.12),p(.60,-.23)],'#709399');
      shape(c,[p(.29,-.065),p(.385,-.34),p(.423,-.33),p(.51,-.6),p(.55,-.57),p(.627,-.42),p(.667,-.43),p(.723,-.28),p(.664,-.35),p(.683,-.255),p(.62,-.33),p(.64,-.20),p(.55,-.39),p(.533,-.27),p(.514,-.45),p(.455,-.23),p(.469,-.37),p(.392,-.21),p(.35,-.12),p(.37,-.225)],'#e7e3cf');
      shape(c,[p(.51,-.60),p(.55,-.57),p(.627,-.42),p(.667,-.43),p(.723,-.28),p(.664,-.35),p(.683,-.255),p(.62,-.33),p(.64,-.20),p(.55,-.39),p(.533,-.27),p(.514,-.45)],'#bdd1cb');
      line(c,[p(.42,-.17),p(.385,-.045),p(.37,-.02),p(.345,.08)],'#b8c9b9',1.1);
    }
    shape(c,[[-10,336],[46,327],[119,339],[192,367],[259,354],[351,391],[418,396],[479,373],[531,354],[598,365],[674,335],[753,311],[856,343],[1008,284],[1008,645],[-10,645]],'#6c9690');
    shape(c,[[0,371],[73,364],[106,379],[163,381],[221,406],[277,421],[369,431],[456,406],[552,372],[621,383],[710,354],[816,368],[923,339],[1000,338],[1000,650],[0,650]],'#51837c');
    shape(c,[[0,438],[111,426],[205,441],[310,458],[390,452],[495,418],[552,408],[666,424],[775,394],[901,396],[1000,368],[1000,650],[0,650]],'#45766b');
    shape(c,[[347,420],[405,412],[367,426],[332,436],[356,441],[425,444],[430,450],[403,457],[342,469],[288,485],[258,507],[214,517],[228,504],[273,473],[319,459],[381,449],[327,446],[303,440]],'#a5bd9d');
    c.restore();
    const seed=random(5311);
    for(let layer=0;layer<2;layer++) {
      const points=[];
      for(let x=-8;x<=1010;x+=6) {
        const y=465+layer*86+45*Math.sin(x/175+layer)+15*Math.cos(x/65+layer)+u*(65+layer*40);
        points.push([x,y]); pine(c,x+(seed()-.5)*10,y+2,10+seed()*(17+10*layer),layer?'#254e48':'#3f6a5e');
      }
      shape(c,[...points,[1012,770],[-10,770]],layer?'#284f47':'#406b5f');
    }
    // A handful of close pines frames the panorama without covering the route.
    pine(c,22,691+u*170,124,'#1e4842','#37614e');
    pine(c,63,700+u*165,91,'#244a40','#3b604b');
    pine(c,99,691+u*156,73,'#294e42');
  }
  const edge = [[448,680],[464,631],[476,608],[490,597],[488,571],[506,552],[503,531],[517,520],[523,485],[532,479],[530,450],[546,413],[545,397],[563,383],[572,355],[569,337],[584,319],[590,293],[611,273],[614,245],[627,230],[631,202],[646,187],[645,172],[659,161],[672,133],[686,126],[692,102],[709,98],[719,78],[739,70],[751,48],[768,40],[800,43],[819,32],[837,44],[866,39],[891,58],[936,62],[989,49],[1056,81]];
  function edgeX(y) {
    for(let i=1;i<edge.length;i++) {
      const a=edge[i-1], b=edge[i];
      if(a[1]>=y && b[1]<=y) return mix(a[0],b[0],(a[1]-y)/(a[1]-b[1]));
    }
    return y<40?770:448;
  }
  function route(h) {
    const u=clamp(h/1000), y=mix(602,40,u);
    const inset= (19+15*Math.sin(u*13.5)+5*Math.sin(u*39))*Math.min(1,(1-u)*22);
    return {x:edgeX(y)+inset,y};
  }
  function camera(h,b) {
    const p=route(h), z=mix(1.48,.94,b); if(followX!==null)p.x=followX;
    return {z, x:mix(635-p.x*z,30,b), y:mix(425-p.y*z,34,b)};
  }
  function cliff(c) {
    c.save();
    const silhouette=[...edge,[1520,60],[1520,1040],[280,1040]];
    shape(c,silhouette,'#be8768'); c.clip();
    const gradient=c.createLinearGradient(490,250,1100,580);
    gradient.addColorStop(0,'#dca780'); gradient.addColorStop(.42,'#bc886b'); gradient.addColorStop(1,'#8e695c');
    c.fillStyle=gradient;c.fillRect(280,0,1350,1100);
    const rng=random(67032);
    // Warm lit lips and cool shadow planes follow the actual contour.
    for(let i=1;i<edge.length;i++){
      const [x,y]=edge[i], [px,py]=edge[i-1], d=18+rng()*71;
      shape(c,[[px-1,py],[x-1,y],[x+d,y+7+d*.3],[px+d*.46,py+11]],i%4===0?'#e7b38a':i%3===0?'#cd9674':'#dba681');
      if(i%3===1)shape(c,[[x,y],[x+d,y+7+d*.3],[x+d+11,y+36],[x+12,y+11]],'#ad8068');
    }
    const colors=['#c99676','#d5a27d','#b48268','#a77860','#d9a783','#c18e71','#b38871','#b37e65'];
    for(let band=0;band<16;band++) {
      let x=365+rng()*20, y=band*57-130;
      while(x<1500){
        const w=18+rng()*111, h=9+rng()*45, tilt=5+rng()*15;
        const k=colors[Math.floor(rng()*colors.length)];
        shape(c,[[x,y],[x+w*.32,y-7],[x+w,y-tilt],[x+w*.86,y+h*.32],[x+w*.57,y+h*.44],[x+w*.20,y+h],[x+w*.09,y+h*.7]],k);
        if(w>75)line(c,[[x+2,y],[x+w*.32,y-6],[x+w*.73,y-tilt+3]],'rgba(255,211,160,.46)',1.5);
        x+=w*.9; y-=4+rng()*7;
      }
    }
    for(let i=0;i<160;i++) {
      const x=430+rng()*920,y=25+rng()*800,w=rng()*38+3;
      line(c,[[x,y],[x+w*.36,y-2],[x+w,y-2-rng()*5]],i%4?'rgba(96,71,61,.23)':'rgba(255,217,177,.61)',rng()*1.3+.6);
    }
    for(let i=0;i<24;i++){
      let x=485+rng()*685,y=40+rng()*570;const points=[[x,y]];
      for(let n=0;n<3+rng()*3;n++){x-=rng()*9-3;y+=rng()*20+3;points.push([x,y]);}
      line(c,points,'rgba(97,74,66,.38)',1.5);
    }
    // High snow collects on sloping shelves, leaving warm stone exposed.
    shape(c,[[650,6],[1080,3],[1118,62],[1002,54],[967,68],[946,66],[941,76],[925,68],[901,70],[878,60],[863,64],[843,56],[832,64],[814,56],[791,64],[773,57],[763,68],[758,59],[744,75],[749,57],[716,91],[719,74],[686,118],[671,112]],'#ece5cf');
    shape(c,[[840,47],[891,59],[933,63],[968,57],[1002,51],[1002,57],[965,70],[939,77],[927,70],[902,73],[879,63],[866,66]],'#bed2cb');
    c.restore();
    for(let i=2;i<edge.length-7;i+=3) {
      const [x,y]=edge[i];
      line(c,[[x-3,y],[x+3,y-1],[x+11,y-6]],y<188?'#f2e5c8':'#f0c69a',2);
      if(y>322) {
        line(c,[[x,y],[x-4,y-5],[x-8,y-8]],'#6a7855',1.4);
        line(c,[[x,y],[x+2,y-8]],'#6a7855',1.2);
      }
    }
  }

  function frameScale(){
    const cover=Math.max(width/1000,height/650);
    return {x:mix(cover,width/1000,pullback),y:mix(cover,height/650,pullback)};
  }
  function project(p, cam) {
    const s=frameScale();
    return {x:(p.x*cam.z+cam.x-635)*s.x+width*.635, y:(p.y*cam.z+cam.y-425)*s.y+height*425/650};
  }
  function renderScenery(cam) {
    const c=scenery.getContext('2d');
    const s=frameScale();
    c.setTransform(s.x*pixelRatio,0,0,s.y*pixelRatio,(width*.635-635*s.x)*pixelRatio,(height*425/650-425*s.y)*pixelRatio);
    // Cache the illustrated rock and valley layers; the camera can move without
    // rebuilding thousands of polygons every frame.
    const skyStamp=Math.round(altitude/8)+'|'+Math.round(pullback*32);
    if(!skyLayer){skyLayer=document.createElement('canvas');skyLayer.width=1500;skyLayer.height=975;}
    if(skyKey!==skyStamp){
      const sky=skyLayer.getContext('2d');sky.setTransform(1.5,0,0,1.5,0,0);
      backdrop(sky,altitude/1000*(1-pullback));
      const rng=random(672);sky.fillStyle='rgba(53,51,40,.10)';
      for(let i=0;i<2200;i++)sky.fillRect(rng()*1000,rng()*650,.65+rng()*.8,.7+rng()*.7);
      skyKey=skyStamp;
    }
    c.drawImage(skyLayer,0,0,1000,650);
    if(!cliffLayer){
      cliffLayer=document.createElement('canvas');cliffLayer.width=2280;cliffLayer.height=1560;
      const rock=cliffLayer.getContext('2d');rock.scale(1.5,1.5);cliff(rock);
      pine(rock,473,615,75,'#32554a','#516c51');pine(rock,458,638,43,'#385e4d','#617950');
      pine(rock,493,576,36,'#47674f','#667b53');
    }
    c.save();c.translate(cam.x,cam.y);c.scale(cam.z,cam.z);c.drawImage(cliffLayer,0,0,1520,1040);c.restore();
  }
  function rope(cam,p,scale,now) {
    const c=ctx, dest=project(p,cam);
    const sway=reduced?0:Math.sin(now*.002)*1.4*scale;
    c.beginPath(); c.moveTo(dest.x+1*scale,dest.y-17*scale);
    let latest=dest;
    for(let step=Math.floor((altitude-18)/65)*65;step>=0;step-=65) {
      const hold=project(route(step),cam);
      const x=hold.x-6*scale, y=hold.y;
      c.quadraticCurveTo(Math.min(x,latest.x)-6*scale+sway,(latest.y+y)*.5+6*scale,x,y);
      latest={x,y};
    }
    const foot=project({x:edgeX(685)-8,y:745},cam);
    c.quadraticCurveTo(Math.min(latest.x,foot.x)-10*scale,(latest.y+foot.y)*.5,foot.x,foot.y);
    c.strokeStyle='#7b4d3e'; c.lineWidth=2.5*scale; c.stroke();
    c.strokeStyle='#e7aa63';c.lineWidth=1.2*scale;c.stroke();
  }
  function climberSize(cam){
    const s=frameScale();
    return clamp(Math.sqrt(s.x*s.y)*cam.z*.88,.54,1.55)*(1-.25*pullback);
  }
  function contactPose(p,cam,size,beat,energy){
    const base=project(p,cam);
    const rest=[[-12,-2],[14,-13],[21,-59],[18,-37]];
    if(!motion||reduced||!energy)return rest;
    const cycle=Math.floor(beat), frac=beat-cycle;
    const total=motion.to-motion.from, steps=motion.gaitSteps;
    // Opposing hands and feet alternate. During the support phase their
    // world positions stay put while the torso moves between them.
    return rest.map(([x,y],i)=>{
      const offset=[.50,0,0,.50][i];
      const k=beat+offset, step=Math.floor(k), u=k-step;
      const a=clamp((step-offset)/steps),b=clamp((step+1-offset)/steps);
      const from=route(mix(motion.from,motion.to,a)),to=route(mix(motion.from,motion.to,b));
      const swing=smooth(clamp(u/.52));
      const wx=mix(from.x,to.x,swing),wy=mix(from.y,to.y,swing);
      const pos=project({x:wx,y:wy},cam);
      const lift=Math.sin(Math.PI*clamp(u/.52))*energy;
      const blend=smooth(clamp(beat/.4))*smooth(clamp((steps-beat)/.4));
      return [x+clamp((pos.x-base.x)/size,-15,15)*blend+(i<2?-3:3)*lift,y+clamp((pos.y-base.y)/size,-22,22)*blend-5*lift];
    });
  }
  function climber(p,cam,now,beat,energy) {
    const c=ctx, anchor=project(p,cam);
    const size=climberSize(cam);
    const stride=energy*Math.sin(beat*Math.PI*2), reach=energy*Math.cos(beat*Math.PI*2);
    rope(cam,p,size,now);
    c.save();
    c.translate(anchor.x,anchor.y);
    c.scale(size,size);
    c.lineJoin=c.lineCap='round';
    const hip=[-2+1.6*stride,-20-2*energy], shoulder=[3+1.3*reach,-40-2*energy];
    const [lowFoot,highFoot,highGrip,lowGrip]=contactPose(p,cam,size,beat,energy);
    // Bend joints toward the wall and keep the body balanced over the feet.
    const joint=(a,b,dx,dy)=>[(a[0]+b[0])*.5+dx,(a[1]+b[1])*.5+dy];
    const stroke=(points,width,shade)=>{
      line(c,points,'#182a29',width+2);
      line(c,points,shade,width);
    };
    stroke([hip,joint(hip,highFoot,6,-8),highFoot],6,'#2c4548');
    stroke([shoulder,joint(shoulder,lowGrip,3,7),lowGrip],5,'#9e5136');
    stroke([hip,joint(hip,lowFoot,-6,-3),lowFoot],7,'#4a6463');
    for(const [x,y] of [lowFoot,highFoot])line(c,[[x-3,y],[x+4,y]],'#172928',4);
    shape(c,[[hip[0]-6,hip[1]],[shoulder[0]-7,shoulder[1]+1],[shoulder[0]+4,shoulder[1]-2],[hip[0]+5,hip[1]-3],[hip[0]+4,hip[1]+1]],'#d76b40');
    shape(c,[[-8,-36],[-3,-40],[1,-32],[-5,-23],[-12,-25],[-13,-32]],'#345954');
    line(c,[[-9,-33],[-6,-28]],'#85a896',1.4);
    stroke([shoulder,joint(shoulder,highGrip,-6,-1),highGrip],5,'#ec8852');
    for(const [x,y] of [lowGrip,highGrip])oval(c,x,y,2.5,2.1,'#e8ac7e');
    oval(c,7,-46-3*energy,5.3,6,'#9b6849');
    oval(c,6,-49-3*energy,6.8,4.2,'#f1d289');
    line(c,[[1,-47-3*energy],[12,-47-3*energy]],'#a5753e',1.1);
    line(c,[[-7,hip[1]-2],[3,hip[1]-2]],'#1c3634',2.8);
    oval(c,-8,hip[1]+2,3,3.7,'#c0d2bb');
    c.restore();
  }
  function chalkDust(cam,now){
    if(!contact || reduced)return;
    const age=(now-contact.time)/420;
    if(age>=1)return;
    const anchor=project(contact.position,cam);
    const size=climberSize(cam);
    ctx.save();
    ctx.globalAlpha=.78*(1-age);
    for(let i=0;i<9;i++){
      const angle=i*2.4+contact.index;
      const spread=(5+i%4*4)*age;
      const x=anchor.x+(21+Math.cos(angle)*spread)*size;
      const y=anchor.y+(-59+Math.sin(angle)*spread+age*age*13)*size;
      oval(ctx,x,y,(1+i%3*.55)*size,(1+i%2*.6)*size,'#fff2d9');
    }
    ctx.restore();
  }
  function flag(cam,score,colour,opposite=false) {
    if(score===null || !Number.isFinite(Number(score)))return;
    const p=project(route(clamp(score/1000)*1000),cam);
    const unit=clamp(height/400,.78,1.3);
    const side=opposite?-1:1;
    const x=p.x+side*11*unit,y=p.y;
    line(ctx,[[x,y],[x,y-21*unit]],'#554a40',1.5*unit);
    shape(ctx,[[x,y-21*unit],[x+side*14*unit,y-18*unit],[x,y-14*unit]],colour);
  }
  function resize() {
    if(!canvas)return;
    const rect=canvas.getBoundingClientRect(); width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    pixelRatio=clamp(window.devicePixelRatio||1,1,2);
    canvas.width=Math.max(1,Math.round(width*pixelRatio));canvas.height=Math.max(1,Math.round(height*pixelRatio));
    scenery=document.createElement('canvas');scenery.width=canvas.width;scenery.height=canvas.height;
    lastPaint=-Infinity; backgroundKey=''; start();
  }
  function start(){
    if(!frame && canvas && !document.hidden)frame=requestAnimationFrame(paint);
  }
  function paint(now) {
    frame=0;
    if(!canvas || document.hidden)return;
    // Full refresh rate during movement, inexpensive idle refresh.
    if(!motion&&!pull&&now-lastPaint<1000/30){start();return;}
    const dt=clamp(now-lastFrame,0,80);lastFrame=now;lastPaint=now;
    let phase=0,energy=0,done;
    if(motion) {
      const t=clamp((now-motion.start)/motion.duration);
      const progress=reduced?t:smooth(t);
      altitude=mix(motion.from,motion.to,progress);
      phase=progress*motion.gaitSteps;
      energy=motion.to>motion.from?Math.sin(Math.PI*t)**.4:0;
      const landed=Math.min(motion.steps,Math.floor(progress*motion.steps+.12));
      if(!reduced&&motion.to>motion.from){
        while(motion.lastGrip<landed){
          motion.lastGrip++;
          contact={time:now,position:route(altitude),index:motion.lastGrip};
          if(typeof motion.onGrip==='function')motion.onGrip(motion.lastGrip-1);
        }
      }
      if(t>=1&&(reduced||now>=motion.start+motion.duration+60)){
        altitude=motion.to;done=motion.done;motion=null;phase=0;energy=0;
      }
    }
    if(pull) {
      const t=clamp((now-pull.start)/pull.duration);
      pullback=mix(pull.from,1,smooth(t));if(t>=1)pull=null;
    }
    // A continuous, damped follow camera instead of per-hold jumps.
    const blend=reduced?1:1-Math.exp(-dt/115);
    followAltitude=mix(followAltitude,altitude,blend);
    followX=mix(followX??route(followAltitude).x,route(followAltitude).x,blend);
    if(Math.abs(altitude-followAltitude)<.15)followAltitude=altitude;
    const cam=camera(followAltitude,pullback);
    const key=[cam.x.toFixed(1),cam.y.toFixed(1),cam.z.toFixed(4),altitude.toFixed(1)].join('|');
    if(key!==backgroundKey){renderScenery(cam);backgroundKey=key;}
    ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(scenery,0,0);
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    ctx.lineJoin='round';ctx.lineCap='round';
    if(pullback>.98)flag(cam,mean,'#517d80',true);
    climber(route(altitude),cam,now,phase,energy);
    chalkDust(cam,now);
    if(pullback>.98)flag(cam,altitude,'#ce503c');
    if(!reduced) {
      // Two small birds skirt the edge of the valley in the distance.
      const x=width*(.05+((now*.000009)%1)*.36), y=height*(.27+.012*Math.sin(now*.00034));
      for(let i=0;i<2;i++){const bx=x+i*10,by=y-i*4,flap=Math.sin(now*.004+i)*1.3;line(ctx,[[bx-3,by-1+flap],[bx,by+.4],[bx+3,by-1+flap]],'rgba(56,79,71,.6)',.9);}
    }
    if(done)done();
    if(!reduced || motion || pull)start();
  }
  function set(h) {
    altitude=clamp(Number(h)||0,0,1000);followAltitude=altitude;followX=route(altitude).x;motion=null;contact=null;pull=null;pullback=0;mean=null;backgroundKey='';start();
  }
  function climb(from,to,matches,done,onGrip) {
    set(from); const steps=clamp(Math.round(Number(matches)||0),1,6);
    const destination=clamp(Number(to)||0,0,1000);
    motion={from:altitude,to:destination,steps,gaitSteps:Math.max(steps,Math.ceil(Math.abs(destination-altitude)*.562/14)),done,onGrip,lastGrip:0,start:performance.now(),duration:reduced?1:360+steps*100};
    start();
  }
  function finish(h,average) {
    altitude=clamp(Number(h)||0,0,1000);mean=average==null?null:clamp(Number(average)||0,0,1000);
    if(!pull && pullback<1) pull={start:performance.now(),duration:reduced?1:1450,from:pullback};
    start();
  }
  function changed(e){reduced=e.matches;start();}
  function init(el) {
    if(!el || !el.getContext)return;
    if(canvas!==el){
      if(observer)observer.disconnect();
      if(reducedQuery)reducedQuery.removeEventListener('change',changed);
      canvas=el;ctx=canvas.getContext('2d'); if(!ctx){canvas=null;return;}
      reducedQuery=window.matchMedia('(prefers-reduced-motion: reduce)');reduced=reducedQuery.matches;
      reducedQuery.addEventListener('change',changed);
      document.addEventListener('visibilitychange',start);
      if(window.ResizeObserver){observer=new ResizeObserver(resize);observer.observe(canvas);}
      else window.addEventListener('resize',resize);
    }
    resize();
  }
  window.Mountain={init,set,climb,finish};
})();
