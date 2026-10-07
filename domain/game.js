const ROUNDS = 5;
const MIN_PRICE = 1;
const MAX_PRICE = 250_000_000;
const backgrounds = ['#e9f3ff','#fff1df','#e9f8ee','#f5eaff','#fff6c9','#e9f7f7'];

const $ = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:n<100?2:0}).format(n);

let domains=[];
let rounds=[];
let roundIndex=0;
let totalScore=0;
let results=[];
let locked=false;
const BEST_KEY='crilo_domain_top5';
function getBests(){try{return JSON.parse(localStorage.getItem(BEST_KEY)||'[]')}catch{return []}}
function saveBest(score){const b=[...getBests(),score].sort((a,b)=>b-a).slice(0,5);localStorage.setItem(BEST_KEY,JSON.stringify(b));return b}
function renderBests(scores=getBests()){$('bestScores').innerHTML=scores.length?scores.map((s,i)=>`<div class="best-score-row"><span>#${i+1}</span><strong>${Number(s).toLocaleString()} / 5000</strong></div>`).join(''):'<div class="r-meta">Finish a game to set your first personal best.</div>'}

function sliderToPrice(v){
  const t = Number(v)/1000;
  const raw = Math.pow(10, Math.log10(MIN_PRICE) + t*(Math.log10(MAX_PRICE)-Math.log10(MIN_PRICE)));
  return snapPrice(raw);
}
function priceToSlider(price){
  return 1000*(Math.log10(price)-Math.log10(MIN_PRICE))/(Math.log10(MAX_PRICE)-Math.log10(MIN_PRICE));
}
function snapPrice(n){
  if(n<10) return Math.round(n*100)/100;
  if(n<100) return Math.round(n);
  if(n<1_000) return Math.round(n/10)*10;
  if(n<10_000) return Math.round(n/100)*100;
  if(n<100_000) return Math.round(n/1_000)*1_000;
  if(n<1_000_000) return Math.round(n/10_000)*10_000;
  if(n<10_000_000) return Math.round(n/100_000)*100_000;
  return Math.round(n/1_000_000)*1_000_000;
}
function calculateScore(guess,actual){
  const ratio=Math.max(guess,actual)/Math.max(0.01,Math.min(guess,actual));
  const logError=Math.log10(ratio);
  return Math.max(0,Math.min(1000,Math.round(1000*Math.exp(-1.35*logError))));
}
function shuffle(a){
  const b=[...a];
  for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}
  return b;
}
function chooseRounds(){
  // 3 documented + 2 estimates per game when possible, randomized order.
  const sales=shuffle(domains.filter(d=>d.price_type==='documented_sale')).slice(0,3);
  const estimates=shuffle(domains.filter(d=>d.price_type==='crilo_estimate')).slice(0,2);
  return shuffle([...sales,...estimates]).slice(0,ROUNDS);
}
function renderProgress(){
  $('progress').innerHTML=Array.from({length:ROUNDS},(_,i)=>`<span class="dot ${i<roundIndex?'done':i===roundIndex?'current':''}"></span>`).join('');
}
function setRound(){
  locked=false;
  const d=rounds[roundIndex];
  document.body.style.background=backgrounds[roundIndex%backgrounds.length];
  $('score').textContent=totalScore.toLocaleString();
  $('domainName').textContent=d.domain;
  const estimated=d.price_type==='crilo_estimate';
  $('questionType').textContent=estimated?'CRILO ESTIMATE':'DOCUMENTED SALE';
  $('question').textContent=estimated?'What is this famous domain worth in Crilo’s domain-only estimate?':'How much did this domain sell for?';
  $('guessButton').classList.remove('hidden');
  $('reveal').classList.add('hidden');
  $('priceSlider').disabled=false;
  $('priceSlider').value=Math.round(priceToSlider(100_000));
  updateGuess();
  renderProgress();
}
function updateGuess(){ $('guessValue').textContent=fmt(sliderToPrice($('priceSlider').value)); }
function submitGuess(){
  if(locked) return;
  locked=true;
  const d=rounds[roundIndex];
  const guess=sliderToPrice($('priceSlider').value);
  const score=calculateScore(guess,d.answer_price_usd);
  totalScore+=score;
  results.push({domain:d.domain,guess,actual:d.answer_price_usd,score,type:d.price_type});
  $('score').textContent=totalScore.toLocaleString();
  $('yourGuess').textContent=fmt(guess);
  $('actualPrice').textContent=fmt(d.answer_price_usd);
  $('roundScore').textContent=score.toLocaleString();
  $('answerLabel').textContent=d.price_type==='crilo_estimate'?'Crilo estimate':'Sale price';
  $('sourceNote').textContent=d.price_type==='crilo_estimate'
    ? 'Hypothetical domain-only game estimate — not a public sale or professional appraisal.'
    : 'Documented-sale entry from the Crilo research dataset.';
  $('priceSlider').disabled=true;
  $('guessButton').classList.add('hidden');
  $('nextButton').textContent=roundIndex===ROUNDS-1?'See results':'Next round';
  $('reveal').classList.remove('hidden');
}
function nextRound(){
  if(roundIndex===ROUNDS-1){showResults();return;}
  roundIndex++;setRound();
}
function showResults(){
  $('gameScreen').classList.add('hidden');
  $('resultsScreen').classList.remove('hidden');
  $('finalScore').textContent=totalScore.toLocaleString();
  $('score').textContent=totalScore.toLocaleString();
  const msg=totalScore>=4700?'Domain genius.':totalScore>=4000?'Seriously impressive.':totalScore>=3000?'Pretty good.':totalScore>=2000?'Not bad.':totalScore>=1000?'Domains are weird.':"Maybe don't become a domain broker.";
  $('finalMessage').textContent=msg;
  $('roundResults').innerHTML=results.map(r=>`<div class="result-row"><div><div class="r-domain">${r.domain}</div><div class="r-meta">${r.type==='crilo_estimate'?'Estimated value':'Documented sale'}</div></div><div class="r-meta">Guess: ${fmt(r.guess)}</div><div class="r-meta">Answer: ${fmt(r.actual)}</div><div class="r-points">${r.score}</div></div>`).join('');
  renderBests(saveBest(totalScore));
  document.body.style.background='#eef0f6';
}
function restart(){
  roundIndex=0;totalScore=0;results=[];rounds=chooseRounds();
  $('resultsScreen').classList.add('hidden');$('gameScreen').classList.remove('hidden');setRound();
}
async function init(){
  try{
    const res=await fetch('domains.json',{cache:'no-store'});
    if(!res.ok) throw new Error('Could not load domains.json');
    domains=await res.json();
    // Crilo Easter egg: keep it rare and clearly a registration price.
    domains.push({domain:'crilo.fun',answer_price_usd:1.57,price_type:'registration'});
    rounds=chooseRounds();
    setRound();
  }catch(err){
    $('domainName').textContent='Could not load game data';
    $('question').textContent='Make sure index.html, game.js, style.css, and domains.json are in the same GitHub folder.';
    $('guessButton').disabled=true;
    console.error(err);
  }
}
$('priceSlider').addEventListener('input',updateGuess);
$('guessButton').addEventListener('click',submitGuess);
$('nextButton').addEventListener('click',nextRound);
$('playAgainButton').addEventListener('click',restart);
init();

$('helpBtn').addEventListener('click',()=>$('helpModal').classList.remove('hidden'));
$('closeHelp').addEventListener('click',()=>$('helpModal').classList.add('hidden'));
$('helpModal').addEventListener('click',e=>{if(e.target===$('helpModal'))$('helpModal').classList.add('hidden')});
renderBests();
