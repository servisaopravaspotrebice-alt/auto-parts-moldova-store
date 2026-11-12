import https from 'node:https';

// Use a fresh IPv4 HTTPS connection for Bot API calls. This avoids Node fetch/
// dual-stack connection stalls observed on some hosted Node environments.
// Never log the request URL: its path contains the secret bot token.
export function telegramApiErrorCode(status, data) {
  const code = Number(data?.error_code || status);
  if (code === 400) return 'TELEGRAM_INVALID_CHAT';
  if (code === 401) return 'TELEGRAM_INVALID_TOKEN';
  if (code === 403) return 'TELEGRAM_BOT_NOT_STARTED_OR_BLOCKED';
  if (code === 429) return 'TELEGRAM_RATE_LIMITED';
  return 'TELEGRAM_API_ERROR';
}

export function telegramNetworkErrorCode(error) {
  const code = String(error?.code || '');
  if (['ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(code)) return 'TELEGRAM_TIMEOUT';
  return 'TELEGRAM_NETWORK_ERROR';
}

export function telegramRequest(token, method, payload = {}, {timeoutMs = 20000} = {}) {
  if (!token) return Promise.reject(new Error('BOT_TOKEN_MISSING'));
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(method)) return Promise.reject(new Error('TELEGRAM_METHOD_INVALID'));
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    let settled = false;
    let absoluteTimer;
    function fail(code) { if (!settled) { settled = true; clearTimeout(absoluteTimer); reject(new Error(code)); } }
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: '/bot' + token + '/' + method,
      method: 'POST',
      family: 4,
      agent: false,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, response => {
      let received = 0, chunks = [];
      response.on('data', chunk => {
        received += chunk.length;
        if (received > 20000) { fail('TELEGRAM_RESPONSE_TOO_LARGE'); req.destroy(); }
        else chunks.push(chunk);
      });
      response.on('error', err => fail(telegramNetworkErrorCode(err)));
      response.on('end', () => {
        if (settled) return;
        let result;
        try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { return fail('TELEGRAM_INVALID_RESPONSE'); }
        if (response.statusCode < 200 || response.statusCode >= 300 || result.ok !== true)
          return fail(telegramApiErrorCode(response.statusCode, result));
        settled = true;
        clearTimeout(absoluteTimer);
        resolve(result.result);
      });
    });
    // Absolute deadline also covers DNS resolution and TLS handshake stalls.
    absoluteTimer = setTimeout(() => req.destroy(Object.assign(new Error('Telegram deadline exceeded'), {code: 'ETIMEDOUT'})), timeoutMs);
    absoluteTimer.unref();
    req.setTimeout(timeoutMs, () => req.destroy(Object.assign(new Error('Telegram connection timed out'), {code: 'ETIMEDOUT'})));
    req.on('error', err => fail(telegramNetworkErrorCode(err)));
    req.end(body);
  });
}
