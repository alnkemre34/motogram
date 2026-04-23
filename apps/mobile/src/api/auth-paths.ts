/** POST OAuth — yollar `docs/API_Contract.md` ile aynı (v1 /auth prefix). */
export const authPaths = {
  oauthApple: '/auth/oauth/apple',
  oauthGoogle: '/auth/oauth/google',
} as const;
