const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler: createRawHandler } = require('../api/verify-user');
function createHandler(options) {
  return createRawHandler({ ...options, grantSecret: 'anonymous-grant-secret-with-at-least-32-chars' });
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
    setHeader() {},
  };
}

test('rejects non-POST requests with 405', async () => {
  const handler = createHandler({ verifyUser: async () => {}, sheetsWebhookUrl: 'https://example.com/webhook' });
  const req = { method: 'GET', body: {} };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
});

test('rejects request missing name, phone or code as 400', async () => {
  const handler = createHandler({ verifyUser: async () => {}, sheetsWebhookUrl: 'https://example.com/webhook' });
  const res = mockRes();
  await handler({ method: 'POST', body: { name: '배경미' } }, res);
  assert.equal(res.statusCode, 400);
  const missingPhone = mockRes();
  await handler({ method: 'POST', body: { name: '익명', code: 'ABC' } }, missingPhone);
  assert.equal(missingPhone.statusCode, 400);
});

test('returns 503 when sheetsWebhookUrl is not configured', async () => {
  const handler = createHandler({ verifyUser: async () => {}, sheetsWebhookUrl: null });
  const req = { method: 'POST', body: { name: '배경미', phone: '01012345678', code: 'M0001' } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 503);
});

test('forwards name, canonical phone and code without exposing the phone in the response', async () => {
  let sentPayload = null;
  const handler = createHandler({
    verifyUser: async (url, payload) => {
      sentPayload = payload;
      return { result: 'ok', userId: 'U001', userName: '배경미', phone: '+821012345678', invitationId: 'I1' };
    },
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = { method: 'POST', body: { name: '  배경미  ', phone: '010-1234-5678', code: ' M0001 ' } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(sentPayload.type, 'verify_user');
  assert.equal(sentPayload.name, '배경미');
  assert.equal(sentPayload.code, 'M0001');
  assert.equal(sentPayload.phone, '+821012345678');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { result: 'ok', userId: 'U001', userName: '배경미' });
});

test('forwards canRetest through to the response when verifyUser returns it', async () => {
  const handler = createHandler({
    verifyUser: async () => ({ result: 'ok', userId: 'U001', userName: '배경미', phone: '+821012345678', invitationId: 'I1', canRetest: false }),
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = { method: 'POST', body: { name: '배경미', phone: '01012345678', code: 'M0001' } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.canRetest, false);
});

test('propagates suspended/expired/not_found results unchanged', async () => {
  for (const result of ['suspended', 'expired', 'not_found']) {
    const handler = createHandler({
      verifyUser: async () => ({ result }),
      sheetsWebhookUrl: 'https://example.com/webhook',
    });
    const req = { method: 'POST', body: { name: '배경미', phone: '01012345678', code: 'M0001' } };
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.result, result);
  }
});

test('returns 502 when verifyUser throws', async () => {
  const handler = createHandler({
    verifyUser: async () => { throw new Error('network error'); },
    sheetsWebhookUrl: 'https://example.com/webhook',
  });
  const req = { method: 'POST', body: { name: '배경미', phone: '01012345678', code: 'M0001' } };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 502);
});
