import { describe, expect, it } from 'vitest';
import { validateAuthResponse } from './authSession.js';

describe('validateAuthResponse', () => {
  it('returns a complete authentication result', () => {
    const result = { token: 'valid-token', user: { id: 1, name: 'User' } };
    expect(validateAuthResponse(result)).toBe(result);
  });

  it.each([undefined, null, {}, { user: { id: 1 } }, { token: 'token' }])(
    'rejects an incomplete authentication result: %j',
    (result) => {
      expect(() => validateAuthResponse(result)).toThrow('Respons login dari server tidak lengkap. Coba lagi.');
    },
  );
});
