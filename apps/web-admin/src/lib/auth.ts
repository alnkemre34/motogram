// Spec 5.4 + 9.2 - NextAuth.js Credentials provider.
// Admin panelin giris akisi dogrudan backend /auth/login endpoint'ini cagirir.
// Login basarili + kullanici role'u ADMIN veya MODERATOR degilse erisim reddedilir.
// JWT access token session.accessToken olarak saklanir; API client her istekte
// Authorization: Bearer <accessToken> ekler.
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

interface LoginResponse {
  userId: string;
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
    refreshTokenExpiresIn: number;
  };
}

interface AdminUserLookup {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/v1';

async function loginToBackend(identifier: string, password: string): Promise<LoginResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as LoginResponse;
  } catch {
    return null;
  }
}

async function fetchAdminSelf(accessToken: string): Promise<AdminUserLookup | null> {
  // /admin/users?search=... endpoint'i ile giris yapan kullaniciyi bulamayiz;
  // bunun yerine rol payload JWT icinde zaten var. Burada sadece ek bilgi
  // (email, username) icin /users/me cagrilabilir. Basit tutmak icin atliyoruz.
  void accessToken;
  return null;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 15 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Motogram Admin',
      credentials: {
        identifier: { label: 'E-posta veya kullanici adi', type: 'text' },
        password: { label: 'Sifre', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials.password) return null;
        const result = await loginToBackend(credentials.identifier, credentials.password);
        if (!result) return null;

        // JWT access token'in payload'inda role alani mevcut.
        // Basit base64 decode (next-auth icinde jwt verify yapilmaz; backend zaten
        // yaptigi icin burada sadece role bilgisini okuyoruz).
        let role: 'USER' | 'MODERATOR' | 'ADMIN' = 'USER';
        try {
          const [, payloadB64] = result.tokens.accessToken.split('.');
          if (payloadB64) {
            const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
            if (payload?.role === 'ADMIN' || payload?.role === 'MODERATOR') {
              role = payload.role;
            }
          }
        } catch {
          // token parse edilemiyorsa USER varsayilir -> erisim reddedilir.
        }
        if (role === 'USER') {
          // Admin paneline sadece ADMIN/MODERATOR girebilir.
          return null;
        }

        await fetchAdminSelf(result.tokens.accessToken); // placeholder

        return {
          id: result.userId,
          name: credentials.identifier,
          role,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          accessTokenExpiresAt: Date.now() + result.tokens.accessTokenExpiresIn * 1000,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          role?: 'USER' | 'MODERATOR' | 'ADMIN';
          accessToken?: string;
          refreshToken?: string;
          accessTokenExpiresAt?: number;
        };
        token.userId = user.id;
        token.role = u.role ?? 'USER';
        token.accessToken = u.accessToken;
        token.refreshToken = u.refreshToken;
        token.accessTokenExpiresAt = u.accessTokenExpiresAt;
      }
      return token;
    },
    async session({ session, token }) {
      session.userId = token.userId as string;
      session.role = token.role as 'ADMIN' | 'MODERATOR' | 'USER';
      session.accessToken = token.accessToken as string | undefined;
      return session;
    },
  },
};
