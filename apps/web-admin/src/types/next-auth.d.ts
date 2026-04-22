// NextAuth session + JWT tiplerini genislet.
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    userId: string;
    role: 'ADMIN' | 'MODERATOR' | 'USER';
    accessToken?: string;
  }

  interface User {
    id: string;
    role: 'ADMIN' | 'MODERATOR' | 'USER';
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: 'ADMIN' | 'MODERATOR' | 'USER';
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
  }
}
