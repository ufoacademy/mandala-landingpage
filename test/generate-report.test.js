const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler: createRawHandler } = require('../api/generate-report');
const { createGrant } = require('../api/lib/diagnosis-grant');
const grantSecret = 'anonymous-grant-secret-with-at-least-32-chars';
const writeSecret = 'anonymous-write-secret-with-at-least-32-chars';
function createHandler(options) {
  const handler = createRawHandler({ ...options, postLead: async (...args) => {
    const result = await options.postLead(...args);
    return result === undefined ? { ok: true } : result;
  }, grantSecret, writeSecret });
  const cookie = `hm_diagnosis_grant=${createGrant({ userId: 'U001', userName: '홍길동', phone: '+821012345678', invitationId: 'I1' }, grantSecret)}`;
  return (req, res) => handler({ ...req, headers: { ...req.headers, cookie }, body: { id: 'fixture-id', ...req.body } }, res);
}

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function makeAreaScores() {
  const pctVals = [63, 40, 90, 25, 75, 50, 85, 60];
  return Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `영역${i + 1}`,
    sub: `서브${i + 1}`,
    score: 20,
    pctVal: pctVals[i],
  }));
}

function validBody(overrides = {}) {
  return {
    name: '홍길동',
    age: '35',
    gender: 'm',
    contact: '010-1234-5678',
    email: 'hong@example.com',
    consentPersonal: true,
    consentHealth: true,
    consentMarketing: false,
    honeypot: '',
    areaScores: makeAreaScores(),
    checkupSummary: null,
    totalScore: 160,
    ...overrides,
  };
}

test('rejects non-POST requests with 405', async () => {
  const handler = createHandler({
    createAnthropicClient: () => ({}),
    postLead: async () => {},
    sheetsWebhookUrl: null,
  });
  const req = { method: 'GET', body: {} };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
});

test('rejects request with filled honeypot as 400 without calling Claude', async () => {
  let claudeCalled = false;
  const handler = createHandler({
    createAnthropicClient: () => ({
      messages: { stream: () => { claudeCalled = true; throw new Error('should not be called'); } },
    }),
    postLead: async () => {},
    sheetsWebhookUrl: null,
  });
  const req = { method: 'POST', body: validBody({ honeypot: 'bot' }) };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(claudeCalled, false);
});

test('rejects invalid contact as 400', async () => {
  const handler = createHandler({
    createAnthropicClient: () => ({}),
    postLead: async () => {},
    sheetsWebhookUrl: null,
  });
  const req = { method: 'POST', body: validBody({ contact: 'not-a-phone' }) };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.ok(res.body.details.includes('invalid_contact'));
});

test('rejects missing personal-info consent as 400', async () => {
  const handler = createHandler({
    createAnthropicClient: () => ({}),
    postLead: async () => {},
    sheetsWebhookUrl: null,
  });
  const req = { method: 'POST', body: validBody({ consentPersonal: false }) };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.ok(res.body.details.includes('consent_personal_required'));
});

test('rejects missing health-info consent as 400', async () => {
  const handler = createHandler({
    createAnthropicClient: () => ({}),
    postLead: async () => {},
    sheetsWebhookUrl: null,
  });
  const req = { method: 'POST', body: validBody({ consentHealth: false }) };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.ok(res.body.details.includes('consent_health_required'));
});

test('accepts request without optional marketing consent', async () => {
  const fakeReport = {
    greeting: 'g', coreInsights: ['a', 'b', 'c', 'd'], areaInterpretations: [], pairedSections: [],
    priorityExplanation: 'x', roadmap12Week: [], finalConclusion: { oneLineSummary: 's', whyStrong: 'w', finalProposal: 'f' },
  };
  const handler = createHandler({
    createAnthropicClient: () => ({
      messages: { stream: () => ({ finalMessage: async () => ({ content: [{ type: 'text', text: JSON.stringify(fakeReport) }] }) }) },
    }),
    postLead: async () => {},
    sheetsWebhookUrl: null,
  });
  const req = { method: 'POST', body: validBody({ consentMarketing: false }) };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
});

test('returns generated report JSON on success', async () => {
  const fakeReport = {
    greeting: '안녕하세요',
    coreInsights: ['a', 'b', 'c', 'd'],
    areaInterpretations: [],
    pairedSections: [],
    priorityExplanation: 'x',
    roadmap12Week: [],
    finalConclusion: { oneLineSummary: 's', whyStrong: 'w', finalProposal: 'f' },
  };
  const handler = createHandler({
    createAnthropicClient: () => ({
      messages: {
        stream: () => ({ finalMessage: async () => ({ content: [{ type: 'text', text: JSON.stringify(fakeReport) }] }) }),
      },
    }),
    postLead: async () => {},
    sheetsWebhookUrl: null,
  });
  const req = { method: 'POST', body: validBody() };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.report, fakeReport);
});

test('requests enough max_tokens headroom for thinking + full report (regression: 8000 and 16000 both truncated real responses as the schema/prompt grew)', async () => {
  const fakeReport = {
    greeting: 'g', coreInsights: ['a', 'b', 'c', 'd'], areaInterpretations: [], pairedSections: [],
    priorityExplanation: 'x', roadmap12Week: [], finalConclusion: { oneLineSummary: 's', whyStrong: 'w', finalProposal: 'f' },
  };
  let capturedParams = null;
  const handler = createHandler({
    createAnthropicClient: () => ({
      messages: {
        stream: (params) => {
          capturedParams = params;
          return { finalMessage: async () => ({ content: [{ type: 'text', text: JSON.stringify(fakeReport) }] }) };
        },
      },
    }),
    postLead: async () => {},
    sheetsWebhookUrl: null,
  });
  const req = { method: 'POST', body: validBody() };
  const res = mockRes();
  await handler(req, res);
  assert.ok(capturedParams.max_tokens >= 32000, `max_tokens too low: ${capturedParams.max_tokens}`);
});

test('clamps coreInsights, pairedSections, messagingExamples to their max counts when Claude overshoots (schema cannot enforce minItems/maxItems)', async () => {
  const oversizedReport = {
    greeting: '안녕하세요',
    coreInsights: ['a', 'b', 'c', 'd', 'stray extra item'],
    areaInterpretations: [],
    pairedSections: [
      { leftTitle: '1', leftNarrative: '', rightTitle: '', rightNarrative: '', middleTitle: '', middleNarrative: '', highlightTitle: '', highlightContent: '' },
      { leftTitle: '2', leftNarrative: '', rightTitle: '', rightNarrative: '', middleTitle: '', middleNarrative: '', highlightTitle: '', highlightContent: '' },
      { leftTitle: '3', leftNarrative: '', rightTitle: '', rightNarrative: '', middleTitle: '', middleNarrative: '', highlightTitle: '', highlightContent: '' },
      { leftTitle: '4', leftNarrative: '', rightTitle: '', rightNarrative: '', middleTitle: '', middleNarrative: '', highlightTitle: '', highlightContent: '' },
      { leftTitle: '5 stray', leftNarrative: '', rightTitle: '', rightNarrative: '', middleTitle: '', middleNarrative: '', highlightTitle: '', highlightContent: '' },
    ],
    priorityExplanation: 'x',
    roadmap12Week: [],
    messagingExamples: ['m1', 'm2', 'm3', 'm4', 'm5 stray'],
    finalConclusion: { oneLineSummary: 's', whyStrong: 'w', finalProposal: 'f' },
  };
  const handler = createHandler({
    createAnthropicClient: () => ({
      messages: { stream: () => ({ finalMessage: async () => ({ content: [{ type: 'text', text: JSON.stringify(oversizedReport) }] }) }) },
    }),
    postLead: async () => {},
    sheetsWebhookUrl: null,
  });
  const req = { method: 'POST', body: validBody() };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.report.coreInsights.length, 4);
  assert.deepEqual(res.body.report.coreInsights, ['a', 'b', 'c', 'd']);
  assert.equal(res.body.report.pairedSections.length, 4);
  assert.equal(res.body.report.pairedSections[3].leftTitle, '4');
  assert.equal(res.body.report.messagingExamples.length, 4);
  assert.deepEqual(res.body.report.messagingExamples, ['m1', 'm2', 'm3', 'm4']);
});

test('clamps grayZoneInsights to 10 items when Claude overshoots', async () => {
  const oversizedReport = {
    greeting: '안녕하세요',
    coreInsights: ['a', 'b', 'c', 'd'],
    areaInterpretations: [],
    pairedSections: [],
    priorityExplanation: 'x',
    roadmap12Week: [],
    grayZoneInsights: Array.from({ length: 12 }, (_, i) => ({ name: `항목${i + 1}`, mechanism: 'x' })),
    finalConclusion: { oneLineSummary: 's', whyStrong: 'w', finalProposal: 'f' },
  };
  const handler = createHandler({
    createAnthropicClient: () => ({
      messages: { stream: () => ({ finalMessage: async () => ({ content: [{ type: 'text', text: JSON.stringify(oversizedReport) }] }) }) },
    }),
    postLead: async () => {},
    sheetsWebhookUrl: null,
  });
  const req = { method: 'POST', body: validBody() };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.report.grayZoneInsights.length, 10);
  assert.equal(res.body.report.grayZoneInsights[9].name, '항목10');
});

test('posts generated report to sheets webhook and waits for persistence acknowledgment', async () => {
  let postedPayload = null;
  const fakeReport = {
    greeting: 'g', coreInsights: ['a', 'b', 'c', 'd'], areaInterpretations: [], pairedSections: [],
    priorityExplanation: 'x', roadmap12Week: [], finalConclusion: { oneLineSummary: 's', whyStrong: 'w', finalProposal: 'f' },
  };
  const handler = createHandler({
    createAnthropicClient: () => ({
      messages: { stream: () => ({ finalMessage: async () => ({ content: [{ type: 'text', text: JSON.stringify(fakeReport) }] }) }) },
    }),
    postLead: async (url, payload) => {
      postedPayload = payload;
    },
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = { method: 'POST', body: validBody({ consentMarketing: true }) };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(postedPayload.type, 'premium_lead');
  assert.deepEqual(postedPayload.report, fakeReport);
});

test('awaits postLead before responding (regression: fire-and-forget got cut off by the serverless runtime before the sheet write completed)', async () => {
  let webhookResolved = false;
  const fakeReport = {
    greeting: 'g', coreInsights: ['a', 'b', 'c', 'd'], areaInterpretations: [], pairedSections: [],
    priorityExplanation: 'x', roadmap12Week: [], finalConclusion: { oneLineSummary: 's', whyStrong: 'w', finalProposal: 'f' },
  };
  const handler = createHandler({
    createAnthropicClient: () => ({
      messages: { stream: () => ({ finalMessage: async () => ({ content: [{ type: 'text', text: JSON.stringify(fakeReport) }] }) }) },
    }),
    postLead: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      webhookResolved = true;
    },
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = { method: 'POST', body: validBody() };
  const res = mockRes();
  await handler(req, res);
  assert.equal(webhookResolved, true, 'handler must await postLead, not fire-and-forget it');
  assert.equal(res.statusCode, 200);
});

test('includes type "premium_lead" and passes through the diagnosis id when posting to sheets webhook', async () => {
  let postedPayload = null;
  const fakeReport = {
    greeting: 'g', coreInsights: ['a', 'b', 'c', 'd'], areaInterpretations: [], pairedSections: [],
    priorityExplanation: 'x', roadmap12Week: [], finalConclusion: { oneLineSummary: 's', whyStrong: 'w', finalProposal: 'f' },
  };
  const handler = createHandler({
    createAnthropicClient: () => ({
      messages: { stream: () => ({ finalMessage: async () => ({ content: [{ type: 'text', text: JSON.stringify(fakeReport) }] }) }) },
    }),
    postLead: async (url, payload) => {
      postedPayload = payload;
    },
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = { method: 'POST', body: validBody({ id: 'abc123' }) };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(postedPayload.type, 'premium_lead');
  assert.equal(postedPayload.id, 'abc123');
});

test('includes areaScores/checkupSummary/targetTable/scoringVersion/reportSchemaVersion in the sheets webhook payload (for the 결과스냅샷 saved alongside the report)', async () => {
  let postedPayload = null;
  const fakeReport = {
    greeting: 'g', coreInsights: ['a', 'b', 'c', 'd'], areaInterpretations: [], pairedSections: [],
    priorityExplanation: 'x', roadmap12Week: [], finalConclusion: { oneLineSummary: 's', whyStrong: 'w', finalProposal: 'f' },
  };
  const targetTable = [{ key: 'bmi', name: '체질량지수(BMI)', current: 24, unit: 'kg/m²', target: '23 미만', note: '', status: 'gz' }];
  const handler = createHandler({
    createAnthropicClient: () => ({
      messages: { stream: () => ({ finalMessage: async () => ({ content: [{ type: 'text', text: JSON.stringify(fakeReport) }] }) }) },
    }),
    postLead: async (url, payload) => {
      postedPayload = payload;
    },
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const areaScores = makeAreaScores();
  const req = {
    method: 'POST',
    body: validBody({ areaScores, targetTable, scoringVersion: 'HM-POMP-0-100-v1', reportSchemaVersion: 'HM-REPORT-v1' }),
  };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(postedPayload.areaScores, areaScores);
  assert.deepEqual(postedPayload.targetTable, targetTable);
  assert.equal(postedPayload.scoringVersion, 'HM-POMP-0-100-v1');
  assert.equal(postedPayload.reportSchemaVersion, 'HM-REPORT-v1');
});

test('passes lowScoreItems through to buildPrompt without breaking report generation', async () => {
  const fakeReport = {
    greeting: 'g', coreInsights: ['a', 'b', 'c', 'd'], areaInterpretations: [], pairedSections: [],
    priorityExplanation: 'x', roadmap12Week: [], finalConclusion: { oneLineSummary: 's', whyStrong: 'w', finalProposal: 'f' },
  };
  let capturedMessages = null;
  const handler = createHandler({
    createAnthropicClient: () => ({
      messages: {
        stream: (params) => {
          capturedMessages = params.messages;
          return { finalMessage: async () => ({ content: [{ type: 'text', text: JSON.stringify(fakeReport) }] }) };
        },
      },
    }),
    postLead: async () => {},
    sheetsWebhookUrl: null,
  });
  const req = {
    method: 'POST',
    body: validBody({ lowScoreItems: [{ code: '1-A-1', question: '나는 채소 반찬이나 쌈과 함께 식사한다.' }] }),
  };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.match(capturedMessages[0].content, /나는 채소 반찬이나 쌈과 함께 식사한다\./);
});

test('fetches HIRA age-group stats, filters to chronic diseases, and passes the top one to buildPrompt', async () => {
  const fakeReport = {
    greeting: 'g', coreInsights: ['a', 'b', 'c', 'd'], areaInterpretations: [], pairedSections: [],
    priorityExplanation: 'x', roadmap12Week: [], finalConclusion: { oneLineSummary: 's', whyStrong: 'w', finalProposal: 'f' },
  };
  let capturedMessages = null;
  let capturedFetchArgs = null;
  const handler = createHandler({
    createAnthropicClient: () => ({
      messages: {
        stream: (params) => {
          capturedMessages = params.messages;
          return { finalMessage: async () => ({ content: [{ type: 'text', text: JSON.stringify(fakeReport) }] }) };
        },
      },
    }),
    postLead: async () => {},
    sheetsWebhookUrl: null,
    fetchAgeGroupStats: async (args) => {
      capturedFetchArgs = args;
      return [
        { name: '급성 비인두염(감기)', code: 'J00', count: 900 },
        { name: '본태성(원발성) 고혈압', code: 'I10', count: 400 },
      ];
    },
    hiraApiKey: 'fake-key',
    enableHiraStats: true,
  });
  const req = { method: 'POST', body: validBody({ age: '52', gender: 'f' }) };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(capturedFetchArgs.age, '52');
  assert.equal(capturedFetchArgs.gender, 'f');
  assert.equal(capturedFetchArgs.apiKey, 'fake-key');
  assert.match(capturedMessages[0].content, /연령대 만성질환 통계/);
  assert.match(capturedMessages[0].content, /본태성\(원발성\) 고혈압/);
  assert.doesNotMatch(capturedMessages[0].content, /급성 비인두염/);
});

test('skips fetchAgeGroupStats entirely when enableHiraStats is not set (apis.data.go.kr is unreachable from Vercel and was wasting ~40s per request across 4 sequential calls, pushing report generation past the 300s function limit)', async () => {
  const fakeReport = {
    greeting: 'g', coreInsights: ['a', 'b', 'c', 'd'], areaInterpretations: [], pairedSections: [],
    priorityExplanation: 'x', roadmap12Week: [], finalConclusion: { oneLineSummary: 's', whyStrong: 'w', finalProposal: 'f' },
  };
  let fetchCalled = false;
  const handler = createHandler({
    createAnthropicClient: () => ({
      messages: { stream: () => ({ finalMessage: async () => ({ content: [{ type: 'text', text: JSON.stringify(fakeReport) }] }) }) },
    }),
    postLead: async () => {},
    sheetsWebhookUrl: null,
    fetchAgeGroupStats: async () => {
      fetchCalled = true;
      return [];
    },
    hiraApiKey: 'fake-key',
    // enableHiraStats intentionally omitted — defaults to off
  });
  const req = { method: 'POST', body: validBody() };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(fetchCalled, false, 'fetchAgeGroupStats must not be called unless enableHiraStats is true');
});

test('omits age-group section when fetchAgeGroupStats is not injected (existing tests without HIRA wiring keep working)', async () => {
  const fakeReport = {
    greeting: 'g', coreInsights: ['a', 'b', 'c', 'd'], areaInterpretations: [], pairedSections: [],
    priorityExplanation: 'x', roadmap12Week: [], finalConclusion: { oneLineSummary: 's', whyStrong: 'w', finalProposal: 'f' },
  };
  let capturedMessages = null;
  const handler = createHandler({
    createAnthropicClient: () => ({
      messages: {
        stream: (params) => {
          capturedMessages = params.messages;
          return { finalMessage: async () => ({ content: [{ type: 'text', text: JSON.stringify(fakeReport) }] }) };
        },
      },
    }),
    postLead: async () => {},
    sheetsWebhookUrl: null,
  });
  const req = { method: 'POST', body: validBody() };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.doesNotMatch(capturedMessages[0].content, /연령대 만성질환 통계/);
});

test('returns 502 when Claude call fails', async () => {
  const handler = createHandler({
    createAnthropicClient: () => ({
      messages: { stream: () => ({ finalMessage: async () => { throw new Error('network error'); } }) },
    }),
    postLead: async () => {},
    sheetsWebhookUrl: null,
  });
  const req = { method: 'POST', body: validBody() };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 502);
});
