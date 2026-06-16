import type { IncomingMessage, ServerResponse } from 'node:http';
import { authorizeAndListInstallations } from '../_lib/githubAppOAuth';
import { GitHubAppApiError, GitHubAppNotConfiguredError } from '../_lib/githubAppTypes';

type QueryValue = string | string[] | undefined;
type VercelLikeRequest = IncomingMessage & {
  query?: Record<string, QueryValue>;
};

function firstValue(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value;
}

function queryFromRequest(req: VercelLikeRequest) {
  if (req.query) return req.query;
  const parsed = new URL(req.url || '/', 'https://shipseal.local');
  return {
    code: parsed.searchParams.get('code') || undefined,
    error: parsed.searchParams.get('error') || undefined,
    error_description: parsed.searchParams.get('error_description') || undefined,
  };
}

function htmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sendHtml(res: ServerResponse, status: number, payload: Record<string, unknown>, title: string) {
  const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${htmlEscape(title)}</title>
  </head>
  <body>
    <p>${htmlEscape(title)}</p>
    <p><a href="/#scan">Return to ShipSeal</a></p>
    <script>
      (function () {
        var message = ${safeJson};
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(message, window.location.origin);
        }
        window.setTimeout(function () { window.close(); }, 100);
      }());
    </script>
  </body>
</html>`);
}

function errorPayload(code: string, message: string) {
  return {
    source: 'shipseal-github-connect',
    status: 'error',
    code,
    message,
  };
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  if (req.method && req.method !== 'GET') {
    sendHtml(res, 405, errorPayload('github_api_error', 'Use GET.'), 'GitHub connection failed.');
    return;
  }

  const query = queryFromRequest(req);
  const error = (firstValue(query.error) || '').trim();
  const code = (firstValue(query.code) || '').trim();

  if (error || !code) {
    sendHtml(
      res,
      400,
      errorPayload('user_authorization_failed', error || 'GitHub authorization did not return a code.'),
      'GitHub authorization was not completed.'
    );
    return;
  }

  try {
    const installations = await authorizeAndListInstallations(code);
    const payload = {
      source: 'shipseal-github-connect',
      status: 'ok',
      installationId: installations.length === 1 ? String(installations[0].id) : undefined,
      installations: installations.map(installation => ({
        ...installation,
        id: String(installation.id),
      })),
    };
    sendHtml(res, 200, payload, 'GitHub connected. You can return to ShipSeal.');
  } catch (err) {
    if (err instanceof GitHubAppNotConfiguredError) {
      sendHtml(res, 501, errorPayload(err.code, err.message), 'GitHub connection is not configured.');
      return;
    }
    if (err instanceof GitHubAppApiError) {
      sendHtml(res, err.status >= 400 && err.status < 600 ? err.status : 502, errorPayload(err.code, err.message), 'GitHub connection failed.');
      return;
    }
    sendHtml(res, 502, errorPayload('github_api_error', 'GitHub connection failed.'), 'GitHub connection failed.');
  }
}
