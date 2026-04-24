# Session Handoff — Motogram

> **Amac:** Bir oturumdan sonraki oturuma hizli "nerede kalmistik" ozeti.
> Bu dosya kisa tutulur; resmi durum `docs/PROJECT_BOARD.md`'da.
>
> **Asistan kurali:** Yeni oturum acilinca ILK OKUNACAK dosya.
> Guncel degilse tarih/commit kontrolu yapip uyari ver.

> **Güncel (2026-04-24+)**: Mobil istemci hedefi artık **`apps/mobile-native` (React Native CLI, Expo yok)**.
> `apps/mobile` (Expo/EAS + Mapbox) içeren bölümler **legacy** kabul edilir.

---

## Mobil on uc — nerede kaldik? (2026-04-23 guncel)

| Konu | Durum |
|------|--------|
| **Mobil yol haritasi (P1–P7)** | **P1–P7 kod + `pnpm test`/`typecheck` (turbo) tamam.** **7.5** = sadece cihazda **§8.4**. |
| **P6 kapanis ozeti** | Haritada `SosButton`; `PartyInboxScreen` + `PartySignalFeed` i18n; `LocationSharingSheet` `GROUP_MEMBERS`; Discover/Community `visibility` etiketleri; `map.sos` / `devNearbyMs` / `inbox.party*`. |
| **P7.1 ozet** | `party:status_changed` → `setPartyStatus`; WS `auth(cb)`; test `party-ws-helpers.spec.ts`. |
| **P7.2 ozet** | `useMessaging`: reconnect, `message:read_by` + `getConversation` `lastReadAt`; `messaging-merge` + `messaging-read-receipts` + test; `message:error`; `ConversationScreen` i18n + `inbox.messageRead`. |
| **P7.3–7.4 ozet** | `gamification-socket` / `emergency-socket`; `useP7RealtimeWebSockets` + `AppState` + `P7RealtimeHost`; `p7-realtime.store`; `realtime.*` i18n. |
| **P7 kapanis (kod)** | `useMessaging` `AppState`; `ws-typed` Sentry; `eventCreate` / rozet-görev i18n; turbo test yeşil. |
| **A5 (profil + public)** | `UserProfile`, `follows`, `ChangePassword` + e-posta/cihaz/kullanici adi ekranlari. |
| **Onceki ref. commit** | `git log -1 --oneline` ile dogrula. |
| **Test (yerel)** | `pnpm typecheck` + `pnpm test` (kok **turbo**); mobil: **21 suite / 73 test** (2026-04-23). |
| **Belge** | `docs/FRONTEND_IMPLEMENTATION_ROADMAP.md` **§7–§8** (P7 detay §8), `docs/FRONTEND_UI_UX_BLUEPRINT.md` §14, `docs/PROJECT_BOARD.md` (WS/gateway) |

**Ardil / acik isler (P7 oncelik):**

- **P7 kapanis:** `docs/FRONTEND_IMPLEMENTATION_ROADMAP.md` **§8.4** tablosunu cihazda doldur (PASS / N / A). P7.2 idle edge istege bagli.
- Istege bagli: `GET /devices` yanitina token veya `DELETE` id-ile cihaz satiri.

**Kod giris noktalari (mobil):** `MapScreen` + `SosButton`; `PartyInboxScreen`; `useParty` / `party.store`; `P7RealtimeHost` + `useP7RealtimeWebSockets`; `FRONTEND_IMPLEMENTATION_ROADMAP` P7 satiri.

**P7 yol haritasi (ayrinti):** `docs/FRONTEND_IMPLEMENTATION_ROADMAP.md` **§8** — sira: **7.1** `/realtime` sertlestirme → **7.2** `/messaging` tam → **7.3** `/gamification` → **7.4** `/emergency` WS → **7.5** smoke + test. Olay adlari: `packages/shared/.../socket-events.schema.ts`.

**P7.1 (son commit):** `party:status_changed` store akrani (`setPartyStatus`, `party-ws-helpers`); `socket` / `messaging-socket` `auth(cb)`; Jest: `party-ws-helpers.spec.ts`.

**P7.2 (son commit):** yukaridakilere ek `message:read_by` + `messaging-read-receipts.ts`; `ConversationScreen` `inbox.messageRead`.

**P7.3–7.4 (son commit):** `P7RealtimeHost` (`RootNavigator`); `gamification-socket` + `emergency-socket`; `useP7RealtimeWebSockets`.

---

## Son Guncelleme

- **Tarih:** 2026-04-23 (ustteki tablo + bu blok senkron)
- **Repo durumu:** Yerel / `main` — `git log -1 --oneline` ile dogrula.
- **Zod R9 (backend contract):** `apps/api/src/contract/public.contract.spec.ts` — health +
  auth hatalari + kayit/JWT ile feed + map (`shards`, `nearby`) + media 401/404;
  CI’da **`prisma migrate deploy`** + `pnpm test` (contract haric) + `pnpm run test:contract`
  + `CONTRACT_TESTS=1`. Yerel tam contract icin Postgres+Redis+migrate.
- **Zod R10 (k6 + SLO):** `scripts/check-slo.sh` Prometheus sorgulari + `deploy.sh` sonunda kapı
  (`SKIP_SLO_CHECK=1` ile atlama); `k6/http-baseline.js` `livez`+`readyz`; kok `pnpm slo:check`,
  `pnpm k6:baseline`.
- **R11 (pgBackRest):** `docker-compose.prod.yml` `--profile backup` + `infra/pgbackrest/*` +
  `scripts/pgbackrest-exec.sh`; `docs/RUNBOOK.md` §13.5 restore drill; WAL/archive Postgres tarafinda.
- **R12 (strict kapanış):** `docs/DEPLOY_RUNBOOK.md` § R12 — 72h bake ön koşulu, `ZOD_RESPONSE_STRICT` /
  `NEXT_PUBLIC_STRICT_SCHEMA` / `expo.extra.strictSchema` sırası; repo checklist tamam, canlı flip operasyon.
- **R6 (mobil formlar):** `PartyCreateModal` — `CreatePartySchema` + `useZodForm`; harita bos CTA + RIDE
  «aktif parti yok» CTA; i18n `map.partyCreate` / `map.ride`; Jest 53.

---

## SU ANKI DURUM (2026-04-21)

### Backend (VPS 85.235.74.203)

- 6 container **healthy**: postgres, redis, minio, api, nginx, web-admin
- Nginx **HTTP-only mode** (`NGINX_CONF=nginx.http.conf` - `.env.prod`'da)
- API port 3000 **disariya kapali** (Spec 8.11 uyumu)
- Disaridan disari test: `curl http://85.235.74.203/v1/healthz` → 200 OK
- TLS **ertelendi** (kullanici karari, test amacli HTTP yeterli)
- UFW ve SSH hardening: **kullanici henuz VPS'te manuel calistirmadi** (RUNBOOK 12)

### Faz 7 Ilerleme

| Asama | Durum |
|---|---|
| Asama 0 - Saglamlik Temeli (DB + seed + bootstrap) | **TAMAMLANDI** (2026-04-21) |
| Asama 1 Adim 7 - Port kapatma + nginx HTTP-only | **TAMAMLANDI** (2026-04-21, ADR-030) |
| Asama 1 Adim 5-6 - Domain + TLS | **ERTELENDI** (kullanici karari) |
| Asama 1 Adim 8 - UFW + SSH | **PENDING** (VPS'te manuel, RUNBOOK 12) |
| Asama 1 Adim 9 - Secrets 0600 | **KISMEN** (.env.prod 600 yapilmali) |
| Asama 2-6 | **BASLANMADI** |

### Mobil Uygulama

- **Aktif:** `apps/mobile-native` (React Native CLI, MapLibre, `react-native-config`).
- Ortam: kök `.env.example` mobil bölümündeki `API_URL`, `WS_URL`, isteğe bağlı
  `MAP_STYLE_URL` / `SENTRY_DSN` / `GOOGLE_*_CLIENT_ID` (eski `EXPO_PUBLIC_*` kaldırıldı).
- Eski Expo tabanlı `apps/mobile` repo’da yok; EAS/Expo Go notları geçmiş oturum
  kalıntısıdır — yeni build: Gradle/Xcode ile `mobile-native`.

### Bilinen Hotfix'ler (Faz 6 sonrasi)

- `apps/web-admin/src/app/login/page.tsx` - Suspense boundary (commit `6837724`)
- `apps/web-admin/public/.gitkeep` - Dockerfile COPY hata onleme (commit `4eefad4`)

---

## BEKLEYEN AKSIYONLAR

### Asistan Tarafi (kullanici talep ederse)

1. Asama 2 - Backup + PITR stratejisi (pg_dump cron + MinIO upload + restore drill)
2. Asama 3 - Observability dashboard + alert kurallari (Prometheus alertmanager)
3. Asama 4 - Yuk testi (k6 senaryolari)
4. Asama 5 - EAS Build profilleri test (development -> preview pipeline)
5. Asama 6 - CI/CD security scan (trivy, npm audit, docker scout)

### Kullanici Tarafi

1. **Android yerel build:** `apps/mobile-native` içinde `pnpm android` (veya
   Android Studio). Gerekirse `.env.development` ile `API_URL` / `WS_URL` VPS’e
   yönlendirilir.
2. VPS'te UFW + SSH hardening (RUNBOOK 12)
3. VPS'te `chmod 600 .env.prod`
4. Opsiyonel: Mapbox token + Firebase FCM config (prod icin)

---

## YENI OTURUMDA ILK UC KONTROL (Asistan)

1. **Bu dosyanin tarih/commit'i guncel mi?** Yukaridaki bilgilere bak,
   `git log --oneline -5` ile karsilastir. Farkli ise once bu dosyayi
   guncel tut.
2. **VPS hala ayakta mi?** Kullaniciya sormadan tahmin etme. Gerekirse
   asagidaki hizli komutu ver:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod ps
   curl -i http://85.235.74.203/v1/healthz
   ```
3. **Mobil API adresi:** `mobile-native` `.env*` içinde `API_URL` (ör. `http://…/v1`)
   prod/staging ile uyumlu mu?

---

## HIZLI REFERANS

- **Spec:** `../motogram-spec.md`
- **Proje durumu:** `docs/PROJECT_BOARD.md` (resmi)
- **Operasyon:** `docs/RUNBOOK.md` (cold start, TLS, backup, DR)
- **Faz detay:** `docs/phases/phase-[1-7].md`
- **Cursorrules:** `../.cursorrules` (anayasa)

## VPS Erisim

- **IP:** 85.235.74.203
- **SSH:** `ssh root@85.235.74.203`
- **Repo:** `/opt/motogram` ([github.com/alnkemre34/motogram-fixed](https://github.com/alnkemre34/motogram-fixed), branch `main`)
- **Env dosyasi:** `/opt/motogram/.env.prod` (git-disi, 0600 hedef)
- **Compose:** `docker-compose.prod.yml`

## Guncel Yapilandirma Degerleri

- `NGINX_CONF=nginx.http.conf` (TLS'e gecince `nginx.prod.conf`)
- `API_URL=http://85.235.74.203/v1` (mobile-native react-native-config)
- `WS_URL=http://85.235.74.203`
- Dev OTP bypass: `986877`
- API healthcheck: `GET /v1/healthz`

---

## Son Oturum Ozeti — mobil dokümantasyon (2026-04-24)

1. P5 ayarlar ve profil duzenleme dogrulandi; `typecheck` + Jest tekrar kosuldu.
2. `SESSION_HANDOFF`, `PROJECT_BOARD` §1, `FRONTEND_IMPLEMENTATION_ROADMAP` §7 ile "nerede kaldik" metin halinde birlesti.

---

## Son Oturum Ozeti (2026-04-21)

**Yapildiklar kronolojik:**

1. Faz 7 Asama 0 TAMAMLANDI: Prisma baseline migration (39KB),
   `tsconfig.seed.json` + compile edilmis seed JS, `bootstrap.sh`,
   compose `tooling` profili. ADR-029.
2. VPS'te Faz 7 Asama 0 uygulandi: image rebuild + migrate resolve +
   seed JS. Curl `/v1/healthz` 200 OK dondu.
3. Faz 7 Asama 1 PARTIAL TAMAMLANDI: Nginx HTTP-only variant
   (`nginx.http.conf`), compose'dan API 3000 publish kaldirildi,
   `NGINX_CONF` env var ile dual-mode. ADR-030.
4. Hotfix: web-admin `/login` Suspense boundary + `public/.gitkeep`.
5. Mobil config: VPS URL + cleartext HTTP + EAS profilleri.
6. Expo Go testi icin Mapbox plugin gecici olarak devre disi
   (Risk #31, `EXPO_GO_TODO.md`).
7. VPS dogrulama: 6 container healthy, curl 200 OK, port 3000
   `Connection refused` (dogru).
8. Kullanici is yerinde tunnel testi yapamadi (ngrok timeout +
   firewall), eve gecince LAN modunda deneyecek.

**Sonraki adim:** Ev Wi-Fi'de Expo Go test sonucuna gore Asama 2
(backup) ya da bulunan bug'larin duzeltilmesi.
