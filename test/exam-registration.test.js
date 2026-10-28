const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const writeSecret = 'anonymous-write-secret-with-at-least-32-chars';

function createWorkbook(staffEmail = 'staff@example.test') {
  const tables = new Map();
  const properties = new Map([['STAFF_EMAILS', 'staff@example.test'], ['DIAGNOSIS_WRITE_SECRET', writeSecret]]);
  const cache = new Map();
  let sequence = 0;
  const lock = { acquireCount: 0, releaseCount: 0, waitLock() { this.acquireCount++; }, releaseLock() { this.releaseCount++; } };
  function sheet(name) {
    if (!tables.has(name)) {
      const rows = [];
      tables.set(name, {
        rows,
        getLastRow: () => rows.length,
        getLastColumn: () => rows[0]?.length || 0,
        appendRow: (row) => rows.push([...row]),
        getRange(row, col, count, width) {
          return {
            getValues: () => rows.slice(row - 1, row - 1 + count).map(item => item.slice(col - 1, col - 1 + width)),
            getValue: () => rows[row - 1]?.[col - 1],
            setValue: value => { rows[row - 1][col - 1] = value; },
            setValues: (values) => values.forEach((value, i) => { values[i].forEach((cell, j) => { rows[row - 1 + i][col - 1 + j] = cell; }); }),
          };
        },
      });
    }
    return tables.get(name);
  }
  const context = {
    Date, String, Number, JSON, Math,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => tables.get(name) || null, insertSheet: sheet }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key) || null, setProperty: (key, value) => properties.set(key, value) }) },
    LockService: { getScriptLock: () => lock },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key) || null, put: (key, value) => cache.set(key, value), remove: key => cache.delete(key) }) },
    Session: { getActiveUser: () => ({ getEmail: () => staffEmail }), getScriptTimeZone: () => 'Asia/Seoul' },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      getUuid: () => (++sequence).toString(16).padStart(32, '0'),
      computeDigest: (_algorithm, value, charset) => {
        const encoding = charset === 'UTF_8' ? 'utf8' : 'latin1';
        return Array.from(crypto.createHash('sha256').update(value, encoding).digest(), byte => byte > 127 ? byte - 256 : byte);
      },
      computeHmacSha256Signature: (message, secret) => Array.from(crypto.createHmac('sha256', secret).update(message).digest(), byte => byte > 127 ? byte - 256 : byte),
      formatDate: date => date.toISOString().slice(0, 10),
    },
  };
  const source = fs.readFileSync(require.resolve('../google-apps-script/exam-registration.gs'), 'utf8');
  vm.runInNewContext(source, context);
  vm.runInNewContext(fs.readFileSync(require.resolve('../google-apps-script/lead-webhook.gs'), 'utf8'), context);
  return { context, tables, properties, lock };
}

test('equivalent phones share one stable ID, while each exam gets a new invitation', () => {
  const { context, tables, lock } = createWorkbook();
  assert.equal(context.normalizeExamPhone('010-1234-5678'), '+821012345678');
  assert.equal(context.normalizeExamPhone('+821012345678'), '+821012345678');
  const first = context.registerExamApplication({ name: '익명', phone: '010-1234-5678' });
  const second = context.registerExamApplication({ name: '익명', phone: '+821012345678' });
  assert.equal(first.userId, 'HM000001');
  assert.equal(second.userId, first.userId);
  assert.notEqual(second.invitationId, first.invitationId);
  assert.notEqual(second.code, first.code);
  assert.equal(tables.get('앱사용자명단').rows.length, 2);
  assert.equal(tables.get('검사신청').rows.length, 3);
  assert.equal(lock.acquireCount, 2);
  assert.equal(lock.releaseCount, 2);
  assert.equal(tables.get('검사신청').rows.flat().includes(first.code), false);
});

test('changed name is held for staff review without allocating an ID or invitation', () => {
  const { context, tables, lock } = createWorkbook();
  context.registerExamApplication({ name: '익명', phone: '01012345678' });
  assert.equal(context.registerExamApplication({ name: '다른이름', phone: '01012345678' }).status, 'name_review');
  assert.equal(tables.get('앱사용자명단').rows.length, 2);
  assert.equal(tables.get('검사신청').rows.length, 2);
  assert.equal(lock.acquireCount, lock.releaseCount);
});

test('reissuing an exam code invalidates the old code and keeps the same invitation', () => {
  const { context } = createWorkbook();
  const first = context.registerExamApplication({ name: '익명', phone: '01012345678' });
  const replacement = context.reissueExamCode(first.invitationId);
  assert.equal(replacement.status, 'ok');
  assert.notEqual(replacement.code, first.code);
  assert.equal(context.findExamApplication({ name: '익명', phone: '01012345678', code: first.code }).status, 'not_found');
  const found = context.findExamApplication({ name: '익명', phone: '+821012345678', code: replacement.code });
  assert.equal(found.status, 'ok');
  assert.equal(found.userId, first.userId);
  assert.equal(found.invitationId, first.invitationId);
});

test('phone cells converted to numbers by Sheets still identify and save the same examination', () => {
  const { context, tables } = createWorkbook();
  const first = context.registerExamApplication({ name: '익명', phone: '01012345678' });
  const numericPhone = 821012345678;
  tables.get('앱사용자명단').rows[1][2] = numericPhone;
  tables.get('검사신청').rows[1][3] = numericPhone;

  assert.equal(context.normalizeExamPhone(numericPhone), '+821012345678');
  assert.equal(context.verifyExamGate({ name: '익명', phone: '01012345678', code: first.code }).status, 'ok');
  const second = context.registerExamApplication({ name: '익명', phone: '01012345678' });
  assert.equal(second.userId, first.userId);
  assert.equal(tables.get('앱사용자명단').rows.length, 2);

  const writeTimestamp = Date.now();
  const writeNonce = 'numeric-phone-cells';
  const writeSignature = crypto.createHmac('sha256', writeSecret)
    .update(`diagnosis\nD-numeric\n${first.userId}\n${first.invitationId}\n${writeTimestamp}\n${writeNonce}`).digest('hex');
  const saved = context.saveExamDiagnosis({ id: 'D-numeric', name: '익명',
    phone: '01012345678', contact: '01012345678', appUserId: first.userId,
    invitationId: first.invitationId, areaScores: [], writeTimestamp, writeNonce, writeSignature });
  assert.equal(saved.diagnosisStored, true);

  const report = { greeting: '익명' };
  const reportHash = crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex');
  const reportSignature = crypto.createHmac('sha256', writeSecret)
    .update(`premium_lead\nD-numeric\n${first.userId}\n${first.invitationId}\n${reportHash}\n${writeTimestamp}\n${writeNonce}`).digest('hex');
  const reportSaved = context.saveExamReport({ id: 'D-numeric', appUserId: first.userId,
    invitationId: first.invitationId, report, reportHash, writeTimestamp, writeNonce,
    writeSignature: reportSignature });
  assert.equal(reportSaved.ok, true);
});

test('a completed exam can recover its own saved answers without starting a second exam', () => {
  const { context } = createWorkbook();
  const invitation = context.registerExamApplication({ name: '익명', phone: '01012345678' });
  assert.equal(context.recoverExamDiagnosis({ name: '익명', phone: '01012345678', code: invitation.code }).result, 'not_found');
  const writeTimestamp = Date.now();
  const writeNonce = 'recover-test';
  const id = 'D-recover';
  const writeSignature = crypto.createHmac('sha256', writeSecret)
    .update(`diagnosis\n${id}\n${invitation.userId}\n${invitation.invitationId}\n${writeTimestamp}\n${writeNonce}`).digest('hex');
  const saved = context.saveExamDiagnosis({ id, name: '익명', phone: '01012345678', contact: '01012345678',
    appUserId: invitation.userId, invitationId: invitation.invitationId, age: 45, gender: 'f',
    allAnswers: { '1-A-1': 3 }, checkupValues: { fbg: 92 }, totalScore: 180,
    areaScores: [], writeTimestamp, writeNonce, writeSignature });
  assert.equal(saved.diagnosisStored, true);
  assert.equal(context.verifyExamGate({ name: '익명', phone: '01012345678', code: invitation.code }).status, 'already_completed');
  const recovered = context.recoverExamDiagnosis({ name: '익명', phone: '01012345678', code: invitation.code });
  assert.equal(recovered.result, 'ok');
  assert.equal(recovered.diagnosisId, id);
  assert.equal(recovered.allAnswers['1-A-1'], 3);
  assert.equal(recovered.checkupValues.fbg, 92);
  assert.equal(context.recoverExamDiagnosis({ name: '익명', phone: '01087654321', code: invitation.code }).result, 'not_found');
  assert.equal(context.recoverExamDiagnosis({ name: '다른이름', phone: '01012345678', code: invitation.code }).result, 'not_found');
});

test('staff registration fails closed when the signed-in email is unavailable', () => {
  const { context, tables } = createWorkbook('');
  assert.equal(context.registerExamApplication({ name: '익명', phone: '01012345678' }).status, 'forbidden');
  assert.equal(tables.size, 0);
});

test('the diagnosis gate requires the matching phone and limits failed codes', () => {
  const { context } = createWorkbook();
  const registered = context.registerExamApplication({ name: '익명', phone: '01012345678' });
  assert.equal(context.verifyExamGate({ name: '익명', phone: '01012345678', code: registered.code }).status, 'ok');
  assert.equal(context.verifyExamGate({ name: '익명', phone: '01087654321', code: registered.code }).status, 'not_found');
  for (let i = 0; i < 9; i++) {
    assert.equal(context.verifyExamGate({ name: '익명', phone: '01012345678', code: 'BADCODE' }).status, 'not_found');
  }
  assert.equal(context.verifyExamGate({ name: '익명', phone: '01012345678', code: 'BADCODE' }).status, 'not_found');
  assert.equal(context.verifyExamGate({ name: '익명', phone: '01012345678', code: registered.code }).status, 'too_many_attempts');
});

test('a suspended roster member cannot use an issued code or save after a grant was issued', () => {
  const { context, tables } = createWorkbook();
  const invitation = context.registerExamApplication({ name: '익명', phone: '01012345678' });
  assert.equal(context.verifyExamGate({ name: '익명', phone: '01012345678', code: invitation.code }).status, 'ok');
  tables.get('앱사용자명단').rows[1][3] = '중지';
  assert.equal(context.verifyExamGate({ name: '익명', phone: '01012345678', code: invitation.code }).status, 'suspended');
  const writeTimestamp = Date.now();
  const writeNonce = 'nonce-after-suspension';
  const writeSignature = crypto.createHmac('sha256', writeSecret)
    .update(`diagnosis\nD1\n${invitation.userId}\n${invitation.invitationId}\n${writeTimestamp}\n${writeNonce}`).digest('hex');
  const saved = context.saveExamDiagnosis({ id: 'D1', name: '익명', phone: '+821012345678',
    contact: '+821012345678', appUserId: invitation.userId, invitationId: invitation.invitationId,
    areaScores: [], writeTimestamp, writeNonce, writeSignature });
  assert.equal(saved.ok, false);
  assert.equal(tables.has('진단기록'), false);
});

test('one signed invitation stores one diagnosis and a retry is idempotent', () => {
  const { context, tables } = createWorkbook();
  const invitation = context.registerExamApplication({ name: '익명', phone: '01012345678' });
  const now = Date.now();
  const signatureFor = id => crypto.createHmac('sha256', writeSecret)
    .update(`diagnosis\n${id}\n${invitation.userId}\n${invitation.invitationId}\n${now}\nnonce-1`).digest('hex');
  const data = { id: 'D1', name: '익명', appUserId: invitation.userId, appUserName: '익명',
    invitationId: invitation.invitationId, phone: '+821012345678', contact: '+821012345678',
    areaScores: [], writeTimestamp: now, writeNonce: 'nonce-1', writeSignature: signatureFor('D1') };
  assert.equal(context.saveExamDiagnosis(data).diagnosisStored, true);
  assert.equal(context.saveExamDiagnosis(data).diagnosisStored, true);
  assert.equal(tables.get('진단기록').rows.length, 2);
  assert.equal(tables.get('검사신청').rows[1][8], 'D1');
  const second = { ...data, id: 'D2', writeSignature: signatureFor('D2') };
  assert.equal(context.saveExamDiagnosis(second).result, 'already_completed');
  assert.equal(tables.get('진단기록').rows.length, 2);
  assert.equal(context.saveExamDiagnosis({ ...data, appUserId: 'forged' }).ok, false);
});

test('a signed report attaches only to the diagnosis owned by its invitation', () => {
  const { context, tables } = createWorkbook();
  const invitation = context.registerExamApplication({ name: '익명', phone: '01012345678' });
  const now = Date.now();
  const base = { id: 'D1', appUserId: invitation.userId, invitationId: invitation.invitationId,
    writeTimestamp: now, writeNonce: 'nonce-2' };
  const diagnosisSignature = crypto.createHmac('sha256', writeSecret)
    .update(`diagnosis\nD1\n${invitation.userId}\n${invitation.invitationId}\n${now}\nnonce-2`).digest('hex');
  context.saveExamDiagnosis({ ...base, name: '익명', phone: '+821012345678', contact: '+821012345678',
    areaScores: [], writeSignature: diagnosisSignature });
  const report = { greeting: '익명' };
  const reportHash = crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex');
  const reportSignature = crypto.createHmac('sha256', writeSecret)
    .update(`premium_lead\nD1\n${invitation.userId}\n${invitation.invitationId}\n${reportHash}\n${now}\nnonce-2`).digest('hex');
  assert.equal(context.saveExamReport({ ...base, report, reportHash, writeSignature: reportSignature }).ok, true);
  const header = tables.get('진단기록').rows[0];
  assert.equal(JSON.parse(tables.get('진단기록').rows[1][header.indexOf('AI리포트(JSON)')]).greeting, '익명');
  assert.equal(context.saveExamReport({ ...base, invitationId: 'other', report, reportHash,
    writeSignature: reportSignature }).ok, false);
  tables.get('앱사용자명단').rows[1][3] = '중지';
  assert.equal(context.saveExamReport({ ...base, report, reportHash, writeSignature: reportSignature }).result, 'forbidden');
});

test('two examinations share the phone ID but require separate invitations and diagnoses', () => {
  const { context, tables } = createWorkbook();
  const first = context.registerExamApplication({ name: '익명', phone: '010-1234-5678' });
  const save = (invitation, diagnosisId) => {
    const writeTimestamp = Date.now();
    const writeNonce = 'nonce-two-rounds';
    const writeSignature = crypto.createHmac('sha256', writeSecret)
      .update(`diagnosis\n${diagnosisId}\n${invitation.userId}\n${invitation.invitationId}\n${writeTimestamp}\n${writeNonce}`).digest('hex');
    return context.saveExamDiagnosis({ id: diagnosisId, name: '익명', phone: '+821012345678',
      contact: '+821012345678', appUserId: invitation.userId, invitationId: invitation.invitationId,
      areaScores: [], writeTimestamp, writeNonce, writeSignature });
  };
  assert.equal(save(first, 'D1').diagnosisStored, true);
  assert.equal(context.findExamApplication({ name: '익명', phone: '01012345678', code: first.code, requireCompleted: false }).status, 'already_completed');
  const second = context.registerExamApplication({ name: '익명', phone: '+821012345678' });
  assert.equal(second.userId, first.userId);
  assert.notEqual(second.invitationId, first.invitationId);
  assert.notEqual(second.code, first.code);
  assert.equal(context.findExamApplication({ name: '익명', phone: '01012345678', code: second.code, requireCompleted: false }).status, 'ok');
  assert.equal(save(second, 'D2').diagnosisStored, true);
  const sheet = tables.get('진단기록').rows;
  const idColumn = sheet[0].indexOf('사용자ID');
  const inviteColumn = sheet[0].indexOf('신청ID');
  assert.deepEqual(sheet.slice(1).map(row => [row[0], row[idColumn], row[inviteColumn]]),
    [['D1', first.userId, first.invitationId], ['D2', first.userId, second.invitationId]]);
});
