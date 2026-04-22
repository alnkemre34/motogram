import { LoginSchema, OtpVerifySchema, RegisterSchema } from './auth.schema';

// Spec 7.3.6 - Zod SSOT tests validate SPEC rules directly
// Spec 9.2 - EULA literal(true) zorunlu

describe('RegisterSchema (Spec 7.3.6, 9.2)', () => {
  const base = {
    email: 'alice@example.com',
    username: 'alice_01',
    password: 'secret123',
    eulaAccepted: true as const,
  };

  it('accepts a valid registration payload', () => {
    const res = RegisterSchema.safeParse(base);
    expect(res.success).toBe(true);
  });

  it('rejects when EULA is NOT explicitly true (Spec 9.2 App Store UGC kurali)', () => {
    const res = RegisterSchema.safeParse({ ...base, eulaAccepted: false });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]!.message).toBe('eula_required');
    }
  });

  it('rejects when EULA is missing', () => {
    const { eulaAccepted: _, ...rest } = base;
    const res = RegisterSchema.safeParse(rest);
    expect(res.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const res = RegisterSchema.safeParse({ ...base, email: 'not-an-email' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.message === 'email_invalid')).toBe(true);
    }
  });

  it('rejects username shorter than 3 chars', () => {
    const res = RegisterSchema.safeParse({ ...base, username: 'ab' });
    expect(res.success).toBe(false);
  });

  it('rejects username with invalid chars (space, symbols)', () => {
    const res = RegisterSchema.safeParse({ ...base, username: 'alice rider!' });
    expect(res.success).toBe(false);
  });

  it('rejects password shorter than 8 chars (Spec 7.3.6)', () => {
    const res = RegisterSchema.safeParse({ ...base, password: 'short' });
    expect(res.success).toBe(false);
  });

  it('defaults preferredLanguage to "tr"', () => {
    const res = RegisterSchema.safeParse(base);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.preferredLanguage).toBe('tr');
    }
  });
});

describe('LoginSchema', () => {
  it('requires identifier and password', () => {
    const res = LoginSchema.safeParse({ identifier: '', password: '' });
    expect(res.success).toBe(false);
  });

  it('accepts either username or email as identifier', () => {
    expect(LoginSchema.safeParse({ identifier: 'alice', password: 'x' }).success).toBe(true);
    expect(
      LoginSchema.safeParse({ identifier: 'alice@example.com', password: 'x' }).success,
    ).toBe(true);
  });
});

describe('OtpVerifySchema (Spec 9.2 OTP)', () => {
  it('requires E.164 phone format', () => {
    const res = OtpVerifySchema.safeParse({ phoneNumber: '5551234567', code: '123456' });
    expect(res.success).toBe(false);
  });

  it('requires 6-digit code', () => {
    const res = OtpVerifySchema.safeParse({ phoneNumber: '+905551234567', code: 'ABC' });
    expect(res.success).toBe(false);
  });

  it('accepts valid E.164 + 6 digits', () => {
    const res = OtpVerifySchema.safeParse({ phoneNumber: '+905551234567', code: '123456' });
    expect(res.success).toBe(true);
  });
});
