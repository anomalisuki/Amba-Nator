const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let selectedTheme = '1';
let state = null;
let currentTheme = 'Karakter';
let busy = false;

const setupPanel = $('#setupPanel');
const hero = $('#hero');
const gamePanel = $('#gamePanel');
const resultPanel = $('#resultPanel');
const lostPanel = $('#lostPanel');
const errorToast = $('#errorToast');

$$('.theme-card').forEach(card => card.addEventListener('click', () => {
  $$('.theme-card').forEach(x => x.classList.remove('selected'));
  card.classList.add('selected');
  selectedTheme = card.dataset.theme;
}));

async function api(payload) {
  const res = await fetch('/api/akinator', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({status:false,error:'Server mengembalikan response yang tidak valid.'}));
  if (!res.ok || data.status === false) throw new Error(data.error || 'Permintaan gagal.');
  return data;
}

function showError(message) {
  $('#errorText').textContent = message;
  errorToast.classList.remove('hidden');
}
$('#closeError').onclick = () => errorToast.classList.add('hidden');

function setLoading(button, text='Memulai…') {
  button.dataset.oldText = button.innerHTML;
  button.innerHTML = `${text}<span>•</span>`;
  button.disabled = true;
}
function unsetLoading(button) {
  button.innerHTML = button.dataset.oldText || button.innerHTML;
  button.disabled = false;
}

function updateGame() {
  $('#gameTheme').textContent = currentTheme.toUpperCase();
  $('#qNum').textContent = state.num;
  $('#question').textContent = state.question;
  const progress = Math.max(0, Math.min(100, Number(state.progression || 0)));
  $('#progressBar').style.width = `${progress}%`;
  $('#progressText').textContent = `${Math.round(progress)}%`;
  $('#backBtn').disabled = state.num <= 1;
}

function scrollTop() { window.scrollTo({top: 0, behavior: 'smooth'}); }

async function startGame() {
  if (busy) return;
  busy = true;
  const btn = $('#startBtn');
  setLoading(btn);
  errorToast.classList.add('hidden');
  try {
    const data = await api({action:'start', theme:selectedTheme});
    state = data.state;
    currentTheme = data.theme;
    setupPanel.classList.add('hidden');
    hero.classList.add('hidden');
    resultPanel.classList.add('hidden');
    lostPanel.classList.add('hidden');
    gamePanel.classList.remove('hidden');
    updateGame();
    scrollTop();
  } catch (e) {
    showError(e.message);
  } finally {
    unsetLoading(btn);
    busy = false;
  }
}

async function answer(value) {
  if (busy || !state) return;
  busy = true;
  $$('#answers button').forEach(b => b.disabled = true);
  try {
    const data = await api({action:'answer', answer:value, state});
    state = data.state;
    const result = data.result || {};
    updateGame();
    if (result.lost) return showLost();
    if (result.guess) return showGuess(result.guess);
  } catch (e) {
    showError(e.message);
  } finally {
    if (!resultPanel.classList.contains('hidden') || !lostPanel.classList.contains('hidden')) return;
    $$('#answers button').forEach(b => b.disabled = false);
    busy = false;
  }
}

async function goBack() {
  if (busy || !state || state.num <= 1) return;
  busy = true;
  $('#backBtn').disabled = true;
  try {
    const data = await api({action:'back', state});
    state = data.state;
    updateGame();
  } catch (e) { showError(e.message); }
  finally { busy = false; updateGame(); $$('#answers button').forEach(b => b.disabled = false); }
}

async function showGuess(guess) {
  gamePanel.classList.add('hidden');
  resultPanel.classList.remove('hidden');
  $('#resultName').textContent = guess.name || 'Tidak diketahui';
  $('#resultDescription').textContent = guess.description || 'Akinator menemukan tebakan yang paling cocok.';
  $('#resultQuestions').textContent = `${state.num} pertanyaan`;
  $('#resultTheme').textContent = currentTheme;
  const img = $('#resultImage');
  const fallback = $('#imageFallback');
  fallback.textContent = (guess.name || 'A').trim().charAt(0).toUpperCase();
  img.style.display = 'none';
  fallback.style.display = 'grid';
  if (guess.photo) {
    img.onload = () => { img.style.display='block'; fallback.style.display='none'; };
    img.onerror = () => { img.style.display='none'; fallback.style.display='grid'; };
    img.src = guess.photo;
  }
  $('#againBtn').onclick = () => resetToSetup();
  scrollTop();
  try { await api({action:'confirm', theme:currentTheme, state, guess}); } catch (_) {}
  busy = false;
}

function showLost() {
  gamePanel.classList.add('hidden');
  lostPanel.classList.remove('hidden');
  $('#lostAgain').onclick = resetToSetup;
  scrollTop();
  busy = false;
}

function resetToSetup() {
  busy = false;
  state = null;
  resultPanel.classList.add('hidden');
  lostPanel.classList.add('hidden');
  gamePanel.classList.add('hidden');
  setupPanel.classList.remove('hidden');
  hero.classList.remove('hidden');
  scrollTop();
}

$('#startBtn').onclick = startGame;
$('#backBtn').onclick = goBack;
$('#resetTop').onclick = resetToSetup;
$('#againBtn').onclick = resetToSetup;
$('#lostAgain').onclick = resetToSetup;

$$('#answers button').forEach(btn => btn.addEventListener('click', () => answer(btn.dataset.answer)));

document.addEventListener('keydown', e => {
  if (e.target.matches('input,textarea')) return;
  const map = { '1':'1','2':'2','3':'3','4':'4','5':'5' };
  if (map[e.key] && !gamePanel.classList.contains('hidden')) answer(map[e.key]);
  if (e.key === 'ArrowLeft' && !gamePanel.classList.contains('hidden')) goBack();
});
