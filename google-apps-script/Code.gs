/**
 * QuidEdge — Lead capture backend (Google Apps Script)
 * ---------------------------------------------------------------------------
 * What it does when the website contact form is submitted:
 *   1. Appends the client's details as a new row in your Google Sheet.
 *   2. Emails you "You got a client request" with all the details.
 *
 * Setup steps are in BOT-PROTECTION.md. You only need to change NOTIFY_EMAIL below
 * if you want the alert to go somewhere other than your inquiries inbox.
 * ---------------------------------------------------------------------------
 */

// Where the "You got a client request" alert is sent.
var NOTIFY_EMAIL = 'inquiries.quidedge.au@gmail.com';

// The tab (sheet) name inside your spreadsheet. Created automatically if missing.
var SHEET_NAME = 'Leads';

// Column headers, in order. (Also the order rows are written in.)
var HEADERS = [
  'Timestamp', 'Full Name', 'Email', 'WhatsApp',
  'Annual Revenue', 'Primary Platform', 'Goal',
  'Consent: Marketing', 'Consent: Updates'
];

/**
 * Handles the POST from the website form.
 * The script is bound to the spreadsheet, so getActiveSpreadsheet() works.
 */
function doPost(e) {
  var p = (e && e.parameter) || {};
  var rejected = { ok: false, code: 'rejected' };
  // Apps Script does not expose a trustworthy client IP. Never accept an IP
  // supplied by the browser as a rate-limit identity or Siteverify remoteip.
  if (!e || !e.postData || e.postData.length > 65536) return json_(rejected);
  if (e.parameters && Object.keys(e.parameters).some(function (key) {
    return e.parameters[key].length !== 1;
  })) return json_(rejected);
  if (String(p.website || '').trim()) return json_(rejected);
  var type = p.form_type;
  if (type !== 'contact' && type !== 'newsletter') return json_(rejected);
  var limits = { name: 120, email: 254, whatsapp: 80, revenue: 80, platform: 80, goal: 4000 };
  if (Object.keys(limits).some(function (key) {
    return String(p[key] || '').length > limits[key] || /\u0000/.test(String(p[key] || ''));
  })) return json_(rejected);
  var name = cleanText_(p.name, 120);
  var email = cleanEmail_(p.email).toLowerCase();
  var whatsapp = cleanText_(p.whatsapp, 80);
  var revenue = cleanText_(p.revenue, 80);
  var platform = cleanText_(p.platform, 80);
  var goal = cleanText_(p.goal, 4000);
  if (!email || /[\r\n]/.test(name)) return json_(rejected);
  if (type === 'contact') {
    if (!name || !goal ||
        ['$10K – $20K', '$20K – $50K', 'More than $50K+'].indexOf(revenue) === -1 ||
        ['YouTube', 'TikTok', 'Instagram / Reels', 'LinkedIn', 'Multiple platforms'].indexOf(platform) === -1 ||
        p.consent_marketing !== 'on' || p.consent_updates !== 'on') return json_(rejected);
  } else {
    // A caller-controlled goal prefix must never bypass contact validation.
    name = 'Newsletter subscriber'; goal = 'Newsletter signup';
    whatsapp = ''; revenue = ''; platform = '';
  }
  if (!verifyTurnstile_(p['cf-turnstile-response'], type)) {
    return json_({ ok: false, code: 'verification_failed' });
  }

  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(5000)) return json_({ ok: false, code: 'busy' });
    var properties = PropertiesService.getScriptProperties();
    var now = Date.now();
    // Persistent counters survive CacheService eviction. Fixed windows are
    // intentionally conservative: at most 3/email/hour, 60 total/hour, 300/day.
    var hour = Math.floor(now / 3600000);
    var day = Math.floor(now / 86400000);
    var emailKey = 'qe-email-' + digest_(email);
    var emailState = JSON.parse(properties.getProperty(emailKey) || '{}');
    var globalState = JSON.parse(properties.getProperty('qe-traffic') || '{}');
    var fingerprint = digest_(JSON.stringify([type, name, email, whatsapp, revenue, platform, goal]));
    if (emailState.fingerprint === fingerprint && emailState.savedAt > now - 86400000) {
      return json_({ ok: true, duplicate: true });
    }
    var emailCount = emailState.hour === hour ? emailState.count : 0;
    var hourCount = globalState.hour === hour ? globalState.hourCount : 0;
    var dayCount = globalState.day === day ? globalState.dayCount : 0;
    if (emailCount >= 3 || hourCount >= 60 || dayCount >= 300) {
      console.warn('qe_submission_rate_limited');
      return json_({ ok: false, code: 'rate_limited' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    var row = [new Date(), safeSheetText_(name), safeSheetText_(email),
      safeSheetText_(whatsapp), safeSheetText_(revenue), safeSheetText_(platform),
      safeSheetText_(goal), p.consent_marketing === 'on' ? 'Yes' : 'No',
      p.consent_updates === 'on' ? 'Yes' : 'No'];
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    properties.setProperty(emailKey, JSON.stringify({
      hour: hour, count: emailCount + 1, fingerprint: fingerprint, savedAt: now
    }));
    properties.setProperty('qe-traffic', JSON.stringify({
      hour: hour, hourCount: hourCount + 1, day: day, dayCount: dayCount + 1
    }));
    // Remove only this feature's expired email counters. Never touch secrets.
    var all = properties.getProperties();
    Object.keys(all).forEach(function (key) {
      if (key.indexOf('qe-email-') === 0 && JSON.parse(all[key]).savedAt <= now - 86400000) {
        properties.deleteProperty(key);
      }
    });
    var sheetUrl = ss.getUrl() + '#gid=' + sheet.getSheetId();
    try {
      sendAlert_({ name: name, email: email, whatsapp: whatsapp,
        revenue: revenue, platform: platform, goal: goal }, sheetUrl);
    } catch (mailError) {
      // The lead is already stored. Do not encourage duplicate retries or leak
      // provider errors/contact details into the public response or logs.
      console.error('qe_notification_failed');
    }
    return json_({ ok: true });
  } catch (err) {
    console.error('qe_submission_failed');
    return json_({ ok: false, code: 'unavailable' });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function digest_(value) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)
  ).replace(/=+$/, '');
}

function verifyTurnstile_(token, action) {
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  try {
    var properties = PropertiesService.getScriptProperties();
    var secret = properties.getProperty('TURNSTILE_SECRET');
    // Exact production hostnames only; no localhost wildcard or caller override.
    var hostnames = ['www.quidedge.com', 'quidedge.com'];
    if (!secret || !secret.trim()) return false;
    var response = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post', payload: { secret: secret, response: token },
      muteHttpExceptions: true, followRedirects: false,
    });
    if (response.getResponseCode() !== 200) return false;
    var result = JSON.parse(response.getContentText());
    return result.success === true && result.action === action &&
      hostnames.indexOf(result.hostname) !== -1;
  } catch (error) {
    return false;
  }
}

function cleanText_(value, maxLen) {
  var s = String(value == null ? '' : value)
    .replace(/\u0000/g, '')
    .trim();
  if (s.length > maxLen) s = s.substring(0, maxLen);
  return s;
}

function cleanEmail_(value) {
  var s = cleanText_(value, 254);
  // Conservative validation; keeps normal international/local-part characters
  // used by real addresses while rejecting newlines/header injection.
  if (/[\r\n]/.test(s)) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return '';
  return s;
}

function safeSheetText_(value) {
  var s = String(value == null ? '' : value);
  // Spreadsheet formula injection is triggered by formula-leading characters.
  // Prefixing with an apostrophe stores the exact visible value as text.
  if (/^[\s]*[=+\-@]/.test(s)) return "'" + s;
  return s;
}

/** Sends the "You got a client request" email to you. */
function sendAlert_(p, sheetUrl) {
  var name = p.name || 'New lead';
  var subject = '🎉 You got a client request — ' + String(name).replace(/[\r\n]+/g, ' ').substring(0, 120);

  var rows = [
    ['Name', p.name],
    ['Email', p.email],
    ['WhatsApp', p.whatsapp],
    ['Annual revenue', p.revenue],
    ['Primary platform', p.platform],
    ['Goal', p.goal]
  ].map(function (r) {
    return '<tr>' +
      '<td style="padding:6px 14px 6px 0;color:#8a8680;font:600 12px/1.4 Arial;white-space:nowrap;vertical-align:top;">' + r[0] + '</td>' +
      '<td style="padding:6px 0;color:#111;font:14px/1.5 Arial;">' + escapeHtml_(r[1] || '—') + '</td>' +
    '</tr>';
  }).join('');

  var html =
    '<div style="max-width:560px;margin:0 auto;font-family:Arial,sans-serif;">' +
      '<div style="background:#0a0a0a;color:#edede7;padding:22px 24px;">' +
        '<div style="font:300 20px/1 Arial;">Quid<b>E</b>dge<span style="color:#3d5afe;">.</span></div>' +
        '<div style="margin-top:6px;font:600 11px/1 Arial;letter-spacing:2px;color:#8a8680;text-transform:uppercase;">New client request</div>' +
      '</div>' +
      '<div style="border:1px solid #eee;border-top:none;padding:22px 24px;">' +
        '<p style="margin:0 0 16px;font:15px/1.5 Arial;color:#111;">You got a new strategy-call request. Details:</p>' +
        '<table style="border-collapse:collapse;width:100%;">' + rows + '</table>' +
        '<p style="margin:22px 0 0;">' +
          '<a href="' + sheetUrl + '" style="background:#3d5afe;color:#fff;text-decoration:none;padding:11px 20px;font:700 12px/1 Arial;letter-spacing:1px;">OPEN THE SHEET</a>' +
        '</p>' +
      '</div>' +
    '</div>';

  var plain =
    'New client request\n\n' +
    'Name: ' + (p.name || '') + '\n' +
    'Email: ' + (p.email || '') + '\n' +
    'WhatsApp: ' + (p.whatsapp || '') + '\n' +
    'Annual revenue: ' + (p.revenue || '') + '\n' +
    'Primary platform: ' + (p.platform || '') + '\n' +
    'Goal: ' + (p.goal || '') + '\n\n' +
    'Sheet: ' + sheetUrl;

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: subject,
    replyTo: p.email || NOTIFY_EMAIL, // reply goes straight to the client
    htmlBody: html,
    body: plain
  });
}

/** GET handler — lets you open the /exec URL in a browser to confirm it's live. */
function doGet() {
  return json_({ ok: true, message: 'QuidEdge lead endpoint is live.' });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml_(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
