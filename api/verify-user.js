const { createGrant } = require('./lib/diagnosis-grant');
const { normalizeExamPhone } = require('./lib/phone');

function createHandler({ verifyUser, sheetsWebhookUrl, grantSecret }) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method_not_allowed' });
      return;
    }

    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const phone = normalizeExamPhone(body.phone);

    if (!name || !code || !phone) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }

    if (!sheetsWebhookUrl) {
      res.status(503).json({ error: 'not_configured' });
      return;
    }

    try {
      const result = await verifyUser(sheetsWebhookUrl, { type: 'verify_user', name, phone, code });
      if (result.result === 'ok') {
        if (result.phone !== phone || !result.userId || !result.invitationId || result.userName !== name) {
          throw new Error('INVALID_VERIFIED_INVITATION');
        }
        if (!grantSecret) { res.status(503).json({ error: 'not_configured' }); return; }
        const grant = createGrant({ userId: result.userId, userName: result.userName,
          phone: result.phone, invitationId: result.invitationId }, grantSecret);
        res.setHeader('Set-Cookie', `hm_diagnosis_grant=${grant}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`);
      } else if (res.setHeader) {
        res.setHeader('Set-Cookie', 'hm_diagnosis_grant=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      }
      if (result.result === 'too_many_attempts') {
        res.status(429).json({ result: 'too_many_attempts' });
      } else {
        res.status(200).json(result.result === 'ok'
          ? { result: 'ok', userId: result.userId, userName: result.userName,
            ...(typeof result.canRetest === 'boolean' ? { canRetest: result.canRetest } : {}) }
          : { result: result.result });
      }
    } catch (err) {
      console.error('user verify failed');
      res.status(502).json({ error: 'verify_failed' });
    }
  };
}

async function realVerifyUser(url, payload) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  // GAS가 verify_user 타입을 모르는 옛 배포라면 result 필드 자체가 없다 — 이 경우
  // "not_found"로 조용히 뭉개면 실제 미등록과 구분이 안 되므로 명시적으로 실패 처리한다.
  if (!data || typeof data.result !== 'string') {
    throw new Error('unexpected response from sheets webhook: ' + JSON.stringify(data));
  }
  return { result: data.result, userId: data.userId, userName: data.userName,
    phone: data.phone, invitationId: data.invitationId, canRetest: data.canRetest };
}

const defaultHandler = createHandler({
  verifyUser: realVerifyUser,
  sheetsWebhookUrl: process.env.SHEETS_WEBHOOK_URL,
  grantSecret: process.env.DIAGNOSIS_GRANT_SECRET,
});

module.exports = defaultHandler;
module.exports.createHandler = createHandler;
