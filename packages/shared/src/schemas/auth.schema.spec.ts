import {
  AuthCapabilitiesSchema,
  ChangeEmailRequestSchema,
  ChangeEmailVerifySchema,
  ChangePasswordSchema,
  ForgotPasswordSchema,
  LoginSchema,
  OtpVerifySchema,
  RegisterSchema,
  ResetPasswordSchema,
} from './auth.schema';

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

describe('ChangePasswordSchema (B-04)', () => {
  it('accepts distinct current and new passwords', () => {
    const res = ChangePasswordSchema.safeParse({
      currentPassword: 'oldpass12',
      newPassword: 'newpass34',
    });
    expect(res.success).toBe(true);
  });

  it('rejects when new equals current', () => {
    const res = ChangePasswordSchema.safeParse({
      currentPassword: 'samepass1',
      newPassword: 'samepass1',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.message === 'password_must_change')).toBe(true);
    }
  });

  it('rejects short passwords', () => {
    expect(
      ChangePasswordSchema.safeParse({ currentPassword: 'short', newPassword: 'also' }).success,
    ).toBe(false);
  });
});

describe('ForgotPasswordSchema (B-05)', () => {
  it('accepts a valid email', () => {
    expect(ForgotPasswordSchema.safeParse({ email: 'a@b.co' }).success).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(ForgotPasswordSchema.safeParse({ email: 'not-email' }).success).toBe(false);
  });
});

describe('ResetPasswordSchema (B-05)', () => {
  it('requires token min 32 and valid new password', () => {
    const token = 't'.repeat(32);
    expect(
      ResetPasswordSchema.safeParse({ token, newPassword: 'validpass1' }).success,
    ).toBe(true);
  });

  it('rejects token shorter than 32', () => {
    expect(
      ResetPasswordSchema.safeParse({ token: 'x'.repeat(31), newPassword: 'validpass1' }).success,
    ).toBe(false);
  });
});

describe('ChangeEmailRequestSchema (B-07)', () => {
  it('accepts newEmail + password', () => {
    expect(
      ChangeEmailRequestSchema.safeParse({
        newEmail: 'a@b.co',
        password: 'password1',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid newEmail', () => {
    expect(
      ChangeEmailRequestSchema.safeParse({ newEmail: 'bad', password: 'password1' }).success,
    ).toBe(false);
  });
});

describe('ChangeEmailVerifySchema (B-07)', () => {
  it('requires token min 32', () => {
    expect(ChangeEmailVerifySchema.safeParse({ token: 't'.repeat(32) }).success).toBe(true);
    expect(ChangeEmailVerifySchema.safeParse({ token: 's'.repeat(31) }).success).toBe(false);
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

describe('AuthCapabilitiesSchema', () => {
  it('accepts otpAuthEnabled boolean', () => {
    expect(AuthCapabilitiesSchema.safeParse({ otpAuthEnabled: true }).success).toBe(true);
    expect(AuthCapabilitiesSchema.safeParse({ otpAuthEnabled: false }).success).toBe(true);
    expect(AuthCapabilitiesSchema.safeParse({}).success).toBe(false);
  });
});
