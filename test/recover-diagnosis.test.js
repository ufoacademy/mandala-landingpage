const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../api/recover-diagnosis');

const grantSecret = 'anonymous-grant-secret-with-at-least-32-chars';
const code = 'A'.repeat(20);
function mockRes() {
  return { statusCode: 0, body: null, headers: {}, status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; } };
}
function recovered() {
  return { result: 'ok', userId: 'U1', invitationId: 'I1', diagnosisId: 'D1',
    userName: '익명', phone: '+821012345678', age: 45, gender: 'f',
    allAnswers: { '1-A-1': 3 }, checkupValues: { fbg: 92 }, totalScore: 180,
    hasReport: false };
}

test('saved diagnosis recovery returns exam data and a private grant without exposing the code', async () => {
  let payload;
  const handler = createHandler({ recover: async (_url, input) => { payload = input; return recovered(); },
    sheetsWebhookUrl: 'https://example.test/gas', grantSecret });
  const res = mockRes();
  await handler({ method: 'POST', body: { name: ' 익명 ', phone: '010-1234-5678', code: code.toLowerCase() } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(payload.type, 'recover_diagnosis');
  assert.equal(payload.phone, '+821012345678');
  assert.equal(res.body.diagnosisId, 'D1');
  assert.equal(res.body.allAnswers['1-A-1'], 3);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.match(res.headers['set-cookie'], /^hm_diagnosis_grant=.*HttpOnly; Secure; SameSite=Lax/);
  assert.equal(JSON.stringify(res.body).includes(code), false);
  assert.equal('userId' in res.body, false);
});

test('a mismatched identity never receives saved health data or a grant', async () => {
  const handler = createHandler({ recover: async () => ({ ...recovered(), phone: '+821099999999' }),
    sheetsWebhookUrl: 'https://example.test/gas', grantSecret });
  const res = mockRes();
  await handler({ method: 'POST', body: { name: '익명', phone: '01012345678', code } }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.headers['set-cookie'], undefined);
  assert.equal('allAnswers' in res.body, false);
});

test('an incomplete exam cannot be recovered', async () => {
  const handler = createHandler({ recover: async () => ({ result: 'not_found' }),
    sheetsWebhookUrl: 'https://example.test/gas', grantSecret });
  const res = mockRes();
  await handler({ method: 'POST', body: { name: '익명', phone: '01012345678', code } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.headers['set-cookie'], undefined);
});
