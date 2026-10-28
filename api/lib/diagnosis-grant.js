const { createHmac, timingSafeEqual } = require('node:crypto');

const GRANT_LIFETIME_MS = 2 * 60 * 60 * 1000;

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function createGrant({ userId, userName, phone, invitationId }, secret, now = Date.now()) {
  if (typeof secret !== 'string' || secret.length < 32 || !/^[^\r\n]{1,128}$/.test(String(userId))
    || !/^\+8210\d{8}$/.test(phone) || !/^[A-Za-z0-9-]{1,128}$/.test(invitationId)) {
    throw new Error('DIAGNOSIS_GRANT_NOT_CONFIGURED');
  }
  const payload = Buffer.from(JSON.stringify({ userId: String(userId), userName: String(userName),
    phone, invitationId, expiresAt: now + GRANT_LIFETIME_MS })).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

function readGrant(grant, secret, now = Date.now()) {
  if (typeof grant !== 'string' || grant.length > 1000 || typeof secret !== 'string' || secret.length < 32) return null;
  const parts = grant.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return null;
  const expected = signature(parts[0], secret);
  if (!timingSafeEqual(Buffer.from(parts[1]), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (typeof data.userId !== 'string' || !/^[^\r\n]{1,128}$/.test(data.userId)
      || typeof data.userName !== 'string' || data.userName.length > 80
      || !/^\+8210\d{8}$/.test(data.phone) || !/^[A-Za-z0-9-]{1,128}$/.test(data.invitationId)
      || !Number.isSafeInteger(data.expiresAt) || data.expiresAt <= now || data.expiresAt > now + GRANT_LIFETIME_MS) return null;
    return { userId: data.userId, userName: data.userName, phone: data.phone, invitationId: data.invitationId };
  } catch {
    return null;
  }
}

module.exports = { createGrant, readGrant };
