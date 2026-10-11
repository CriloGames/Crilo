/* Crilo's pastel stone wall: tightly stacked interlocking horizontal courses.
   Entirely decorative, deterministic, offline, and responsive to viewport size. */
(function(){
  'use strict';
  const field=document.getElementById('shapeCanvas');
  if(!field)return;
  const palette=[
    ['#f4b5c9','#c883a5'],['#f9c09e','#cc977e'],['#ffda9c','#d0ab74'],
    ['#f4e2ab','#c5b27e'],['#addfc8','#7cba9f'],['#a9dacf','#7bb3a8'],
    ['#a4d7e9','#73a8bb'],['#b6cdf2','#869ecb'],['#c9b3ef','#9a85c0'],
    ['#ddbbed','#b08cbe'],['#f0b9d8','#bd8eac'],['#c9e5b2','#9fbd88']
  ];
  let queued=false,lastW=0,lastH=0;
  function render(){
    queued=false;
    const width=Math.round(field.clientWidth),height=Math.round(field.clientHeight);
    if(!width||!height||(width===lastW&&height===lastH))return;
    lastW=width;lastH=height;
    let seed=0xC710B1A;
    function random(){
      seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
      return (seed>>>0)/4294967296;
    }
    const narrow=width<500;
    const base=width<360?67:width<500?76:width<740?103:width<1100?124:150;
    const rowHeight=narrow?48:width<900?57:67;
    const fragment=document.createDocumentFragment();
    let count=0,rows=0,interlocking=0;
    for(let y=-rowHeight*.54;y<height+rowHeight;y+=rowHeight){
      const course=document.createElement('div');
      course.className='wall-course';
      course.style.top=Math.round(y)+'px';
      course.style.setProperty('--course-h',rowHeight+'px');
      const offset=base*(.22+random()*.75);
      let x=-offset,tiles=0;
      while(x<width+base){
        // Mixed stone widths form offset seams, including wide irregular slabs.
        const factor=random();
        const factorWidth=factor<.12?.55+random()*.16:factor>.84?1.5+random()*.4:.76+random()*.62;
        const brickWidth=Math.round(Math.max(42,base*factorWidth));
        const brick=document.createElement('span');
        const color=palette[Math.floor(random()*palette.length)];
        brick.className='shape brick'+(random()>.64?' is-ridged':'');
        brick.style.setProperty('--brick-x',Math.round(x+1)+'px');
        brick.style.setProperty('--brick-w',Math.max(35,brickWidth-3)+'px');
        brick.style.setProperty('--brick-color',color[0]);
        brick.style.setProperty('--brick-shadow',color[1]);
        brick.style.setProperty('--corners',Math.round(3+random()*7)+'px '+Math.round(3+random()*8)+'px '+Math.round(3+random()*6)+'px '+Math.round(4+random()*7)+'px');
        brick.style.setProperty('--tilt',(random()*.9-.45).toFixed(2)+'deg');
        // Small stamped Crilo details sit within the blocks, never on controls.
        if(brickWidth>base*.85 && count%17===0){
          const kind=['wheel','duck','domain'][Math.floor(count/17)%3];
          brick.classList.add('is-'+kind);
          const mark=document.createElement('span');
          mark.className='brick-mark '+kind;
          if(kind==='domain')mark.textContent='.com';
          if(kind==='duck'){
            mark.appendChild(document.createElement('i'));
            mark.appendChild(document.createElement('b'));
          }
          brick.appendChild(mark);
        }
        course.appendChild(brick);
        if(tiles>0)interlocking++;
        x+=brickWidth;
        count++;tiles++;
        if(count>900)break;
      }
      rows++;
      fragment.appendChild(course);
      if(count>900)break;
    }
    field.replaceChildren(fragment);
    field.dataset.brickCount=String(count);
    field.dataset.courseCount=String(rows);
    field.dataset.wall='stacked';
  }
  function schedule(){
    if(queued)return;
    queued=true;requestAnimationFrame(render);
  }
  render();
  if(typeof ResizeObserver!=='undefined'){
    const observer=new ResizeObserver(schedule);
    observer.observe(field);
  }else window.addEventListener('resize',schedule,{passive:true});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(schedule).catch(()=>{});
})();
