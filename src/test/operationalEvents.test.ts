import { describe, expect, it } from 'vitest';
import { isAdminSession, adminUserIds } from '../../api/_lib/adminAuth';
import { sanitizeOperationalMetadata, supportReference } from '../../api/_lib/operationalEvents';
import { operationSupportReference } from '@/lib/supportReference';

describe('production operational observability', () => {
  it('redacts sensitive operational metadata while retaining safe counters', () => {
    expect(sanitizeOperationalMetadata({ durationMs: 120, provider: 'configured', prompt: 'secret', source: 'private' })).toEqual({ durationMs: 120, provider: 'configured' });
  });
  it('creates a stable short support reference without exposing a full operation identifier', () => {
    const reference = supportReference('aop_01JABCDEF123456789');
    expect(reference).toMatch(/^RI-[A-Z0-9]{1,10}$/);
    expect(reference).not.toContain('aop_');
    expect(reference).toBe(operationSupportReference('aop_01JABCDEF123456789'));
  });
  it('authorizes only server-configured operator user IDs', () => {
    const session = { user: { id: 'usr_admin', email: null, displayName: null, avatarUrl: null }, id: 'ses_1', expiresAt: '', createdAt: '' };
    expect(adminUserIds({ SHIPSEAL_ADMIN_USER_IDS: 'usr_admin, usr_other' })).toEqual(new Set(['usr_admin', 'usr_other']));
    expect(isAdminSession(session, { SHIPSEAL_ADMIN_USER_IDS: 'usr_admin' })).toBe(true);
    expect(isAdminSession(session, { SHIPSEAL_ADMIN_USER_IDS: 'usr_other' })).toBe(false);
    expect(isAdminSession(null, { SHIPSEAL_ADMIN_USER_IDS: 'usr_admin' })).toBe(false);
  });
});
