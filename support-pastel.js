/* Dense floating pastel objects for Keep Crilo Spinning.
   Decorative only; deterministic, no payments, tracking, or external requests. */
(function(){
  'use strict';
  const field=document.getElementById('shapeCanvas');
  if(!field)return;
  const palette=[
    ['#F7B5CB','#D68CA9'],['#FFCBAB','#DC9F86'],
    ['#FFDA95','#D8B477'],['#F6E49F','#CEC179'],
    ['#AFE2C9','#80B8A2'],['#BCE8D9','#8FBFB1'],
    ['#A9DAEE','#7EACCB'],['#BDD1FA','#94A8D6'],
    ['#D0B9F5','#AB91D6'],['#EAC5F3','#C199D0'],
    ['#F2B9DD','#CC90B4'],['#CDE8B3','#A6C087']
  ];
  const kinds=['round','soft-square','pill','arch','dot','pebble','ticket'];
  let seed=0xC710B1A;
  function random(){
    seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
    return (seed>>>0)/4294967296;
  }
  function render(){
    const w=Math.round(field.clientWidth),h=Math.round(field.clientHeight);
    if(!w||!h)return;
    seed=0xC710B1A; // the same pleasing arrangement after a device resize
    const cellW=w<430?58:w<700?66:w<1100?83:94;
    const cellH=cellW*.79;
    const columns=Math.ceil(w/cellW)+2;
    const rows=Math.ceil(h/cellH)+2;
    const fragment=document.createDocumentFragment();
    let count=0,wide=0;
    for(let row=0;row<rows;row++){
      let col=0;
      const offset=(row%3===0?-.31:row%3===1?-.02:-.18)*cellW;
      while(col<columns){
        const roll=random();
        const span=col<columns-1&&roll>.87&&w>490?2:1;
        const kind=kinds[Math.floor(random()*kinds.length)];
        const color=palette[Math.floor(random()*palette.length)];
        // Bounded gaps keep nearly all shapes separate while their shadows
        // and perspective layers create the stacked-on-Z look.
        const cellSpan=span*cellW;
        const shapeW=cellSpan*(span===2?.89:.84+random()*.09);
        const shapeH=cellH*(kind==='dot'?.72+random()*.12:.79+random()*.14);
        const x=offset+(col+span/2)*cellW+(random()-.5)*cellW*.055;
        const y=(row+.5)*cellH+(random()-.5)*cellH*.065;
        const el=document.createElement('span');
        el.className='float-shape '+kind;
        const depth=3+Math.floor(random()*9);
        el.style.setProperty('--x',x.toFixed(1)+'px');
        el.style.setProperty('--y',y.toFixed(1)+'px');
        el.style.setProperty('--w',Math.round(shapeW)+'px');
        el.style.setProperty('--h',Math.round(shapeH)+'px');
        el.style.setProperty('--rot',((random()-.5)*7).toFixed(2)+'deg');
        el.style.setProperty('--rx',((random()-.5)*13).toFixed(1)+'deg');
        el.style.setProperty('--ry',((random()-.5)*13).toFixed(1)+'deg');
        el.style.setProperty('--lift',depth+'px');
        el.style.setProperty('--z',String(1+Math.floor(random()*7)));
        el.style.setProperty('--c',color[0]);
        el.style.setProperty('--shadow',color[1]);
        // Small site motifs, without turning the backdrop into another game.
        if(count%41===8 && shapeW>45){
          const symbol=document.createElement('span');
          symbol.className='float-mark';
          const motif=['wheel','duck','domain'][(Math.floor(count/41))%3];
          symbol.classList.add(motif);
          if(motif==='domain')symbol.textContent='.com';
          if(motif==='duck')symbol.textContent='●';
          el.appendChild(symbol);
        }
        // Only a few pieces have a separate chip resting on their top edge.
        if(count%23===6 && shapeW>65){
          const chip=document.createElement('i');
          chip.className='float-chip';
          el.appendChild(chip);
        }
        fragment.appendChild(el);
        count++;
        if(span===2)wide++;
        col+=span;
        if(count>700)break;
      }
      if(count>700)break;
    }
    field.replaceChildren(fragment);
    field.dataset.layout='floating';
    field.dataset.shapeCount=String(count);
    field.dataset.wideCount=String(wide);
  }
  let pending=false;
  function schedule(){
    if(pending)return;
    pending=true;
    requestAnimationFrame(()=>{pending=false;render()});
  }
  render();
  if(typeof ResizeObserver!=='undefined'){
    const observer=new ResizeObserver(schedule);
    observer.observe(field);
  }else window.addEventListener('resize',schedule,{passive:true});
})();
