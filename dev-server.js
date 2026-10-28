const http = require('node:http');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { readFile } = require('node:fs/promises');

const DEFAULT_API_ORIGIN = 'https://mandala-gamma.vercel.app';
const API_PATHS = new Set([
  '/api/verify-user',
  '/api/recover-diagnosis',
  '/api/log-diagnosis',
  '/api/generate-report',
]);
const PUBLIC_FILES = new Map([
  ['/assets/report/design-cover.png', ['assets/report/design-cover.png', 'image/png']],
  ['/assets/report/design-map.png', ['assets/report/design-map.png', 'image/png']],
  ['/result-theme.css', ['result-theme.css', 'text/css; charset=utf-8']],
  ['/report-theme.css', ['report-theme.css', 'text/css; charset=utf-8']],
  ['/report-gallery.css', ['report-gallery.css', 'text/css; charset=utf-8']],
  ['/report-sample.js', ['report-sample.js', 'text/javascript; charset=utf-8']],
  ['/report-sample.html', ['report-sample.html', 'text/html; charset=utf-8']],
  ['/result-preview.html', ['result-preview.html', 'text/html; charset=utf-8']],
  ['/assets/report/original-02.png', ['assets/report/original-02.png', 'image/png; charset=utf-8']],
  ['/assets/report/original-03.png', ['assets/report/original-03.png', 'image/png; charset=utf-8']],
  ['/assets/report/premium-design-sample.pdf', ['assets/report/premium-design-sample.pdf', 'application/pdf; charset=utf-8']],
  ['/premium.html', ['premium.html', 'text/html; charset=utf-8']],
  ['/premium-game.css', ['premium-game.css', 'text/css; charset=utf-8']],
  ['/premium.css', ['premium.css', 'text/css; charset=utf-8']],
  ['/premium.js', ['premium.js', 'text/javascript; charset=utf-8']],
  ['/promotion.html', ['promotion.html', 'text/html; charset=utf-8']],
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/diagnosis.html', ['diagnosis.html', 'text/html; charset=utf-8']],
  ['/education-detail.html', ['education-detail.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/report.html', ['report.html', 'text/html; charset=utf-8']],
  ['/privacy-policy.html', ['privacy-policy.html', 'text/html; charset=utf-8']],
  ['/lib/validateLead.js', ['lib/validateLead.js', 'text/javascript; charset=utf-8']],
  ['/preview.jpg', ['preview.jpg', 'image/jpeg']],
  ['/mandala-promo.mp4', ['mandala-promo.mp4', 'video/mp4']],
]);
const SESSION_LIFETIME_MS = 2 * 60 * 60 * 1000;

function cookieValue(header, name) {
  const match = String(header || '').match(new RegExp(`(?:^|;\\s*)${name}=([A-Za-z0-9_.-]+)`));
  return match ? match[1] : '';
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function createDevServer({
  rootDir = __dirname,
  apiOrigin = DEFAULT_API_ORIGIN,
  fetchImpl = fetch,
} = {}) {
  const upstream = new URL(apiOrigin);
  if (upstream.protocol !== 'https:') throw new Error('apiOrigin must use HTTPS');
  const sessions = new Map();

  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;

    if (pathname === '/api/payment-config') {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
      return sendJson(res, 200, require('./api/payment-config').getPaymentConfig());
    }
    if (pathname === '/api/create-premium-order') {
      if (req.method !== 'POST') return sendJson(res,405,{error:'method_not_allowed'});
      const chunks=[]; let size=0;
      for await (const chunk of req) { size+=chunk.length; if(size>4096) return sendJson(res,413,{error:'request_too_large'}); chunks.push(chunk); }
      try { req.body=JSON.parse(Buffer.concat(chunks).toString()); } catch { return sendJson(res,400,{error:'invalid_json'}); }
      res.status = code => { res.statusCode=code; return res; };
      res.json = body => sendJson(res,res.statusCode,body);
      return require('./api/create-premium-order')(req,res);
    }

    if (API_PATHS.has(pathname)) {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1024 * 1024) return sendJson(res, 413, { error: 'request_too_large' });
        chunks.push(chunk);
      }
      try {
        const localSessionId = cookieValue(req.headers.cookie, 'hm_local_session');
        const session = sessions.get(localSessionId);
        if (session && session.expiresAt <= Date.now()) sessions.delete(localSessionId);
        const upstreamHeaders = { 'Content-Type': 'application/json' };
        if (session && session.expiresAt > Date.now()) upstreamHeaders.Cookie = session.grantCookie;
        const response = await fetchImpl(new URL(pathname, upstream).href, {
          method: 'POST',
          headers: upstreamHeaders,
          body: Buffer.concat(chunks),
        });
        const responseText = await response.text();
        let localCookie;
        if (pathname === '/api/verify-user' || pathname === '/api/recover-diagnosis') {
          if (localSessionId) sessions.delete(localSessionId);
          const grant = cookieValue(response.headers.get('set-cookie'), 'hm_diagnosis_grant');
          let result;
          try { result = JSON.parse(responseText).result; } catch { /* non-JSON upstream response */ }
          if (response.ok && result === 'ok' && grant) {
            const newSessionId = randomUUID();
            sessions.set(newSessionId, {
              grantCookie: `hm_diagnosis_grant=${grant}`,
              expiresAt: Date.now() + SESSION_LIFETIME_MS,
            });
            localCookie = `hm_local_session=${newSessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=7200`;
          } else {
            localCookie = 'hm_local_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0';
          }
        }
        if (pathname === '/api/generate-report' || pathname === '/api/log-diagnosis') {
          let errorCode = '';
          if (!response.ok) {
            try { errorCode = JSON.parse(responseText).error || ''; } catch { /* non-JSON upstream error */ }
          }
          console.log(`${pathname}: ${response.status}${errorCode ? ` ${errorCode}` : ''}`);
        }
        res.writeHead(response.status, {
          'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          ...(localCookie ? { 'Set-Cookie': localCookie } : {}),
        });
        res.end(responseText);
      } catch (error) {
        console.error('Local API proxy failed:', pathname, error.message, error.cause?.code || '');
        sendJson(res, 502, { error: 'upstream_unavailable' });
      }
      return;
    }

    const file = PUBLIC_FILES.get(pathname);
    if (!file || req.method !== 'GET') return sendJson(res, 404, { error: 'not_found' });
    try {
      const data = await readFile(path.join(rootDir, file[0]));
      res.writeHead(200, { 'Content-Type': file[1], 'Content-Length': data.length });
      res.end(data);
    } catch {
      sendJson(res, 404, { error: 'not_found' });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createDevServer().listen(port, '127.0.0.1', () => {
    console.log(`건강만다라 로컬 미리보기: http://127.0.0.1:${port}`);
    console.log('인증 및 진단 API는 기존 만다라 운영 서버를 사용합니다.');
  });
}

module.exports = { createDevServer };
