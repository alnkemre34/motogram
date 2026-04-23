import { authPaths } from './auth-paths';

describe('authPaths', () => {
  it('matches API contract v1 /auth prefix', () => {
    expect(authPaths.oauthApple).toBe('/auth/oauth/apple');
    expect(authPaths.oauthGoogle).toBe('/auth/oauth/google');
  });
});
