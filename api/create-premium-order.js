const { randomUUID, createHmac } = require('node:crypto');
const { getPaymentConfig } = require('./payment-config');
const { normalizeExamPhone } = require('./lib/phone');
function createHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control','no-store');
    if(req.method !== 'POST') return res.status(405).json({error:'method_not_allowed'});
    if(!getPaymentConfig(env).available) return res.status(503).json({error:'sales_not_ready'});
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const phone = normalizeExamPhone(req.body?.phone);
    if(name.length < 2 || name.length > 40 || /[\r\n<>]/.test(name) || !phone || req.body?.consent !== true) return res.status(400).json({error:'invalid_buyer'});
    const orderId = randomUUID();
    const payload = JSON.stringify({type:'create_premium_order',orderId,name,phone,amount:9900,currency:'KRW',productId:'mandala-premium',consentVersion:'premium-v1',createdAt:new Date().toISOString()});
    try {
      // The durable order service must bind this identity to the provider bill and
      // issue an invitation only after independently verifying paid status.
      const response = await fetchImpl(env.PREMIUM_ORDER_SERVICE_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Mandala-Signature':createHmac('sha256',env.PREMIUM_ORDER_SECRET).update(payload).digest('hex')},body:payload,signal:AbortSignal.timeout(15000),redirect:'error'});
      if(!response.ok) throw new Error('order_service_failed');
      const result = await response.json(); const url = new URL(result.checkoutUrl);
      if(result.orderId !== orderId || result.amount !== 9900 || url.protocol !== 'https:' || url.username || url.password || url.origin !== new URL(env.PREMIUM_CHECKOUT_ORIGIN).origin) throw new Error('invalid_checkout');
      return res.status(200).json({orderId,checkoutUrl:url.href});
    } catch { return res.status(502).json({error:'order_unavailable'}); }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
