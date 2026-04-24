import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold text-text">Sayfa bulunamadı</h1>
      <Link href="/login" className="text-accent underline">
        Girişe dön
      </Link>
    </div>
  );
}
