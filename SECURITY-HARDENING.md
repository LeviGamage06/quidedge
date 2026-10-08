# Security and media hardening

This draft preserves existing navigation, form controls, Google Sheets CSV sources, Apps Script endpoints, video playback, fullscreen and keyboard use. It does not modify any Google Sheet or Apps Script deployment.

## Implemented
- Production build hashes exact inline script bodies per page and removes script-src unsafe-inline from the generated meta CSP. npm run build verifies the final hashes; CI/deployment already use this command. Deploy only its complete output, never an earlier/raw Astro output. No dependency added.
- JSON-LD serialization escapes HTML-significant characters so a content value cannot terminate its script element.
- Native video download controls are discouraged using controlslist=nodownload; existing controls and restrictions are retained. Dynamic sheet-fed media receives the same hint.
- Image drag-to-desktop is disabled within main content. No global context-menu, copy, print, keyboard, developer-tool or screenshot blocker is installed.
- Removed ineffective nosniff meta markup and meta frame-ancestors; these directives require real response headers. Corrected the misleading _headers proxy comment.

## Limits and pending verification
Public image/video bytes remain downloadable, and screenshots/recordings cannot be prevented. controlslist support varies by browser. This is not DRM or authenticated delivery. Private originals, watermarked public copies, signed URLs and streaming DRM require a separately scoped media/backend workflow and do not eliminate recording. Original media is unchanged.

GitHub Pages ignores _headers. Adding a Cloudflare proxy alone does not activate it. Actual framing, nosniff and other response-header controls need hosting/edge configuration, verified with response headers. Existing _headers policy is not a fully reviewed migration configuration and must be reconciled with embeds, generated script hashes and current origins before any hosting migration. No DNS/hosting changes made.

CMS admin is intentionally excluded from marketing-page CSP rewriting. No CMS authentication/backend access, Apps Script authorization/rate-limit audit, repository admin-settings changes or penetration test was performed. The public site is served by GitHub Pages and its observed response already includes HSTS. npm audit --omit=dev reported zero known vulnerabilities at the time of this check; this does not establish absence of security defects.

Validation: production build, existing feature smoke checks, independent HTML/CSP hash checks, and unchanged form attributes/options, navigation and media-source comparisons across 17 marketing pages. Full real-browser CSP enforcement, dynamic CSV loading, accessibility and media-playback regression testing remains required before approving a live release. No live publication is authorized by this draft.
