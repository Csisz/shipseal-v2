import type { IncomingMessage } from 'node:http';

export type AuthConfigArea = 'github-oauth' | 'github-app' | 'account-oauth';

export class AuthConfigurationError extends Error {
  constructor(
    public readonly area: AuthConfigArea,
    public readonly code: string,
    message: string,
    public readonly missingEnv: string[] = [],
    public readonly invalidFields: string[] = []
  ) {
    super(message);
    this.name = 'AuthConfigurationError';
  }
}

export interface AuthConfigDiagnostics {
  area: AuthConfigArea;
  configured: boolean;
  missingEnv: string[];
  invalidFields: string[];
  callbackUrlConfigured?: boolean;
  callbackUrlUsable?: boolean;
  apiBaseUrlUsable?: boolean;
  persistenceConfigured?: boolean;
}

type HeaderRequest = Pick<IncomingMessage, 'headers'>;

function clean(value: string | undefined) {
  return (value || '').trim();
}

function firstHeader(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value || '').split(',')[0].trim();
}

function isProduction(env: NodeJS.ProcessEnv) {
  return env.VERCEL === '1' || env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production';
}

function parseHttpsServiceUrl(value: string, field: string, env: NodeJS.ProcessEnv, area: AuthConfigArea) {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    if (isProduction(env) && parsed.protocol !== 'https:') throw new Error();
    if (isProduction(env) && /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)) throw new Error();
    return parsed;
  } catch {
    throw new AuthConfigurationError(area, 'invalid_api_base_url', `${field} is not a usable service URL.`, [], [field]);
  }
}

export function getGitHubApiBaseUrl(env: NodeJS.ProcessEnv = process.env, area: Extract<AuthConfigArea, 'github-oauth' | 'github-app'> = 'github-oauth') {
  const value = clean(env.GITHUB_API_BASE_URL) || 'https://api.github.com';
  const parsed = parseHttpsServiceUrl(value, 'GITHUB_API_BASE_URL', env, area);
  return parsed.toString().replace(/\/+$/, '');
}

export function validateGitHubClientId(clientId: string) {
  return !!clientId
    && clientId.length >= 8
    && clientId.length <= 128
    && /^[A-Za-z0-9._-]+$/.test(clientId)
    && !/PRIVATE_KEY|BEGIN|END|-----|github_pat_|gh[pousr]_|sk-/i.test(clientId);
}

export function getGitHubOAuthConfig(env: NodeJS.ProcessEnv = process.env) {
  const clientId = clean(env.GITHUB_APP_CLIENT_ID);
  const clientSecret = clean(env.GITHUB_APP_CLIENT_SECRET);
  const missingEnv = [
    ...(!clientId ? ['GITHUB_APP_CLIENT_ID'] : []),
    ...(!clientSecret ? ['GITHUB_APP_CLIENT_SECRET'] : []),
  ];
  const invalidFields = clientId && !validateGitHubClientId(clientId) ? ['GITHUB_APP_CLIENT_ID'] : [];
  if (missingEnv.length || invalidFields.length) {
    throw new AuthConfigurationError(
      'github-oauth',
      missingEnv.includes('GITHUB_APP_CLIENT_ID') ? 'missing_client_id' : missingEnv.length ? 'missing_client_secret' : 'invalid_client_id_format',
      'GitHub login is not configured correctly.',
      missingEnv,
      invalidFields
    );
  }
  return { clientId, clientSecret, apiBaseUrl: getGitHubApiBaseUrl(env) };
}

export function resolveGitHubOAuthCallbackUrl(
  req: HeaderRequest,
  explicit = '',
  env: NodeJS.ProcessEnv = process.env
) {
  let value = clean(explicit) || clean(env.GITHUB_APP_CALLBACK_URL);
  if (!value) {
    const host = firstHeader(req.headers?.['x-forwarded-host']) || firstHeader(req.headers?.host) || 'localhost:8080';
    const proto = firstHeader(req.headers?.['x-forwarded-proto']) || (host.includes('localhost') ? 'http' : 'https');
    value = `${proto}://${host}/api/github-app/oauth-callback`;
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AuthConfigurationError('github-oauth', 'invalid_callback_url', 'GitHub App callback URL is invalid.', [], ['GITHUB_APP_CALLBACK_URL']);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/api/github-app/oauth-callback'
    || (isProduction(env) && parsed.protocol !== 'https:')
    || (isProduction(env) && /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname))) {
    throw new AuthConfigurationError('github-oauth', 'invalid_callback_url', 'GitHub App callback URL must point to /api/github-app/oauth-callback and use a public HTTPS origin in production.', [], ['GITHUB_APP_CALLBACK_URL']);
  }
  return parsed.toString();
}

export function normalizeGitHubPrivateKey(value: string) {
  return value.trim().replace(/\\n/g, '\n');
}

export function getGitHubInstallationConfig(env: NodeJS.ProcessEnv = process.env) {
  const appId = clean(env.GITHUB_APP_ID);
  const privateKey = normalizeGitHubPrivateKey(env.GITHUB_APP_PRIVATE_KEY || '');
  const missingEnv = [...(!appId ? ['GITHUB_APP_ID'] : []), ...(!privateKey ? ['GITHUB_APP_PRIVATE_KEY'] : [])];
  const invalidFields = privateKey && (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(privateKey) || !/-----END [A-Z ]*PRIVATE KEY-----/.test(privateKey))
    ? ['GITHUB_APP_PRIVATE_KEY']
    : [];
  if (missingEnv.length || invalidFields.length) {
    throw new AuthConfigurationError(
      'github-app',
      missingEnv.includes('GITHUB_APP_ID') ? 'missing_app_id' : missingEnv.length ? 'missing_private_key' : 'invalid_private_key_format',
      'GitHub App installation access is not configured correctly.',
      missingEnv,
      invalidFields
    );
  }
  return { appId, privateKey, apiBaseUrl: getGitHubApiBaseUrl(env, 'github-app') };
}

export function getAccountOAuthConfig(env: NodeJS.ProcessEnv = process.env) {
  const clientId = clean(env.SHIPSEAL_ACCOUNT_GITHUB_CLIENT_ID);
  const clientSecret = clean(env.SHIPSEAL_ACCOUNT_GITHUB_CLIENT_SECRET);
  const callbackUrl = clean(env.SHIPSEAL_ACCOUNT_GITHUB_CALLBACK_URL);
  const databaseUrl = clean(env.DATABASE_URL);
  const missingEnv = [
    ...(!clientId ? ['SHIPSEAL_ACCOUNT_GITHUB_CLIENT_ID'] : []),
    ...(!clientSecret ? ['SHIPSEAL_ACCOUNT_GITHUB_CLIENT_SECRET'] : []),
    ...(!callbackUrl ? ['SHIPSEAL_ACCOUNT_GITHUB_CALLBACK_URL'] : []),
    ...(!databaseUrl ? ['DATABASE_URL'] : []),
  ];
  const invalidFields: string[] = [];
  let parsed: URL | undefined;
  if (callbackUrl) {
    try { parsed = new URL(callbackUrl); } catch { invalidFields.push('SHIPSEAL_ACCOUNT_GITHUB_CALLBACK_URL'); }
    if (parsed && (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/api/account/callback'
      || (isProduction(env) && parsed.protocol !== 'https:')
      || (isProduction(env) && /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)))) {
      invalidFields.push('SHIPSEAL_ACCOUNT_GITHUB_CALLBACK_URL');
    }
  }
  if (clientId && !validateGitHubClientId(clientId)) invalidFields.push('SHIPSEAL_ACCOUNT_GITHUB_CLIENT_ID');
  if (missingEnv.length || invalidFields.length) {
    throw new AuthConfigurationError('account-oauth', 'account_auth_not_configured', 'ShipSeal account sign-in is unavailable on this deployment.', missingEnv, invalidFields);
  }
  return { clientId, clientSecret, callbackUrl: parsed!.toString(), databaseUrl };
}

export function inspectAuthConfiguration(area: AuthConfigArea, env: NodeJS.ProcessEnv = process.env): AuthConfigDiagnostics {
  try {
    if (area === 'github-oauth') {
      getGitHubOAuthConfig(env);
      return { area, configured: true, missingEnv: [], invalidFields: [], callbackUrlConfigured: !!clean(env.GITHUB_APP_CALLBACK_URL), apiBaseUrlUsable: true };
    }
    if (area === 'github-app') {
      getGitHubInstallationConfig(env);
      return { area, configured: true, missingEnv: [], invalidFields: [], apiBaseUrlUsable: true };
    }
    getAccountOAuthConfig(env);
    return { area, configured: true, missingEnv: [], invalidFields: [], callbackUrlConfigured: true, callbackUrlUsable: true, persistenceConfigured: true };
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return {
        area,
        configured: false,
        missingEnv: error.missingEnv,
        invalidFields: error.invalidFields,
        callbackUrlConfigured: area === 'account-oauth' ? !!clean(env.SHIPSEAL_ACCOUNT_GITHUB_CALLBACK_URL) : area === 'github-oauth' ? !!clean(env.GITHUB_APP_CALLBACK_URL) : undefined,
        callbackUrlUsable: error.invalidFields.every(field => !field.includes('CALLBACK_URL')),
        apiBaseUrlUsable: !error.invalidFields.includes('GITHUB_API_BASE_URL'),
        persistenceConfigured: area === 'account-oauth' ? !!clean(env.DATABASE_URL) : undefined,
      };
    }
    return { area, configured: false, missingEnv: [], invalidFields: ['unknown_configuration_error'] };
  }
}

export function safeAuthDiagnostic(error: unknown) {
  if (error instanceof AuthConfigurationError) {
    return { area: error.area, code: error.code, missingEnv: error.missingEnv, invalidFields: error.invalidFields };
  }
  return { area: 'unknown', code: 'route_failure', missingEnv: [], invalidFields: [] };
}
