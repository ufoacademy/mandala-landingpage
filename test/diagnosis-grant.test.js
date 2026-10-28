const test = require('node:test');
const assert = require('node:assert/strict');
const { createGrant, readGrant } = require('../api/lib/diagnosis-grant');

const secret = 'anonymous-test-secret-with-enough-entropy';

test('a verified grant identifies its member and expires after two hours', () => {
  const now = 1790000000000;
  const identity = { userId: 'U1', userName: '익명', phone: '+821012345678', invitationId: 'I1' };
  const grant = createGrant(identity, secret, now);
  assert.deepEqual(readGrant(grant, secret, now + 1000), identity);
  assert.equal(readGrant(grant, secret, now + 7200001), null);
});

test('a modified grant cannot select another member', () => {
  const now = 1790000000000;
  const grant = createGrant({ userId: 'U1', userName: '익명', phone: '+821012345678', invitationId: 'I1' }, secret, now);
  assert.equal(readGrant(grant.slice(0, -1) + (grant.endsWith('A') ? 'B' : 'A'), secret, now), null);
});

test('a grant is rejected when the bound phone or invitation is absent', () => {
  assert.throws(() => createGrant({ userId: 'U1', userName: '익명' }, secret));
  assert.throws(() => createGrant({ userId: 'U1', userName: '익명', phone: '01012345678', invitationId: 'I1' }, secret));
});
