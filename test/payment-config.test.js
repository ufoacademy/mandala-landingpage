const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getPaymentConfig } = require('../api/payment-config');
test('premium sales stay closed without fulfillment and terms', () => {
  assert.deepEqual(getPaymentConfig({}), { available: false, price: 9900, originalPrice: 50000, currency: 'KRW' });
  assert.equal(getPaymentConfig({PREMIUM_SALES_ENABLED:'true',PREMIUM_CHECKOUT_URL:'https://pay.example.com'}).available,false);
});
test('only reviewed HTTPS configuration opens checkout; secrets never exposed', () => {
  const env = { PREMIUM_SALES_ENABLED:'true', PREMIUM_ORDER_SERVICE_URL:'https://orders.example.com/create', PREMIUM_ORDER_SECRET:'a'.repeat(32), PREMIUM_CHECKOUT_ORIGIN:'https://pay.example.com', PREMIUM_TERMS_URL:'https://example.com/terms', PREMIUM_DELIVERY_DESCRIPTION:'결제 확인 후 이용권을 발급합니다.', SECRET:'never-public' };
  assert.equal(getPaymentConfig(env).available,true);
  assert.equal(JSON.stringify(getPaymentConfig(env)).includes('never-public'),false);
  for (const bad of ['javascript:alert(1)','http://pay.example.com','https://user:pass@example.com','']) {
    assert.equal(getPaymentConfig({...env,PREMIUM_ORDER_SERVICE_URL:bad}).available,false);
  }
});
