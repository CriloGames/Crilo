(() => {
  'use strict';
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const mix = (a, b, k) => a + (b - a) * k;
  const smooth = t => t * t * (3 - 2 * t);
  let canvas, ctx, scenery, observer, frame, width = 1, height = 1, pixelRatio = 1;
  let altitude = 0, pullback = 0, mean = null, motion, pull, lastPaint = -100, backgroundKey = '';
  let reduced = false, reducedQuery;
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
    const sunY=118+u*27;
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
    const p=route(h), z=mix(1.48,.94,b);
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

  function project(p, cam) {
    return {x:(p.x*cam.z+cam.x)*width/1000, y:(p.y*cam.z+cam.y)*height/650};
  }
  function renderScenery(cam) {
    const c=scenery.getContext('2d');
    c.setTransform(scenery.width/1000,0,0,scenery.height/650,0,0);
    backdrop(c,altitude/1000*(1-pullback));
    c.save(); c.translate(cam.x,cam.y); c.scale(cam.z,cam.z); cliff(c);
    // A few evergreens are perched on the lower ledges.
    pine(c,473,615,75,'#32554a','#516c51');pine(c,458,638,43,'#385e4d','#617950');
    pine(c,493,576,36,'#47674f','#667b53');
    c.restore();
    const rng=random(672);
    c.fillStyle='rgba(53,51,40,.10)';
    for(let i=0;i<2200;i++)c.fillRect(rng()*1000,rng()*650,.65+rng()*.8,.7+rng()*.7);
  }
  function rope(cam,p,scale,now) {
    const c=ctx, dest=project(p,cam);
    const sway=reduced?0:Math.sin(now*.0008)*2.2*scale;
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
  function climber(p,cam,now,phase,energy) {
    const c=ctx, anchor=project(p,cam);
    const s=(.56+.65*clamp(height/540,0,1.25))*(1-.37*pullback);
    const breath=reduced?0:Math.sin(now*.002)*.72;
    const wave=Math.sin(phase), opp=Math.cos(phase);
    const lift=energy*Math.max(0,wave)*4;
    const grip=(x,y)=>{oval(c,x,y+.8,4.2,1.7,'#9e7663');line(c,[[x-3,y-.1],[x+.5,y-.7],[x+3,y-.3]],'#efcfad',.8);};
    rope(cam,p,s,now);
    c.save(); c.translate(anchor.x,anchor.y);c.scale(s,s);
    c.lineCap='round'; c.lineJoin='round';
    const bx=2+energy*opp*2, by=-21-lift+breath;
    const leftFoot=[-9+energy*wave*3,-2-energy*Math.max(0,-wave)*9];
    const rightFoot=[10+energy*opp*2,-7-energy*Math.max(0,wave)*9];
    const leftHand=[5+energy*opp*3,-45-energy*Math.max(0,wave)*6];
    const rightHand=[15+energy*wave*3,-34-energy*Math.max(0,-wave)*8];
    grip(...leftFoot);grip(...rightFoot);grip(...leftHand);grip(...rightHand);
    function limb(points,dark,color,size) {
      line(c,points,dark,size+1.4);line(c,points,color,size);
    }
    limb([[bx+2,by+1],[11,by+8],rightFoot],'#354640','#46625a',5.1);
    line(c,[[rightFoot[0]-2,rightFoot[1]],[rightFoot[0]+2,rightFoot[1]+1],[rightFoot[0]+4,rightFoot[1]]],'#273b36',3.3);
    limb([[bx+1,by-11],[12,by-13],rightHand],'#854c3b','#b85a44',4.3);
    oval(c,rightHand[0],rightHand[1],2.2,2.3,'#efb98b');
    limb([[bx,by],[-8+energy*wave*2,by+8],leftFoot],'#293e3a','#3e5551',5.3);
    line(c,[[leftFoot[0]-1,leftFoot[1]],[leftFoot[0]+2,leftFoot[1]+.9],[leftFoot[0]+5,leftFoot[1]]],'#223834',3.6);
    c.save();c.translate(bx,by);
    shape(c,[[-5,-15],[-1,-19],[5,-17],[7,-11],[6,-3],[4,2],[-5,1],[-7,-6]],'#733e32');
    shape(c,[[-5,-14],[-1,-18],[4,-16],[5,-11],[3,-4],[-4,0],[-6,-7]],'#d84d3c');
    shape(c,[[-5,-14],[-1,-17],[1,-15],[-2,-9],[-4,-5],[-6,-7]],'#ec6c4b');
    line(c,[[-6,-2],[-1,0],[5,-2]],'#384741',2.5);
    line(c,[[-2,0],[-1,4],[3,3]],'#e6ab69',1.2);
    shape(c,[[-8,-3],[-5,-3],[-4,2],[-5,6],[-10,5],[-11,0]],'#658c89');
    line(c,[[-11,-1],[-7,-2],[-5,-2]],'#e1d4ac',1.4);
    // Helmet, face and chin strap remain legible at phone scale.
    oval(c,2.3,-20.8,4.7,5.4,'#573e33');
    shape(c,[[.5,-24],[5.4,-24],[6.3,-20.7],[7.8,-19.5],[6.2,-18.8],[5.4,-16.8],[1.5,-17.4],[-.2,-20.5]],'#e9b38b');
    oval(c,1.7,-24.5,5.7,3.9,'#f1cf87');
    shape(c,[[-4.1,-23.7],[2,-24.1],[6,-24.5],[8,-23.4],[6.3,-22.3],[.4,-22.1],[-4.2,-22.5]],'#dca358');
    line(c,[[.3,-22], [2.2,-18],[4,-17.5]],'#755648',.8);
    c.restore();
    limb([[bx-2,by-13],[-7,by-19],leftHand],'#964336','#e65c42',4.7);
    oval(c,leftHand[0],leftHand[1],2.3,2.1,'#f3c298');
    if(energy>.1 && !reduced) {
      for(let i=0;i<4;i++){
        const f=(now*.0018+i*.239)%1;
        c.globalAlpha=(1-f)*energy*.62;
        oval(c,leftHand[0]-2-i-f*(5+i),leftHand[1]+f*(6+i),.7+f*.6,.6+f*.3,'#f8e8d2');
      }
      c.globalAlpha=1;
    }
    c.restore();
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
    if(now-lastPaint<1000/30){start();return;}
    lastPaint=now;
    let phase=0,energy=0,done;
    if(motion) {
      const t=clamp((now-motion.start)/motion.duration);
      // Each move pauses briefly as the hand finds its next hold.
      const beats=t*motion.steps, base=Math.floor(beats), frac=beats-base;
      const advance=(base+smooth(clamp((frac-.13)/.73)))/motion.steps;
      altitude=mix(motion.from,motion.to,advance);
      phase=beats*Math.PI*2;energy=motion.to>motion.from?Math.sin(Math.PI*t)**.4:0;
      if(t>=1){altitude=motion.to;done=motion.done;motion=null;}
    }
    if(pull) {
      const t=clamp((now-pull.start)/pull.duration);
      pullback=mix(pull.from,1,smooth(t));if(t>=1)pull=null;
    }
    const cam=camera(altitude,pullback);
    const key=[cam.x.toFixed(1),cam.y.toFixed(1),cam.z.toFixed(4),altitude.toFixed(1)].join('|');
    if(key!==backgroundKey){renderScenery(cam);backgroundKey=key;}
    ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(scenery,0,0);
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    ctx.lineJoin='round';ctx.lineCap='round';
    if(pullback>.98)flag(cam,mean,'#517d80',true);
    climber(route(altitude),cam,now,phase,energy);
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
    altitude=clamp(Number(h)||0,0,1000); motion=null;pull=null;pullback=0;mean=null;backgroundKey=''; start();
  }
  function climb(from,to,matches,done) {
    set(from); const steps=clamp(Math.round(Number(matches)||0),1,6);
    motion={from:altitude,to:clamp(Number(to)||0,0,1000),steps,done,start:performance.now(),duration:reduced?1:420+steps*325};
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
