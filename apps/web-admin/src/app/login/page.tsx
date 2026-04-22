'use client';

// Spec 5.4 + 9.2 - Admin paneli login ekrani.
// NextAuth credentials provider'a istek atar; basarili olursa /dashboard'a yonlendirir.
// Next.js 14: useSearchParams() Suspense boundary icinde olmali.
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const errorParam = search?.get('error');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam === 'forbidden' ? 'Bu hesabin admin paneline erisim izni yok.' : null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn('credentials', {
      identifier,
      password,
      redirect: false,
    });
    setLoading(false);
    if (!result?.ok) {
      setError('Giris basarisiz. Kimlik bilgilerinizi kontrol edin.');
      return;
    }
    router.push('/dashboard');
  }

  return (
    <div className="card w-full max-w-md">
      <h1 className="mb-1 text-2xl font-semibold text-accent">Motogram Admin</h1>
      <p className="mb-6 text-sm text-textMuted">
        Yonetici paneline erismek icin giris yapin. Sadece ADMIN ve MODERATOR roller giris yapabilir.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-textMuted">
            E-posta veya kullanici adi
          </label>
          <input
            className="input"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-textMuted">Sifre</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && <div className="text-sm text-accentDanger">{error}</div>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Giris yapiliyor...' : 'Giris Yap'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Suspense
        fallback={
          <div className="card w-full max-w-md">
            <div className="text-sm text-textMuted">Yukleniyor...</div>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
