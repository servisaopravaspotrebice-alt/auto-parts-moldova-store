import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeVinOrOem} from '../lib/order-reference.js';

test('VIN is optional and OEM references are accepted', () => {
  assert.equal(normalizeVinOrOem(''), '');
  assert.equal(normalizeVinOrOem(undefined), '');
  assert.equal(normalizeVinOrOem(' wvwzzz1kz6w612345 '), 'WVWZZZ1KZ6W612345');
  assert.equal(normalizeVinOrOem('7H1422061J'), '7H1422061J');
  assert.equal(normalizeVinOrOem('A 000 123-456/01'), 'A 000 123-456/01');
});
test('bad reference input is rejected instead of silently truncated', () => {
  assert.equal(normalizeVinOrOem('X'.repeat(31)), null);
  assert.equal(normalizeVinOrOem('VIN <script>'), null);
  assert.equal(normalizeVinOrOem('код детали'), null);
  assert.equal(normalizeVinOrOem({bad:1}), null);
});
test('vehicle make is optional in the customer form', () => {
  const html=fs.readFileSync(new URL('../public/index.html', import.meta.url),'utf8');
  const make=html.match(/<select\\s+id="make"[^>]*>/)?.[0]||'';
  assert.ok(make, 'Vehicle make selector not found');
  assert.doesNotMatch(make,/\\srequired(?:\\s|=|>)/i);
  assert.match(html,/<button[^>]*id="submitBtn"[^>]*type="submit"/i);
});
