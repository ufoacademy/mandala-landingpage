const Anthropic = require('@anthropic-ai/sdk');
const { validateLead } = require('../lib/validateLead');
const { buildPrompt } = require('../lib/buildPrompt');
const { REPORT_SCHEMA } = require('../lib/reportSchema');
const { fetchAgeGroupDiseaseStats, filterChronicDiseases } = require('../lib/hiraAgeGroupStats');
const { createHash, createHmac, randomUUID } = require('node:crypto');
const { readGrant } = require('./lib/diagnosis-grant');
const { normalizeExamPhone } = require('./lib/phone');

function createHandler({ createAnthropicClient, postLead, sheetsWebhookUrl, grantSecret, writeSecret, fetchAgeGroupStats, hiraApiKey, enableHiraStats }) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method_not_allowed' });
      return;
    }

    const requestStart = Date.now();
    const body = req.body || {};
    const { id, name, age, gender, contact, email, consentPersonal, consentHealth, consentMarketing, honeypot, areaScores, checkupSummary, targetTable, totalScore, lowScoreItems, scoringVersion, reportSchemaVersion } = body;

    let verified = null;
    if (sheetsWebhookUrl) {
      if (!grantSecret || !writeSecret || writeSecret.length < 32) { res.status(503).json({ error: 'not_configured' }); return; }
      const cookie = String(req.headers && req.headers.cookie || '').match(/(?:^|;\s*)hm_diagnosis_grant=([A-Za-z0-9_.-]+)/);
      verified = cookie ? readGrant(cookie[1], grantSecret) : null;
      if (!verified) { res.status(401).json({ error: 'unauthorized' }); return; }
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) { res.status(400).json({ error: 'invalid_id' }); return; }
      if (normalizeExamPhone(contact) !== verified.phone) { res.status(403).json({ error: 'phone_mismatch' }); return; }
      if (typeof name !== 'string' || name.trim() !== verified.userName) {
        res.status(403).json({ error: 'name_mismatch' }); return;
      }
    }

    const lead = validateLead({ name, age, gender, contact, email, consentPersonal, consentHealth, consentMarketing, honeypot });
    if (!lead.valid) {
      // 임시 디버그 — 실제 값은 찍지 않고 실패 사유 코드만 남긴다. 원인 확인 후 제거.
      console.error('validateLead failed:', lead.errors);
      res.status(400).json({ error: 'invalid_input', details: lead.errors });
      return;
    }

    // apis.data.go.kr(HIRA)는 Vercel 서버에서 연결 자체가 계속 타임아웃되고 있어(국내 IP
    // 제한으로 추정) 매 요청마다 순차 호출 4회만큼 시간을 헛되이 날렸고, 그게 리포트 생성이
    // Vercel의 300초 함수 실행 제한을 넘겨 504로 실패하는 원인이 됐다(2026-09-04 확인).
    // 원인이 해결되기 전까지는 ENABLE_HIRA_STATS=true를 명시적으로 켜지 않는 한 건너뛴다.
    const hiraStart = Date.now();
    let ageGroupDisease = null;
    if (enableHiraStats && fetchAgeGroupStats) {
      try {
        const raw = await fetchAgeGroupStats({ age: lead.age, gender: lead.gender, apiKey: hiraApiKey });
        const topChronic = filterChronicDiseases(raw)[0];
        if (topChronic) ageGroupDisease = { name: topChronic.name };
      } catch (err) {
        console.error('HIRA age-group disease stats fetch failed', err);
      }
    }
    const hiraDurationMs = Date.now() - hiraStart;

    let prompt;
    try {
      prompt = buildPrompt({ name: lead.name, areaScores, checkupSummary, totalScore, lowScoreItems, ageGroupDisease });
    } catch (err) {
      console.error('buildPrompt failed:', err.message);
      res.status(400).json({ error: 'invalid_scores', message: err.message });
      return;
    }

    try {
      const client = createAnthropicClient();
      // max_tokens is large enough that the SDK requires streaming (it refuses non-streaming
      // calls it estimates could run past 10 minutes) — stream() avoids that guard, then
      // finalMessage() gives us back the fully assembled response same as create() would.
      const claudeStart = Date.now();
      const stream = client.messages.stream({
        model: 'claude-sonnet-5',
        max_tokens: 32000,
        system: prompt.system,
        messages: prompt.messages,
        output_config: { format: { type: 'json_schema', schema: REPORT_SCHEMA } },
      });
      const response = await stream.finalMessage();
      const claudeDurationMs = Date.now() - claudeStart;
      const textBlock = response.content.find((b) => b.type === 'text');
      const report = JSON.parse(textBlock.text);
      // Claude's structured output (json_schema) doesn't support minItems/maxItems on arrays,
      // so exact counts are prompt-instructed only — clamp defensively in case the model overshoots.
      if (Array.isArray(report.coreInsights)) {
        report.coreInsights = report.coreInsights.slice(0, 4);
      }
      if (Array.isArray(report.pairedSections)) {
        report.pairedSections = report.pairedSections.slice(0, 4);
      }
      if (report.nutritionPlan && Array.isArray(report.nutritionPlan.recommendations)) {
        report.nutritionPlan.recommendations = report.nutritionPlan.recommendations.slice(0, 5);
      }
      if (Array.isArray(report.messagingExamples)) {
        report.messagingExamples = report.messagingExamples.slice(0, 4);
      }
      if (Array.isArray(report.grayZoneInsights)) {
        report.grayZoneInsights = report.grayZoneInsights.slice(0, 10);
      }
      if (sheetsWebhookUrl) {
        // Awaited (not fire-and-forget): an un-awaited fetch here previously got cut off when
        // the serverless invocation ended, silently dropping the sheet write. Best-effort —
        // a webhook failure is caught and logged, not surfaced to the client. The diagnosis-log
        // row (id, personal info, scores, answers) was already written when the result screen
        // appeared; report persistence must still be acknowledged before displaying success.
        try {
          // areaScores/checkupSummary/targetTable/scoringVersion/reportSchemaVersion는 리포트
          // 본문과 함께 GAS가 "결과스냅샷(JSON)"에 저장해, 나중에 AI를 다시 부르거나 현재
          // 데이터로 재계산하지 않고도 이 시점의 결과서를 그대로 재현할 수 있게 한다.
          const reportHash = createHash('sha256').update(JSON.stringify(report), 'utf8').digest('hex');
          const writeTimestamp = Date.now();
          const writeNonce = randomUUID();
          const message = `premium_lead\n${id}\n${verified.userId}\n${verified.invitationId}\n${reportHash}\n${writeTimestamp}\n${writeNonce}`;
          const writeSignature = createHmac('sha256', writeSecret).update(message).digest('hex');
          const saved = await postLead(sheetsWebhookUrl, {
            type: 'premium_lead', id: id || '', report,
            areaScores, checkupSummary, targetTable, scoringVersion, reportSchemaVersion,
            appUserId: verified.userId, invitationId: verified.invitationId,
            reportHash, writeTimestamp, writeNonce, writeSignature,
          });
          if (!saved || saved.ok !== true) throw new Error('REPORT_WRITE_FAILED');
        } catch (err) {
          console.error('lead webhook failed', err);
          res.status(502).json({ error: 'storage_unavailable' });
          return;
        }
      }
      console.log('generate-report timing', {
        totalMs: Date.now() - requestStart,
        claudeMs: claudeDurationMs,
        hiraMs: hiraDurationMs,
        hiraEnabled: !!enableHiraStats,
      });
      res.status(200).json({ report });
    } catch (err) {
      console.error('claude request failed', {
        err,
        totalMs: Date.now() - requestStart,
        hiraMs: hiraDurationMs,
        hiraEnabled: !!enableHiraStats,
      });
      res.status(502).json({ error: 'report_generation_failed' });
    }
  };
}

async function realPostLead(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('REPORT_WRITE_FAILED');
  return await response.json();
}

const defaultHandler = createHandler({
  createAnthropicClient: () => new Anthropic(),
  postLead: realPostLead,
  sheetsWebhookUrl: process.env.SHEETS_WEBHOOK_URL,
  grantSecret: process.env.DIAGNOSIS_GRANT_SECRET,
  writeSecret: process.env.DIAGNOSIS_WRITE_SECRET,
  fetchAgeGroupStats: fetchAgeGroupDiseaseStats,
  hiraApiKey: process.env.HIRA_API_KEY,
  enableHiraStats: process.env.ENABLE_HIRA_STATS === 'true',
});

module.exports = defaultHandler;
module.exports.createHandler = createHandler;
// Large max_tokens can push real generations past Vercel's default function duration.
// Observed a real generation take 117s against a 120s cap — too little margin, raised to 300s.
module.exports.config = { maxDuration: 300 };
