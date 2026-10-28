const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler: createRawHandler } = require('../api/log-diagnosis');
const { createGrant } = require('../api/lib/diagnosis-grant');
const grantSecret = 'anonymous-grant-secret-with-at-least-32-chars';
const writeSecret = 'anonymous-write-secret-with-at-least-32-chars';
function createHandler(options) {
  const handler = createRawHandler({ ...options, grantSecret, writeSecret });
  const cookie = `hm_diagnosis_grant=${createGrant({ userId: 'U001', userName: '배경미', phone: '+821012345678', invitationId: 'I1' }, grantSecret)}`;
  return (req, res) => handler({ ...req, headers: { ...req.headers, cookie },
    body: { contact: '010-1234-5678', ...req.body } }, res);
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
  return Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `영역${i + 1}`,
    sub: `서브${i + 1}`,
    score: 20,
    pctVal: 63,
  }));
}

test('rejects non-POST requests with 405', async () => {
  const handler = createHandler({ postLead: async () => {}, sheetsWebhookUrl: null });
  const req = { method: 'GET', body: {} };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
});

test('rejects request with missing areaScores as 400', async () => {
  const handler = createHandler({ postLead: async () => {}, sheetsWebhookUrl: null });
  const req = { method: 'POST', body: { id: 'x1', totalScore: 100 } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
});

test('rejects request with areaScores that does not have exactly 8 items as 400', async () => {
  const handler = createHandler({ postLead: async () => {}, sheetsWebhookUrl: null });
  const req = { method: 'POST', body: { id: 'x1', areaScores: makeAreaScores().slice(0, 3), totalScore: 60 } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
});

test('returns 503 without calling postLead when sheetsWebhookUrl is not configured', async () => {
  let called = false;
  const handler = createHandler({
    postLead: async () => { called = true; return { ok: true, diagnosisStored: true }; },
    sheetsWebhookUrl: null,
  });
  const req = { method: 'POST', body: { id: 'x1', areaScores: makeAreaScores(), lowScoreItems: [], totalScore: 160 } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 503);
  assert.equal(called, false);
});

test('posts type "diagnosis" with id, personal info, areaScores, allAnswers, checkupValues, totalScore to sheets webhook', async () => {
  let postedPayload = null;
  const handler = createHandler({
    postLead: async (url, payload) => {
      postedPayload = payload;
      return { ok: true, diagnosisStored: true };
    },
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = {
    method: 'POST',
    body: {
      id: 'x1',
      name: '홍길동',
      age: '35',
      gender: 'm',
      email: 'hong@example.com',
      contact: '010-1234-5678',
      consentMarketing: true,
      areaScores: makeAreaScores(),
      allAnswers: { '1-A-1': 2 },
      checkupValues: { bmi: '23.5' },
      totalScore: 160,
      totalScorePct: 50,
      assessmentVersion: 'HM-8D64-2026.09',
      scoringVersion: 'HM-POMP-0-100-v1',
      reportSchemaVersion: 'HM-REPORT-v1',
      selectedMode: 'both',
      diagnosisStartedAt: '2026-09-08T10:00:00.000Z',
      diagnosisCompletedAt: '2026-09-08T10:12:00.000Z',
    },
  };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(postedPayload.type, 'diagnosis');
  assert.equal(postedPayload.id, 'x1');
  assert.equal(postedPayload.name, '배경미');
  assert.equal(postedPayload.phone, '+821012345678');
  assert.equal(postedPayload.invitationId, 'I1');
  assert.equal(postedPayload.age, '35');
  assert.equal(postedPayload.gender, 'm');
  assert.equal(postedPayload.email, 'hong@example.com');
  assert.equal(postedPayload.contact, '+821012345678');
  assert.equal(postedPayload.consentMarketing, true);
  assert.equal(postedPayload.totalScore, 160);
  assert.equal(postedPayload.totalScorePct, 50);
  assert.equal(postedPayload.assessmentVersion, 'HM-8D64-2026.09');
  assert.equal(postedPayload.scoringVersion, 'HM-POMP-0-100-v1');
  assert.equal(postedPayload.reportSchemaVersion, 'HM-REPORT-v1');
  assert.equal(postedPayload.selectedMode, 'both');
  assert.equal(postedPayload.diagnosisStartedAt, '2026-09-08T10:00:00.000Z');
  assert.equal(postedPayload.diagnosisCompletedAt, '2026-09-08T10:12:00.000Z');
  assert.deepEqual(postedPayload.areaScores, makeAreaScores());
  assert.deepEqual(postedPayload.allAnswers, { '1-A-1': 2 });
  assert.deepEqual(postedPayload.checkupValues, { bmi: '23.5' });
});

test('uses grant identity instead of browser appUserId/appUserName', async () => {
  let postedPayload = null;
  const handler = createHandler({
    postLead: async (url, payload) => {
      postedPayload = payload;
      return { ok: true, diagnosisStored: true };
    },
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = {
    method: 'POST',
    body: {
      id: 'x1',
      areaScores: makeAreaScores(),
      totalScore: 160,
      appUserId: 'forged',
      appUserName: 'forged',
    },
  };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(postedPayload.appUserId, 'U001');
  assert.equal(postedPayload.appUserName, '배경미');
});

test('uses verified grant identity when browser omits appUserId/appUserName', async () => {
  let postedPayload = null;
  const handler = createHandler({
    postLead: async (url, payload) => {
      postedPayload = payload;
      return { ok: true, diagnosisStored: true };
    },
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = { method: 'POST', body: { id: 'x1', areaScores: makeAreaScores(), totalScore: 160 } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(postedPayload.appUserId, 'U001');
  assert.equal(postedPayload.appUserName, '배경미');
});

test('defaults allAnswers and checkupValues to empty object when omitted', async () => {
  let postedPayload = null;
  const handler = createHandler({
    postLead: async (url, payload) => {
      postedPayload = payload;
      return { ok: true, diagnosisStored: true };
    },
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = { method: 'POST', body: { id: 'x1', areaScores: makeAreaScores(), totalScore: 160 } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(postedPayload.allAnswers, {});
  assert.deepEqual(postedPayload.checkupValues, {});
});

test('webhook failure blocks code issuance', async () => {
  const handler = createHandler({
    postLead: async () => { throw new Error('network error'); },
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = { method: 'POST', body: { id: 'x1', areaScores: makeAreaScores(), totalScore: 160 } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 502);
});

test('awaits postLead before responding (regression: fire-and-forget got cut off by the serverless runtime before the sheet write completed)', async () => {
  let webhookResolved = false;
  const handler = createHandler({
    postLead: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      webhookResolved = true;
      return { ok: true, diagnosisStored: true };
    },
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = { method: 'POST', body: { id: 'x1', areaScores: makeAreaScores(), totalScore: 160 } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(webhookResolved, true, 'handler must await postLead, not fire-and-forget it');
  assert.equal(res.statusCode, 200);
});

test('includes linkedPlanId in the GAS payload when provided', async () => {
  let postedPayload = null;
  const handler = createHandler({
    postLead: async (url, payload) => { postedPayload = payload; return { ok: true, diagnosisStored: true }; },
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = { method: 'POST', body: { id: 'x1', areaScores: makeAreaScores(), totalScore: 160, linkedPlanId: 'p1' } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(postedPayload.linkedPlanId, 'p1');
  assert.equal(res.statusCode, 200);
});

test('defaults linkedPlanId to empty string when omitted', async () => {
  let postedPayload = null;
  const handler = createHandler({
    postLead: async (url, payload) => { postedPayload = payload; return { ok: true, diagnosisStored: true }; },
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = { method: 'POST', body: { id: 'x1', areaScores: makeAreaScores(), totalScore: 160 } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(postedPayload.linkedPlanId, '');
});

test('forwards planComparison from GAS response when present', async () => {
  const handler = createHandler({
    postLead: async () => ({ ok: true, diagnosisStored: true, planComparison: { planId: 'p1', goals: [], achievementRate: 100 } }),
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = { method: 'POST', body: { id: 'x1', areaScores: makeAreaScores(), totalScore: 160, linkedPlanId: 'p1' } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.diagnosisStored, true);
  assert.deepEqual(res.body.planComparison, { planId: 'p1', goals: [], achievementRate: 100 });
});

test('does not include planComparison when GAS response omits it', async () => {
  const handler = createHandler({
    postLead: async () => ({ ok: true, diagnosisStored: true }),
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = { method: 'POST', body: { id: 'x1', areaScores: makeAreaScores(), totalScore: 160 } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.diagnosisStored, true);
  assert.equal(res.body.planComparison, undefined);
});

test('refuses to issue a code when GAS gives no confirmation', async () => {
  const handler = createHandler({
    postLead: async () => {},
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = { method: 'POST', body: { id: 'x1', areaScores: makeAreaScores(), totalScore: 160 } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.resultCode, undefined);
});
