// Every public form uses the same verification and response contract.
const forms = [...document.querySelectorAll('#lead-form, .newsletter-form')];
const sitekey = document.getElementById('qe-form-config')?.dataset.sitekey;
const states = new Map();
const unavailable = 'Verification is unavailable. Please reload, or email inquiries.quidedge.au@gmail.com.';

for (const [index, form] of forms.entries()) {
  const button = form.querySelector('button[type="submit"]');
  const label = button?.querySelector('.btn-label') || button;
  const widget = document.createElement('div');
  widget.id = `qe-verification-${index}`;
  widget.style.cssText = 'flex-basis:100%;width:100%;min-height:65px;';
  const error = form.querySelector('[role="alert"]') || document.createElement('p');
  error.setAttribute('role', 'alert');
  error.className = 'text-xs';
  error.style.cssText = 'color:#f87171;flex-basis:100%;';
  error.hidden = true;
  form.style.flexWrap = 'wrap';
  form.append(widget, error);
  const state = { button, label, original: label?.textContent, widgetId: undefined, busy: false, error };
  states.set(form, state);
  if (button) button.disabled = true;
  const showError = (message) => { error.textContent = message; error.hidden = false; };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.busy) return;
    error.hidden = true;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const api = window.turnstile;
    const token = state.widgetId !== undefined && api?.getResponse(state.widgetId);
    if (!token) { showError('Please complete the verification before sending.'); return; }
    state.busy = true;
    if (button) button.disabled = true;
    if (label) label.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');
    try {
      const body = new URLSearchParams();
      for (const [key, value] of new FormData(form)) body.append(key, String(value));
      body.set('form_type', form.id === 'lead-form' ? 'contact' : 'newsletter');
      body.set('cf-turnstile-response', token);
      const response = await fetch(form.action, {
        method: 'POST', body, mode: 'cors', credentials: 'omit',
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error('delivery');
      const result = await response.json();
      if (result.ok !== true) {
        showError(result.code === 'rate_limited'
          ? 'Too many requests. Please try again later, or email us directly.'
          : 'Your request could not be accepted. Please verify again and retry.');
        return;
      }
      if (form.id === 'lead-form') {
        form.hidden = true;
        const success = document.getElementById('form-success');
        if (success) { success.hidden = false; success.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      } else {
        const thanks = document.createElement('p');
        thanks.className = 'text-sm text-stone';
        thanks.setAttribute('role', 'status');
        thanks.textContent = 'Thanks — you’re subscribed. ✓';
        api.remove(state.widgetId);
        form.replaceWith(thanks);
      }
    } catch {
      // Delivery may be uncertain. Never claim that an opaque/failed response saved a lead.
      showError('We could not confirm receipt. Please retry, or email inquiries.quidedge.au@gmail.com.');
    } finally {
      state.busy = false;
      form.removeAttribute('aria-busy');
      if (label) label.textContent = state.original;
      if (form.isConnected && !form.hidden) api.reset(state.widgetId);
      // The next callback enables this form only after a fresh single-use token.
    }
  });
}

function failed() {
  for (const state of states.values()) {
    state.error.textContent = unavailable;
    state.error.hidden = false;
    if (state.button) state.button.disabled = true;
  }
}

if (forms.length && sitekey) {
  window.qeTurnstileReady = () => {
    clearTimeout(loadTimeout);
    for (const [form, state] of states) {
      const invalidate = () => { if (state.button) state.button.disabled = true; };
      state.widgetId = window.turnstile.render(form.querySelector('[id^="qe-verification-"]'), {
        sitekey, action: form.id === 'lead-form' ? 'contact' : 'newsletter',
        theme: 'dark', size: 'flexible',
        callback: () => {
          if (state.error.textContent === unavailable) state.error.hidden = true;
          if (state.button) state.button.disabled = state.busy;
        },
        'expired-callback': invalidate,
        'timeout-callback': invalidate,
        'error-callback': () => {
          invalidate(); state.error.textContent = unavailable; state.error.hidden = false;
        },
      });
    }
  };
  const loadTimeout = setTimeout(failed, 20000);
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=qeTurnstileReady&render=explicit';
  script.async = true;
  script.addEventListener('error', failed);
  document.head.append(script);
} else if (forms.length) {
  failed();
}
