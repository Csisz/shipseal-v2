import { describe, expect, it } from 'vitest';
import {
  buildGitHubArchiveUrl,
  validateGitHubArchiveParams,
} from '../../api/github-archive';

describe('Vercel GitHub archive proxy helpers', () => {
  it('builds a GitHub codeload archive URL from validated params', () => {
    const params = validateGitHubArchiveParams({ owner: 'Csisz', repo: 'shipseal', ref: 'main' });

    expect(params).toEqual({ owner: 'Csisz', repo: 'shipseal', ref: 'main' });
    if ('error' in params) throw new Error(params.error);

    expect(buildGitHubArchiveUrl(params)).toBe('https://codeload.github.com/Csisz/shipseal/zip/main');
  });

  it('defaults ref to HEAD and strips .git from repo', () => {
    const params = validateGitHubArchiveParams({ owner: 'Csisz', repo: 'shipseal.git' });

    expect(params).toEqual({ owner: 'Csisz', repo: 'shipseal', ref: 'HEAD' });
  });

  it('rejects invalid owner, repo, and ref values', () => {
    expect(validateGitHubArchiveParams({ owner: 'bad owner', repo: 'shipseal', ref: 'main' }))
      .toEqual({ status: 400, error: 'Invalid GitHub owner parameter.' });
    expect(validateGitHubArchiveParams({ owner: 'Csisz', repo: '../shipseal', ref: 'main' }))
      .toEqual({ status: 400, error: 'Invalid GitHub repo parameter.' });
    expect(validateGitHubArchiveParams({ owner: 'Csisz', repo: 'shipseal', ref: '../main' }))
      .toEqual({ status: 400, error: 'Invalid GitHub ref parameter.' });
  });
});
