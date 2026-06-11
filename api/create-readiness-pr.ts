import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createReadinessPrOnGitHub,
  isValidationError,
  userFacingGitHubWriteError,
  validateCreateReadinessPrRequest,
} from './_lib/githubWrite';

const MAX_BODY_BYTES = 768 * 1024;

type VercelLikeRequest = IncomingMessage & {
  body?: unknown;
};

async function readJsonBody(req: VercelLikeRequest): Promise<unknown> {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return JSON.parse(req.body);
    return req.body;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_BODY_BYTES) throw new Error('payload-too-large');
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, error instanceof Error && error.message === 'payload-too-large' ? 413 : 400, {
      error: error instanceof Error && error.message === 'payload-too-large'
        ? 'Create Readiness PR payload is too large.'
        : 'Invalid JSON payload.',
    });
    return;
  }

  const validated = validateCreateReadinessPrRequest(body);
  if (isValidationError(validated)) {
    sendJson(res, validated.status, { error: validated.error });
    return;
  }

  try {
    const result = await createReadinessPrOnGitHub(validated);
    sendJson(res, 200, {
      ok: true,
      pullRequestUrl: result.pullRequestUrl,
      branchName: result.branchName,
      baseBranch: result.baseBranch,
      fileCount: result.fileCount,
    });
  } catch (error) {
    const mapped = userFacingGitHubWriteError(error);
    sendJson(res, mapped.status, { error: mapped.error });
  }
}
