# Motogram

Harita öncelikli motosiklet sosyal platformu — monorepo (`apps/api`, `apps/mobile`, `apps/web-admin`, `packages/shared`).

## Production deploy disiplini

Tam entegrasyon (Zod %100 + observability + horizontal scaling) için **[docs/DEPLOY_RUNBOOK.md](docs/DEPLOY_RUNBOOK.md)** ve **[docs/ZOD_FULL_INTEGRATION_ROADMAP.md](docs/ZOD_FULL_INTEGRATION_ROADMAP.md)** dosyalarını takip edin. Repoda yapılan son büyük entegrasyon özeti: **[docs/ZOD_FULL_INTEGRATION_ROADMAP.md](docs/ZOD_FULL_INTEGRATION_ROADMAP.md)** içinde **§18 Tam entegrasyon planı — uygulama kaydı**.

## Geliştirme

```bash
pnpm install
pnpm --filter @motogram/shared build   # API/mobile @motogram/shared tipleri icin zorunlu
pnpm dev
```

CI’da tam `AppModule` contract testi `GITHUB_ACTIONS=true` iken calisir; lokalde
`CONTRACT_TESTS=1` + Postgres/Redis ayakta olmali (`apps/api/src/contract/public.contract.spec.ts`).
