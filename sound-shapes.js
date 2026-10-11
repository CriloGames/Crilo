/* The Shape of Sound — a free, self-contained Crilo sound playground.
   No accounts, external audio, analytics, purchases, or backend calls. */
(function(){
  'use strict';
  const stage=document.getElementById('soundStage');
  if(!stage)return;
  const objectLayer=document.getElementById('soundObjects');
  const playhead=document.getElementById('soundPlayhead');
  const status=document.getElementById('soundStatus');
  const discovery=document.getElementById('soundDiscovery');
  const selection=document.getElementById('soundSelection');
  const panel=document.getElementById('soundInspector');
  const nameLabel=document.getElementById('soundSelectedName');
  const partsLabel=document.getElementById('soundSelectedParts');
  const widthSlider=document.getElementById('soundStretch');
  const heightSlider=document.getElementById('soundBloom');
  const playButton=document.getElementById('soundPlayRoom');
  const muteButton=document.getElementById('soundMute');
  const bpmControl=document.getElementById('soundTempo');
  const bpmLabel=document.getElementById('soundTempoValue');
  const definitions={
    boop:{name:'Boop',hue:'#F9A8A5',light:'#FFE5CF',glyph:'◌',wave:'sine',duration:.35},
    hum:{name:'Hum',hue:'#A8B6EA',light:'#EBE7FF',glyph:'≈',wave:'triangle',duration:1.05},
    pluck:{name:'Pluck',hue:'#F2C77C',light:'#FFF4CE',glyph:'⌁',wave:'triangle',duration:.38},
    chime:{name:'Chime',hue:'#A6D9C5',light:'#E2FAE8',glyph:'✦',wave:'sine',duration:1.1},
    buzz:{name:'Buzz',hue:'#C9A8DE',light:'#F4E1F9',glyph:'∿',wave:'sawtooth',duration:.45}
  };
  const kinds=Object.keys(definitions);
  const initial=[
    {kind:'boop',x:.17,y:.35,sx:1,sy:1},
    {kind:'chime',x:.48,y:.27,sx:1.05,sy:1.1},
    {kind:'pluck',x:.81,y:.37,sx:.96,sy:.96},
    {kind:'hum',x:.30,y:.74,sx:1.2,sy:1.08},
    {kind:'buzz',x:.69,y:.72,sx:1.04,sy:.92}
  ];
  const MAX_OBJECTS=25;
  const KEY='crilo_sound_shapes_v1';
  // Enhance the existing static page without touching checkout destinations.
  // Move its single optional tip card above the experiment and turn its
  // existing Add button into five directly accessible, named sound choices.
  function arrangePage(){
    if(typeof stage.closest!=='function')return; // Browser-independent VM tests.
    const lab=stage.closest('.sound-lab');
    const tip=document.querySelector('.sound-page > .support-card');
    if(lab&&tip){
      tip.classList.add('sound-tipbar');
      lab.parentElement.insertBefore(tip,lab);
      document.querySelector('.sound-game-divider')?.remove();
      document.querySelector('.sound-support-label')?.remove();
    }
    const original=document.getElementById('soundAdd');
    if(!original||!stage.parentElement)return;
    const palette=document.createElement('div');
    palette.className='sound-palette';
    palette.setAttribute('role','group');
    palette.setAttribute('aria-label','Add one of five sounds');
    const label=document.createElement('span');
    label.className='sound-palette-title';label.textContent='Add a sound ↘';
    palette.appendChild(label);
    const options=document.createElement('div');
    options.className='sound-palette-options';palette.appendChild(options);
    for(const kind of kinds){
      const spec=definitions[kind],button=kind==='boop'?original:document.createElement('button');
      button.id='soundAdd'+spec.name;
      button.type='button';button.className='sound-palette-button';
      button.dataset.kind=kind;button.setAttribute('aria-label','Add '+spec.name+' sound');
      button.innerHTML='<span aria-hidden="true">'+spec.glyph+'</span> '+spec.name;
      options.appendChild(button);
    }
    stage.parentElement.insertBefore(palette,stage);
  }
  function addButton(kind){
    return document.getElementById('soundAdd'+definitions[kind].name)||
      (kind==='boop'?document.getElementById('soundAdd'):null);
  }
  arrangePage();
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const round=(n)=>Math.round(n*1000)/1000;
  let idSeq=0,blobs=[],selected=null,interaction=null,muted=false,audio=null,master=null;
  let loopTimer=null,stepIndex=0,nextStepTime=0,loopStartTime=0,tempo=104;
  let discoveryTimer=null;
  function newBlob(kind,x,y,sx,sy,parts){
    return {id:++idSeq,kind:kinds.includes(kind)?kind:'boop',x:clamp(Number(x)||.5,.09,.91),
      y:clamp(Number(y)||.5,.13,.88),sx:clamp(Number(sx)||1,.58,1.8),
      sy:clamp(Number(sy)||1,.58,1.8),parts:(parts||[kind]).filter(p=>kinds.includes(p)).slice(0,4)};
  }
  function restore(){
    try{
      const stored=JSON.parse(localStorage.getItem(KEY)||'null');
      if(!Array.isArray(stored)||!stored.length||stored.length>MAX_OBJECTS)return null;
      const result=stored.map(v=>{
        if(!v||!kinds.includes(v.kind)||!Array.isArray(v.parts)||!v.parts.length||v.parts.length>4||
           !v.parts.every(p=>kinds.includes(p))||![v.x,v.y,v.sx,v.sy].every(Number.isFinite))throw Error('Invalid sound object');
        return newBlob(v.kind,v.x,v.y,v.sx,v.sy,v.parts);
      });
      return result;
    }catch(_){return null}
  }
  function persist(){
    try{
      localStorage.setItem(KEY,JSON.stringify(blobs.map(b=>({
        kind:b.kind,x:round(b.x),y:round(b.y),sx:round(b.sx),sy:round(b.sy),parts:b.parts
      }))));
    }catch(_){}
  }
  function say(message){
    status.textContent=message;
  }
  function find(id){return blobs.find(b=>b.id===id)}
  function label(blob){return blob.parts.map(t=>definitions[t].name).join(' + ')}
  function size(blob){
    const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
    const normal=clamp(w*.146,78,132);
    const density=Math.sqrt(w*h/Math.max(8,blobs.length))*.73;
    const base=Math.min(normal,Math.max(44,density));
    return {w:Math.round(base*blob.sx),h:Math.round(base*.91*blob.sy)};
  }
  function slots(){
    const cols=stage.clientWidth>=640?7:5,rows=Math.ceil(MAX_OBJECTS/cols),all=[];
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)
      all.push({x:.15+.70*col/Math.max(1,cols-1),y:.18+.64*row/Math.max(1,rows-1)});
    return all;
  }
  function openSpot(blob){
    const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
    let best={x:.5,y:.5},bestScore=-1;
    for(const spot of slots()){
      blob.x=spot.x;blob.y=spot.y;keepInside(blob);
      const own=size(blob);
      const score=blobs.reduce((lowest,b)=>{
        const other=size(b);
        const dx=(blob.x-b.x)*w/Math.max(1,(own.w+other.w)/2+8);
        const dy=(blob.y-b.y)*h/Math.max(1,(own.h+other.h)/2+24);
        return Math.min(lowest,Math.hypot(dx,dy));
      },Infinity);
      if(score>bestScore){bestScore=score;best={x:blob.x,y:blob.y}}
    }
    return best;
  }
  // Keep stretched shapes and resize handles in view across viewport sizes.
  function keepInside(blob){
    const dims=size(blob),rect=stage.getBoundingClientRect();
    const w=Math.max(1,stage.clientWidth||rect.width);
    const h=Math.max(1,stage.clientHeight||rect.height);
    const xInset=Math.min(.48,(dims.w/2+20)/w);
    const yInset=Math.min(.48,(dims.h/2+31)/h);
    blob.x=clamp(blob.x,xInset,1-xInset);
    blob.y=clamp(blob.y,yInset,1-yInset);
  }
  function blobMarkup(blob){
    const spec=definitions[blob.kind],isMixed=blob.parts.length>1;
    const btn=document.createElement('div');
    btn.className='sound-blob'+(isMixed?' sound-mixed':'');
    btn.setAttribute('role','button');btn.setAttribute('tabindex','0');
    btn.setAttribute('aria-label',label(blob)+', tap to hear. Arrow keys move; Shift and arrows stretch.');
    btn.dataset.id=String(blob.id);
    btn.innerHTML='<span class="sound-blob-halo" aria-hidden="true"></span>'+
      '<span class="sound-blob-body" aria-hidden="true"><span class="sound-blob-sheen"></span><span class="sound-blob-wave">'+spec.glyph+'</span></span>'+
      '<span class="sound-blob-caption">'+label(blob)+'</span>'+
      '<span class="sound-handle sound-handle-x" aria-hidden="true" title="Stretch width">↔</span>'+
      '<span class="sound-handle sound-handle-y" aria-hidden="true" title="Stretch height">↕</span>';
    btn.style.setProperty('--blob-color',spec.hue);
    btn.style.setProperty('--blob-light',isMixed?definitions[blob.parts[blob.parts.length-1]].light:spec.light);
    btn.addEventListener('pointerdown',event=>{
      if(event.button!==undefined&&event.button!==0)return;
      const handle=event.target.closest('.sound-handle');
      startInteraction(event,blob.id,handle?(handle.classList.contains('sound-handle-x')?'width':'height'):'move');
    });
    btn.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();select(blob.id);playBlob(blob);pulse(blob.id);return;
      }
      const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      if(!dirs[event.key])return;
      event.preventDefault();select(blob.id);
      const d=dirs[event.key];
      if(event.shiftKey){
        blob.sx=clamp(blob.sx+d[0]*.08,.58,1.8);
        blob.sy=clamp(blob.sy+d[1]*.08,.58,1.8);
      }else{
        blob.x=clamp(blob.x+d[0]*.018,.09,.91);
        blob.y=clamp(blob.y+d[1]*.025,.13,.88);
      }
      paint();persist();
    });
    return btn;
  }
  function paint(){
    const ids=new Set(blobs.map(b=>String(b.id)));
    objectLayer.querySelectorAll('.sound-blob').forEach(node=>{if(!ids.has(node.dataset.id))node.remove()});
    for(const blob of blobs){
      keepInside(blob);
      let node=objectLayer.querySelector('[data-id="'+blob.id+'"]');
      if(!node){node=blobMarkup(blob);objectLayer.appendChild(node)}
      const dims=size(blob);
      node.style.left=(blob.x*100)+'%';
      node.style.top=(blob.y*100)+'%';
      node.style.width=dims.w+'px';
      node.style.height=dims.h+'px';
      node.classList.toggle('is-selected',blob.id===selected);
      node.classList.toggle('is-target',interaction?.target===blob.id);
    }
    const current=find(selected);
    panel.hidden=!current;
    selection.hidden=!!current;
    if(current){
      nameLabel.textContent=current.parts.length>1?'A little mixture':definitions[current.kind].name;
      partsLabel.textContent=current.parts.length>1?label(current)+' · '+current.parts.length+' layers':
        'Tap it, stretch it, or drop it on another sound.';
      widthSlider.value=String(Math.round(current.sx*100));
      heightSlider.value=String(Math.round(current.sy*100));
      document.getElementById('soundSeparate').disabled=current.parts.length<2||blobs.length+current.parts.length-1>MAX_OBJECTS;
      document.getElementById('soundDuplicate').disabled=blobs.length>=MAX_OBJECTS;
      document.getElementById('soundDelete').disabled=blobs.length<=1;
    }
    document.getElementById('soundCounter').textContent=blobs.length+' / '+MAX_OBJECTS+' sounds';
    for(const kind of kinds){
      const button=addButton(kind);
      if(button)button.disabled=blobs.length>=MAX_OBJECTS;
    }
    stage.classList.toggle('is-dense',blobs.length>12);
  }
  function select(id){
    selected=find(id)?.id||null;paint();
  }
  function pulse(id){
    const node=objectLayer.querySelector('[data-id="'+id+'"]');
    if(!node)return;
    node.classList.remove('is-sounding');
    void node.offsetWidth;
    node.classList.add('is-sounding');
    clearTimeout(node._soundTimer);
    node._soundTimer=setTimeout(()=>node.classList.remove('is-sounding'),580);
  }
  function ensureAudio(){
    const Ctor=window.AudioContext||window.webkitAudioContext;
    if(!Ctor){say('Your browser does not support Web Audio. Try a current browser.');return null}
    try{
      if(!audio){
        audio=new Ctor();
        master=audio.createGain();
        master.gain.value=muted?0:.53;
        // Limit stacked notes gently, without changing the normal solo voices.
        if(typeof audio.createDynamicsCompressor==='function'){
          const limiter=audio.createDynamicsCompressor();
          limiter.threshold.value=-14;
          limiter.knee.value=8;
          limiter.ratio.value=12;
          limiter.attack.value=.003;
          limiter.release.value=.17;
          master.connect(limiter);limiter.connect(audio.destination);
        }else master.connect(audio.destination);
      }
      if(audio.state==='suspended')audio.resume().catch(()=>{});
      return audio;
    }catch(_){say('Sound could not start. Check your device audio settings.');return null}
  }
  function playBlob(blob,when){
    if(!blob)return;
    const context=ensureAudio();
    if(!context||muted)return;
    const t=Math.max(context.currentTime+.003,when||0);
    const scale=[130.81,146.83,164.81,196,220,261.63,293.66,329.63,392,440,523.25];
    const index=clamp(Math.round((.9-blob.y)*10),0,10);
    const freq=scale[index]*Math.pow(2,-Math.log2(blob.sx)*.42);
    const volume=clamp(blob.sy*.08,.027,.135)/Math.sqrt(blob.parts.length);
    for(const [n,part] of blob.parts.entries()){
      const spec=definitions[part];
      const length=clamp(spec.duration*blob.sx,.14,2.15);
      const osc=context.createOscillator();
      const envelope=context.createGain();
      const filter=context.createBiquadFilter();
      filter.type='lowpass';
      filter.frequency.value=part==='buzz'?850+blob.sy*730:part==='hum'?1450+blob.sy*880:9000;
      filter.Q.value=part==='buzz'?1.8:.4;
      osc.type=spec.wave;
      osc.frequency.setValueAtTime(clamp(freq*Math.pow(2,n*.005)*(part==='chime'?2:1),55,2400),t);
      if(part==='boop')osc.frequency.exponentialRampToValueAtTime(freq*.83,t+length*.8);
      envelope.gain.setValueAtTime(.0001,t);
      const peak=volume*(part==='hum'?.75:part==='buzz'?.48:1);
      envelope.gain.exponentialRampToValueAtTime(Math.max(.001,peak),t+.012);
      envelope.gain.exponentialRampToValueAtTime(.0001,t+length);
      osc.connect(filter);filter.connect(envelope);
      let pan=null;
      if(typeof context.createStereoPanner==='function'){
        pan=context.createStereoPanner();
        pan.pan.value=clamp((blob.x-.5)*1.2,-.7,.7);
        envelope.connect(pan);pan.connect(master);
      }else envelope.connect(master);
      osc.start(t);osc.stop(t+length+.025);
      osc.onended=()=>{try{osc.disconnect();filter.disconnect();envelope.disconnect();if(pan)pan.disconnect()}catch(_){}};
      if(part==='chime'){
        const partial=context.createOscillator(),amp=context.createGain();
        partial.type='sine';
        partial.frequency.value=freq*3.04;
        amp.gain.setValueAtTime(.0001,t);
        amp.gain.exponentialRampToValueAtTime(Math.max(.001,volume*.25),t+.015);
        amp.gain.exponentialRampToValueAtTime(.0001,t+length*.75);
        partial.connect(amp);amp.connect(master);
        partial.start(t);partial.stop(t+length+.02);
        partial.onended=()=>{partial.disconnect();amp.disconnect()};
      }
    }
  }
  function startInteraction(event,id,mode){
    if(interaction)return; // Ignore additional fingers during an active drag.
    const blob=find(id);if(!blob)return;
    ensureAudio();
    select(id);
    interaction={id,mode,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:blob.x,y:blob.y,
      sx:blob.sx,sy:blob.sy,moved:false,target:null};
    if(stage.setPointerCapture)try{stage.setPointerCapture(event.pointerId)}catch(_){}
    stage.classList.add('is-interacting');
    event.preventDefault();
  }
  function moveInteraction(event){
    if(!interaction||(event.pointerId!==undefined&&event.pointerId!==interaction.pointerId))return;
    const b=find(interaction.id);if(!b)return;
    const rect=stage.getBoundingClientRect();
    const dx=event.clientX-interaction.startX,dy=event.clientY-interaction.startY;
    if(Math.abs(dx)+Math.abs(dy)>6)interaction.moved=true;
    if(interaction.mode==='width'){
      b.sx=clamp(interaction.sx+dx/100,.58,1.8);
    }else if(interaction.mode==='height'){
      b.sy=clamp(interaction.sy-dy/105,.58,1.8);
    }else{
      b.x=clamp(interaction.x+dx/Math.max(1,rect.width),.09,.91);
      b.y=clamp(interaction.y+dy/Math.max(1,rect.height),.13,.88);
      keepInside(b);
      interaction.target=null;
      if(interaction.moved){
        for(const other of blobs){
          if(other.id===b.id)continue;
          const aSize=size(b),oSize=size(other);
          const xDist=Math.abs((b.x-other.x)*rect.width),yDist=Math.abs((b.y-other.y)*rect.height);
          if(xDist<(aSize.w+oSize.w)*.31&&yDist<(aSize.h+oSize.h)*.34){
            interaction.target=other.id;break;
          }
        }
      }
    }
    paint();
  }
  function showDiscovery(message){
    discovery.textContent=message;
    discovery.classList.add('is-visible');
    clearTimeout(discoveryTimer);
    discoveryTimer=setTimeout(()=>discovery.classList.remove('is-visible'),3400);
  }
  function merge(sourceId,targetId){
    const a=find(sourceId),b=find(targetId);
    if(!a||!b||a.id===b.id)return;
    if(a.parts.length+b.parts.length>4){
      say('That sound is full! Try separating a mixture first.');return;
    }
    const parts=[...b.parts,...a.parts],mix=newBlob(b.kind,b.x,b.y,(b.sx+a.sx)/2,(b.sy+a.sy)/2,parts);
    blobs=blobs.filter(item=>item.id!==a.id&&item.id!==b.id);
    blobs.push(mix);selected=mix.id;
    const unique=new Set(parts);
    const special=unique.has('hum')&&unique.has('chime')?'Moonwater':
      unique.has('boop')&&unique.has('buzz')?'Rubber radio':
      unique.has('chime')&&unique.has('pluck')?'Glass garden':
      unique.has('buzz')&&unique.has('pluck')?'A very tiny thunderstorm':null;
    if(special)showDiscovery('You made: '+special+' ✦');
    else showDiscovery(parts.length+' sounds found each other ✦');
    say('Mixed '+label(a)+' with '+label(b)+'. Tap your new sound to hear it.');
    paint();playBlob(mix);pulse(mix.id);persist();
  }
  function finishInteraction(event){
    if(!interaction||(event?.pointerId!==undefined&&event.pointerId!==interaction.pointerId))return;
    const state=interaction;
    interaction=null;stage.classList.remove('is-interacting');
    if(stage.releasePointerCapture&&event?.pointerId!==undefined)try{stage.releasePointerCapture(event.pointerId)}catch(_){}
    if(state.mode==='move'&&state.moved&&state.target){
      merge(state.id,state.target);return;
    }
    const blob=find(state.id);if(!blob)return;
    if(!state.moved&&state.mode==='move'){playBlob(blob);pulse(blob.id);say('Playing '+label(blob)+'. Try stretching it or combining it with another sound.')}
    else if(state.mode==='move')say('Moved '+label(blob)+'. Its position changes the note and timing.');
    else{playBlob(blob);pulse(blob.id);say('Sculpted '+label(blob)+'. It sounds different now.')}
    paint();persist();
  }
  window.addEventListener('pointermove',moveInteraction);
  window.addEventListener('pointerup',finishInteraction);
  window.addEventListener('pointercancel',event=>{
    if(!interaction||(event.pointerId!==undefined&&event.pointerId!==interaction.pointerId))return;
    interaction=null;stage.classList.remove('is-interacting');paint();persist();
  });
  function stepDuration(){return 60/tempo/2}
  function tick(){
    if(!audio||!loopTimer)return;
    if(audio.state!=='running')return;
    let cycles=0;
    while(nextStepTime<audio.currentTime+.12&&cycles++<8){
      const step=stepIndex%16,time=nextStepTime;
      for(const blob of blobs){
        if(clamp(Math.floor(blob.x*16),0,15)===step){
          playBlob(blob,time);
          const id=blob.id;
          const wait=Math.max(0,(time-audio.currentTime)*1000);
          setTimeout(()=>{if(loopTimer)pulse(id)},wait);
        }
      }
      stepIndex=(stepIndex+1)%16;
      nextStepTime+=stepDuration();
    }
    if(cycles>=8)nextStepTime=audio.currentTime+stepDuration();
    // Display the audible position instead of the step queued in advance.
    const phase=audio.currentTime<loopStartTime?0:
      ((stepIndex-(nextStepTime-audio.currentTime)/stepDuration())%16+16)%16;
    playhead.style.left=(phase/16*100)+'%';
  }
  function stopRoom(){
    if(loopTimer){clearInterval(loopTimer);loopTimer=null}
    stage.classList.remove('is-looping');
    playButton.textContent='▶  Play the room';
    playButton.setAttribute('aria-pressed','false');
    playhead.style.left='0%';
  }
  function toggleRoom(){
    if(loopTimer){stopRoom();say('The room is paused.');return}
    if(!ensureAudio())return;
    if(muted){muted=false;updateMute()}
    nextStepTime=audio.currentTime+.08;loopStartTime=nextStepTime;stepIndex=0;
    loopTimer=setInterval(tick,28);
    stage.classList.add('is-looping');
    playButton.textContent='■  Stop the room';
    playButton.setAttribute('aria-pressed','true');
    say('The room is playing! Move shapes left or right to change the rhythm, up or down to change the notes.');
    tick();
  }
  function updateMute(){
    if(master&&audio)master.gain.setTargetAtTime(muted?0:.53,audio.currentTime,.018);
    muteButton.textContent=muted?'♪  Sound off':'♫  Sound on';
    muteButton.setAttribute('aria-pressed',String(!muted));
    muteButton.setAttribute('aria-label',muted?'Unmute the sound playground':'Mute the sound playground');
  }
  function addSound(kind){
    if(!kinds.includes(kind))return;
    if(blobs.length>=MAX_OBJECTS){say('Your room has 25 sounds already. Remove one to make space.');return}
    const blob=newBlob(kind,.5,.5,1,1),spot=openSpot(blob);
    blob.x=spot.x;blob.y=spot.y;
    blobs.push(blob);select(blob.id);playBlob(blob);pulse(blob.id);persist();
    say('Added '+definitions[kind].name+'. Space for '+(MAX_OBJECTS-blobs.length)+' more.');
  }
  function separate(){
    const b=find(selected);
    if(!b||b.parts.length<2)return;
    if(blobs.length+b.parts.length-1>MAX_OBJECTS){say('Not enough space to separate this mixture. Remove a sound first.');return}
    blobs=blobs.filter(v=>v.id!==b.id);
    const count=b.parts.length;
    for(let i=0;i<count;i++){
      const angle=2*Math.PI*i/count;
      const x=clamp(b.x+Math.cos(angle)*.095,.11,.89);
      const y=clamp(b.y+Math.sin(angle)*.13,.15,.85);
      blobs.push(newBlob(b.parts[i],x,y,b.sx,b.sy));
    }
    selected=blobs[blobs.length-1].id;
    paint();persist();say('Separated your mixture back into its individual voices.');
  }
  function reset(){
    stopRoom();
    blobs=initial.map(v=>newBlob(v.kind,v.x,v.y,v.sx,v.sy));
    selected=null;paint();persist();
    say('A fresh little sound garden. Tap any shape to hear it.');
    showDiscovery('A new beginning ✧');
  }
  function shuffle(){
    const grid=slots();
    for(let i=grid.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [grid[i],grid[j]]=[grid[j],grid[i]];
    }
    blobs.forEach((blob,i)=>{blob.x=grid[i].x;blob.y=grid[i].y});
    paint();persist();say('Everything moved. Press Play the room to hear the new melody.');
  }
  for(const kind of kinds){
    const button=addButton(kind);
    if(button)button.addEventListener('click',()=>addSound(kind));
  }
  document.getElementById('soundShuffle').addEventListener('click',shuffle);
  document.getElementById('soundReset').addEventListener('click',reset);
  document.getElementById('soundSeparate').addEventListener('click',separate);
  document.getElementById('soundPreview').addEventListener('click',()=>{const b=find(selected);if(b){playBlob(b);pulse(b.id)}});
  document.getElementById('soundDuplicate').addEventListener('click',()=>{
    const b=find(selected);if(!b||blobs.length>=MAX_OBJECTS)return;
    const duplicate=newBlob(b.kind,.5,.5,b.sx,b.sy,[...b.parts]);
    const spot=openSpot(duplicate);duplicate.x=spot.x;duplicate.y=spot.y;
    blobs.push(duplicate);select(duplicate.id);paint();persist();playBlob(duplicate);pulse(duplicate.id);
    say('A second '+label(b)+' joined the room.');
  });
  document.getElementById('soundDelete').addEventListener('click',()=>{
    if(blobs.length<=1||!find(selected))return;
    blobs=blobs.filter(b=>b.id!==selected);selected=null;paint();persist();
    say('Sound removed. Make another whenever you like.');
  });
  function sliderUpdate(){
    const b=find(selected);if(!b)return;
    b.sx=clamp(Number(widthSlider.value)/100,.58,1.8);
    b.sy=clamp(Number(heightSlider.value)/100,.58,1.8);
    paint();persist();
  }
  widthSlider.addEventListener('input',sliderUpdate);
  heightSlider.addEventListener('input',sliderUpdate);
  widthSlider.addEventListener('change',()=>{const b=find(selected);if(b){playBlob(b);pulse(b.id)}});
  heightSlider.addEventListener('change',()=>{const b=find(selected);if(b){playBlob(b);pulse(b.id)}});
  playButton.addEventListener('click',toggleRoom);
  muteButton.addEventListener('click',()=>{ensureAudio();muted=!muted;updateMute()});
  bpmControl.addEventListener('input',()=>{
    tempo=clamp(Number(bpmControl.value)||104,65,170);
    bpmLabel.textContent=tempo+' BPM';
  });
  window.addEventListener('resize',paint,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRoom()});
  window.addEventListener('pagehide',stopRoom);
  const loaded=restore();
  blobs=loaded||initial.map(v=>newBlob(v.kind,v.x,v.y,v.sx,v.sy));
  paint();updateMute();
  say(loaded?'Welcome back! Your sounds are just where you left them.':'Tap any shape to hear it. Drag onto another shape to combine their sounds.');
})();
