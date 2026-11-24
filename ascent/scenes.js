(() => {
'use strict';
const scenes=[
  {
    "options": [
      "A radio play",
      "A wildlife recording",
      "A puppet show",
      "A film screening"
    ],
    "correct": 0,
    "clues": [
      "A tray of gravel sits beside a script.",
      "Someone has marked exactly when a door should slam.",
      "The man playing the horse never leaves his chair.",
      "Two coconut shells are set beside his microphone.",
      "The cast shares one red ON AIR light.",
      "The listeners will never see the horse."
    ],
    "why": "The gravel makes footsteps and the shells make hoofbeats. The cast makes the whole scene audible for radio listeners."
  },
  {
    "options": [
      "A railway platform",
      "An auction room",
      "A restaurant kitchen",
      "A stock exchange"
    ],
    "correct": 1,
    "clues": [
      "A woman lifts one finger without saying a word.",
      "Across the room, a man shakes his head and lowers his eyes.",
      "Someone at a lectern repeats a number, then waits.",
      "A clerk writes down a paddle number.",
      "A painting stays on its easel until the hammer falls.",
      "The next lot is carried to the front."
    ],
    "why": "The raised finger is a bid. The man declines to raise it, the hammer closes the sale, and the clerk records the winner."
  },
  {
    "options": [
      "A tailor’s fitting",
      "A fencing lesson",
      "A climbing competition",
      "A stage rehearsal"
    ],
    "correct": 2,
    "clues": [
      "Six people stare up at the same wall.",
      "Their hands trace movements while both feet stay on the floor.",
      "One brushes white dust off a rubber toe.",
      "A judge checks that the starting tape is visible.",
      "There is a thick mat beneath the overhang.",
      "Two steady hands on the last hold earn a top."
    ],
    "why": "The competitors are reading a boulder problem from the ground. Chalk, taped starting holds and the controlled top belong to the same attempt."
  },
  {
    "options": [
      "A museum restoration",
      "A bakery before opening",
      "A photo darkroom",
      "A pottery workshop"
    ],
    "correct": 3,
    "clues": [
      "A damp sponge rests beside a loop of wire.",
      "A row of bowls sits upside down.",
      "Thin curls collect under a spinning foot.",
      "The wire slides beneath the base of a fresh cup.",
      "Glaze samples hang on fired tiles.",
      "The kiln door stays closed until it cools."
    ],
    "why": "A potter cuts soft clay off the wheel with wire. Once the bowls stiffen, they are turned upside down so their foot rings can be trimmed."
  },
  {
    "options": [
      "A planetarium show",
      "A drive-in movie",
      "An airport approach",
      "A lighthouse watch"
    ],
    "correct": 1,
    "clues": [
      "Little red lights go dark one row at a time.",
      "Someone wipes a patch of glass at eye level.",
      "A handwritten sign lists an FM frequency.",
      "The people in the back sit on the roof of a van.",
      "Opening credits climb a screen across the parking lot.",
      "A dead battery means a jump-start after the feature."
    ],
    "why": "The red lights are tail lights. The windshield is the viewing window, and the car radio carries the movie soundtrack."
  }
];
const $=id=>document.getElementById(id);
const stage=document.querySelector('.expedition');
const mountain=window.Mountain;
mountain.init($('view'));
let index=0, visible=2, records=[], phase='ready';
const total=()=>records.reduce((sum,r)=>sum+r.points,0);
const stake=()=>250-visible*25;
function screen(name,title){
  phase=name;stage.dataset.phase=name;
  $('startPane').hidden=name!=='ready';
  $('board').hidden=name!=='play';
  $('recap').hidden=name!=='reveal';
  $('finish').hidden=name!=='results';
  $('heading').textContent=title;
  if(name!=='animating')$('heading').focus({preventScroll:true});
}
function addPair(){
  const list=$('clues');
  for(const clue of scenes[index].clues.slice(visible-2,visible)){
    const li=document.createElement('li');li.textContent=clue;list.append(li);
  }
  $('pitch').textContent='PITCH '+(index+1)+' / 5  ·  '+stake()+' POINTS';
  $('hint').hidden=visible===6;
  $('hint').textContent='Reveal two more clues (−50 pts)';
}
function openPitch(){
  visible=2;
  screen('play','Where are you?');
  $('choices').replaceChildren();
  scenes[index].options.forEach((name,i)=>{
    const button=document.createElement('button');button.textContent=name;
    button.onclick=()=>answer(i);$('choices').append(button);
  });
  $('clues').replaceChildren();addPair();
}
function answer(choice){
  if(phase!=='play')return;
  const scene=scenes[index],correct=choice===scene.correct;
  const from=total(),points=correct?stake():0;
  records.push({points,choice,visible});
  const reveal=()=>{
    if(phase!=='animating')return;
    $('pitch').textContent='PITCH '+(index+1)+' / 5  ·  '+points+' POINTS';
    screen('reveal',scene.options[scene.correct]);
    $('why').textContent=(correct?'You read it. ':'You chose '+scene.options[choice].toLowerCase()+'. ')+scene.why;
    $('next').textContent=index===4?'See my climb ↗':'Next pitch ↗';
  };
  screen('animating','');
  if(correct){mountain.climb(from,total(),points/50,reveal,()=>{});}
  else reveal();
}
function finish(){
  screen('results',total()+' / 1,000');
  $('pitch').textContent='ROUTE COMPLETE';
  $('summary').replaceChildren(...records.map((r,i)=>{
    const li=document.createElement('li'),score=document.createElement('b');
    li.append(scenes[i].options[scenes[i].correct]);score.textContent=r.points+' pts';li.append(score);return li;
  }));
  mountain.finish(total(),null);
}
$('begin').onclick=openPitch;
$('hint').onclick=()=>{if(phase==='play' && visible<6){visible+=2;addPair();if(visible===6)$('choices').firstElementChild.focus({preventScroll:true});}};
$('next').onclick=()=>{if(index===4)finish();else{index++;openPitch();}};
$('again').onclick=()=>{index=0;records=[];mountain.set(0);openPitch();};
})();