# Session Handoff — Motogram

> **Amac:** Bir oturumdan sonraki oturuma hizli "nerede kalmistik" ozeti.
> Bu dosya kisa tutulur; resmi durum `docs/PROJECT_BOARD.md`'da.
>
> **Asistan kurali:** Yeni oturum acilinca ILK OKUNACAK dosya.
> Guncel degilse tarih/commit kontrolu yapip uyari ver.

---

## Mobil on uc — nerede kaldik? (2026-04-24 guncel)

| Konu | Durum |
|------|--------|
| **Mobil yol haritasi (P1–P7)** | **P1–P5 tamam; sirada P6** (harita + topluluk/parti polish), sonra P7 (WS + gam). |
| **Son yapit mobil commit** | `4b54e62` — P5: Settings hub, `PATCH /users/me`, bildirim tercihleri, acil kisiler, engellenenler, hesap silme, `linking` `settings/*`. |
| **Onceki mobil commitler** | `37718f7` — P3 story rail + StoryViewer; `88ee21c` — P4 AppStack 4 tab + bildirimler. |
| **Test (yerel)** | `pnpm --filter @motogram/mobile typecheck` + `pnpm --filter @motogram/mobile test` — son kosum: **15 suite / 59 test** gecer. |
| **Belge** | `docs/FRONTEND_IMPLEMENTATION_ROADMAP.md` (rev. gunlugu), `docs/FRONTEND_UI_UX_BLUEPRINT.md` v1.5, `docs/PROJECT_BOARD.md` §1. |

**Ardil / acik isler (oncelik secimi):**

- `GET /v1/users/:username` — baska kullanici profil ekrani (A5’te kalan parca).
- Hikâye **video** in-app: `expo-av` (P3’te sadece placeholder + metin).
- Ayarlar §11.5: sifre / e-posta / cihaz ekranlari (endpoint’ler mevcut, UI yok).
- **P6:** Map / Community / Party ekranlari contract + polish (yol haritasi A6).

**Kod giris noktalari (mobil):** `AppStackParamList` → `Settings`, `EditProfile`, …; `apps/mobile/src/navigation/`; `apps/mobile/src/screens/settings/`.

---

## Son Guncelleme

- **Tarih:** 2026-04-24 (ustteki tablo + bu blok senkron)
- **Repo durumu:** Yerel / `main` — son commit: `git log -1 --oneline` (beklenen: `4b54e62` ustu P5 sonrası)
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

- `apps/mobile/.env` olusturuldu (`EXPO_PUBLIC_API_URL=http://85.235.74.203/v1`)
- `apps/mobile/app.json` `android.usesCleartextTraffic=true` (Android 9+ HTTP izin)
- `apps/mobile/app.json` `extra.apiUrl` VPS'e yonlendirildi
- `apps/mobile/eas.json` yeni: development / preview / production profilleri
- EAS project link tamamlandi: `@alnkemre/motogram`
- EAS Android worker uyumu icin `apps/mobile/eas.json` icinde `pnpm=10.20.0`
  sabitlendi
- Expo Go gecici workaround'u geri alindi; `@rnmapbox/maps` plugin'i native
  build icin `app.json` icine explicit `@rnmapbox/maps/app.plugin.js` yolu ile
  restore edildi.
- **Aktif mobil blocker:** Mapbox download token / `RNMapboxMapsDownloadToken`
  EAS secret'i olmadan APK build baslamayabilir.
- `preview` Android build'i tetiklendi; kuyrukta bekleyen build URL'si:
  `expo.dev/accounts/alnkemre/projects/motogram/builds/dc069560-6103-4e3b-ad64-7afeecc21115`

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

1. **Android APK / dev build testi:**
   ```powershell
   cd C:\Users\Jeyrus\Desktop\motogram-final\apps\mobile
   pnpm exec eas build --profile preview --platform android
   ```
   Build tamamlaninca APK'yi cihaza kur, OTP `986877`, ekranlari dolas. Mapbox
   download token secret'i yoksa build yine durabilir.
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
3. **Mapbox EAS secret hazir mi?** `RNMapboxMapsDownloadToken` yoksa Android
   APK / dev build takilabilir; once bu blocker'i temizle.

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
- `EXPO_PUBLIC_API_URL=http://85.235.74.203/v1`
- `EXPO_PUBLIC_WS_URL=http://85.235.74.203`
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
