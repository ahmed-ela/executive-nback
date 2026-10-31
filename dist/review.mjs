import { DAYS, MAX_N, isTarget } from './engine.mjs?v=executive-2';

const OUTCOMES = {
  warmup: { symbol: '—', short: 'Warm-up', label: 'Warm-up', color: 'warmup' },
  hit: { symbol: '✓', short: 'Caught', label: 'Correct match', color: 'caught' },
  correctRejection: { symbol: '✓', short: 'Waited', label: 'Correct nonmatch', color: 'waited' },
  miss: { symbol: '×', short: 'Missed', label: 'Missed match', color: 'miss' },
  falseAlarm: { symbol: '!', short: 'False alarm', label: 'False alarm', color: 'false-alarm' }
};

export function canReview(round) {
  return Boolean(round?.complete && Number.isFinite(round.result?.score) && Number.isInteger(round.n) && round.n >= 1 && round.n <= MAX_N &&
    Array.isArray(round.sequence) && round.sequence.length > round.n &&
    round.sequence.every(day => Number.isInteger(day) && day >= 0 && day < DAYS.length) &&
    Array.isArray(round.responses) && round.responses.length === round.sequence.length &&
    round.responses.every(response => response && typeof response.match === 'boolean'));
}

export function trialOutcome(round, index) {
  if (index < round.n) return 'warmup';
  const target = isTarget(round.sequence, round.n, index);
  const pressed = round.responses[index]?.match === true;
  return target ? (pressed ? 'hit' : 'miss') : (pressed ? 'falseAlarm' : 'correctRejection');
}

/** Only call while idle: this is a completed-round review, not a live memory aid. */
export function renderReview(host, round) {
  if (!canReview(round)) { host.hidden = true; return; }
  host.innerHTML = `
    <div class="review-heading"><div><h2 id="review-title">Round review · ${round.n}-back</h2><p class="review-date"></p></div><span class="review-score"></span></div>
    <div class="review-legend" aria-label="Color key"><span class="caught">✓ Caught</span><span class="waited">✓ Waited</span><span class="miss">× Missed match</span><span class="false-alarm">! False alarm</span><span class="warmup">— Warm-up</span></div>
    <p class="review-hint">Read left to right. Select a day to see its comparison. Scroll sideways for more →</p>
    <div class="timeline-scroll" tabindex="0" role="region" aria-label="Weekdays in presentation order">
      <div class="timeline-track"><div class="comparison-link" aria-hidden="true"><span></span></div><ol class="timeline"></ol></div>
    </div>
    <div class="comparison-detail" aria-live="polite"></div>
    <p class="review-footnote">Each color shows one response. Your score balances matches and nonmatches equally.</p>`;
  host.querySelector('.review-date').textContent = new Date(round.date).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
  host.querySelector('.review-score').textContent = `${Math.round(round.result.score)}% score`;
  const timeline = host.querySelector('.timeline');
  const scroll = host.querySelector('.timeline-scroll');
  const link = host.querySelector('.comparison-link');
  const detail = host.querySelector('.comparison-detail');
  const outcomes = round.sequence.map((_, i) => trialOutcome(round, i));
  const buttons = round.sequence.map((day, i) => {
    const outcome = OUTCOMES[outcomes[i]];
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `trial-chip ${outcome.color}`;
    button.setAttribute('aria-label', `Item ${i + 1}, ${DAYS[day]}, ${outcome.label}`);
    button.setAttribute('aria-pressed', 'false');
    button.title = `Item ${i + 1}: ${DAYS[day]} — ${outcome.label}`;
    button.innerHTML = `<span class="trial-number">${i + 1}</span><strong>${DAYS[day].slice(0, 3)}</strong><span class="trial-symbol" aria-hidden="true">${outcome.symbol}</span><span class="trial-outcome">${outcome.short}</span>`;
    button.addEventListener('click', () => select(i, true));
    item.append(button);
    timeline.append(item);
    return button;
  });
  function select(index, reveal) {
    const outcome = OUTCOMES[outcomes[index]];
    const reference = index - round.n;
    buttons.forEach((button, i) => {
      button.classList.toggle('selected', i === index);
      button.classList.toggle('reference', i === reference);
      button.setAttribute('aria-pressed', String(i === index));
    });
    link.hidden = reference < 0;
    if (reference < 0) {
      detail.className = 'comparison-detail warmup';
      detail.innerHTML = `<strong>Item ${index + 1} · ${DAYS[round.sequence[index]]}</strong><p>Warm-up: remember this day. There is no comparison or scored response yet.</p>`;
    } else {
      const earlierDay = DAYS[round.sequence[reference]];
      const expectedDay = DAYS[(round.sequence[reference] + 1) % DAYS.length];
      const currentDay = DAYS[round.sequence[index]];
      const target = isTarget(round.sequence, round.n, index);
      const pressed = round.responses[index].match;
      detail.className = `comparison-detail ${outcome.color}`;
      detail.innerHTML = `<div class="comparison-pair"><span><small>Item ${reference + 1} · ${round.n} back</small><strong>${earlierDay}</strong></span><span class="pair-arrow" aria-hidden="true">→</span><span><small>Item ${index + 1} · shown</small><strong>${currentDay}</strong></span><b class="outcome-label">${outcome.symbol} ${outcome.label}</b></div><p>The day after <strong>${earlierDay}</strong> is <strong>${expectedDay}</strong>. ${target ? 'This was a match — press Space.' : 'This was not a match — do nothing.'}</p><p><strong>${pressed ? 'You responded “match”.' : 'You did not respond.'}</strong></p>`;
      const from = buttons[reference].parentElement;
      const to = buttons[index].parentElement;
      link.style.left = `${timeline.offsetLeft + from.offsetLeft + from.offsetWidth / 2}px`;
      link.style.width = `${to.offsetLeft - from.offsetLeft}px`;
      link.firstElementChild.textContent = `${round.n} back`;
    }
    if (reveal) {
      const first = buttons[Math.max(0, reference)].parentElement;
      const last = buttons[index].parentElement;
      const left = first.offsetLeft;
      const right = last.offsetLeft + last.offsetWidth;
      if (right - left > scroll.clientWidth) scroll.scrollLeft = right - scroll.clientWidth + 8;
      else if (left < scroll.scrollLeft) scroll.scrollLeft = Math.max(0, left - 8);
      else if (right > scroll.scrollLeft + scroll.clientWidth) scroll.scrollLeft = Math.max(0, right - scroll.clientWidth + 8);
    }
  }
  host.hidden = false;
  const firstError = outcomes.findIndex(outcome => outcome === 'miss' || outcome === 'falseAlarm');
  select(firstError >= 0 ? firstError : round.n, true);
}
