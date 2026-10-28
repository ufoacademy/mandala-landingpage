var DIAGNOSIS_SHEET_NAME = '진단기록';
var USER_SHEET_NAME = '앱사용자명단';
// 열 순서: 사용자이름, 접근코드, 사용자ID, 사용상태, 사용종료일, 비고, 재검사가능
// 재검사가능 열이 비어있거나 'N'이 아니면 재검사를 허용한다(기존 행과의 하위호환 기본값).
var USER_COL = { NAME: 0, CODE: 1, ID: 2, STATUS: 3, END_DATE: 4, NOTE: 5, RETEST: 6 };
var DIM_LETTERS = ['A', 'B', 'C', 'D'];
var AREA_LABELS = ['식', '동', '휴', '심', '환', '연', '지', '락'];

// index.html의 BIOMARKERS 객체(원본 26개) + 3개 파생지표(nlr/bun_cr/tg_hdl)와 1:1로 대응.
// 항목을 추가하려면 여기와 index.html의 BIOMARKERS를 함께 갱신해야 한다.
var CHECKUP_FIELDS = [
  ['fbg', '공복혈당'], ['hba1c', '당화혈색소'], ['tg', '중성지방'], ['hdl', 'HDL콜레스테롤'],
  ['ldl', 'LDL콜레스테롤'], ['tc', '총콜레스테롤'], ['sbp', '수축기혈압'], ['dbp', '이완기혈압'],
  ['bmi', 'BMI'], ['waist', '허리둘레'], ['alt', 'ALT(GPT)'], ['ast', 'AST(GOT)'],
  ['ggt', 'GGT'], ['hb', '헤모글로빈'], ['mcv', 'MCV'], ['rdw', 'RDW'],
  ['neut', '호중구%'], ['lymp', '림프구%'], ['crp', 'hs-CRP'], ['uric', '요산'],
  ['bun', 'BUN'], ['cr', '크레아티닌'], ['egfr', 'eGFR'], ['tsh', 'TSH'],
  ['vitd', '비타민D'], ['ferritin', '페리틴'],
  ['nlr', 'NLR(스트레스지수)'], ['bun_cr', 'BUN/Cr비율'], ['tg_hdl', 'TG/HDL비율'],
];

function buildQuestionCodes() {
  var codes = [];
  for (var areaId = 1; areaId <= 8; areaId++) {
    for (var li = 0; li < DIM_LETTERS.length; li++) {
      for (var qi = 1; qi <= 2; qi++) {
        codes.push(areaId + '-' + DIM_LETTERS[li] + '-' + qi);
      }
    }
  }
  return codes;
}

function buildDiagnosisHeader() {
  var header = ['ID', '날짜', '이름', '나이', '성별', '이메일', '연락처', '광고동의', '총점'];
  for (var rank = 1; rank <= 8; rank++) {
    header.push(rank + '위 약점');
  }
  header = header.concat(buildQuestionCodes());
  for (var i = 0; i < CHECKUP_FIELDS.length; i++) {
    header.push(CHECKUP_FIELDS[i][1]);
  }
  header.push('리포트생성일', 'AI리포트(JSON)');
  header.push('사용자ID', '사용자이름');
  header.push('총점(0-100)', '문항버전', '산식버전', '리포트스키마버전', '진단모드', '진단시작', '진단완료');
  header.push('결과스냅샷(JSON)');
  header.push('신청ID');
  return header;
}

// "앱사용자명단" 시트에서 이름+접근코드가 일치하는 사용자를 찾는다.
// 반환: { status:'ok', userId, userName } | { status:'suspended'|'expired'|'not_found' }
function findAppUser(name, code) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(USER_SHEET_NAME);
  if (!sheet) return { status: 'not_found' };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'not_found' };

  // 시트가 아직 '재검사가능' 열(7번째) 없이 6열짜리 구버전 그대로여도 범위 오류가 나지
  // 않도록, 실제 시트 폭을 넘지 않게 clamp한다 — 운영 시트를 미리 넓혀둘 필요가 없다.
  var numCols = Math.min(7, sheet.getMaxColumns());
  var rows = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  var n = String(name || '').trim();
  var c = String(code || '').trim();

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (String(row[USER_COL.NAME]).trim() === n && String(row[USER_COL.CODE]).trim() === c) {
      if (String(row[USER_COL.STATUS]).trim() !== '사용중') {
        return { status: 'suspended' };
      }
      var endDate = row[USER_COL.END_DATE];
      if (endDate instanceof Date && !isNaN(endDate.getTime())) {
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var endDay = new Date(endDate);
        endDay.setHours(0, 0, 0, 0);
        if (endDay.getTime() < today.getTime()) {
          return { status: 'expired' };
        }
      }
      var canRetest = String(row[USER_COL.RETEST] || '').trim() !== 'N';
      return { status: 'ok', userId: row[USER_COL.ID], userName: row[USER_COL.NAME], canRetest: canRetest };
    }
  }
  return { status: 'not_found' };
}

function getOrCreateDiagnosisSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(DIAGNOSIS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(DIAGNOSIS_SHEET_NAME);
  }
  var expectedHeader = buildDiagnosisHeader();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(expectedHeader);
  } else {
    // 기존 운영 시트의 데이터 열 순서를 유지하면서 신규 메타데이터 열만 뒤에 추가한다.
    var currentLastColumn = sheet.getLastColumn();
    if (currentLastColumn < expectedHeader.length) {
      sheet.getRange(1, currentLastColumn + 1, 1, expectedHeader.length - currentLastColumn)
        .setValues([expectedHeader.slice(currentLastColumn)]);
    }
  }
  return sheet;
}

// 진단 완료 시점(결과 화면이 뜨는 순간)에 한 번 기록되는 행. 이름/연락처 등은 진단 시작 전
// 필수 동의 화면에서 이미 입력받은 값이므로 이 시점부터 채워져 있다. 프리미엄 리포트가
// 나중에 생성되면 attachReportToRow()가 같은 ID의 이 행을 찾아 리포트 칸만 채워넣는다.
function appendDiagnosisRow(data) {
  var sheet = getOrCreateDiagnosisSheet();
  var codes = buildQuestionCodes();

  // 약한 영역(pctVal 낮은 순)부터 1~8위로 정렬 — 원본 areaScores 배열은 건드리지 않는다.
  var areaScores = (data.areaScores || []).slice();
  areaScores.sort(function (a, b) { return a.pctVal - b.pctVal; });

  var allAnswers = data.allAnswers || {};
  var checkupValues = data.checkupValues || {};

  var row = [
    data.id || '',
    new Date(data.timestamp || new Date()),
    data.name || '',
    data.age || '',
    data.gender || '',
    data.email || '',
    data.contact || '',
    data.consentMarketing ? 'Y' : 'N',
    data.totalScore != null ? data.totalScore : '',
  ];
  for (var rank = 0; rank < 8; rank++) {
    var a = areaScores[rank];
    row.push(a ? (AREA_LABELS[a.id - 1] + ' ' + a.pctVal + '%') : '');
  }
  for (var k = 0; k < codes.length; k++) {
    var val = allAnswers[codes[k]];
    row.push(val !== undefined && val !== null ? val : '');
  }
  for (var m = 0; m < CHECKUP_FIELDS.length; m++) {
    var cv = checkupValues[CHECKUP_FIELDS[m][0]];
    row.push(cv !== undefined && cv !== null ? cv : '');
  }
  row.push('', '');
  row.push(data.appUserId || '', data.appUserName || '');
  row.push(
    data.totalScorePct != null ? data.totalScorePct : '',
    data.assessmentVersion || '',
    data.scoringVersion || '',
    data.reportSchemaVersion || '',
    data.selectedMode || '',
    data.diagnosisStartedAt ? new Date(data.diagnosisStartedAt) : '',
    data.diagnosisCompletedAt ? new Date(data.diagnosisCompletedAt) : ''
  );
  row.push('', data.invitationId || '');

  sheet.appendRow(row);
}

function findRowById(sheet, id) {
  if (!id) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      return i + 2; // 1-indexed, +1 for header row
    }
  }
  return -1;
}

// rowIndex 행이 appUserId의 몇 번째 검사인지(1부터) 센다. appendDiagnosisRow가 항상 끝에
// 추가하므로 시트상 행 순서가 곧 시간순이다 — 날짜 비교 없이 앞쪽 행 개수만 세면 된다.
function computeRoundNo(sheet, col, rowIndex, appUserId) {
  if (!appUserId) return null;
  var idCol = col['사용자ID'] + 1;
  var precedingCount = rowIndex - 2; // 헤더(1행) 다음부터 이 행 이전까지의 데이터 행 수
  var count = 1; // 이 행 자신
  if (precedingCount > 0) {
    var ids = sheet.getRange(2, idCol, precedingCount, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(appUserId)) count++;
    }
  }
  return count;
}

// 프리미엄 리포트 생성이 끝나면 호출된다. 새 행을 추가하는 게 아니라, 진단 완료 시점에
// 이미 기록된 같은 ID의 행을 찾아 리포트 칸만 채워넣는다(업데이트). 같은 시점에 "결과스냅샷"도
// 함께 저장해, 나중에 마이페이지에서 AI를 다시 부르거나 현재 데이터로 재계산하지 않고도
// 이 시점의 결과서를 그대로 재현할 수 있게 한다.
function attachReportToRow(data) {
  var sheet = getOrCreateDiagnosisSheet();
  var header = buildDiagnosisHeader();
  var col = {};
  for (var i = 0; i < header.length; i++) col[header[i]] = i;
  var reportDateCol = col['리포트생성일'] + 1;
  var reportJsonCol = col['AI리포트(JSON)'] + 1;
  var snapshotCol = col['결과스냅샷(JSON)'] + 1;
  var reportJson = JSON.stringify(data.report || {});

  var rowIndex = findRowById(sheet, data.id);
  if (rowIndex === -1) {
    return false;
  }

  var now = new Date();
  sheet.getRange(rowIndex, reportDateCol).setValue(now);
  sheet.getRange(rowIndex, reportJsonCol).setValue(reportJson);

  var appUserId = sheet.getRange(rowIndex, col['사용자ID'] + 1).getValue();
  var diagnosisDate = sheet.getRange(rowIndex, col['날짜'] + 1).getValue();
  var roundNo = computeRoundNo(sheet, col, rowIndex, appUserId);

  var areaScores = data.areaScores || [];
  var top3 = areaScores.slice().sort(function (a, b) { return a.pctVal - b.pctVal; }).slice(0, 3)
    .map(function (a) { return { id: a.id, icon: a.icon, name: a.name, pctVal: a.pctVal }; });

  var snapshot = {
    areaScores: areaScores,
    top3: top3,
    checkupSummary: data.checkupSummary || [],
    targetTable: data.targetTable || [],
    report: data.report || {},
    date: formatDateOnly(diagnosisDate instanceof Date ? diagnosisDate : now),
    roundNo: roundNo,
    scoringVersion: data.scoringVersion || '',
    reportSchemaVersion: data.reportSchemaVersion || '',
  };
  sheet.getRange(rowIndex, snapshotCol).setValue(JSON.stringify(snapshot));
  return true;
}

function examWriteHex(bytes) {
  return bytes.map(function (value) { return ('0' + (value & 255).toString(16)).slice(-2); }).join('');
}

function verifyExamWrite(data, message, report) {
  var secret = PropertiesService.getScriptProperties().getProperty('DIAGNOSIS_WRITE_SECRET');
  if (!secret || secret.length < 32 || !Number.isSafeInteger(Number(data.writeTimestamp))
      || Math.abs(Date.now() - Number(data.writeTimestamp)) > 300000
      || !/^[A-Za-z0-9-]{1,128}$/.test(String(data.writeNonce || ''))
      || !/^[a-f0-9]{64}$/.test(String(data.writeSignature || ''))) return false;
  if (report && examWriteHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      JSON.stringify(data.report || {}), Utilities.Charset.UTF_8)) !== data.reportHash) return false;
  var expected = examWriteHex(Utilities.computeHmacSha256Signature(message, secret));
  return expected === data.writeSignature;
}

function findExamInvitationRow(invitationId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXAM_INVITATION_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var rows = examRows(sheet, EXAM_INVITATION_HEADER.length);
  var matching = [];
  rows.forEach(function (row, index) {
    if (row[0] === invitationId) matching.push({ sheet: sheet, row: row, rowIndex: index + 2 });
  });
  return matching.length === 1 ? matching[0] : null;
}

function examDiagnosisRowByInvitation(sheet, invitationId) {
  var header = buildDiagnosisHeader();
  var invitationColumn = header.indexOf('신청ID') + 1;
  if (sheet.getLastRow() < 2) return -1;
  var ids = sheet.getRange(2, invitationColumn, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] === invitationId) return i + 2;
  return -1;
}

function saveExamDiagnosis(data) {
  var message = 'diagnosis\n' + data.id + '\n' + data.appUserId + '\n' + data.invitationId
    + '\n' + data.writeTimestamp + '\n' + data.writeNonce;
  if (!verifyExamWrite(data, message, false)) return { ok: false, result: 'forbidden' };
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(data.id || ''))) return { ok: false, result: 'invalid_request' };
  var phone = normalizeExamPhone(data.phone);
  if (!phone || normalizeExamPhone(data.contact) !== phone) return { ok: false, result: 'forbidden' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var invitation = findExamInvitationRow(data.invitationId);
    if (!invitation || invitation.row[1] !== data.appUserId || invitation.row[2] !== data.name
        || normalizeExamPhone(invitation.row[3]) !== phone || invitation.row[5] !== 'active'
        || examMemberStatus(data.appUserId, data.name, phone) !== 'ok') return { ok: false, result: 'forbidden' };
    var sheet = getOrCreateDiagnosisSheet();
    var priorRow = examDiagnosisRowByInvitation(sheet, data.invitationId);
    var existingId = String(invitation.row[8] || '');
    if ((existingId && existingId !== data.id)
        || (priorRow !== -1 && String(sheet.getRange(priorRow, 1).getValue()) !== data.id)) {
      return { ok: false, result: 'already_completed' };
    }
    var otherRow = findRowById(sheet, data.id);
    if (otherRow !== -1 && otherRow !== priorRow) return { ok: false, result: 'conflict' };
    if (priorRow !== -1) {
      if (!existingId) invitation.sheet.getRange(invitation.rowIndex, 9, 1, 2)
        .setValues([[data.id, sheet.getRange(priorRow, 2).getValue()]]);
      return { ok: true, diagnosisStored: true };
    }
    if (existingId || !(invitation.row[7] instanceof Date) || invitation.row[7].getTime() < Date.now()) {
      return { ok: false, result: 'expired' };
    }
    appendDiagnosisRow(data);
    invitation.sheet.getRange(invitation.rowIndex, 9, 1, 2).setValues([[data.id, new Date()]]);
    return { ok: true, diagnosisStored: true };
  } finally {
    lock.releaseLock();
  }
}

function saveExamReport(data) {
  var message = 'premium_lead\n' + data.id + '\n' + data.appUserId + '\n' + data.invitationId
    + '\n' + data.reportHash + '\n' + data.writeTimestamp + '\n' + data.writeNonce;
  if (!verifyExamWrite(data, message, true)) return { ok: false, result: 'forbidden' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var invitation = findExamInvitationRow(data.invitationId);
    if (!invitation || invitation.row[1] !== data.appUserId || invitation.row[8] !== data.id
        || examMemberStatus(data.appUserId, invitation.row[2], invitation.row[3]) !== 'ok') {
      return { ok: false, result: 'forbidden' };
    }
    var sheet = getOrCreateDiagnosisSheet();
    var rowIndex = findRowById(sheet, data.id);
    var header = buildDiagnosisHeader();
    if (rowIndex < 2 || sheet.getRange(rowIndex, header.indexOf('신청ID') + 1).getValue() !== data.invitationId
        || sheet.getRange(rowIndex, header.indexOf('사용자ID') + 1).getValue() !== data.appUserId) {
      return { ok: false, result: 'not_found' };
    }
    return attachReportToRow(data) ? { ok: true } : { ok: false, result: 'not_found' };
  } finally {
    lock.releaseLock();
  }
}

// A completed invitation can reopen only its own saved diagnosis. The code is
// checked against the invitation hash; no health data is returned on mismatch.
function recoverExamDiagnosis(data) {
  var verified = verifyExamGate({ name: data.name, phone: data.phone, code: data.code,
    requireCompleted: true });
  if (verified.status !== 'ok') return { result: verified.status };
  var sheet = getOrCreateDiagnosisSheet();
  var header = buildDiagnosisHeader();
  var rowIndex = findRowById(sheet, verified.diagnosisId);
  if (rowIndex < 2) return { result: 'not_found' };
  var row = sheet.getRange(rowIndex, 1, 1, header.length).getValues()[0];
  var col = {};
  for (var i = 0; i < header.length; i++) col[header[i]] = i;
  if (String(row[col['사용자ID']]) !== String(verified.userId)
      || String(row[col['신청ID']]) !== String(verified.invitationId)
      || String(row[col['이름']]) !== String(data.name).trim()
      || normalizeExamPhone(row[col['연락처']]) !== verified.phone) return { result: 'not_found' };
  var allAnswers = {};
  buildQuestionCodes().forEach(function (code) { allAnswers[code] = row[col[code]]; });
  var checkupValues = {};
  CHECKUP_FIELDS.forEach(function (item) {
    var value = row[col[item[1]]];
    if (value !== '' && value !== null) checkupValues[item[0]] = value;
  });
  var reportText = row[col['AI리포트(JSON)']];
  var snapshotText = row[col['결과스냅샷(JSON)']];
  var snapshot = null;
  if (snapshotText) { try { snapshot = JSON.parse(snapshotText); } catch (ignore) {} }
  var report = null;
  if (reportText) { try { report = JSON.parse(reportText); } catch (ignore) {} }
  return { result: 'ok', userId: verified.userId, invitationId: verified.invitationId,
    diagnosisId: verified.diagnosisId, userName: String(data.name).trim(), phone: verified.phone,
    age: row[col['나이']], gender: row[col['성별']], email: row[col['이메일']],
    allAnswers: allAnswers, checkupValues: checkupValues, totalScore: row[col['총점']],
    hasReport: !!report, report: report, snapshot: snapshot };
}

// ════════════════════════════════════════
//  TOP3 SMART 행동계획 + 4주 재진단 (Phase 3)
// ════════════════════════════════════════
var PLAN_SHEET_NAME = '행동계획';

function buildPlanHeader() {
  return [
    'planId', 'diagnosisId', 'appUserId', 'appUserName', '생성일시',
    'planStatus', '재진단예정일', '재진단diagnosisId', '재진단일시',
    'goalId', '약점영역ID', '약점영역명', '최초점수',
    'SMART목표', '시작일', '빈도', '시간', '장애물', '대체행동', '확인방법',
    '재진단점수', '변화량', '목표달성여부',
  ];
}

function getOrCreatePlanSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PLAN_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PLAN_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(buildPlanHeader());
  }
  return sheet;
}

function addDays(date, days) {
  var d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateOnly(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Asia/Seoul', 'yyyy-MM-dd');
}

// TOP3 SMART 목표 저장 — 항상 3개 goal이 같은 planId로 3행 추가된다.
// 재진단예정일(4주 뒤)은 클라이언트 시간을 신뢰하지 않고 여기서 계산한다.
function savePlan(data) {
  var sheet = getOrCreatePlanSheet();
  var now = new Date();
  var nextCheckinDate = formatDateOnly(addDays(now, 28));
  var goals = data.goals || [];

  for (var i = 0; i < goals.length; i++) {
    var g = goals[i];
    sheet.appendRow([
      data.planId || '', data.diagnosisId || '', data.appUserId || '', data.appUserName || '', now,
      '진행중', nextCheckinDate, '', '',
      g.goalId || '', g.areaId || '', g.areaName || '', g.baselineScore != null ? g.baselineScore : '',
      g.smartGoal || '', g.startDate || '', g.frequency || '', g.time || '', g.obstacle || '', g.alternative || '', g.checkMethod || '',
      '', '', '',
    ]);
  }

  return { ok: true, planId: data.planId, nextCheckinDate: nextCheckinDate };
}

// appUserId 단독 조회를 막기 위해 findAppUser(name, code)로 먼저 재인증한 뒤에만
// 검증된 userId로 조회한다 — 클라이언트가 보낸 appUserId는 조회 키로 쓰지 않는다.
function getActivePlan(data) {
  var auth = findAppUser(data.name, data.code);
  if (auth.status !== 'ok') {
    return { result: auth.status };
  }

  var sheet = getOrCreatePlanSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { result: 'ok', userId: auth.userId, userName: auth.userName, plan: null };
  }

  var header = buildPlanHeader();
  var rows = sheet.getRange(2, 1, lastRow - 1, header.length).getValues();
  var col = {};
  for (var i = 0; i < header.length; i++) col[header[i]] = i;

  var planRows = [];
  for (var r = 0; r < rows.length; r++) {
    if (String(rows[r][col['appUserId']]) === String(auth.userId) && rows[r][col['planStatus']] === '진행중') {
      planRows.push(rows[r]);
    }
  }
  if (planRows.length === 0) {
    return { result: 'ok', userId: auth.userId, userName: auth.userName, plan: null };
  }

  planRows.sort(function (a, b) { return new Date(b[col['생성일시']]) - new Date(a[col['생성일시']]); });
  var latestPlanId = planRows[0][col['planId']];
  var goalsForPlan = planRows.filter(function (row) { return row[col['planId']] === latestPlanId; });

  var plan = {
    planId: latestPlanId,
    diagnosisId: goalsForPlan[0][col['diagnosisId']],
    planStatus: goalsForPlan[0][col['planStatus']],
    nextCheckinDate: formatDateOnly(new Date(goalsForPlan[0][col['재진단예정일']])),
    goals: goalsForPlan.map(function (row) {
      return {
        goalId: row[col['goalId']], areaId: row[col['약점영역ID']], areaName: row[col['약점영역명']],
        baselineScore: row[col['최초점수']], smartGoal: row[col['SMART목표']], startDate: row[col['시작일']],
        frequency: row[col['빈도']], time: row[col['시간']], obstacle: row[col['장애물']],
        alternative: row[col['대체행동']], checkMethod: row[col['확인방법']],
      };
    }),
  };
  return { result: 'ok', userId: auth.userId, userName: auth.userName, plan: plan };
}

// linkedPlanId가 포함된 diagnosis 요청(=4주 재진단) 처리 시 doPost에서 호출된다.
// 새 진단의 areaScores(요청에 이미 포함됨)를 이용해 재조회 없이 바로 변화량을 계산한다.
function completeLinkedPlan(data) {
  var sheet = getOrCreatePlanSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var header = buildPlanHeader();
  var range = sheet.getRange(2, 1, lastRow - 1, header.length);
  var rows = range.getValues();
  var col = {};
  for (var i = 0; i < header.length; i++) col[header[i]] = i;

  var scoreByAreaId = {};
  (data.areaScores || []).forEach(function (a) { scoreByAreaId[a.id] = a.pctVal; });

  var now = new Date();
  var comparisonGoals = [];
  var matched = false;

  for (var r = 0; r < rows.length; r++) {
    if (String(rows[r][col['planId']]) !== String(data.linkedPlanId)) continue;
    matched = true;

    var areaId = rows[r][col['약점영역ID']];
    var baseline = rows[r][col['최초점수']];
    var rediagnosisScore = scoreByAreaId[areaId];
    if (rediagnosisScore == null) continue;
    var change = rediagnosisScore - baseline;
    var achieved = change > 0;

    rows[r][col['planStatus']] = '재진단완료';
    rows[r][col['재진단diagnosisId']] = data.id || '';
    rows[r][col['재진단일시']] = now;
    rows[r][col['재진단점수']] = rediagnosisScore;
    rows[r][col['변화량']] = change;
    rows[r][col['목표달성여부']] = achieved ? 'Y' : 'N';

    comparisonGoals.push({
      goalId: rows[r][col['goalId']], areaId: areaId, areaName: rows[r][col['약점영역명']],
      baselineScore: baseline, rediagnosisScore: rediagnosisScore, change: change, achieved: achieved,
    });
  }
  if (!matched) return null;
  range.setValues(rows);

  var achievedCount = comparisonGoals.filter(function (g) { return g.achieved; }).length;
  return {
    planId: data.linkedPlanId,
    goals: comparisonGoals,
    achievementRate: comparisonGoals.length ? Math.round((achievedCount / comparisonGoals.length) * 100) : 0,
  };
}

// ════════════════════════════════════════
//  이름+개인코드 누적 마이페이지
// ════════════════════════════════════════
// appUserId 단독 조회를 막기 위해 findAppUser(name, code)로 먼저 재인증한 뒤에만
// 검증된 userId로 진단기록을 조회한다. 같은 appUserId의 모든 행을 날짜순으로
// 묶어 회차(roundNo)를 매긴다 — 진단기록/앱사용자명단 헤더는 건드리지 않는다.
function getMyHistory(data) {
  var auth = findAppUser(data.name, data.code);
  if (auth.status !== 'ok') {
    return { result: auth.status };
  }

  var sheet = getOrCreateDiagnosisSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { result: 'ok', userId: auth.userId, userName: auth.userName, canRetest: auth.canRetest, history: [] };
  }

  var header = buildDiagnosisHeader();
  var rows = sheet.getRange(2, 1, lastRow - 1, header.length).getValues();
  var col = {};
  for (var i = 0; i < header.length; i++) col[header[i]] = i;

  var records = [];
  for (var r = 0; r < rows.length; r++) {
    if (String(rows[r][col['사용자ID']]) === String(auth.userId)) {
      records.push({
        diagnosisId: rows[r][col['ID']],
        date: formatDateOnly(new Date(rows[r][col['날짜']])),
        totalScore: rows[r][col['총점']],
        totalScorePct: rows[r][col['총점(0-100)']],
        top3: [rows[r][col['1위 약점']], rows[r][col['2위 약점']], rows[r][col['3위 약점']]].filter(function (v) { return v; }),
        hasReport: !!rows[r][col['AI리포트(JSON)']],
      });
    }
  }

  records.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
  records.forEach(function (rec, idx) { rec.roundNo = idx + 1; });
  records.reverse(); // 최신 회차부터 보여준다

  return { result: 'ok', userId: auth.userId, userName: auth.userName, canRetest: auth.canRetest, history: records };
}

// AREA_LABELS와 같은 순서(식/동/휴/심/환/연/지/락)의 아이콘 — report.html이 areaScores 렌더링에 쓴다.
var AREA_ICONS = ['🍎', '🏃', '😴', '🧠', '🏡', '👥', '📚', '🎨'];

// 저장된 프리미엄 리포트를 그대로 재사용해 마이페이지에서 다시 보여준다 — AI를 다시 부르거나
// 현재 데이터로 재계산하지 않는다. "결과스냅샷(JSON)"이 있으면(이 기능 배포 이후 생성된
// 리포트) 그 안의 areaScores/checkupSummary/targetTable/버전 정보를 그대로 돌려준다.
// 스냅샷이 없는 구버전 행은 강제 변환하지 않고, report.html이 실제로 쓰는 id/icon/name/pctVal만
// "N위 약점" 컬럼에서 재구성해 AI 리포트 본문 + 레이더차트만 보여준다(limited:true로 표시).
function getSavedReport(data) {
  var auth = findAppUser(data.name, data.code);
  if (auth.status !== 'ok') {
    return { result: auth.status };
  }

  var sheet = getOrCreateDiagnosisSheet();
  var header = buildDiagnosisHeader();
  var rowIndex = findRowById(sheet, data.diagnosisId);
  if (rowIndex === -1) {
    return { result: 'not_found' };
  }

  var row = sheet.getRange(rowIndex, 1, 1, header.length).getValues()[0];
  var col = {};
  for (var i = 0; i < header.length; i++) col[header[i]] = i;

  if (String(row[col['사용자ID']]) !== String(auth.userId)) {
    return { result: 'not_found' };
  }

  var reportJsonStr = row[col['AI리포트(JSON)']];
  if (!reportJsonStr) {
    return { result: 'ok', hasReport: false };
  }

  var reportContent;
  try {
    reportContent = JSON.parse(reportJsonStr);
  } catch (e) {
    return { result: 'ok', hasReport: false };
  }

  var name = row[col['이름']], age = row[col['나이']], gender = row[col['성별']];
  var totalScore = row[col['총점']], totalScorePct = row[col['총점(0-100)']];

  var snapshotStr = row[col['결과스냅샷(JSON)']];
  var snapshot = null;
  if (snapshotStr) {
    try {
      snapshot = JSON.parse(snapshotStr);
    } catch (e) {
      snapshot = null;
    }
  }

  if (snapshot) {
    return {
      result: 'ok', hasReport: true, limited: false,
      report: snapshot.report || reportContent,
      name: name, age: age, gender: gender,
      areaScores: snapshot.areaScores || [], checkupSummary: snapshot.checkupSummary || [], targetTable: snapshot.targetTable || [],
      totalScore: totalScore, totalScorePct: totalScorePct,
      date: snapshot.date || '', roundNo: snapshot.roundNo || null,
      scoringVersion: snapshot.scoringVersion || '', reportSchemaVersion: snapshot.reportSchemaVersion || '',
    };
  }

  var areaScores = [];
  for (var rank = 1; rank <= 8; rank++) {
    var cell = String(row[col[rank + '위 약점']] || '');
    var m = cell.match(/^(\S+)\s+(\d+)%$/);
    if (!m) continue;
    var areaId = AREA_LABELS.indexOf(m[1]) + 1;
    if (areaId < 1) continue;
    areaScores.push({ id: areaId, icon: AREA_ICONS[areaId - 1], name: m[1], pctVal: Number(m[2]) });
  }
  areaScores.sort(function (a, b) { return a.id - b.id; });

  return {
    result: 'ok', hasReport: true, limited: true,
    report: reportContent,
    name: name, age: age, gender: gender,
    areaScores: areaScores, checkupSummary: [], targetTable: [],
    totalScore: totalScore, totalScorePct: totalScorePct,
  };
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var responseBody = { ok: true };

  if (data.type === 'diagnosis') {
    responseBody = saveExamDiagnosis(data);
  } else if (data.type === 'premium_lead') {
    responseBody = saveExamReport(data);
    console.log('premium_lead storage result: ' + String(responseBody.result || 'ok'));
  } else if (data.type === 'verify_user') {
    var result = verifyExamGate(data);
    responseBody.result = result.status;
    if (result.status === 'ok') {
      responseBody.userId = result.userId;
      responseBody.userName = String(data.name).trim();
      responseBody.phone = result.phone;
      responseBody.invitationId = result.invitationId;
      responseBody.canRetest = true;
    }
  } else if (data.type === 'recover_diagnosis') {
    responseBody = recoverExamDiagnosis(data);
  } else {
    responseBody = { ok: false, result: 'unsupported' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(responseBody))
    .setMimeType(ContentService.MimeType.JSON);
}

// A phone digest is the rate-limit key; neither phone nor exam code is stored in cache.
function verifyExamGate(data) {
  var phone = normalizeExamPhone(data.phone);
  if (!phone) return { status: 'not_found' };
  var cache = CacheService.getScriptCache();
  var key = 'exam_verify_' + digestExamCode('PHONE:' + phone);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var failures = Number(cache.get(key) || 0);
    if (failures >= 10) return { status: 'too_many_attempts' };
    var result = findExamApplication({ name: data.name, phone: phone, code: data.code,
      requireCompleted: data.requireCompleted === true ? true : false });
    if (result.status === 'ok') {
      cache.remove(key);
      return result;
    }
    if (result.status === 'not_found' || result.status === 'expired') {
      cache.put(key, String(failures + 1), 900);
    }
    return result;
  } finally {
    lock.releaseLock();
  }
}
