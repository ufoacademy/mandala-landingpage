const test = require('node:test');
const assert = require('node:assert/strict');
const { issueResultCode, hashResultCode } = require('../api/lib/result-code');

test('each result code carries at least 128 bits of cryptographic randomness', () => {
  const codes = Array.from({ length: 50 }, issueResultCode);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) assert.match(code, /^[A-Za-z0-9_-]{27,}$/);
  assert.match(hashResultCode(codes[0]), /^[a-f0-9]{64}$/);
  assert.notEqual(hashResultCode(codes[0]), hashResultCode(codes[1]));
});
