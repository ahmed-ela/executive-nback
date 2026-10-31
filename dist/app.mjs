import { DAYS, MAX_N, generateSequence, scoreRound } from './engine.mjs?v=executive-2';
import { canReview, renderReview } from './review.mjs?v=3';

const $ = id => document.getElementById(id);
// Preserve the old dual n-back history. These scores belong to a different task.
const KEY = 'executive-nback-practice-v1';
const INTERVAL = 3000, FLASH = 500, SCORED_TRIALS = 20;
let history = [];
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (Array.isArray(saved)) history = saved.filter(r =>
    r && Number.isFinite(r.seconds) && r.seconds >= 0 && Number.isInteger(r.n) && r.n >= 1 && r.n <= MAX_N &&
    Number.isFinite(Date.parse(r.date)) && (!r.complete || (r.result && Number.isFinite(r.result.score)))
  );
} catch {}
let state = 'idle', timers = [], sequence = [], responses = [];
let current = -1, roundN = 1, startedAt = 0, trialAt = 0;
for (let n = 1; n <= MAX_N; n++) $('level').add(new Option(`${n}-back`, n));
const last = history.filter(r => r.complete).at(-1);
if (last && Number.isInteger(last.result.nextN)) $('level').value = Math.max(1, Math.min(MAX_N, last.result.nextN));

function instructions() {
  const n = Number($('level').value);
  const seconds = 3 + (n + SCORED_TRIALS) * INTERVAL / 1000;
  $('duration').textContent = `${Math.floor(seconds / 60)}m ${seconds % 60}s / round`;
  $('instructions').innerHTML = `Press when this day is <strong>one day after</strong> the day from <strong>${n} ${n === 1 ? 'item' : 'items'} ago.</strong>`;
  $('example').textContent = n === 1
    ? 'Monday → Tuesday is a match. Sunday → Monday counts too.'
    : `Remember ${n} items back, then move forward one weekday. Sunday wraps to Monday.`;
}
function schedule(fn, delay) { timers.push(setTimeout(fn, delay)); }
function clearTimers() { timers.forEach(clearTimeout); timers = []; }
function showStimulus(text, mode = '') {
  $('stimulus').textContent = text;
  $('stimulus').className = mode;
  $('stimulus').setAttribute('aria-label', mode === 'day' ? `Weekday: ${text}` : text === '+' ? 'Fixation' : text);
}
function clearResponse() {
  $('match').classList.remove('pressed');
  $('match').setAttribute('aria-pressed', 'false');
}
function controls(running) {
  $('level').disabled = running;
  $('start').hidden = running;
  $('stop').hidden = !running;
  $('match').disabled = true;
  $('history-section').querySelectorAll('.review-button').forEach(button => { button.disabled = running; });
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(history)); }
  catch { $('save-note').textContent = 'Storage unavailable; export to keep your results.'; }
  renderHistory();
}
function renderHistory() {
  const completed = history.filter(r => r.complete);
  const seconds = history.reduce((sum, r) => sum + r.seconds, 0);
  $('minutes').textContent = (seconds / 60).toFixed(1);
  $('hours').textContent = (seconds / 3600).toFixed(2);
  $('rounds').textContent = completed.length;
  $('average').textContent = completed.length ? (completed.reduce((sum, r) => sum + r.n, 0) / completed.length).toFixed(1) : '—';
  $('history-count').textContent = history.length ? `(${history.length})` : '';
  $('export').hidden = !history.length;
  if (!history.length) return;
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>When</th><th>Level</th><th>Score</th><th>Minutes</th><th>Review</th></tr></thead>';
  const body = table.createTBody();
  for (const r of history.slice(-12).reverse()) {
    const row = body.insertRow();
    const values = [new Date(r.date).toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}), `${r.n}-back`, r.complete ? `${Math.round(r.result.score)}%` : 'Stopped', (r.seconds / 60).toFixed(1)];
    values.forEach(value => { row.insertCell().textContent = value; });
    const cell = row.insertCell();
    if (canReview(r)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'text-button review-button';
      button.textContent = 'View';
      button.setAttribute('aria-label', `Review ${r.n}-back round, ${values[0]}`);
      button.disabled = state !== 'idle';
      button.addEventListener('click', () => {
        if (state !== 'idle') return;
        renderReview($('round-review'), r);
        $('round-review').scrollIntoView({block:'start'});
      });
      cell.append(button);
    } else {
      cell.textContent = '—';
      if (r.complete) cell.title = 'Detailed responses are unavailable for this round.';
    }
  }
  $('history').replaceChildren(table);
}
function start() {
  if (state !== 'idle' || document.hidden) return;
  roundN = Number($('level').value);
  sequence = generateSequence(roundN, SCORED_TRIALS);
  responses = sequence.map(() => ({match:false}));
  current = -1;
  startedAt = 0;
  $('result').hidden = true;
  $('round-review').hidden = true;
  $('progress').value = 0;
  controls(true);
  state = 'countdown';
  $('status').textContent = 'Get ready. Read each weekday as it appears.';
  showStimulus('3', 'countdown');
  schedule(() => showStimulus('2', 'countdown'), 1000);
  schedule(() => showStimulus('1', 'countdown'), 2000);
  schedule(() => { state = 'playing'; startedAt = performance.now(); nextTrial(); }, 3000);
}
function nextTrial() {
  if (state !== 'playing') return;
  current++;
  if (current === sequence.length) { finish(true); return; }
  clearResponse();
  trialAt = performance.now();
  showStimulus(DAYS[sequence[current]], 'day');
  const warmup = current < roundN;
  $('match').disabled = warmup;
  $('status').textContent = warmup
    ? `Remember this day (${current + 1} of ${roundN}). No response yet.`
    : `${current - roundN + 1} / ${SCORED_TRIALS} · Compare with ${roundN} ${roundN === 1 ? 'item' : 'items'} ago`;
  $('progress').value = Math.max(0, current - roundN);
  schedule(() => showStimulus('+', 'fixation'), FLASH);
  schedule(() => {
    if (performance.now() - trialAt > INTERVAL + 900) {
      finish(false, 'Timing was interrupted. Start a fresh round.');
      return;
    }
    nextTrial();
  }, INTERVAL);
}
function respond() {
  if (state !== 'playing' || current < roundN || responses[current].match || performance.now() - trialAt >= INTERVAL) return;
  responses[current] = {match:true, responseMs:Math.round(performance.now() - trialAt)};
  $('match').classList.add('pressed');
  $('match').setAttribute('aria-pressed', 'true');
}
function finish(complete, message) {
  if (state !== 'countdown' && state !== 'playing') return;
  const wasPlaying = state === 'playing';
  state = 'idle';
  clearTimers();
  clearResponse();
  controls(false);
  showStimulus(complete ? 'Done' : 'Ready', 'idle');
  const seconds = wasPlaying ? Math.min((performance.now() - startedAt) / 1000, sequence.length * INTERVAL / 1000) : 0;
  const result = complete ? scoreRound(sequence, roundN, responses) : null;
  if (seconds > 0) {
    history.push({date:new Date().toISOString(), protocol:'executive-weekday-v1', n:roundN, seconds, complete, result, sequence, responses, intervalMs:INTERVAL, flashMs:FLASH, scoredTrials:SCORED_TRIALS});
    save();
  }
  $('status').textContent = complete ? 'Round complete.' : (message || 'Stopped. Start a fresh round when you’re ready.');
  $('start').textContent = complete ? 'Start next round' : 'Start round';
  if (!complete) { $('progress').value = 0; return; }
  $('progress').value = SCORED_TRIALS;
  $('level').value = result.nextN;
  instructions();
  const next = result.nextN > roundN ? 'Ready for a step up.' : result.nextN < roundN ? 'Let’s try a lighter level.' : 'Keep practicing at this level.';
  $('result').innerHTML = `<h2>${Math.round(result.score)}% · ${roundN}-back</h2>
    <div class="result-stats"><span><strong>${result.hits} / ${result.targets}</strong> caught</span><span><strong>${result.misses}</strong> missed</span><span><strong>${result.falseAlarms}</strong> false alarms</span></div>
    <p>${next} Next round: ${result.nextN}-back.</p>
    <p>Score balances targets caught and nonmatches left alone. Making no responses scores 50%.</p>`;
  $('result').hidden = false;
  renderReview($('round-review'), history.at(-1));
}
$('start').addEventListener('click', start);
$('stop').addEventListener('click', () => finish(false));
$('level').addEventListener('change', instructions);
$('match').addEventListener('click', respond);
document.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
  if (state === 'playing' || state === 'countdown') {
    event.preventDefault();
    if (!event.repeat) respond();
  }
});
// Prevent a keyboard-generated click on release from recording another trial.
document.addEventListener('keyup', event => {
  if (event.code === 'Space' && (state === 'playing' || state === 'countdown')) event.preventDefault();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) finish(false, 'Round stopped when you left the tab. Start a fresh round.');
});
window.addEventListener('pagehide', () => finish(false));
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({protocol:'executive-weekday-v1', days:DAYS, rounds:history}, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'executive-nback-history.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
instructions();
renderHistory();
const latestReview = history.filter(canReview).at(-1);
if (latestReview) renderReview($('round-review'), latestReview);
