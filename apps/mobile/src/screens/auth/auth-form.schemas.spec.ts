import { OtpVerifySchema, RegisterSchema } from '@motogram/shared';

import { LoginFormSchema, RegisterScreenFormSchema } from './auth-form.schemas';

describe('LoginFormSchema (R6)', () => {
  it('trims identifier before min length check', () => {
    const r = LoginFormSchema.safeParse({ identifier: '  bob  ', password: 'secret12' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.identifier).toBe('bob');
  });

  it('rejects identifier shorter than 3 after trim', () => {
    const r = LoginFormSchema.safeParse({ identifier: '  ab ', password: 'x' });
    expect(r.success).toBe(false);
  });

  it('rejects empty password', () => {
    const r = LoginFormSchema.safeParse({ identifier: 'alice', password: '' });
    expect(r.success).toBe(false);
  });

  it('accepts valid credentials', () => {
    const r = LoginFormSchema.safeParse({ identifier: 'alice@ex.com', password: 'x' });
    expect(r.success).toBe(true);
  });
});

describe('RegisterScreenFormSchema (R6)', () => {
  const base = {
    email: '  User@EXAMPLE.com  ',
    username: 'Valid_User',
    password: 'password1',
    name: '',
    eulaAccepted: true,
    preferredLanguage: 'tr' as const,
  };

  it('lowercases email and username', () => {
    const r = RegisterScreenFormSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe('user@example.com');
      expect(r.data.username).toBe('valid_user');
    }
  });

  it('fails when EULA not accepted', () => {
    const r = RegisterScreenFormSchema.safeParse({ ...base, eulaAccepted: false });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === 'eula_required')).toBe(true);
    }
  });

  it('maps to RegisterDto via RegisterSchema.parse', () => {
    const r = RegisterScreenFormSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (!r.success) return;
    const dto = RegisterSchema.parse({
      email: r.data.email,
      username: r.data.username,
      password: r.data.password,
      name: r.data.name ? r.data.name : undefined,
      eulaAccepted: true,
      preferredLanguage: r.data.preferredLanguage,
    });
    expect(dto.eulaAccepted).toBe(true);
    expect(dto.email).toBe('user@example.com');
  });
});

describe('OtpVerifySchema (OTP ekrani, R6)', () => {
  const phone = '+905551112233';

  it('accepts 6 digit code', () => {
    const r = OtpVerifySchema.safeParse({ phoneNumber: phone, code: '123456' });
    expect(r.success).toBe(true);
  });

  it('rejects short code', () => {
    const r = OtpVerifySchema.safeParse({ phoneNumber: phone, code: '12345' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid E.164 phone', () => {
    const r = OtpVerifySchema.safeParse({ phoneNumber: '0555', code: '123456' });
    expect(r.success).toBe(false);
  });
});
