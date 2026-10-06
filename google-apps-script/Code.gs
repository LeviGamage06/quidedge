/**
 * QuidEdge — Lead capture backend (Google Apps Script)
 * ---------------------------------------------------------------------------
 * What it does when the website contact form is submitted:
 *   1. Appends the client's details as a new row in your Google Sheet.
 *   2. Emails you "You got a client request" with all the details.
 *
 * Setup steps are in FORM-SETUP.md. You only need to change NOTIFY_EMAIL below
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
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // avoid two submissions writing the same row

    var p = (e && e.parameter) ? e.parameter : {};

    // Invisible bot trap. Real website users never fill this field.
    if (String(p.website || '').trim()) {
      return json_({ ok: true });
    }

    // Reject obviously malformed or abusive payloads before they reach Sheets.
    var name = cleanText_(p.name, 120);
    var email = cleanEmail_(p.email);
    var whatsapp = cleanText_(p.whatsapp, 80);
    var revenue = cleanText_(p.revenue, 80);
    var platform = cleanText_(p.platform, 80);
    var goal = cleanText_(p.goal, 4000);

    if (!email) {
      return json_({ ok: false, error: 'Invalid email address.' });
    }

    // The public endpoint is intentionally shared by the strategy-call form and
    // newsletter forms. Keep both workflows working without changing the sheet.
    var isNewsletter = /^Newsletter signup/i.test(goal);
    if (!isNewsletter && (!name || !goal)) {
      return json_({ ok: false, error: 'Missing required fields.' });
    }

    // Exact duplicate suppression: prevents accidental double-clicks and basic
    // bot retries without blocking legitimate people or changing the UI.
    var fingerprint = [name, email, whatsapp, revenue, platform, goal].join('|').toLowerCase();
    var digest = Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, fingerprint)
    ).replace(/=+$/, '');
    var cache = CacheService.getScriptCache();
    var cacheKey = 'qe-submit-' + digest.substring(0, 40);
    if (cache.get(cacheKey)) {
      return json_({ ok: true, duplicate: true });
    }
    cache.put(cacheKey, '1', 90);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }
    // First run: write the header row and make it bold.
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // Tidy-up: remove the leftover empty default "Sheet1" so there's just one
    // clear tab and the data is never hidden behind a blank sheet.
    var blank = ss.getSheetByName('Sheet1');
    if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(blank);
    }

    // Prefix formula-leading user text with an apostrophe so Google Sheets stores
    // it as literal text. The apostrophe is not displayed in the cell.
    var row = [
      new Date(),
      safeSheetText_(name),
      safeSheetText_(email),
      safeSheetText_(whatsapp),
      safeSheetText_(revenue),
      safeSheetText_(platform),
      safeSheetText_(goal),
      p.consent_marketing ? 'Yes' : 'No',
      p.consent_updates   ? 'Yes' : 'No'
    ];
    sheet.appendRow(row);
    SpreadsheetApp.flush(); // force the write to commit before we email

    // Deep-link straight to the Leads tab so the email button opens the data,
    // not the spreadsheet's default first tab.
    var sheetUrl = ss.getUrl() + '#gid=' + sheet.getSheetId();
    var cleanPayload = {
      name: name,
      email: email,
      whatsapp: whatsapp,
      revenue: revenue,
      platform: platform,
      goal: goal
    };
    sendAlert_(cleanPayload, sheetUrl);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
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
  if (/[
]/.test(s)) return '';
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
  var subject = '🎉 You got a client request — ' + name;

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
