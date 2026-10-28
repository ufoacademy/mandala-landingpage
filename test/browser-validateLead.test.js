const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('browser can validate the same required contact fields as the report API', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'lib', 'validateLead.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(script, context);

  const result = context.window.validateLead({
    name: '테스트', contact: '010-1234-5678', email: '',
    consentPersonal: true, consentHealth: true,
  });
  assert.equal(result.valid, false);
  assert.equal(Array.from(result.errors).includes('invalid_email'), true);
});
