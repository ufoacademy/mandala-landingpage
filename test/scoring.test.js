const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ASSESSMENT_VERSION,
  SCORING_VERSION,
  normalizeLikertScore,
  getScoreBand,
} = require('../lib/scoring');

test('versions are explicit and stable', () => {
  assert.equal(ASSESSMENT_VERSION, 'HM-8D64-2026.09');
  assert.equal(SCORING_VERSION, 'HM-POMP-0-100-v1');
});

test('normalizes the 8-question area score from 8..32 to 0..100', () => {
  assert.equal(normalizeLikertScore(8, 8), 0);
  assert.equal(normalizeLikertScore(14, 8), 25);
  assert.equal(normalizeLikertScore(20, 8), 50);
  assert.equal(normalizeLikertScore(26, 8), 75);
  assert.equal(normalizeLikertScore(32, 8), 100);
});

test('normalizes the 2-question dimension score from 2..8 to 0..100', () => {
  assert.equal(normalizeLikertScore(2, 2), 0);
  assert.equal(normalizeLikertScore(5, 2), 50);
  assert.equal(normalizeLikertScore(8, 2), 100);
});

test('maps normalized scores to four documented bands', () => {
  assert.equal(getScoreBand(0), '취약');
  assert.equal(getScoreBand(24), '취약');
  assert.equal(getScoreBand(25), '주의');
  assert.equal(getScoreBand(50), '보통');
  assert.equal(getScoreBand(75), '강점');
  assert.equal(getScoreBand(100), '강점');
});

test('rejects impossible inputs', () => {
  assert.throws(() => normalizeLikertScore(7, 8), RangeError);
  assert.throws(() => normalizeLikertScore(33, 8), RangeError);
  assert.throws(() => normalizeLikertScore(20, 0), TypeError);
  assert.throws(() => getScoreBand(101), RangeError);
});
