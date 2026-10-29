# Inquiry and newsletter bot protection

Status: prepared for review. Do not merge until frontend configuration and the
Apps Script rollout below are coordinated. A GitHub deployment does not update
Google Apps Script. No live secret or deployment is changed by this PR.

## Protection contract

- Every contact and newsletter POST requires a fresh Cloudflare Turnstile token.
  The existing Apps Script handler calls Siteverify and requires boolean success,
  the matching `contact` or `newsletter` action, and the exact hostname
  `www.quidedge.com` or `quidedge.com`. Missing configuration and upstream errors
  fail closed before sheet writes or notification emails.
- Honeypot, 64 KB request limit, duplicate-parameter rejection, field length
  limits, contact field allowlists and required consent checks run on the server.
  Newsletter mode normalizes its fields and requires its own verified action.
- Persistent, lock-protected limits: 3 accepted submissions per normalized email
  per fixed UTC hour, 60 total per fixed UTC hour and 300 per UTC day. These are
  initial low-volume agency settings; adjust against actual legitimate demand.
  Email hashes and counters expire after 24 hours; raw emails are not stored in
  limiter keys. Fixed windows can permit a burst around a boundary. Changing an
  email can bypass the per-email limit, but not the overall limits.
- An identical last submission for an email is acknowledged without another row
  or alert for 24 hours, after verifying a fresh token. A changed submission
  replaces that email's duplicate fingerprint. This is not a full history index.
- All forms read the backend JSON response. Rejection, CORS failure, timeout and
  malformed responses cannot trigger the success state. A new token is required
  after each submission attempt; every form retains its own widget ID.
- The existing Leads columns, formula escaping, email destination and alert
  contents remain. Email notification failure is logged with a non-personal event
  code after saving the lead; review Apps Script executions if alerts stop.

## Required configuration

1. Create a managed Turnstile widget in the QuidEdge Cloudflare account. Register
   `www.quidedge.com`, `quidedge.com`, `localhost`, and `127.0.0.1`. Production
   verification never accepts the local hostnames. Use Cloudflare's test keys
   only for local/CI testing, never as the deployed production key.
2. The approved widget public sitekey is configured as
   `PUBLIC_TURNSTILE_SITE_KEY` in the Pages workflow and passed to Astro.
   Sitekey: `0x4AAAAAAFrTPGyHwKW2UPlq`. This is public configuration, not a secret. A production
   build without a sitekey fails, preventing a broken form release. PR CI uses
   the documented public test sitekey; that build is not the production release.
3. In the existing Google Apps Script project, set Script Property
   `TURNSTILE_SECRET` to the corresponding secret through the platform's normal
   secret settings. Never commit it, add it to GitHub public variables, or paste
   it in chat. Keep existing properties and the bound spreadsheet unchanged.
4. Back up the current Apps Script source and record the active deployment
   version for rollback. Live source inspected during this task is semantically
   equivalent to the repository baseline, with extra subject newline sanitizing
   retained in this change. Verify the active deployment points to the same
   project before publishing.

## Coordinated activation and validation

Schedule a short form maintenance window. Publish the updated frontend and
Apps Script version together, keeping the existing `/exec` deployment URL. The
old frontend cannot submit to the new strict backend (no token/form_type). The
old backend does not enforce the new checks. Do not leave only one side updated.
Deploy the backend as the existing owner with the existing audience; no wider
sharing or new endpoint is needed. Apps Script may ask the owner to authorize
the added external-request scope for `UrlFetchApp`.

Before reporting the protection live, verify on the production deployment:

1. Successful contact and newsletter submissions using fresh real tokens; check
   one saved row and the expected alert for each. Use approved test details.
2. Replaying a redeemed token, missing tokens, wrong action/hostname, invalid
   fields and over-limit requests never write rows or send alerts.
3. Retrying an identical submission with a fresh token yields one row/alert.
4. Readable CORS JSON responses through the Apps Script redirect; the frontend
   shows errors for rejected submissions. Never restore `no-cors` as a fallback.
5. Contact, footer and blog newsletter widgets work on mobile and desktop under
   the built CSP. Expiration, provider/script failure and retry reset behave
   correctly. Inspect Cloudflare validation analytics and Apps Script executions.

Local checks: `npm test`, `PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA npm run build`,
and `node scripts/verify-build.mjs`. Local tests mock Google and Cloudflare;
they do not replace the real-token production checks above.

## Limits and rollback

Apps Script exposes no trustworthy caller IP to this handler. A caller-supplied
IP is deliberately ignored. The public Google endpoint can still be hit directly;
Cloudflare WAF on the website domain cannot protect Google's domain. Requests
can consume Apps Script execution/UrlFetch quotas even when rejected. Turnstile
plus application limits reduce spam; they do not provide volumetric DDoS
protection or prove a person is a genuine prospective client. Verified attackers
can consume the global allowance; monitor rate-limit events and tune limits.

No DNS, WAF, hosting migration or extra backend is part of this change. If direct
flooding continues, a separately approved backend/edge design is needed.

For rollback, restore both the prior frontend commit and prior Apps Script
deployment version together. Do not disable verification or accept missing tokens
in just one layer. Keep the secret out of backups and logs.
