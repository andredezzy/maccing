"""
OAuth callback HTML page templates for the google-workspace plugin.

Returns full HTML strings (no external dependencies) for the three OAuth
callback states: success, error (user-facing OAuth error), and server error
(exception during token exchange).

Design: Midday-style minimal, light + dark via prefers-color-scheme, WCAG AA,
prefers-reduced-motion, no external assets, no SVG icons, no animations.
"""

from html import escape as html_escape
from typing import Optional


_TOKENS_CSS = """\
/* ─── TOKENS ─────────────────────────────────────────────────── */
:root {
  /* Surfaces */
  --bg:        #ffffff;
  --surface:   #f6f5f2;
  --surface-2: #f1f0ee;

  /* Text */
  --text:      #111111;
  --muted:     #606060;

  /* Borders */
  --border:    #dad9d6;

  /* Interactive */
  --btn-bg:    #17171b;
  --btn-text:  #f9f9f9;

  /* Status */
  --success:   #1a7f4b;
  --error:     #c8392b;

  /* Shape */
  --radius:    0.5rem;
  --radius-sm: 0.25rem;

  /* Font stacks (no external assets) */
  --font-sans: ui-sans-serif, -apple-system, "Segoe UI", Roboto, Inter,
               system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono",
               Menlo, monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg:        #0c0c0c;
    --surface:   #111111;
    --surface-2: #1c1c1c;

    --text:      #f9f9f9;
    --muted:     #606060;

    --border:    #1c1c1c;

    --btn-bg:    #f9f9f9;
    --btn-text:  #17171b;

    --success:   #2fa86a;
    --error:     #e85555;
  }
}"""

_BASE_CSS = """\
/* ─── RESET & BASE ───────────────────────────────────────────── */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
}

body {
  font-family: var(--font-sans);
  font-size: 0.9375rem;
  line-height: 1.6;
  background-color: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

/* ─── CARD ───────────────────────────────────────────────────── */
.card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 100%;
  max-width: 420px;
  padding: 2.5rem 2rem;
}

/* ─── WORDMARK ────────────────────────────────────────────────── */
.wordmark {
  font-family: var(--font-sans);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-bottom: 2rem;
  display: block;
}

/* ─── HEADING ─────────────────────────────────────────────────── */
.heading {
  font-size: 1.0625rem;
  font-weight: 500;
  color: var(--text);
  line-height: 1.4;
  margin-bottom: 0.5rem;
}

/* ─── BODY TEXT ───────────────────────────────────────────────── */
.body-text {
  font-size: 0.875rem;
  color: var(--muted);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

/* ─── EMAIL CHIP ──────────────────────────────────────────────── */
.email-chip {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--text);
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.25rem 0.625rem;
  margin-bottom: 1.5rem;
  font-variant-numeric: tabular-nums;
}

/* ─── STATUS LINE (success / error) ──────────────────────────── */
.status-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--muted);
  margin-bottom: 1.5rem;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot--success { background-color: var(--success); }
.status-dot--error   { background-color: var(--error);   }

/* ─── PRIMARY BUTTON ──────────────────────────────────────────── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.625rem 1.25rem;
  background-color: var(--btn-bg);
  color: var(--btn-text);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  transition: opacity 0.15s ease-out;
}

.btn-primary:hover  { opacity: 0.82; }
.btn-primary:active { opacity: 0.68; }

.btn-primary:focus-visible {
  outline: 2px solid var(--text);
  outline-offset: 3px;
}

/* ─── DIVIDER ─────────────────────────────────────────────────── */
.divider {
  height: 1px;
  width: 100%;
  background-color: var(--border);
  margin: 1.5rem 0;
}

/* ─── FOOTER ──────────────────────────────────────────────────── */
.footer {
  font-size: 0.75rem;
  color: var(--muted);
  text-align: center;
  margin-top: 1.5rem;
}

/* ─── ERROR BLOCK ─────────────────────────────────────────────── */
.error-block {
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-left: 2px solid var(--error);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
}

.error-block p {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--error);
  line-height: 1.5;
  word-break: break-word;
}

/* ─── REDUCED MOTION ──────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; }
}"""

# Auto-close JS preserved from upstream for UX parity:
# The browser tab is opened by webbrowser.open() in auth/google_auth.py and
# there is no other mechanism to dismiss it — without this the tab stays open.
_AUTO_CLOSE_JS = """\
<script>
  function tryClose() {
    window.close();
    setTimeout(function() {
      var btn = document.querySelector('.btn-primary');
      if (btn) { btn.textContent = 'You can close this tab manually'; }
      var note = document.getElementById('auto-close-note');
      if (note) { note.style.display = 'none'; }
    }, 500);
  }
  setTimeout(tryClose, 10000);
</script>"""


def success_page(verified_user_id: Optional[str] = None) -> str:
    """
    Return the HTML string for the OAuth success callback page.

    Parameters
    ----------
    verified_user_id:
        The authenticated Google account email address, or None to fall back
        to the string "Google User" (mirrors upstream behaviour).
    """
    email = html_escape(verified_user_id) if verified_user_id else "Google User"

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Maccing Google Workspace Authenticated</title>
  <style>
    {_TOKENS_CSS}
    {_BASE_CSS}
  </style>
  {_AUTO_CLOSE_JS}
</head>
<body>

  <main>
    <article class="card" role="main" aria-labelledby="card-heading">

      <span class="wordmark" aria-label="Maccing Google Workspace">
        Maccing · Google Workspace
      </span>

      <h1 class="heading" id="card-heading">
        Authenticated
      </h1>

      <p class="body-text">
        Your Google account is connected. You can close this window and return
        to Claude.
      </p>

      <div class="status-line" role="status" aria-live="polite">
        <span class="status-dot status-dot--success" aria-hidden="true"></span>
        <span>Connected as</span>
      </div>

      <code class="email-chip" aria-label="Connected account email">
        {email}
      </code>

      <div class="divider" role="separator" aria-hidden="true"></div>

      <p id="auto-close-note" class="footer">
        This window will close automatically in 10 seconds.
      </p>

    </article>
  </main>

</body>
</html>"""


def error_page(error_message: str, auth_url: Optional[str] = None) -> str:
    """
    Return the HTML string for the OAuth error callback page.

    Parameters
    ----------
    error_message:
        The raw error string or human-readable description to display in the
        code-styled error block.  Must already be HTML-escaped by the caller,
        or pass the raw string — this function escapes it.
    auth_url:
        Optional Google OAuth authorization URL for the "Try again" button.
        If None, the retry button is omitted.
    """
    escaped_message = html_escape(error_message)

    retry_button = ""
    if auth_url:
        escaped_url = html_escape(auth_url)
        retry_button = f"""
      <a
        href="{escaped_url}"
        class="btn-primary"
        role="button"
        aria-label="Retry Google authorization"
      >
        Try again
      </a>"""

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Maccing Google Workspace — Authentication Error</title>
  <style>
    {_TOKENS_CSS}
    {_BASE_CSS}
  </style>
</head>
<body>

  <main>
    <article class="card" role="main" aria-labelledby="card-heading">

      <span class="wordmark" aria-label="Maccing Google Workspace">
        Maccing · Google Workspace
      </span>

      <div class="status-line" role="alert" aria-live="assertive">
        <span class="status-dot status-dot--error" aria-hidden="true"></span>
        <span>Authentication failed</span>
      </div>

      <h1 class="heading" id="card-heading">
        Something went wrong
      </h1>

      <p class="body-text">
        Authorization could not be completed. The details below may help if you
        need to report this.
      </p>

      <div class="error-block" role="region" aria-label="Error details">
        <p>{escaped_message}</p>
      </div>
      {retry_button}

      <div class="divider" role="separator" aria-hidden="true"></div>

      <p class="footer">
        Maccing · Google Workspace
      </p>

    </article>
  </main>

</body>
</html>"""
