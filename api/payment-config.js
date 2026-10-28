// Public configuration only. Never return provider secrets or grant access from a browser redirect.
function validHttps(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
function getPaymentConfig(env = process.env) {
  // Keep sales closed until fulfillment, merchant details and terms have been reviewed.
  const available = env.PREMIUM_SALES_ENABLED === 'true'
    && validHttps(env.PREMIUM_ORDER_SERVICE_URL) && validHttps(env.PREMIUM_CHECKOUT_ORIGIN) && validHttps(env.PREMIUM_TERMS_URL)
    && typeof env.PREMIUM_ORDER_SECRET === 'string' && env.PREMIUM_ORDER_SECRET.length >= 32
    && typeof env.PREMIUM_DELIVERY_DESCRIPTION === 'string' && env.PREMIUM_DELIVERY_DESCRIPTION.trim().length >= 10;
  return { available: Boolean(available), price: 9900, originalPrice: 50000, currency: 'KRW',
    ...(available ? { termsUrl: env.PREMIUM_TERMS_URL,
      deliveryDescription: env.PREMIUM_DELIVERY_DESCRIPTION.trim() } : {}) };
}
function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({ error:'method_not_allowed' }); }
  return res.status(200).json(getPaymentConfig());
}
module.exports = handler;
module.exports.getPaymentConfig = getPaymentConfig;
