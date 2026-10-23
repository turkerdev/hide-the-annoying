import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveClassifierAuth } from './freetier.js';

const future = Date.now() + 60_000;
const settings = {
  apiKeys: { jev: '' },
  endpoints: { jev: 'https://api.typesafe.ai/v1/systemone' },
  freeTierOrigin: 'https://api.hide-the-annoying.turker.dev',
  freeTier: { session: 'session-token', email: 'a@gmail.com', expiresAt: future }
};

test('a personal key skips the free tier', () => {
  const auth = resolveClassifierAuth({
    ...settings,
    apiKeys: { jev: 'Bearer ts_live' }
  });
  assert.equal(auth.mode, 'own-key');
  assert.equal(auth.apiKey, 'ts_live');
  assert.equal(auth.endpoint, 'https://api.typesafe.ai/v1/systemone');
});

test('gmail session uses the proxy when no personal key is set', () => {
  const auth = resolveClassifierAuth(settings);
  assert.equal(auth.mode, 'free-tier');
  assert.equal(auth.apiKey, 'session-token');
  assert.equal(auth.endpoint, 'https://api.hide-the-annoying.turker.dev/v1/systemone');
});

test('expired session does not classify', () => {
  const auth = resolveClassifierAuth({
    ...settings,
    freeTier: { ...settings.freeTier, expiresAt: Date.now() - 1000 }
  });
  assert.equal(auth.mode, 'expired');
});
