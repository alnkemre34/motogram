const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS: string[] = ['https://accounts.google.com', 'accounts.google.com'];

export type AppleIdTokenClaims = { sub: string; email?: string };
export type GoogleIdTokenClaims = { sub: string; email: string; name?: string };

export async function verifyAppleIdentityToken(
  identityToken: string,
  audience: string,
): Promise<AppleIdTokenClaims> {
  const jose = await import('jose');
  const APPLE_JWKS = jose.createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  const { payload } = await jose.jwtVerify(identityToken, APPLE_JWKS, {
    issuer: APPLE_ISSUER,
    audience,
  });
  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  if (!sub) {
    throw new Error('apple_token_missing_sub');
  }
  const email = typeof payload.email === 'string' ? payload.email : undefined;
  return { sub, email };
}

export async function verifyGoogleIdToken(
  idToken: string,
  audiences: string[],
): Promise<GoogleIdTokenClaims> {
  if (audiences.length === 0) {
    throw new Error('google_audiences_empty');
  }
  const jose = await import('jose');
  const GOOGLE_JWKS = jose.createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  const { payload } = await jose.jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience: audiences,
  });
  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email : '';
  if (!sub || !email) {
    throw new Error('google_token_missing_sub_or_email');
  }
  const name = typeof payload.name === 'string' ? payload.name : undefined;
  return { sub, email, name };
}
