const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('basic-info age and gender carry into checkup entry', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'diagnosis.html'), 'utf8');
  const start = html.indexOf('function submitConsentAndStart(){');
  const end = html.indexOf('\nfunction startQuiz(){', start);
  assert.ok(start >= 0 && end > start);
  const elements = {
    premiumConsentPersonal: { checked: true },
    premiumConsentHealth: { checked: true },
    consentError: { style: {} },
    premiumName: { value: '테스트' },
    premiumAge: { value: '47' },
    premiumGender: { value: 'f' },
    premiumContact: { value: '010-1234-5678' },
    premiumEmail: { value: 'person@example.test' },
    premiumHoneypot: { value: '' },
    'ci-gender': { value: 'm' },
    'ci-age': { value: '' },
  };
  let shownScreen;
  const context = {
    document: { getElementById: (id) => elements[id] },
    appUserPhone: '010-1234-5678',
    selectedMode: 'checkup',
    validateLead: () => ({ valid: true }),
    showScreen: (screen) => { shownScreen = screen; },
  };
  vm.runInNewContext(html.slice(start, end), context);
  context.submitConsentAndStart();
  assert.equal(shownScreen, 'screen-checkup');
  assert.equal(elements['ci-gender'].value, 'f');
  assert.equal(elements['ci-age'].value, '47');
});

