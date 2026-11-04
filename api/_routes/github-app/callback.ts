import type { ServerResponse, IncomingMessage } from 'node:http';
import { getGitHubAppInstallationSummary } from '../../_lib/githubAppAuth.js';
import { listUserInstallations } from '../../_lib/githubAppOAuth.js';
import { GitHubAppApiError } from '../../_lib/githubAppTypes.js';
import { renderGitHubTransitionPage } from '../../_lib/githubCallbackPage.js';
import { addAuthorizedGitHubInstallation, consumeGitHubFlowState, GitHubConnectionSessionError, readPendingGitHubUserToken, requireGitHubConnectionSession } from '../../_lib/githubConnectionSession.js';

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

export function buildGitHubAppCallbackRedirect(input: { installationId: string; setupAction?: string }) {
  const params = new URLSearchParams({ githubConnection: 'connected' });
  if (input.setupAction) params.set('githubSetupAction', input.setupAction);
  return `/?${params.toString()}#scan`;
}

function sendPopupResult(res: ServerResponse, status: number, payload: Record<string, unknown>, title: string, options: { message?: string; fallbackUrl?: string } = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(renderGitHubTransitionPage({
    payload,
    title,
    message: options.message || 'Returning to ShipSeal…',
    fallbackUrl: options.fallbackUrl || '/?githubConnection=reconnect-required#scan',
  }));
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  const query = queryFromRequest(req);
  const installationId = (firstValue(query.installation_id) || '').trim();
  const setupAction = (firstValue(query.setup_action) || '').trim();
  const state = (firstValue(query.state) || '').trim();

  if (!consumeGitHubFlowState(req, res, 'setup', state)) {
    sendPopupResult(res, 400, {
      type: 'shipseal:github-error', source: 'shipseal-github-connect', status: 'error',
      code: 'invalid_oauth_state', message: 'GitHub setup expired or could not be verified. Reconnect GitHub.',
    }, 'GitHub setup could not be verified', { message: 'Return to ShipSeal and start the connection again.' });
    return;
  }

  if (!/^[0-9]+$/.test(installationId)) {
    sendPopupResult(res, 400, {
      type: 'shipseal:github-error', source: 'shipseal-github-connect', status: 'error',
      code: 'user_authorization_failed', message: 'GitHub App installation was cancelled.',
    }, 'Repository selection was cancelled', { message: 'No repository permissions were changed.' });
    return;
  }

  try {
    const session = requireGitHubConnectionSession(req);
    const pendingUserToken = readPendingGitHubUserToken(req);
    if (!pendingUserToken || pendingUserToken.githubUserId !== session.githubUserId) {
      throw new GitHubConnectionSessionError(401, 'github_session_expired', 'GitHub authorization expired. Reconnect GitHub.');
    }
    const visibleInstallations = await listUserInstallations(pendingUserToken.token, { apiBaseUrl: pendingUserToken.apiBaseUrl });
    if (!visibleInstallations.some(installation => String(installation.id) === installationId)) {
      throw new GitHubConnectionSessionError(403, 'installation_not_authorized', 'This installation is not authorized for the connected GitHub user.');
    }
    const installation = await getGitHubAppInstallationSummary(installationId);
    addAuthorizedGitHubInstallation(req, res, installation);
    sendPopupResult(res, 200, {
      type: 'shipseal:github-connected', source: 'shipseal-github-connect', status: 'ok',
      setupAction: setupAction || 'install', installationId,
      installations: [{ ...installation, id: String(installation.id) }],
    }, 'Repositories are ready', {
      message: 'ShipSeal is refreshing your authorized repositories.',
      fallbackUrl: `/?githubConnection=connected&githubSetupAction=${encodeURIComponent(setupAction || 'install')}#scan`,
    });
  } catch (error) {
    const status = error instanceof GitHubConnectionSessionError || error instanceof GitHubAppApiError ? error.status : 502;
    const code = error instanceof GitHubConnectionSessionError || error instanceof GitHubAppApiError ? error.code : 'github_api_error';
    sendPopupResult(res, status, {
      type: 'shipseal:github-error', source: 'shipseal-github-connect', status: 'error',
      code,
      message: error instanceof GitHubConnectionSessionError
        ? error.message
        : error instanceof GitHubAppApiError && error.code === 'user_authorization_failed'
          ? 'GitHub authorization expired or was revoked. Reconnect GitHub.'
        : 'ShipSeal could not verify the GitHub App installation. Retry or reconnect GitHub.',
    }, 'GitHub setup needs attention', { message: 'Return to ShipSeal for a safe recovery option.' });
  }
}
