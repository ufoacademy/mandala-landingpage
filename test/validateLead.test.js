const test = require('node:test');
const assert = require('node:assert/strict');
const { validateLead } = require('../lib/validateLead');

function validInput(overrides = {}) {
  return {
    name: '홍길동',
    age: '35',
    gender: 'm',
    contact: '010-1234-5678',
    email: 'hong@example.com',
    consentPersonal: true,
    consentHealth: true,
    consentMarketing: false,
    honeypot: '',
    ...overrides,
  };
}

test('valid name, age, gender, phone contact, email, and required consents passes', () => {
  const result = validateLead(validInput());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.name, '홍길동');
  assert.equal(result.age, '35');
  assert.equal(result.gender, 'm');
  assert.equal(result.contact, '010-1234-5678');
  assert.equal(result.email, 'hong@example.com');
});

test('missing age/gender does not block submission (optional demographic fields)', () => {
  const result = validateLead(validInput({ age: '', gender: '' }));
  assert.equal(result.valid, true);
  assert.equal(result.age, '');
  assert.equal(result.gender, '');
});

test('phone contact without dashes also passes', () => {
  const result = validateLead(validInput({ contact: '01012345678' }));
  assert.equal(result.valid, true);
});

test('gate-accepted international and spaced phone formats pass consent validation', () => {
  for (const contact of ['+821012345678', '010 (1234) 5678']) {
    const result = validateLead(validInput({ contact }));
    assert.equal(result.valid, true, `${contact}: ${result.errors.join(', ')}`);
  }
});

test('honeypot filled is rejected as spam', () => {
  const result = validateLead(validInput({ honeypot: 'i am a bot' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('spam_detected'));
});

test('name too short is rejected', () => {
  const result = validateLead(validInput({ name: '홍' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('invalid_name'));
});

test('missing name is rejected', () => {
  const result = validateLead(validInput({ name: '' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('invalid_name'));
});

test('invalid contact format is rejected', () => {
  const result = validateLead(validInput({ contact: '전화번호아님' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('invalid_contact'));
});

test('invalid email format is rejected', () => {
  const result = validateLead(validInput({ email: 'not-an-email' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('invalid_email'));
});

test('missing email is rejected', () => {
  const result = validateLead(validInput({ email: '' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('invalid_email'));
});

test('missing personal-info consent is rejected', () => {
  const result = validateLead(validInput({ consentPersonal: false }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('consent_personal_required'));
});

test('missing health-info (sensitive info) consent is rejected', () => {
  const result = validateLead(validInput({ consentHealth: false }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('consent_health_required'));
});

test('missing optional marketing consent does not block submission', () => {
  const result = validateLead(validInput({ consentMarketing: false }));
  assert.equal(result.valid, true);
  assert.equal(result.consentMarketing, false);
});

test('marketing consent, when given, is passed through', () => {
  const result = validateLead(validInput({ consentMarketing: true }));
  assert.equal(result.valid, true);
  assert.equal(result.consentMarketing, true);
});

test('trims whitespace from name, contact, and email', () => {
  const result = validateLead(validInput({ name: '  홍길동  ', contact: '  010-1234-5678  ', email: '  hong@example.com  ' }));
  assert.equal(result.name, '홍길동');
  assert.equal(result.contact, '010-1234-5678');
  assert.equal(result.email, 'hong@example.com');
});
