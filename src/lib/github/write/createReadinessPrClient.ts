import type {
  CreateGitHubAppReadinessPrPayload,
  CreateGitHubAppReadinessPrResponse,
  CreateReadinessPrPayload,
  CreateReadinessPrResponse,
} from './types';

export class CreateReadinessPrClientError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'CreateReadinessPrClientError';
  }
}

export async function createReadinessPr(payload: CreateReadinessPrPayload): Promise<CreateReadinessPrResponse> {
  const response = await fetch('/api/create-readiness-pr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);

  if (!response.ok) {
    throw new CreateReadinessPrClientError(errorMessage(data) || 'Create Readiness PR failed.', response.status);
  }

  return data as CreateReadinessPrResponse;
}

export async function createGitHubAppReadinessPr(payload: CreateGitHubAppReadinessPrPayload): Promise<CreateGitHubAppReadinessPrResponse> {
  const response = await fetch('/api/github-app/create-readiness-pr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);

  if (!response.ok) {
    throw new CreateReadinessPrClientError(errorMessage(data) || 'Create Readiness PR failed.', response.status);
  }

  return data as CreateGitHubAppReadinessPrResponse;
}

function errorMessage(data: Awaited<ReturnType<typeof readJson>>) {
  return data && 'error' in data && typeof data.error === 'string' ? data.error : undefined;
}

async function readJson(response: Response): Promise<{ error?: string } | CreateReadinessPrResponse | CreateGitHubAppReadinessPrResponse | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
