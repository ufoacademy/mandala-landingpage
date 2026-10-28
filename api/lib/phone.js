function normalizeExamPhone(value) {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/[\s().-]/g, '');
  if (/^010\d{8}$/.test(digits)) return `+82${digits.slice(1)}`;
  if (/^\+8210\d{8}$/.test(digits)) return digits;
  return null;
}

module.exports = { normalizeExamPhone };
