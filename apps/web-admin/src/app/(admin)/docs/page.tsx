// Dokumantasyon + operational runbook kisayolu.
export default function DocsPage() {
  const links = [
    { label: 'Spec', href: '/docs/motogram-spec.md', desc: 'Motogram tam spesifikasyon' },
    { label: 'Phase 1', href: '/docs/phases/phase-1.md', desc: 'Auth + User + Follow' },
    { label: 'Phase 2', href: '/docs/phases/phase-2.md', desc: 'Post/Story/Like/Comment' },
    { label: 'Phase 3', href: '/docs/phases/phase-3.md', desc: 'Realtime + Chat + Party' },
    { label: 'Phase 4', href: '/docs/phases/phase-4.md', desc: 'Map + Community + Event + PostGIS' },
    { label: 'Phase 5', href: '/docs/phases/phase-5.md', desc: 'SOS + Gamification + Media' },
    { label: 'Phase 6', href: '/docs/phases/phase-6.md', desc: 'Admin + Deployment + Observability' },
    { label: 'Project Board', href: '/docs/PROJECT_BOARD.md', desc: 'ADR + Status' },
    { label: 'Runbook', href: '/docs/RUNBOOK.md', desc: 'Operasyonel rehber' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Dokumantasyon</h1>
        <p className="text-sm text-textMuted">Proje ici dokumanlar ve operational notlar.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {links.map((l) => (
          <div key={l.href} className="card">
            <div className="font-medium">{l.label}</div>
            <div className="mt-1 text-xs text-textMuted">{l.desc}</div>
            <code className="mt-2 block text-xs text-accent">{l.href}</code>
          </div>
        ))}
      </div>

      <div className="card text-sm">
        <h2 className="mb-2 font-medium">API Sagligi</h2>
        <ul className="ml-4 list-disc space-y-1 text-textMuted">
          <li>
            <code>GET /metrics</code> - Prometheus scrape endpoint (Spec 8.10)
          </li>
          <li>
            <code>GET /healthz</code> - Liveness probe
          </li>
          <li>
            <code>GET /readyz</code> - Readiness probe (DB + Redis + MinIO)
          </li>
        </ul>
      </div>
    </div>
  );
}
