const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createDevServer } = require('../dev-server');

async function start(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

test('serves the redesigned app and keeps local environment files private', async t => {
  const server = createDevServer({ rootDir: path.join(__dirname, '..') });
  t.after(() => server.close());
  const origin = await start(server);

  const landing = await fetch(origin);
  assert.equal(landing.status, 200);
  assert.match(await landing.text(), /내 건강 캐릭터/);
  const page = await fetch(`${origin}/diagnosis.html`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /SECURE ACCESS/);

  const secret = await fetch(`${origin}/.env.local`);
  assert.equal(secret.status, 404);

  const validator = await fetch(`${origin}/lib/validateLead.js`);
  assert.equal(validator.status, 200);
  assert.match(await validator.text(), /validateLead/);
});

test('proxies local code verification to the existing app API', async t => {
  let upstreamRequest;
  const server = createDevServer({
    rootDir: path.join(__dirname, '..'),
    apiOrigin: 'https://mandala-gamma.vercel.app',
    fetchImpl: async (url, options) => {
      upstreamRequest = { url, options };
      return Response.json({ result: 'ok', userId: 'U001', userName: '테스트' });
    },
  });
  t.after(() => server.close());
  const origin = await start(server);

  const response = await fetch(`${origin}/api/verify-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '테스트', code: '123456' }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { result: 'ok', userId: 'U001', userName: '테스트' });
  assert.equal(upstreamRequest.url, 'https://mandala-gamma.vercel.app/api/verify-user');
  assert.deepEqual(JSON.parse(upstreamRequest.options.body), { name: '테스트', code: '123456' });
});

test('keeps the upstream diagnosis grant on the local server across report requests', async t => {
  const upstreamRequests = [];
  const server = createDevServer({
    fetchImpl: async (url, options) => {
      upstreamRequests.push({ url, options });
      if (url.endsWith('/api/verify-user')) {
        return new Response(JSON.stringify({ result: 'ok', userId: 'U001' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'hm_diagnosis_grant=upstream-secret; Path=/; HttpOnly; Secure; SameSite=Lax' },
        });
      }
      return Response.json({ ok: true });
    },
  });
  t.after(() => server.close());
  const origin = await start(server);

  const verify = await fetch(`${origin}/api/verify-user`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '테스트', code: '123456' }),
  });
  const localCookie = verify.headers.get('set-cookie');
  assert.match(localCookie, /^hm_local_session=/);
  assert.doesNotMatch(localCookie, /upstream-secret/);

  await fetch(`${origin}/api/log-diagnosis`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: localCookie.split(';')[0] }, body: '{}',
  });
  await fetch(`${origin}/api/generate-report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: localCookie.split(';')[0] }, body: '{}',
  });
  assert.equal(upstreamRequests[1].options.headers.Cookie, 'hm_diagnosis_grant=upstream-secret');
  assert.equal(upstreamRequests[2].options.headers.Cookie, 'hm_diagnosis_grant=upstream-secret');
});

test('completed-exam recovery forwards the new diagnosis grant to report generation', async t => {
  const upstreamRequests = [];
  const server = createDevServer({ fetchImpl: async (url, options) => {
    upstreamRequests.push({ url, options });
    if (url.endsWith('/api/recover-diagnosis')) return new Response(JSON.stringify({ result: 'ok', diagnosisId: 'D1' }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'hm_diagnosis_grant=recovered-grant; Path=/; HttpOnly; Secure; SameSite=Lax' },
    });
    return Response.json({ ok: true });
  } });
  t.after(() => server.close());
  const origin = await start(server);
  const recovered = await fetch(`${origin}/api/recover-diagnosis`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '익명' }) });
  assert.equal(recovered.status, 200);
  const localCookie = recovered.headers.get('set-cookie');
  assert.match(localCookie, /^hm_local_session=/);
  await fetch(`${origin}/api/generate-report`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: localCookie.split(';')[0] }, body: '{}' });
  assert.equal(upstreamRequests[1].options.headers.Cookie, 'hm_diagnosis_grant=recovered-grant');
});
