const byId = id => document.getElementById(id);
const start = byId('start');
const intro = byId('intro');
const guess = byId('guess');
const field = guess.parentElement;
const wordsFound = new Set();
const playerStorage = 'tagalong.player.v1';
const attemptMarker = 'tagalong.started.v1';
const endpoint = 'https://mqozqigwkobnhijvvboy.supabase.co/rest/v1/rpc/tagalong_round';
const publicKey = 'sb_publishable__AqZ1h05YLDbnKZf8FC-Tw_WahZdQot';
let dictionary, player, round, opensAt, endsAt, guessPrefix, tick;
let phase = 'intro';
let loading = false;

byId('rules').open = matchMedia('(min-width:721px)').matches;

async function requestRound(resumeOnly) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST', cache: 'no-store', signal: controller.signal,
      headers: { apikey: publicKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_key: player, resume_only: resumeOnly })
    });
    if (!response.ok) throw new Error('Round request failed');
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function addWord(word) {
  if (wordsFound.has(word)) return;
  wordsFound.add(word);
  const chip = document.createElement('li');
  chip.textContent = word;
  byId('found').prepend(chip);
  byId('score').textContent = wordsFound.size;
  byId('pointLabel').textContent = wordsFound.size === 1 ? 'point' : 'points';
}

function showTotal() {
  const score = wordsFound.size;
  const list = byId('answers');
  const items = document.createDocumentFragment();
  const answers = [...dictionary].filter(word => word !== round.word && word.includes(round.word)).sort();
  for (const word of answers) {
    const item = document.createElement('li');
    if (wordsFound.has(word)) {
      item.className = 'found-answer';
      item.setAttribute('aria-label', word + ', found');
      item.textContent = '✓ ' + word;
    } else {
      item.textContent = word;
    }
    items.append(item);
  }
  list.replaceChildren(items);
  byId('found').hidden = true;
  byId('total').textContent = score + (score === 1 ? ' point' : ' points') + ' · Found ' + score + ' of ' + answers.length;
}

function updateClock() {
  if (phase === 'done') return;
  const now = performance.now();
  if (now >= endsAt) {
    phase = 'done';
    clearInterval(tick);
    byId('countdown').hidden = true;
    byId('play').hidden = true;
    byId('result').hidden = false;
    showTotal();
    return;
  }
  if (now < opensAt) {
    byId('countdown').textContent = 'Guessing opens in ' + Math.ceil((opensAt - now) / 1000) + '…';
    return;
  }
  if (phase !== 'play') {
    phase = 'play';
    byId('countdown').hidden = true;
    byId('play').hidden = false;
    guess.focus({ preventScroll: true });
  }
  byId('time').textContent = Math.ceil((endsAt - now) / 1000);
}

function showRound(data) {
  round = data;
  const offset = performance.now() - Date.parse(data.server_now);
  opensAt = offset + Date.parse(data.opens_at);
  endsAt = offset + Date.parse(data.ends_at);
  guessPrefix = 'tagalong.guess.' + player + '.' + data.day + '.';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(guessPrefix)) addWord(key.slice(guessPrefix.length));
  }
  intro.hidden = true;
  byId('round').hidden = false;
  byId('word').textContent = data.word.toUpperCase();
  byId('word').focus({ preventScroll: true });
  phase = 'reveal';
  tick = setInterval(updateClock, 80);
  updateClock();
}

async function prepare() {
  if (loading) return;
  loading = true;
  start.disabled = true;
  try {
    player = localStorage.getItem(playerStorage) || crypto.randomUUID();
    localStorage.setItem(playerStorage, player);
    byId('notice').textContent = 'Loading dictionary…';
    const response = await fetch('words.txt');
    if (!response.ok) throw new Error('Dictionary unavailable');
    const entries = (await response.text()).trim().split(/\r?\n/);
    if (entries.length < 25000 || !entries.includes('tagalong')) throw new Error('Incomplete dictionary');
    dictionary = new Set(entries);
    if (localStorage.getItem(attemptMarker)) {
      const existing = await requestRound(true);
      if (existing) {
        showRound(existing);
        return;
      }
    }
    byId('notice').textContent = '';
    start.firstChild.textContent = 'Start today’s round ';
  } catch {
    dictionary = null;
    byId('notice').textContent = 'Couldn’t prepare the round. Check your connection and allow browser storage, then try again.';
    start.firstChild.textContent = 'Retry loading ';
  } finally {
    loading = false;
    start.disabled = false;
  }
}

start.addEventListener('click', async () => {
  if (!dictionary) return prepare();
  if (loading || phase !== 'intro') return;
  loading = true;
  start.disabled = true;
  try {
    localStorage.setItem(attemptMarker, '1');
    byId('notice').textContent = '';
    intro.classList.add('leaving');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await new Promise(resolve => setTimeout(resolve, 220));
    }
    byId('loadingRound').hidden = false;
    const data = await requestRound(false);
    showRound(data);
  } catch {
    intro.classList.remove('leaving');
    byId('notice').textContent = 'Couldn’t open the round. Try again to start or resume.';
  } finally {
    byId('loadingRound').hidden = true;
    loading = false;
    start.disabled = false;
  }
});

function clearError() {
  field.classList.remove('invalid');
  guess.removeAttribute('aria-invalid');
  byId('feedback').textContent = '';
}

function rejectGuess(message) {
  field.classList.remove('invalid');
  void field.offsetWidth;
  field.classList.add('invalid');
  guess.setAttribute('aria-invalid', 'true');
  byId('feedback').textContent = message;
  guess.focus();
  guess.select();
}

byId('form').addEventListener('submit', event => {
  event.preventDefault();
  if (!round) return;
  updateClock();
  if (phase !== 'play') return;
  const entry = guess.value.trim().toLowerCase();
  const seed = round.word;
  if (entry === seed) return rejectGuess('Add at least one letter to “' + seed.toUpperCase() + '”.');
  if (!dictionary.has(entry)) return rejectGuess('Word not found in the dictionary.');
  if (!entry.includes(seed)) return rejectGuess('Your word must contain “' + seed.toUpperCase() + '”.');
  if (wordsFound.has(entry) || localStorage.getItem(guessPrefix + entry)) {
    return rejectGuess('You’ve already found this word.');
  }
  localStorage.setItem(guessPrefix + entry, '1');
  addWord(entry);
  clearError();
  guess.value = '';
  guess.focus({ preventScroll:true });
});
guess.addEventListener('input', clearError);
window.addEventListener('storage', event => {
  if (guessPrefix && event.newValue === '1' && event.key?.startsWith(guessPrefix)) {
    addWord(event.key.slice(guessPrefix.length));
    if (phase === 'done') showTotal();
  }
});
document.addEventListener('visibilitychange', () => {
  if (round && !document.hidden) updateClock();
});
prepare();
