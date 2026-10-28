'use strict';

const ASSESSMENT_VERSION = 'HM-8D64-2026.09';
const SCORING_VERSION = 'HM-POMP-0-100-v1';
const REPORT_SCHEMA_VERSION = 'HM-REPORT-v1';

/**
 * 1~4 Likert 문항의 합계를 0~100 POMP(Percent of Maximum Possible) 점수로 환산한다.
 * 예: 8문항 원점수 8→0, 20→50, 32→100.
 */
function normalizeLikertScore(score, itemCount, minResponse = 1, maxResponse = 4) {
  if (!Number.isFinite(score) || !Number.isInteger(itemCount) || itemCount <= 0) {
    throw new TypeError('score must be finite and itemCount must be a positive integer');
  }
  const minimum = itemCount * minResponse;
  const maximum = itemCount * maxResponse;
  if (score < minimum || score > maximum || maximum === minimum) {
    throw new RangeError('score is outside the possible response range');
  }
  return Math.round(((score - minimum) / (maximum - minimum)) * 100);
}

function getScoreBand(percent) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new RangeError('percent must be between 0 and 100');
  }
  if (percent < 25) return '취약';
  if (percent < 50) return '주의';
  if (percent < 75) return '보통';
  return '강점';
}

module.exports = {
  ASSESSMENT_VERSION,
  SCORING_VERSION,
  REPORT_SCHEMA_VERSION,
  normalizeLikertScore,
  getScoreBand,
};
