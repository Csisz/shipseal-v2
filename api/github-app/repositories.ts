import type { IncomingMessage, ServerResponse } from 'node:http';
import type { GitHubAppAuthOptions } from '../_lib/githubAppTypes.js';
import { GitHubAppApiError, GitHubAppNotConfiguredError } from '../_lib/githubAppTypes.js';
import { listGitHubAppRepositories } from '../_lib/githubAppClient.js';

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
    installationId: parsed.searchParams.get('installationId') || undefined,
  };
}

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export async function listInstallationRepositories(installationId: string, options: GitHubAppAuthOptions = {}) {
  if (!/^[0-9]+$/.test(installationId)) {
    return {
      status: 400,
      body: {
        status: 'invalid_request',
        code: 'installation_not_found',
        message: 'A valid installationId query parameter is required.',
      },
    };
  }

  try {
    const repositories = await listGitHubAppRepositories(installationId, options);
    return {
      status: 200,
      body: {
        status: 'ok',
        repositories,
      },
    };
  } catch (error) {
    if (error instanceof GitHubAppNotConfiguredError) {
      return {
        status: 501,
        body: {
          status: 'not_configured',
          code: error.code,
          message: 'GitHub App server credentials are not configured yet.',
        },
      };
    }
    if (error instanceof GitHubAppApiError) {
      return {
        status: error.status === 404 ? 404 : 502,
        body: {
          status: 'github_error',
          code: error.code,
          message: error.message,
        },
      };
    }
    return {
      status: 502,
      body: {
        status: 'github_error',
        code: 'github_api_error',
        message: 'GitHub App repository listing failed.',
      },
    };
  }
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  const installationId = (firstValue(queryFromRequest(req).installationId) || '').trim();
  const result = await listInstallationRepositories(installationId);
  sendJson(res, result.status, result.body);
}
