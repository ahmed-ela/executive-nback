export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MAX_N = 20;

function validateN(n) {
  if (!Number.isInteger(n) || n < 1 || n > MAX_N) {
    throw new RangeError(`n must be an integer from 1 to ${MAX_N}`);
  }
}

function randomIndex(length, rng) {
  const value = rng();
  if (!(value >= 0 && value < 1)) throw new RangeError('rng must return a value in [0, 1)');
  return Math.floor(value * length);
}

function targetIndices(count, targets, rng) {
  const indices = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = randomIndex(i + 1, rng);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return new Set(indices.slice(0, targets));
}

function chooseOther(options, excluded, rng) {
  const candidates = options.filter(value => value !== excluded);
  return candidates[randomIndex(candidates.length, rng)];
}

/** A target is the weekday AFTER the weekday n steps back, including Sunday -> Monday. */
export function isTarget(sequence, n, index) {
  validateN(n);
  if (index < n || index < 0 || index >= sequence.length) return false;
  return sequence[index] === (sequence[index - n] + 1) % DAYS.length;
}

/** Exactly round(30% * scoredTrials) day-after targets; no accidental targets. */
export function generateSequence(n, scoredTrials = 20, rng = Math.random) {
  validateN(n);
  if (!Number.isInteger(scoredTrials) || scoredTrials < 2) {
    throw new RangeError('scoredTrials must be an integer of at least 2');
  }
  const targetCount = Math.max(1, Math.min(scoredTrials - 1, Math.round(scoredTrials * 0.3)));
  const targets = targetIndices(scoredTrials, targetCount, rng);
  const weekdays = Array.from({ length: DAYS.length }, (_, i) => i);
  const sequence = [];
  for (let i = 0; i < n + scoredTrials; i++) {
    const targetDay = i >= n ? (sequence[i - n] + 1) % DAYS.length : undefined;
    sequence.push(i >= n && targets.has(i - n)
      ? targetDay : chooseOther(weekdays, targetDay, rng));
  }
  return sequence;
}

/** Scores and balancedAccuracy are percentages (0..100). Warm-up trials are ignored. */
export function scoreRound(sequence, n, responses = []) {
  validateN(n);
  if (!Array.isArray(sequence) || sequence.length <= n) {
    throw new RangeError('Sequence must include scored trials after its warm-up');
  }
  if (sequence.some(day => !Number.isInteger(day) || day < 0 || day >= DAYS.length)) {
    throw new RangeError('Sequence items must be weekday indices from 0 to 6');
  }
  const result = { hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0 };
  for (let i = n; i < sequence.length; i++) {
    const target = isTarget(sequence, n, i);
    const responded = responses[i]?.match === true;
    if (target) result[responded ? 'hits' : 'misses']++;
    else result[responded ? 'falseAlarms' : 'correctRejections']++;
  }
  result.targets = result.hits + result.misses;
  result.nonTargets = result.falseAlarms + result.correctRejections;
  // Require both classes so chance and no-response scores remain interpretable.
  if (!result.targets || !result.nonTargets) {
    throw new RangeError('A round needs at least one target and one non-target');
  }
  result.balancedAccuracy = 50 * (
    result.hits / result.targets + result.correctRejections / result.nonTargets
  );
  result.score = result.balancedAccuracy;
  result.nextN = Math.max(1, Math.min(MAX_N, n + (result.score >= 90 ? 1 : result.score < 70 ? -1 : 0)));
  return result;
}
