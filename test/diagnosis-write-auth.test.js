const test = require('node:test');
const assert = require('node:assert/strict');
const { createGrant } = require('../api/lib/diagnosis-grant');
const { createHandler: createVerifyHandler } = require('../api/verify-user');
const { createHandler: createLogHandler } = require('../api/log-diagnosis');

const grantSecret = 'anonymous-grant-secret-with-at-least-32-chars';
const writeSecret = 'anonymous-write-secret-with-at-least-32-chars';
const identity = { userId: 'U1', userName: '익명', phone: '+821012345678', invitationId: 'I1' };
function mockRes() {
  return { statusCode: 0, body: null, headers: {}, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }, setHeader(name, value) { this.headers[name.toLowerCase()] = value; } };
}
function diagnosisBody() {
  return { id: 'D1', name: '익명', appUserId: 'forged-user', appUserName: 'forged-name',
    areaScores: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, pctVal: 50 })), totalScore: 128 };
}

test('successful gate verification sets a private signed diagnosis grant', async () => {
  const handler = createVerifyHandler({ verifyUser: async () => ({ result: 'ok', userId: 'U1', userName: '익명', phone: '+821012345678', invitationId: 'I1' }),
    sheetsWebhookUrl: 'https://example.test/gas', grantSecret });
  const res = mockRes();
  await handler({ method: 'POST', body: { name: '익명', phone: '01012345678', code: 'access' } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['set-cookie'], /^hm_diagnosis_grant=[A-Za-z0-9_.-]+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200$/);
  assert.ok(!res.headers['set-cookie'].includes('access'));
  assert.ok(!JSON.stringify(res.body).includes('+8210'));
});

test('diagnosis write binds browser-forged identity to the grant and returns no second code', async () => {
  let payload;
  const handler = createLogHandler({ postLead: async (_url, body) => { payload = body; return { ok: true, diagnosisStored: true }; },
    sheetsWebhookUrl: 'https://example.test/gas', grantSecret, writeSecret });
  const res = mockRes();
  const grant = createGrant(identity, grantSecret);
  await handler({ method: 'POST', headers: { cookie: `hm_diagnosis_grant=${grant}` },
    body: { ...diagnosisBody(), contact: '010-1234-5678', phone: '+821099999999', invitationId: 'forged' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(payload.appUserId, 'U1');
  assert.equal(payload.appUserName, '익명');
  assert.equal(payload.phone, '+821012345678');
  assert.equal(payload.invitationId, 'I1');
  assert.equal(payload.contact, '+821012345678');
  assert.equal('resultCodeHash' in payload, false);
  assert.match(payload.writeSignature, /^[a-f0-9]{64}$/);
  assert.equal('resultCode' in res.body, false);
});

test('an older GAS deployment cannot claim success without storage acknowledgment', async () => {
  const handler = createLogHandler({ postLead: async () => ({ ok: true }),
    sheetsWebhookUrl: 'https://example.test/gas', grantSecret, writeSecret });
  const grant = createGrant(identity, grantSecret);
  const res = mockRes();
  await handler({ method: 'POST', headers: { cookie: `hm_diagnosis_grant=${grant}` }, body: { ...diagnosisBody(), contact: '01012345678' } }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.resultCode, undefined);
});

test('missing grant and failed storage never claim diagnosis success', async () => {
  let calls = 0;
  const handler = createLogHandler({ postLead: async () => { calls++; return { ok: false }; },
    sheetsWebhookUrl: 'https://example.test/gas', grantSecret, writeSecret });
  const absent = mockRes();
  await handler({ method: 'POST', headers: {}, body: diagnosisBody() }, absent);
  assert.equal(absent.statusCode, 401);
  assert.equal(calls, 0);
  const grant = createGrant(identity, grantSecret);
  const failed = mockRes();
  await handler({ method: 'POST', headers: { cookie: `hm_diagnosis_grant=${grant}` }, body: { ...diagnosisBody(), contact: '01012345678' } }, failed);
  assert.equal(failed.statusCode, 502);
  assert.equal('resultCode' in failed.body, false);
});

test('a changed contact is rejected before writing health data', async () => {
  let calls = 0;
  const handler = createLogHandler({ postLead: async () => { calls++; return { ok: true, diagnosisStored: true }; },
    sheetsWebhookUrl: 'https://example.test/gas', grantSecret, writeSecret });
  const res = mockRes();
  const grant = createGrant(identity, grantSecret);
  await handler({ method: 'POST', headers: { cookie: `hm_diagnosis_grant=${grant}` },
    body: { ...diagnosisBody(), contact: '01087654321' } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(calls, 0);
});
