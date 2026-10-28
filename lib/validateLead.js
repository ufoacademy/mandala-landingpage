const PHONE_PATTERN = /^01[0-9]-?\d{3,4}-?\d{4}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateLead({ name, age, gender, contact, email, consentPersonal, consentHealth, consentMarketing, honeypot }) {
  if (honeypot) {
    return { valid: false, errors: ['spam_detected'], name: '', age: '', gender: '', contact: '', email: '', consentMarketing: false };
  }

  const errors = [];
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedAge = typeof age === 'string' ? age.trim() : '';
  const trimmedGender = typeof gender === 'string' ? gender.trim() : '';
  const trimmedContact = typeof contact === 'string' ? contact.trim() : '';
  const trimmedEmail = typeof email === 'string' ? email.trim() : '';

  if (trimmedName.length < 2 || trimmedName.length > 20) {
    errors.push('invalid_name');
  }
  const compactContact = trimmedContact.replace(/[\s().-]/g, '');
  if (!PHONE_PATTERN.test(trimmedContact) && !/^(?:010\d{8}|\+8210\d{8})$/.test(compactContact)) {
    errors.push('invalid_contact');
  }
  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.push('invalid_email');
  }
  // 개인정보(이름/연락처 등)와 건강정보(민감정보)는 개인정보보호법 제23조에 따라
  // 별도로 구분된 동의가 필요 — 광고성 정보 수신(consentMarketing)은 필수가 아니므로 검증하지 않는다.
  if (!consentPersonal) {
    errors.push('consent_personal_required');
  }
  if (!consentHealth) {
    errors.push('consent_health_required');
  }

  return {
    valid: errors.length === 0,
    errors,
    name: trimmedName,
    age: trimmedAge,
    gender: trimmedGender,
    contact: trimmedContact,
    email: trimmedEmail,
    consentMarketing: !!consentMarketing,
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { validateLead };
if (typeof window !== 'undefined') window.validateLead = validateLead;
