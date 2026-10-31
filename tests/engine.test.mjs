import assert from 'node:assert/strict';
import { DAYS, MAX_N, isTarget, generateSequence, scoreRound } from '../dist/engine.mjs';
import { canReview, trialOutcome } from '../dist/review.mjs';

assert.equal(DAYS[0], 'Monday');
assert.equal(DAYS[6], 'Sunday');
assert.equal(isTarget([6, 0], 1, 1), true, 'Sunday wraps to Monday');
assert.equal(isTarget([0, 0], 1, 1), false, 'Same weekday is not a day-after match');
assert.equal(isTarget([1, 5, 2], 2, 2), true, 'Tuesday / Saturday / Wednesday matches 2-back');
assert.equal(isTarget([1, 5, 6], 2, 2), false, 'Match is based on 2-back, not previous day');
assert.equal(isTarget([6, 0], 2, 1), false, 'Warm-up never matches');

let seed = 42;
const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
let sawSameDayNonTarget = false;
assert.equal(MAX_N, 20);
for (let n = 1; n <= MAX_N; n++) {
  const sequence = generateSequence(n, 20, rng);
  assert.equal(sequence.length, n + 20);
  assert.ok(sequence.every(day => Number.isInteger(day) && day >= 0 && day <= 6));
  const responses = sequence.map((day, i) => ({ match: isTarget(sequence, n, i) }));
  const perfect = scoreRound(sequence, n, responses);
  assert.equal(perfect.targets, 6);
  assert.equal(perfect.nonTargets, 14);
  assert.equal(perfect.hits, 6);
  assert.equal(perfect.correctRejections, 14);
  assert.equal(perfect.score, 100);
  assert.equal(perfect.balancedAccuracy, 100);
  assert.equal(perfect.nextN, Math.min(MAX_N, n + 1));
  const savedRound = JSON.parse(JSON.stringify({n, sequence, responses, result:perfect, complete:true}));
  assert.equal(canReview(savedRound), true, `Saved ${n}-back round can be reviewed`);
  assert.equal(trialOutcome(savedRound, n - 1), 'warmup');
  assert.equal(sequence.filter((_, i) => trialOutcome(savedRound, i) === 'hit').length, perfect.hits);
  assert.equal(sequence.filter((_, i) => trialOutcome(savedRound, i) === 'correctRejection').length, perfect.correctRejections);
  const idle = scoreRound(sequence, n);
  assert.equal(idle.score, 50);
  assert.equal(idle.misses, 6);
  assert.equal(idle.correctRejections, 14);
  assert.equal(idle.nextN, Math.max(1, n - 1));
  for (let i = 0; i < n; i++) responses[i] = { match: true, responseMs: 100 };
  assert.deepEqual(scoreRound(sequence, n, responses), perfect);
  const nonMatch = responses.findIndex((response, i) => i >= n && !response.match);
  responses[nonMatch].match = true;
  const oneFalseAlarm = scoreRound(sequence, n, responses);
  assert.equal(oneFalseAlarm.falseAlarms, 1);
  assert.ok(oneFalseAlarm.score < 100 && oneFalseAlarm.score > 90);
  for (let i = n; i < sequence.length; i++) {
    if (sequence[i] === sequence[i - n]) {
      sawSameDayNonTarget = true;
      assert.equal(isTarget(sequence, n, i), false);
    }
  }
}
assert.ok(sawSameDayNonTarget, 'Same weekday remains a valid non-target');

const sequence = generateSequence(2, 20, rng);
const partial = sequence.map((day, i) => ({ match: isTarget(sequence, 2, i) }));
let removed = 0;
for (let i = 2; i < partial.length && removed < 2; i++) {
  if (partial[i].match) { partial[i].match = false; removed++; }
}
assert.equal(scoreRound(sequence, 2, partial).nextN, 2, 'Intermediate performance holds level');
for (const n of [0, MAX_N + 1, 1.5, NaN, '2']) assert.throws(() => generateSequence(n), RangeError);
assert.throws(() => generateSequence(1, 1), RangeError);
assert.throws(() => generateSequence(1, 20, () => 1), RangeError);
assert.throws(() => scoreRound([0, 8, 2], 1), RangeError);
console.log('Passed: day-after rule, wraparound, n-back indexing, exact targets, scoring, warm-up exclusion, adaptation, invalid inputs.');
