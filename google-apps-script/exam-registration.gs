// This file belongs to the workbook-bound operating Apps Script project.
// The web endpoint never dispatches registerExamApplication or reissueExamCode.
var EXAM_MEMBER_SHEET = '앱사용자명단';
var EXAM_INVITATION_SHEET = '검사신청';
var EXAM_MEMBER_HEADER = ['사용자ID', '이름', '휴대폰번호', '사용상태', '등록일'];
var EXAM_INVITATION_HEADER = ['신청ID', '사용자ID', '이름', '휴대폰번호', '코드해시', '상태', '발급일', '만료일', '진단ID', '검사완료일'];

function normalizeExamPhone(value) {
  var digits = String(value || '').replace(/[\s().-]/g, '');
  if (/^010\d{8}$/.test(digits)) return '+82' + digits.slice(1);
  if (/^\+8210\d{8}$/.test(digits)) return digits;
  if (/^8210\d{8}$/.test(digits)) return '+' + digits;
  return null;
}

function examSheet(name, header) {
  var workbook = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = workbook.getSheetByName(name) || workbook.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(header);
  } else {
    var actual = sheet.getRange(1, 1, 1, header.length).getValues()[0];
    if (header.some(function (label, index) { return actual[index] !== label; })) {
      throw new Error('exam_sheet_schema_mismatch: ' + name);
    }
  }
  return sheet;
}

function examRows(sheet, width) {
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
}

function examStaffAllowed() {
  var email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  var allowed = String(PropertiesService.getScriptProperties().getProperty('STAFF_EMAILS') || '')
    .split(',').map(function (item) { return item.trim().toLowerCase(); });
  return Boolean(email) && allowed.indexOf(email) !== -1;
}

function digestExamCode(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value).trim().toUpperCase())
    .map(function (byte) { return ('0' + (byte & 255).toString(16)).slice(-2); }).join('');
}

function nextExamCode(existingRows) {
  for (var attempt = 0; attempt < 5; attempt++) {
    var code = Utilities.getUuid().replace(/-/g, '').slice(-20).toUpperCase();
    var hash = digestExamCode(code);
    if (!existingRows.some(function (row) { return row[4] === hash; })) return { code: code, hash: hash };
  }
  throw new Error('exam_code_collision');
}

function nextExamUserId(rows) {
  var properties = PropertiesService.getScriptProperties();
  var largest = rows.reduce(function (max, row) {
    var match = /^HM(\d{6,})$/.exec(String(row[0] || ''));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  var next = Math.max(Number(properties.getProperty('NEXT_USER_SEQUENCE') || 1), largest + 1);
  properties.setProperty('NEXT_USER_SEQUENCE', String(next + 1));
  return 'HM' + String(next).padStart(6, '0');
}

function registerExamApplication(input) {
  if (!examStaffAllowed()) return { status: 'forbidden' };
  var name = String(input && input.name || '').trim();
  var phone = normalizeExamPhone(input && input.phone);
  if (!name || !phone) return { status: 'invalid_request' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var members = examSheet(EXAM_MEMBER_SHEET, EXAM_MEMBER_HEADER);
    var invitations = examSheet(EXAM_INVITATION_SHEET, EXAM_INVITATION_HEADER);
    var memberRows = examRows(members, EXAM_MEMBER_HEADER.length);
    var matching = memberRows.filter(function (row) { return normalizeExamPhone(row[2]) === phone; });
    if (matching.length > 1 || (matching[0] && matching[0][1] !== name)) return { status: 'name_review' };
    if (matching[0] && matching[0][3] !== '사용중') return { status: 'suspended' };
    var userId = matching[0] ? matching[0][0] : nextExamUserId(memberRows);
    var invitationRows = examRows(invitations, EXAM_INVITATION_HEADER.length);
    var credential = nextExamCode(invitationRows);
    var invitationId = Utilities.getUuid();
    var issuedAt = new Date();
    var expiresAt = new Date(issuedAt.getTime() + 90 * 86400000);
    if (!matching[0]) members.appendRow([userId, name, phone, '사용중', issuedAt]);
    invitations.appendRow([invitationId, userId, name, phone, credential.hash, 'active', issuedAt, expiresAt, '', '']);
    return { status: 'ok', userId: userId, invitationId: invitationId, code: credential.code };
  } finally {
    lock.releaseLock();
  }
}

function reissueExamCode(invitationId) {
  if (!examStaffAllowed()) return { status: 'forbidden' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = examSheet(EXAM_INVITATION_SHEET, EXAM_INVITATION_HEADER);
    var rows = examRows(sheet, EXAM_INVITATION_HEADER.length);
    var index = rows.findIndex(function (row) { return row[0] === invitationId; });
    if (index < 0 || rows[index][5] === 'revoked') return { status: 'not_found' };
    var credential = nextExamCode(rows);
    var issuedAt = new Date();
    sheet.getRange(index + 2, 5, 1, 4).setValues([[credential.hash, 'active', issuedAt, new Date(issuedAt.getTime() + 90 * 86400000)]]);
    return { status: 'ok', code: credential.code };
  } finally {
    lock.releaseLock();
  }
}

function examMemberStatus(userId, name, phone) {
  var canonicalPhone = normalizeExamPhone(phone);
  if (!canonicalPhone) return 'not_found';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXAM_MEMBER_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return 'not_found';
  var matches = examRows(sheet, EXAM_MEMBER_HEADER.length).filter(function (row) {
    return row[0] === userId && row[1] === name && normalizeExamPhone(row[2]) === canonicalPhone;
  });
  if (matches.length !== 1) return 'not_found';
  return matches[0][3] === '사용중' ? 'ok' : 'suspended';
}

function findExamApplication(input) {
  var name = String(input && input.name || '').trim();
  var phone = normalizeExamPhone(input && input.phone);
  var code = String(input && input.code || '').trim().toUpperCase();
  if (!name || !phone || !/^[A-F0-9]{20}$/.test(code)) return { status: 'not_found' };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXAM_INVITATION_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return { status: 'not_found' };
  var hash = digestExamCode(code);
  var rows = examRows(sheet, EXAM_INVITATION_HEADER.length);
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (row[2] !== name || normalizeExamPhone(row[3]) !== phone || row[4] !== hash || row[5] !== 'active') continue;
    var memberStatus = examMemberStatus(row[1], name, phone);
    if (memberStatus !== 'ok') return { status: memberStatus };
    if (!(row[7] instanceof Date) || row[7].getTime() < Date.now()) return { status: 'expired' };
    if (input.requireCompleted && !row[8]) return { status: 'not_found' };
    if (input.requireCompleted === false && row[8]) return { status: 'already_completed' };
    return { status: 'ok', userId: row[1], invitationId: row[0], diagnosisId: row[8] || '', phone: phone };
  }
  return { status: 'not_found' };
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('검사 신청')
    .addItem('새 검사 등록', 'showExamRegistration')
    .addItem('인증코드 재발급', 'showExamReissue')
    .addToUi();
}

function showExamRegistration() {
  if (!examStaffAllowed()) throw new Error('forbidden');
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('registration-dialog').setWidth(440).setHeight(480), '새 검사 등록');
}

function showExamReissue() {
  if (!examStaffAllowed()) throw new Error('forbidden');
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('registration-dialog').setWidth(440).setHeight(480), '인증코드 재발급');
}
