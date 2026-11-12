import test from 'node:test';
import assert from 'node:assert/strict';
import {telegramApiErrorCode, telegramNetworkErrorCode, telegramRequest} from '../lib/telegram-transport.js';

test('Telegram API errors are classified without exposing credentials or chat IDs', () => {
  assert.equal(telegramApiErrorCode(400,{error_code:400}), 'TELEGRAM_INVALID_CHAT');
  assert.equal(telegramApiErrorCode(401,{error_code:401}), 'TELEGRAM_INVALID_TOKEN');
  assert.equal(telegramApiErrorCode(403,{error_code:403}), 'TELEGRAM_BOT_NOT_STARTED_OR_BLOCKED');
  assert.equal(telegramApiErrorCode(429,{error_code:429}), 'TELEGRAM_RATE_LIMITED');
  assert.equal(telegramApiErrorCode(502,{}), 'TELEGRAM_API_ERROR');
  assert.equal(telegramNetworkErrorCode({code:'ETIMEDOUT'}), 'TELEGRAM_TIMEOUT');
  assert.equal(telegramNetworkErrorCode({code:'ECONNRESET'}), 'TELEGRAM_NETWORK_ERROR');
});
test('Reject missing bot credentials and bad method before any network I/O', async () => {
  await assert.rejects(telegramRequest('', 'getMe', {}), /BOT_TOKEN_MISSING/);
  await assert.rejects(telegramRequest('dummy', '../getMe', {}), /TELEGRAM_METHOD_INVALID/);
});
