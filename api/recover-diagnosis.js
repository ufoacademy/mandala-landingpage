const { createGrant } = require('./lib/diagnosis-grant');
const { normalizeExamPhone } = require('./lib/phone');

function createHandler({ recover, sheetsWebhookUrl, grantSecret }) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const phone = normalizeExamPhone(req.body?.phone);
    const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
    if (!name || name.length > 20 || !phone || !/^[A-F0-9]{20}$/.test(code)) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    if (!sheetsWebhookUrl || !grantSecret || grantSecret.length < 32) {
      return res.status(503).json({ error: 'not_configured' });
    }
    try {
      const data = await recover(sheetsWebhookUrl, { type: 'recover_diagnosis', name, phone, code });
      if (data?.result !== 'ok') {
        return res.status(data?.result === 'too_many_attempts' ? 429 : data?.result === 'expired' ? 410 : 404)
          .json({ error: data?.result === 'expired' ? 'expired' : 'not_found' });
      }
      if (data.userName !== name || data.phone !== phone || !data.userId || !data.invitationId
          || typeof data.diagnosisId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.diagnosisId)
          || !data.allAnswers || typeof data.allAnswers !== 'object'
          || !data.checkupValues || typeof data.checkupValues !== 'object') {
        throw new Error('INVALID_RECOVERED_DIAGNOSIS');
      }
      const grant = createGrant({ userId: data.userId, userName: name, phone,
        invitationId: data.invitationId }, grantSecret);
      res.setHeader('Set-Cookie', `hm_diagnosis_grant=${grant}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ result: 'ok', diagnosisId: data.diagnosisId,
        name, age: data.age, gender: data.gender, email: data.email,
        allAnswers: data.allAnswers, checkupValues: data.checkupValues,
        totalScore: data.totalScore, hasReport: data.hasReport === true,
        report: data.hasReport === true ? data.report : null,
        snapshot: data.hasReport === true ? data.snapshot : null });
    } catch (error) {
      console.error('diagnosis recovery failed');
      return res.status(502).json({ error: 'recovery_unavailable' });
    }
  };
}

async function realRecover(url, payload) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload) });
  if (!response.ok) throw new Error('RECOVERY_WEBHOOK_FAILED');
  return response.json();
}

module.exports = createHandler({ recover: realRecover,
  sheetsWebhookUrl: process.env.SHEETS_WEBHOOK_URL,
  grantSecret: process.env.DIAGNOSIS_GRANT_SECRET });
module.exports.createHandler = createHandler;
