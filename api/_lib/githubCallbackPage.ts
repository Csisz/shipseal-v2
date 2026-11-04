function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeInternalUrl(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

export function renderGitHubTransitionPage(input: {
  payload: Record<string, unknown>;
  title: string;
  message: string;
  nextUrl?: string;
  fallbackUrl?: string;
  notifyOpener?: boolean;
  closePopup?: boolean;
}) {
  const payload = JSON.stringify(input.payload).replace(/</g, '\\u003c');
  const nextUrl = safeInternalUrl(input.nextUrl, '');
  const fallbackUrl = safeInternalUrl(input.fallbackUrl, '/#scan');
  const notifyOpener = input.notifyOpener !== false;
  const closePopup = input.closePopup !== false;
  const continueUrl = nextUrl || fallbackUrl;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <title>${escapeHtml(input.title)}</title>
    <style>
      :root { color-scheme: dark; --bg: #080b12; --panel: #111622; --text: #f6f7fb; --muted: #a3adbd; --line: #293244; --accent: #a7f3d0; }
      @media (prefers-color-scheme: light) { :root { color-scheme: light; --bg: #f6f8fb; --panel: #ffffff; --text: #111827; --muted: #5f6b7a; --line: #dbe1ea; --accent: #047857; } }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(100%, 420px); border: 1px solid var(--line); border-radius: 20px; background: var(--panel); padding: 32px; text-align: center; box-shadow: 0 24px 80px rgba(0,0,0,.18); }
      .mark { width: 44px; height: 44px; margin: 0 auto 18px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 14px; color: var(--accent); }
      .mark::after { content: ""; width: 10px; height: 10px; border-radius: 999px; background: currentColor; box-shadow: 0 0 20px currentColor; animation: breathe 1.4s ease-in-out infinite; }
      h1 { margin: 0; font-size: 22px; line-height: 1.25; }
      p { margin: 12px 0 0; color: var(--muted); font-size: 14px; line-height: 1.6; }
      a { display: inline-flex; margin-top: 22px; color: var(--text); font-size: 13px; font-weight: 650; text-underline-offset: 4px; }
      @keyframes breathe { 50% { transform: scale(.72); opacity: .55; } }
      @media (prefers-reduced-motion: reduce) { .mark::after { animation: none; } }
    </style>
  </head>
  <body>
    <main>
      <div class="mark" aria-hidden="true"></div>
      <h1>${escapeHtml(input.title)}</h1>
      <p>${escapeHtml(input.message)}</p>
      <a href="${escapeHtml(continueUrl)}">Continue to ShipSeal</a>
    </main>
    <script>
      (function () {
        var payload = ${payload};
        var hasOpener = Boolean(window.opener && !window.opener.closed);
        if (hasOpener && ${notifyOpener ? 'true' : 'false'}) {
          window.opener.postMessage(payload, window.location.origin);
          try { window.opener.focus(); } catch (_) {}
        }
        ${nextUrl ? `window.setTimeout(function () { window.location.replace(${JSON.stringify(nextUrl)}); }, 450);` : ''}
        ${!nextUrl && closePopup ? `if (hasOpener) window.setTimeout(function () { window.close(); }, 500);` : ''}
        ${!nextUrl ? `if (!hasOpener) window.setTimeout(function () { window.location.replace(${JSON.stringify(fallbackUrl)}); }, 700);` : ''}
      }());
    </script>
  </body>
</html>`;
}
