const { randomBytes, createHash } = require('node:crypto');

function issueResultCode() {
  return randomBytes(20).toString('base64url');
}

function hashResultCode(code) {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

module.exports = { issueResultCode, hashResultCode };
