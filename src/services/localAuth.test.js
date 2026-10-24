import { beforeEach, describe, expect, it } from 'vitest';
import { getLocalUser, loginLocalAccount, registerLocalAccount } from './localAuth.js';

describe('browser-local accounts', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('registers an account, stores only a password hash, and supports login after reload', async () => {
    const registered = await registerLocalAccount({
      name: 'Local User',
      email: 'LOCAL@example.com',
      password: 'password123',
    });
    const savedUsers = globalThis.localStorage.getItem('study-planner-local-users');

    expect(registered.local).toBe(true);
    expect(registered.user.email).toBe('local@example.com');
    expect(savedUsers).not.toContain('password123');
    expect(savedUsers).toContain('passwordHash');
    expect(getLocalUser(registered.token)).toEqual(registered.user);
    await expect(loginLocalAccount({ email: 'LOCAL@example.com', password: 'password123' }))
      .resolves.toMatchObject({ user: registered.user, local: true });
  });

  it('rejects a wrong password and a duplicate local registration with a different password', async () => {
    await registerLocalAccount({ name: 'Local User', email: 'local@example.com', password: 'password123' });

    await expect(loginLocalAccount({ email: 'local@example.com', password: 'wrongpass' }))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(registerLocalAccount({ name: 'Other User', email: 'local@example.com', password: 'otherpass123' }))
      .rejects.toMatchObject({ code: 'EMAIL_EXISTS' });
  });
});
