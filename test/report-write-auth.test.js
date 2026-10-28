const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../api/generate-report');
const { createGrant } = require('../api/lib/diagnosis-grant');

const grantSecret = 'anonymous-grant-secret-with-at-least-32-chars';
const writeSecret = 'anonymous-write-secret-with-at-least-32-chars';
const identity = { userId: 'U1', userName: '익명', phone: '+821012345678', invitationId: 'I1' };
const fakeReport = { greeting: '익명', coreInsights: [], areaInterpretations: [], pairedSections: [],
  priorityExplanation: '', roadmap12Week: [], finalConclusion: { oneLineSummary: '', whyStrong: '', finalProposal: '' } };
const body = { id: 'D1', name: '익명', age: '35', gender: 'm', contact: '010-1234-5678', email: 'person@example.test',
  consentPersonal: true, consentHealth: true, areaScores: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, pctVal: 50 })), totalScore: 128 };
function response() { return { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } }; }

test('report attachment requires verified diagnosis grant before calling AI', async () => {
  let aiCalls = 0;
  const handler = createHandler({ createAnthropicClient: () => { aiCalls++; return {}; }, postLead: async () => {},
    sheetsWebhookUrl: 'https://example.test/gas', grantSecret, writeSecret });
  const res = response();
  await handler({ method: 'POST', headers: {}, body }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(aiCalls, 0);
});

test('report attachment binds its signed hash and ID to verified user', async () => {
  let payload;
  const handler = createHandler({ createAnthropicClient: () => ({ messages: { stream: () => ({ finalMessage: async () => ({ content: [{ type: 'text', text: JSON.stringify(fakeReport) }] }) }) } }),
    postLead: async (_url, value) => { payload = value; return { ok: true }; },
    sheetsWebhookUrl: 'https://example.test/gas', grantSecret, writeSecret });
  const grant = createGrant(identity, grantSecret);
  const res = response();
  await handler({ method: 'POST', headers: { cookie: `hm_diagnosis_grant=${grant}` }, body }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(payload.appUserId, 'U1');
  assert.equal(payload.invitationId, 'I1');
  assert.equal(payload.type, 'premium_lead');
  assert.match(payload.reportHash, /^[a-f0-9]{64}$/);
  assert.match(payload.writeSignature, /^[a-f0-9]{64}$/);
});

test('report generation rejects a contact different from the verified phone before AI', async () => {
  let aiCalls = 0;
  const handler = createHandler({ createAnthropicClient: () => { aiCalls++; return {}; }, postLead: async () => ({ ok: true }),
    sheetsWebhookUrl: 'https://example.test/gas', grantSecret, writeSecret });
  const res = response();
  const grant = createGrant(identity, grantSecret);
  await handler({ method: 'POST', headers: { cookie: `hm_diagnosis_grant=${grant}` },
    body: { ...body, contact: '01087654321' } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(aiCalls, 0);
});

test('report generation rejects a different name before AI', async () => {
  let aiCalls = 0;
  const handler = createHandler({ createAnthropicClient: () => { aiCalls++; return {}; }, postLead: async () => ({ ok: true }),
    sheetsWebhookUrl: 'https://example.test/gas', grantSecret, writeSecret });
  const res = response();
  const grant = createGrant(identity, grantSecret);
  await handler({ method: 'POST', headers: { cookie: `hm_diagnosis_grant=${grant}` },
    body: { ...body, name: '다른이름' } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(aiCalls, 0);
});

test('report generation does not claim success when storage rejects the report', async () => {
  const handler = createHandler({ createAnthropicClient: () => ({ messages: { stream: () => ({
    finalMessage: async () => ({ content: [{ type: 'text', text: JSON.stringify(fakeReport) }] }),
  }) } }), postLead: async () => ({ ok: false, result: 'not_found' }),
  sheetsWebhookUrl: 'https://example.test/gas', grantSecret, writeSecret });
  const grant = createGrant(identity, grantSecret);
  const res = response();
  await handler({ method: 'POST', headers: { cookie: `hm_diagnosis_grant=${grant}` }, body }, res);
  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, { error: 'storage_unavailable' });
});
