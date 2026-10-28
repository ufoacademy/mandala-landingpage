const { createHmac, randomUUID } = require('node:crypto');
const { readGrant } = require('./lib/diagnosis-grant');
const { normalizeExamPhone } = require('./lib/phone');

function grantFromCookie(header, secret) {
  const match = String(header || '').match(/(?:^|;\s*)hm_diagnosis_grant=([A-Za-z0-9_.-]+)/);
  return match ? readGrant(match[1], secret) : null;
}

function createHandler({ postLead, sheetsWebhookUrl, grantSecret, writeSecret }) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method_not_allowed' });
      return;
    }

    const body = req.body || {};
    const {
      id, name, age, gender, email, contact, consentMarketing,
      areaScores, allAnswers, checkupValues, totalScore, totalScorePct,
      selectedMode, diagnosisStartedAt, diagnosisCompletedAt,
      assessmentVersion, scoringVersion, reportSchemaVersion, linkedPlanId,
    } = body;

    if (!Array.isArray(areaScores) || areaScores.length !== 8) {
      res.status(400).json({ error: 'invalid_area_scores' });
      return;
    }

    if (!sheetsWebhookUrl || !grantSecret || !writeSecret || writeSecret.length < 32) {
      res.status(503).json({ error: 'not_configured' });
      return;
    }
    const verified = grantFromCookie(req.headers && req.headers.cookie, grantSecret);
    if (!verified) { res.status(401).json({ error: 'unauthorized' }); return; }
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
      res.status(400).json({ error: 'invalid_id' }); return;
    }
    if (normalizeExamPhone(contact) !== verified.phone) {
      res.status(403).json({ error: 'phone_mismatch' }); return;
    }
    const writeTimestamp = Date.now();
    const writeNonce = randomUUID();
    const writeMessage = `diagnosis\n${id}\n${verified.userId}\n${verified.invitationId}\n${writeTimestamp}\n${writeNonce}`;
    const writeSignature = createHmac('sha256', writeSecret).update(writeMessage).digest('hex');

    const result = { ok: true, diagnosisStored: true };

    if (sheetsWebhookUrl) {
      // Must be awaited: this function has no other async work to keep it alive, so an
      // un-awaited fetch can get cut off when the serverless invocation ends right after
      // the response is sent (verified in production — logged success, no sheet row).
      try {
        const gasResult = await postLead(sheetsWebhookUrl, {
          type: 'diagnosis',
          id: id || '',
          name: verified.userName,
          age: age || '',
          gender: gender || '',
          email: email || '',
          contact: verified.phone,
          consentMarketing: !!consentMarketing,
          timestamp: new Date().toISOString(),
          totalScore: totalScore ?? null,
          totalScorePct: totalScorePct ?? null,
          assessmentVersion: assessmentVersion || '',
          scoringVersion: scoringVersion || '',
          reportSchemaVersion: reportSchemaVersion || '',
          selectedMode: selectedMode || '',
          diagnosisStartedAt: diagnosisStartedAt || '',
          diagnosisCompletedAt: diagnosisCompletedAt || '',
          areaScores,
          allAnswers: allAnswers && typeof allAnswers === 'object' ? allAnswers : {},
          checkupValues: checkupValues && typeof checkupValues === 'object' ? checkupValues : {},
          appUserId: verified.userId,
          appUserName: verified.userName,
          phone: verified.phone,
          invitationId: verified.invitationId,
          linkedPlanId: linkedPlanId || '',
          writeTimestamp, writeNonce, writeSignature,
        });
        if (!gasResult || gasResult.ok !== true || gasResult.diagnosisStored !== true) throw new Error('DIAGNOSIS_WRITE_FAILED');
        if (gasResult && gasResult.planComparison) {
          result.planComparison = gasResult.planComparison;
        }
      } catch (err) {
        // Do not log result codes, verification values, or health data.
        res.status(502).json({ error: 'storage_unavailable' });
        return;
      }
    }

    res.status(200).json(result);
  };
}

async function realPostLead(url, payload) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error('DIAGNOSIS_WRITE_FAILED');
  return await resp.json();
}

const defaultHandler = createHandler({
  postLead: realPostLead,
  sheetsWebhookUrl: process.env.SHEETS_WEBHOOK_URL,
  grantSecret: process.env.DIAGNOSIS_GRANT_SECRET,
  writeSecret: process.env.DIAGNOSIS_WRITE_SECRET,
});

module.exports = defaultHandler;
module.exports.createHandler = createHandler;
