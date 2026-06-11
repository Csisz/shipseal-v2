import type { IncomingMessage, ServerResponse } from 'node:http';

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
    installation_id: parsed.searchParams.get('installation_id') || undefined,
    setup_action: parsed.searchParams.get('setup_action') || undefined,
    state: parsed.searchParams.get('state') || undefined,
  };
}

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function buildGitHubAppCallbackRedirect(input: { installationId: string; setupAction?: string }) {
  const params = new URLSearchParams({ githubInstallationId: input.installationId });
  if (input.setupAction) params.set('githubSetupAction', input.setupAction);
  return `/?${params.toString()}#scan`;
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  const query = queryFromRequest(req);
  const installationId = (firstValue(query.installation_id) || '').trim();
  const setupAction = (firstValue(query.setup_action) || '').trim();

  if (!/^[0-9]+$/.test(installationId)) {
    sendJson(res, 400, {
      status: 'invalid_request',
      message: 'GitHub App callback is missing a valid installation_id.',
    });
    return;
  }

  res.statusCode = 302;
  res.setHeader('Location', buildGitHubAppCallbackRedirect({ installationId, setupAction }));
  res.end();
}
