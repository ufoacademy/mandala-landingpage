const test = require('node:test');
const assert = require('node:assert/strict');
const { REPORT_SCHEMA } = require('../lib/reportSchema');

test('schema type is object', () => {
  assert.equal(REPORT_SCHEMA.type, 'object');
});

test('schema requires all top-level report fields', () => {
  const expected = [
    'greeting',
    'coreInsights',
    'areaInterpretations',
    'pairedSections',
    'priorityExplanation',
    'nutritionPlan',
    'hopeMessage',
    'ageGroupInsight',
    'grayZoneInsights',
    'roadmap12Week',
    'messagingExamples',
    'finalConclusion',
  ];
  for (const field of expected) {
    assert.ok(REPORT_SCHEMA.required.includes(field), `missing required field: ${field}`);
    assert.ok(REPORT_SCHEMA.properties[field], `missing property definition: ${field}`);
  }
});

test('grayZoneInsights is an array of {name, mechanism} objects with no length constraints', () => {
  const gzi = REPORT_SCHEMA.properties.grayZoneInsights;
  assert.equal(gzi.type, 'array');
  assert.equal(gzi.minItems, undefined);
  assert.equal(gzi.maxItems, undefined);
  assert.deepEqual(gzi.items.required.sort(), ['mechanism', 'name'].sort());
  assert.equal(gzi.items.additionalProperties, false);
});

test('ageGroupInsight requires diseaseName and motivationalSentence', () => {
  const agi = REPORT_SCHEMA.properties.ageGroupInsight;
  assert.equal(agi.type, 'object');
  assert.deepEqual(agi.required.sort(), ['diseaseName', 'motivationalSentence'].sort());
  assert.equal(agi.additionalProperties, false);
});

test('nutritionPlan requires summary and recommendations with evidenceSource per item', () => {
  const np = REPORT_SCHEMA.properties.nutritionPlan;
  assert.deepEqual(np.required.sort(), ['recommendations', 'summary'].sort());
  const recFields = np.properties.recommendations.items.required;
  assert.deepEqual(recFields.sort(), ['description', 'evidenceSource', 'title'].sort());
});

test('coreInsights and messagingExamples have no minItems/maxItems (Claude structured output does not support array length constraints; exact counts enforced via prompt + defensive slicing)', () => {
  assert.equal(REPORT_SCHEMA.properties.coreInsights.minItems, undefined);
  assert.equal(REPORT_SCHEMA.properties.coreInsights.maxItems, undefined);
  assert.equal(REPORT_SCHEMA.properties.messagingExamples.minItems, undefined);
  assert.equal(REPORT_SCHEMA.properties.messagingExamples.maxItems, undefined);
});

test('messagingExamples is an array of strings', () => {
  assert.equal(REPORT_SCHEMA.properties.messagingExamples.type, 'array');
  assert.equal(REPORT_SCHEMA.properties.messagingExamples.items.type, 'string');
});

test('hopeMessage is a plain string field', () => {
  assert.equal(REPORT_SCHEMA.properties.hopeMessage.type, 'string');
});

test('pairedSections has the new left/right/middle/highlight fields and no length constraints', () => {
  const paired = REPORT_SCHEMA.properties.pairedSections;
  assert.equal(paired.minItems, undefined);
  assert.equal(paired.maxItems, undefined);
  const requiredFields = [
    'leftTitle', 'leftNarrative',
    'rightTitle', 'rightNarrative',
    'middleTitle', 'middleNarrative',
    'highlightTitle', 'highlightContent',
  ];
  for (const field of requiredFields) {
    assert.ok(paired.items.required.includes(field), `missing paired section field: ${field}`);
  }
  assert.ok(!paired.items.required.includes('title'), 'old "title" field should be removed');
  assert.ok(!paired.items.required.includes('executionTranslation'), 'old "executionTranslation" field should be removed');
  assert.ok(!paired.items.required.includes('monthlyMission'), 'old "monthlyMission" field should be removed');
});

test('finalConclusion requires oneLineSummary, whyStrong, finalProposal', () => {
  const fc = REPORT_SCHEMA.properties.finalConclusion;
  assert.deepEqual(fc.required.sort(), ['finalProposal', 'oneLineSummary', 'whyStrong'].sort());
});

test('additionalProperties is false at top level to keep output predictable', () => {
  assert.equal(REPORT_SCHEMA.additionalProperties, false);
});
