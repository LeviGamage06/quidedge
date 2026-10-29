import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { hardenHtml } from '../scripts/harden-build.mjs';

const source = readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8');
function backend(options = {}) {
  const properties = new Map([['TURNSTILE_SECRET', 'test-secret']]);
  const rows = [], mails = [], events = [], used = new Set();
  let verificationCalls = 0, writes = 0;
  const sheet = {
    getLastRow: () => 1, appendRow: row => { rows.push(row); }, getSheetId: () => 1,
  };
  const store = {
    getProperty: key => properties.get(key) ?? null,
    setProperty: (key, value) => properties.set(key, value),
    getProperties: () => Object.fromEntries(properties),
    deleteProperty: key => properties.delete(key),
  };
  const context = vm.createContext({
    console: { warn: x => events.push(x), error: x => events.push(x) },
    LockService: { getScriptLock: () => ({ tryLock: () => options.lock !== false, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => store },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_, value) => createHash('sha256').update(value).digest(),
      base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url'),
    },
    UrlFetchApp: { fetch: (url, request) => {
      verificationCalls++;
      assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
      assert.equal(request.followRedirects, false);
      assert.equal(request.payload.secret, 'test-secret');
      assert.equal(request.payload.remoteip, undefined);
      if (options.networkError) throw new Error('private diagnostic');
      const token = request.payload.response;
      const success = !used.has(token);
      used.add(token);
      return {
        getResponseCode: () => options.status ?? 200,
        getContentText: () => options.malformed ? 'invalid json' : JSON.stringify({
          success, action: token.startsWith('newsletter') ? 'newsletter' : 'contact',
          hostname: 'www.quidedge.com', ...options.result,
        }),
      };
    } },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => { writes++; return { getSheetByName: () => sheet, getUrl: () => 'https://example.test/sheet' }; },
      flush() {},
    },
    MailApp: { sendEmail: mail => { if (options.mailError) throw Error('secret'); mails.push(mail); } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
  });
  vm.runInContext(source, context);
  let serial = 0;
  const submit = (changes = {}, envelope = {}) => {
    const parameter = {
      form_type: 'contact', name: 'Test client', email: 'client@example.test',
      revenue: '$10K – $20K', platform: 'YouTube', goal: 'Improve our videos.',
      consent_marketing: 'on', consent_updates: 'on',
      'cf-turnstile-response': `contact-${serial++}`, ...changes,
    };
    return context.doPost({ parameter, postData: { length: 1000 }, ...envelope });
  };
  return { submit, properties, rows, mails, events, get calls() { return verificationCalls; }, get writes() { return writes; } };
}

test('valid contact preserves the nine sheet columns, alert recipient, and formula protection', () => {
  const b = backend();
  assert.equal(b.submit({ name: '=1+1' }).ok, true);
  assert.equal(b.rows.length, 1);
  assert.equal(b.rows[0].length, 9);
  assert.equal(b.rows[0][1], "'=1+1");
  assert.equal(b.mails[0].to, 'inquiries.quidedge.au@gmail.com');
  assert.equal(b.mails[0].replyTo, 'client@example.test');
});

test('missing, oversized, honeypot and malformed fields never reach verification or Sheets', () => {
  for (const change of [
    { 'cf-turnstile-response': '' }, { 'cf-turnstile-response': 'x'.repeat(2049) },
    { website: 'spam' }, { email: 'x\ny@example.test' }, { name: 'x'.repeat(121) },
    { revenue: 'arbitrary' }, { platform: 'arbitrary' }, { consent_updates: '' },
    { name: 'header\ninjection' }, { goal: '' }, { form_type: '' },
  ]) {
    const b = backend();
    assert.equal(b.submit(change).ok, false);
    assert.equal(b.calls, 0); assert.equal(b.writes, 0); assert.equal(b.mails.length, 0);
  }
  const b = backend();
  assert.equal(b.submit({}, { postData: { length: 65537 } }).ok, false);
  assert.equal(b.submit({}, { parameters: { name: ['a', 'b'] } }).ok, false);
});

test('forged, wrong-action, wrong-hostname, localhost and nonboolean success fail closed', () => {
  for (const result of [
    { success: false }, { success: 'true' }, { action: 'newsletter' },
    { hostname: 'attacker.test' }, { hostname: 'localhost' }, { hostname: 'quidedge.com.attacker.test' },
  ]) {
    const b = backend({ result });
    assert.equal(b.submit().ok, false); assert.equal(b.writes, 0); assert.equal(b.mails.length, 0);
  }
});

test('missing secret, provider errors, bad JSON and network failure never write a lead', () => {
  for (const options of [{ status: 500 }, { malformed: true }, { networkError: true }]) {
    const b = backend(options);
    assert.equal(b.submit().ok, false); assert.equal(b.writes, 0);
  }
  const b = backend(); b.properties.delete('TURNSTILE_SECRET');
  assert.equal(b.submit().ok, false); assert.equal(b.calls, 0);
});

test('tokens cannot be replayed; a duplicate with a fresh token creates no second row or email', () => {
  const b = backend();
  assert.equal(b.submit({ 'cf-turnstile-response': 'contact-fixed' }).ok, true);
  assert.equal(b.submit({ 'cf-turnstile-response': 'contact-fixed' }).ok, false);
  assert.equal(b.submit().duplicate, true);
  assert.equal(b.rows.length, 1); assert.equal(b.mails.length, 1);
});

test('newsletter has its own action and cannot smuggle contact details through goal-prefix bypass', () => {
  const b = backend();
  assert.equal(b.submit({ form_type: 'newsletter', 'cf-turnstile-response': 'newsletter-1', goal: '=bad' }).ok, true);
  assert.equal(b.rows[0][1], 'Newsletter subscriber');
  assert.equal(b.rows[0][6], 'Newsletter signup');
  assert.equal(b.rows[0][4], '');
  assert.equal(b.submit({ goal: 'Newsletter signup fake', revenue: '' }).ok, false);
});

test('persistent email and global limits survive any CacheService state', () => {
  const b = backend();
  for (let i = 0; i < 3; i++) assert.equal(b.submit({ goal: `Goal ${i}` }).ok, true);
  assert.equal(b.submit({ goal: 'Fourth request' }).code, 'rate_limited');
  assert.equal(b.rows.length, 3);
  for (const traffic of [
    { hour: Math.floor(Date.now() / 3600000), hourCount: 60 },
    { day: Math.floor(Date.now() / 86400000), dayCount: 300 },
  ]) {
    const c = backend(); c.properties.set('qe-traffic', JSON.stringify(traffic));
    assert.equal(c.submit().code, 'rate_limited'); assert.equal(c.rows.length, 0);
  }
});

test('lock contention fails closed and notification failure does not lose an already-saved lead', () => {
  const busy = backend({ lock: false });
  assert.equal(busy.submit().code, 'busy'); assert.equal(busy.writes, 0);
  const b = backend({ mailError: true });
  assert.equal(b.submit().ok, true); assert.equal(b.rows.length, 1);
  assert.equal(b.submit().duplicate, true); assert.equal(b.rows.length, 1);
  assert.deepEqual(b.events, ['qe_notification_failed']);
});

test('production CSP permits Turnstile while retaining exact inline script hashes', () => {
  const html = hardenHtml('<meta http-equiv="Content-Security-Policy" content="script-src \'self\' \'unsafe-inline\'; object-src \'none\'"><script>console.log(1)</script>');
  assert.match(html, /script-src 'self' https:\/\/challenges.cloudflare.com 'sha256-/);
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval/);
});
