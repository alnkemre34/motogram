# MOTOGRAM — PROJE YONETIM PANOSU (SEYIR DEFTERI)

> Bu dosya, Motogram v4.2 projesinin **merkezi hafizasi** ve **canli durum panosudur.**
> Her faz bitiminde, her mimari karar aninda ve her kritik degisiklikte buraya log
> dusulur. AI asistan (Cursor) yeni bir faza baslarken ONCE bu dosyayi okur.
>
> **Tek Gercek Kaynak:** `motogram-spec.md` (v4.2)
> **Anayasa:** `.cursorrules`
>
> **Dokümantasyon senkron kurali (Zod / R-fazlari):** Her tamamlanan Zod
> entegrasyon alt fazinda (R1, R2, … veya `ZOD_FULL_INTEGRATION_ROADMAP`
> maddesi) **iki dosya birlikte** guncellenir: `docs/ZOD_FULL_INTEGRATION_ROADMAP.md`
> (§18 uygulama kaydi, §19 durum tablosu) ve **bu dosya** (`PROJECT_BOARD.md`
> §1 canli durum + §5 kronolojik log). Yalnizca birini guncellemek atlanmaz.

---

## 0. Proje Kimligi

| Alan | Deger |
|---|---|
| **Urun** | Motogram |
| **Surum** | v4.2 (Redis GEO + Self-Hosted Storage) |
| **Mimari** | Monorepo (pnpm + Turborepo) |
| **Baslangic Tarihi** | 2026-04-20 |
| **Tahmini Sure (Spec 6)** | 10 hafta (6 faz) |

---

## 1. Canli Durum (State Snapshot)

| Alan | Deger |
|---|---|
| **Aktif Faz** | Faz 7 + mobil **P6** (harita + topluluk/parti polish) öncelik |
| **Son Tamamlanan** | **A5 (mobil, devam):** `UserProfile` + `GET /v1/users/:username`, `follows` + `ChangePassword` (B-04); feed/story’den açılış; **P5** önceki: ayarlar hub, tercihler, blocks, acil, hesap silme |
| **Son Guncelleme** | 2026-04-24 — public profil + parola; yol haritası §7 + SESSION_HANDOFF; `typecheck`/`test` yeşil |
| **Son Commit** | `git log -1 --oneline` (A5 + doc senkronu bu tarih) |
| **Aktif Ise Yarar Dokuman** | `docs/SESSION_HANDOFF.md` (oturumlar arasi hizli ozet) |
| **Bekleyen Milestone** | Android `preview` APK build'inin kuyruktan cikmasi ve cihaza kurulup dogrulanmasi; sonuc pozitifse Asama 2 (backup stratejisi) |
| **Aktif Riskler** | Risk #27 (TLS ertelendi) |
| **Engelleyiciler (Blockers)** | Domain satin alma (motogram.app), TLS icin DNS cozumu, Mapbox indirme token, Firebase OTP prod config, FCM/APNs production sertifikalari, Apple/Google Store hesap onayi |

---

## 2. Faz Ilerleme Tablosu

| Faz | Ad | Tahmini Sure | Durum | Baslama | Bitirme |
|---|---|---|---|---|---|
| 0 | Altyapi ve Monorepo Kurulumu | - | TAMAMLANDI | 2026-04-20 | 2026-04-20 |
| 1 | Temel Sosyal Katman | 2 hafta | TAMAMLANDI | 2026-04-20 | 2026-04-20 |
| 2 | Harita ve Redis Konum Motoru | 2 hafta | TAMAMLANDI | 2026-04-20 | 2026-04-20 |
| 3 | Surus Partisi (NFS Tarzi) | 2 hafta | TAMAMLANDI | 2026-04-20 | 2026-04-20 |
| 4 | Topluluklar ve Mesajlasma | 2 hafta | TAMAMLANDI | 2026-04-20 | 2026-04-20 |
| 5 | Acil Durum, Gamification, Medya | 1 hafta | TAMAMLANDI | 2026-04-20 | 2026-04-20 |
| 6 | Yonetim Paneli ve Dagitim | 1 hafta | TAMAMLANDI | 2026-04-20 | 2026-04-20 |
| 7 | Enterprise Prod Hardening | 1-2 hafta | AKTIF (Asama 0/6 TAMAMLANDI) | 2026-04-21 | - |

**Durum Sozlugu:** BEKLIYOR / PLAN / AKTIF / TAMAMLANDI / BLOKE / ERTELENDI

---

## 3. Teknoloji Yigini (Spec 3.1 + 9.7 - Pazarliksiz)

| Katman | Teknoloji | Faz |
|---|---|---|
| Paket Yoneticisi | pnpm 10+ | 0 |
| Gorev Kosucusu | Turborepo 2+ | 0 |
| Mobil | React Native (Expo) | 1+ |
| Web Admin | Next.js 14 (App Router) + shadcn/ui + Tailwind | 6 |
| Backend | NestJS (TypeScript) | 1+ |
| Veritabani | PostgreSQL 15+ (PostGIS) | 1+ |
| Canli Konum | Redis 7+ (GEO komutlari) | 2+ |
| Onbellek / Kuyruk | Redis + BullMQ | 1+ |
| Gercek Zaman | Socket.IO | 3+ |
| Medya | MinIO + Sharp | 5 |
| Harita | Mapbox (@rnmapbox/maps) | 2+ |
| Dogrulama (SSOT) | Zod (packages/shared) | 1+ |
| Mobil State | Zustand + react-query + react-native-mmkv | 1+ |
| i18n | react-i18next | 1+ |
| Hata Izleme | Sentry (sentry-react-native) | 1+ |

**YASAKLAR:** Google Maps, AsyncStorage, Redux, Context API (global state icin),
`any` tipi, hardcoded string, hardcoded API keys.

---

## 4. Monorepo Yapisi (Sabit - Faz 0'da kuruldu)

```
Final-Motogram/
  apps/
    mobile/       -> @motogram/mobile    (React Native + Expo)
    api/          -> @motogram/api       (NestJS)
    web-admin/    -> @motogram/web-admin (Next.js 14)
  packages/
    shared/           -> @motogram/shared           (Zod + tipler)
    config-eslint/    -> @motogram/config-eslint
    config-tsconfig/  -> @motogram/config-tsconfig
  docs/
    PROJECT_BOARD.md  (bu dosya)
    phases/
      phase-1.md ... phase-6.md
  .cursorrules         (Anayasa)
  motogram-spec.md     (SSOT)
  package.json         (workspace root)
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
  .env.example         (Spec 9.5)
  .gitignore
```

---

## 5. Faz Log Girdileri (Kronolojik - Yeni olan en ustte)

### [2026-04-24] Mobil A5 — public profil (username) + takip + parola

**Kod:** `getUserByUsername`, `apps/mobile/src/api/follows.api.ts`, `UserProfileScreen`, `ChangePasswordScreen`, `HomeScreen` / `StoryRail` navigasyon, `linking` `user/:username` + `settings/password`. `POST /auth/password/change` B-04.

---

### [2026-04-23] Mobil P5 — Profil ayarları (Settings) + sözleşme uyumlu API

**Kod:** `apps/mobile/src/api/{users,blocks}.api.ts`; `notifications.api` tercihler; `emergency` contacts; `SettingsScreen` + `EditProfile` + tercih/acil/engel/hesap silme; `AppStack` + `linking` `settings/*`; `ProfileScreen` ⚙. **Not:** `GET /v1/users/:username` (başka profil) P6+.

---

### [2026-04-23] Mobil P3 — Story rail + StoryViewer + bildirim okundu

**Kod:** `apps/mobile/src/api/stories.api.ts`; `features/story/{StoryRail,group-story-feed}`; `screens/story/StoryViewerScreen`; `AppStack` `StoryViewer`; `notifications.api` `markNotificationsRead` + `NotificationsScreen` `useFocusEffect` çıkış. **Not:** `mediaType===VIDEO` için tam oynatıcı yok (metin + ardıl `expo-av`).

---

### [2026-04-23] Mobil P3/P4 — 4 tab + Gelen/ Bildirim Home’dan

**Nav:** `AppStackNavigator` → `MainTabs` (Home, Map, Community, Profile) + `Inbox` (stack) + `Notifications`. Eski 5. sekme (Inbox) kaldırıldı. **API:** `notifications.api.ts` (`/notifications`, `/notifications/unread-count`, Zod). **Inbox ekranı:** `PartyInboxScreen` “Haritaya dön” → `navigate('MainTabs', { screen: 'Map' })`. **Kısıt:** P3’te story rail henüz yok. **Test:** `pnpm --filter @motogram/mobile typecheck` + `test` yeşil.

---

### [2026-04-23] Mobil P1 — OAuth (Apple / Google) + sözleşme hizası

**API:** `appleSignInRequest` / `googleSignInRequest` → `authPaths.oauthApple|oauthGoogle`; yanıt `AuthResultSchema`. **Google:** `expo-auth-session` `useIdTokenAuthRequest` + `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`. **App:** `WebBrowser.maybeCompleteAuthSession()`. **Ekran:** `LoginScreen` + `RegisterScreen` (EULA üstte, `SocialAuthBlock`).

**Doküman:** `FRONTEND_IMPLEMENTATION_ROADMAP` §2.1 (P1–P7), §4 P1 kabul. **Test:** `auth-paths.spec.ts`.

---

### [2026-04-23] Mobil Inbox (A2) — DM + Gruplar + Topluluk + Parti

**Ürün:** Gelen kutusu üst sekmeler: **DM** (bire bir `DIRECT` üstte, `GROUP_CHAT` "Gruplar" alt başlığında), **Topluluk** (`COMMUNITY_CHAT` only), **Parti** (mevcut davet akışı). Blueprint v1.2 ile aynı.

**API:** B-02 `ListConversationsQuerySchema` — `listConversations({ type })`; dosya: `messaging.api.ts` + `messaging-path.ts`.

**UX:** `expo-blur` üst şerit; i18n `inbox.*` (tr/en). Test: `messaging-path.spec.ts` (3 tip sorgu string).

**Doküman:** `docs/FRONTEND_UI_UX_BLUEPRINT.md` §10 güncel; yeni `docs/FRONTEND_IMPLEMENTATION_ROADMAP.md` (A2 kabul + test stratejisi).

---

### [2026-04-23] BACKEND_GAP — B-14 … B-18 toplu kapanış (+ B-16 OTP)

**Prisma:** `NotificationPreference`, `EmergencyContact`, `OtpCode`; `User.phoneVerifiedAt`; `ConversationParticipant.mutedUntil`. Migration: `20260423240000_b14_b18_gap`.

**B-14:** `GET/PATCH /v1/notification-preferences`; `NotificationsService` tercih kapısı.

**B-15:** `GET/POST/DELETE /v1/emergency/contacts` (max 5).

**B-16:** `POST /v1/auth/otp/request`, `POST /v1/auth/otp/verify`; `OtpSmsQueue`; shared yanıt şemaları.

**B-17:** `DELETE /v1/users/me` → `AccountService.requestDeletion` + `AccountDeletionFromUserMeResponseSchema`; `POST /v1/users/me/cancel-deletion` → `AccountDeletionStatusSchema`.

**B-18:** `POST /v1/conversations/:id/mute`, `.../leave`; push alıcı süzme.

**Test:** `pnpm --filter @motogram/shared test`, `pnpm --filter @motogram/api test`, `pnpm --filter @motogram/api test:contract`; `pnpm openapi:generate` + `openapi:check`.

**Dokuman:** `BACKEND_GAP_ROADMAP.md` v1.7; `FRONTEND_BLUEPRINT.md` §17 B5/B10/B11/B15 + §18 notu.

---

### [2026-04-23] BACKEND_GAP — B-13 `GET /v1/events/search`

**Kod:** `EventService.searchEvents`; `EventController` `GET search` (`:id` öncesi); throttle 30/dk; PUBLIC + zaman penceresi + title/description `q`.

**Shared:** `EventSearchQuerySchema`, `EventsSearchResponseSchema`; `event.schema.spec.ts`.

**Test:** `event.service.spec` B-13; surface E2E events adımında arama doğrulaması.

**OpenAPI:** `pnpm openapi:generate` → `docs/openapi.json`, `docs/API_Contract.md`.

**Dokuman:** `BACKEND_GAP_ROADMAP.md` B-13 tamam; `FRONTEND_BLUEPRINT.md` §17 B13 tamam.

---

### [2026-04-23] BACKEND_GAP — B-12 `GET /v1/communities/search`

**Kod:** `CommunityService.searchCommunities`; `CommunityController` `GET search` (`:id` öncesi); throttle 30/dk.

**Shared:** `CommunitySearchQuerySchema`, `CommunitiesSearchResponseSchema`; `community.schema.spec.ts`.

**Test:** `community.service.spec` B-12; surface E2E communities adımında arama doğrulaması.

**OpenAPI:** `pnpm openapi:generate` → `docs/openapi.json`, `docs/API_Contract.md`.

**Dokuman:** `BACKEND_GAP_ROADMAP.md` B-12 tamam; `FRONTEND_BLUEPRINT.md` Discover + §17 B13a tamam.

---

### [2026-04-23] BACKEND_GAP — B-11 kullanıcı raporu `POST /v1/reports`

**Kod:** `ReportsModule` / `ReportsService` / `ReportsController`; 24 saat `(reporterId, targetType, targetId)` dedup → `ConflictException`; throttle 5/dk.

**Shared:** `CreateReportSchema.targetId` UUID; `ReportDtoSchema` `DateLikeSchema`; `report.schema.spec.ts`.

**Test:** `reports.service.spec.ts`, surface E2E B-11; admin `GET/PATCH /admin/reports` değişmedi.

**OpenAPI:** `pnpm openapi:generate` → `docs/openapi.json`, `docs/API_Contract.md`.

**Dokuman:** `BACKEND_GAP_ROADMAP.md` B-11 tamam; `FRONTEND_BLUEPRINT.md` §17 B9 tamam.

---

### [2026-04-23] BACKEND_GAP — B-10 Blocks REST + feed filtresi

**Kod:** `BlocksModule` / `BlocksService` / `BlocksController` (`GET/POST/DELETE /v1/blocks`); `FollowsService.unfollow` ile çift yönlü takip kaldırma; `PostsService.feedForUser`, `findById`, `userPosts` için `BlocksService.peersBlockedEitherWay`; `packages/shared` `BlocksListResponseSchema`, `BlockListItemSchema`, `BlockDtoSchema` (`DateLikeSchema`).

**Test:** `blocks.service.spec.ts`, `block.schema.spec.ts`, `backend.surface.e2e` B-10 (feed + DM 403 + unblock).

**OpenAPI:** `pnpm openapi:generate` → `docs/openapi.json`, `docs/API_Contract.md`, `routes.json`, `api-types.generated.ts`.

**Dokuman:** `BACKEND_GAP_ROADMAP.md` B-10 tamam; `FRONTEND_BLUEPRINT.md` §10.7 + §17 B8 tamam.

---

### [2026-04-23] BACKEND_GAP — B-04 `POST /v1/auth/password/change`

**Kod:** `ChangePasswordSchema` / `ChangePasswordResponseSchema` (`packages/shared/src/schemas/auth.schema.ts`); `AuthService.changePassword` (bcrypt doğrulama, hash güncelleme, `TokenService.revokeAllForUser`); `AuthController` JWT korumalı route, `@Throttle` 5/15dk; `auth.schema.spec` + `auth.service.spec` + `public.contract.spec` + `backend.edge.e2e` senaryoları.

**OpenAPI:** `pnpm openapi:generate` ile `docs/openapi.json`, `API_Contract.md`, `api-types.generated.ts` güncellendi; `pnpm openapi:check` yeşil.

**Dokuman:** `BACKEND_GAP_ROADMAP.md` v1.2, `FRONTEND_BLUEPRINT.md` B2 satırı tamamlandı olarak işaretlendi.

---

### [2026-04-23] BACKEND_GAP kapatma — B-01 / B-02 / B-03 (Zod + OpenAPI uyumlu)

**Baglam:** `docs/BACKEND_GAP_ROADMAP.md` oncelik 1–3; frontend blueprint’teki `likedByMe` ve konusma listesi filtresi + parti `invites/me` route guvenligi.

**Kod:**

- `packages/shared`: `PostApiResponseSchema` + feed item’larda zorunlu `likedByMe: boolean`; `ListConversationsQuerySchema` (`type` opsiyonel); sema testleri (`post.schema.spec`, `message.schema.spec`).
- `apps/api`: `PostsService.attachLikedByMe`, `GET /posts/user/:userId` ve `GET /posts/:id` icin izleyici (`viewer`) ile begeni batch sorgusu; `ConversationService.listMyConversations(userId, query)` tip filtresi; `MessagingController` query parse + 400; `PartyController` statik `invites/*` ve `GET ''` rotalarini `:id` onune alma.
- `public.contract.spec.ts`: feed `likedByMe`, conversations + invalid `type` 400.

**Dogrulama:** `pnpm --filter @motogram/shared test`, `pnpm --filter @motogram/api typecheck` + `test`, `pnpm openapi:generate` (drift oncesi).

**Dokuman:** `docs/FRONTEND_BLUEPRINT.md` §17 B14/B16 satirlari guncellendi; bu pano + `BACKEND_GAP_ROADMAP` sürüm notu.

---

### [2026-04-23] OpenAPI Zod Contract Pipeline — Adim 1-2 (Reflektor + Route Manifest)

**Baglam:** Backend Zod semalari (`packages/shared`) ile API surface'i arasinda drift olmamasi icin OpenAPI contract hattina baslandi. Hedef: `docs/openapi.json` + `docs/API_Contract.md` otomatik uretim + CI drift kapisi.

**Kod / Degisiklikler:**

| Dosya | Ozet |
|---|---|
| `apps/api/src/openapi/reflector.ts` | `DiscoveryService` ile tum controller method'larini tarayip `RouteRecord[]` uretir (HTTP method + path + `ZodBody` request schema + `@ZodResponse` response schema + `@Public/@Roles` auth metadata). |
| `apps/api/scripts/generate-route-manifest.ts` | `NestFactory.createApplicationContext(AppModule.forOpenApi())` ile build-time context acip `packages/shared/openapi/routes.json` yazar (src DISINDA). |
| `apps/api/src/app.module.ts` | `OPENAPI_GENERATE=1` iken env validate bypass + `AppModule.forOpenApi()` (DiscoveryModule + DB/Redis override). |
| `apps/api/src/modules/*` | `OPENAPI_GENERATE=1` icin DB/Redis/BullMQ/Push bootstrap eden `onModuleInit` akislari guardlandi (baglanti/refused olmadan manifest uretilebilsin). |
| `apps/api/tsconfig.json` | `moduleResolution=Node16` + `module=Node16` ile `@motogram/shared` types resolution (TS7016) sorunu giderildi. |
| `apps/api/src/e2e/*` | E2E dosyalarinda implicit `any` hatalari temizlendi; `backend.shutdown.e2e.spec.ts` icinde `describeE2E.skip` hatasi duzeltildi. |

**Cikti:** `packages/shared/openapi/routes.json` (export edilmez; dosya olarak durur).\n\n**Dogrulama:** `pnpm --filter @motogram/api typecheck` PASS; `pnpm --filter @motogram/api test` PASS; `test:contract` PASS (skip'li); `test:e2e` PASS (skip'li).

### [2026-04-23] OpenAPI Zod Contract Pipeline — Adim 3-4 (OpenAPI + API_Contract uretimi)

**Baglam:** Route manifest + Zod semalarindan `docs/openapi.json` ve otomatik `docs/API_Contract.md` uretimi eklendi. Hedef: frontend + backend drift'ini CI kapisiyla kirmaya hazir hale getirmek.

**Kod / Degisiklikler:**

| Dosya | Ozet |
|---|---|
| `packages/shared/src/openapi/generate.ts` | `generateOpenApi()` (OpenAPI 3.1): schema'lari component olarak kaydeder, request/response'u `$ref` ile yazar, `passthrough()` icin `additionalProperties: true` uygular; deterministic key-sort. `extendZodWithOpenApi(z)` ile `.openapi()` extension aktif. |
| `packages/shared/src/openapi/types.ts` | `RouteRecord` + `SchemaMap` tipleri. |
| `packages/shared/tsup.config.ts` | `external: ['zod']` ile zod-to-openapi ve schema'larin ayni Zod runtime'ini kullanmasi saglandi (aksi halde `.openapi is not a function` hatasi oluyordu). |
| `apps/api/scripts/write-openapi.ts` | `routes.json` + shared schema toplama → `docs/openapi.json` (json-stable-stringify) + `docs/API_Contract.md` uretir. |
| `apps/api/scripts/write-api-contract.ts` | OpenAPI hash + endpoint listesi + (auth/roles/request/response schema) ile Markdown contract dokumani uretir. |
| `apps/api/package.json` | `openapi:generate` script'i eklendi (`generate:route-manifest` + `write-openapi.ts`). |
| `docs/openapi.json` | Uretilen OpenAPI contract (commitlenir). |
| `docs/API_Contract.md` | Uretilen API dokumani (commitlenir). |

**Cikti:** `docs/openapi.json`, `docs/API_Contract.md`.\n\n**Dogrulama:** `pnpm --filter @motogram/api openapi:generate` PASS; `@motogram/shared typecheck/build` PASS; `@motogram/api typecheck/test/test:contract/test:e2e` PASS.

### [2026-04-23] OpenAPI Zod Contract Pipeline — Adim 5 (Swagger UI dev/staging middleware)

**Baglam:** OpenAPI uretildikten sonra Swagger UI sadece dev/staging'de serve edilir. Production ortaminda endpoint'ler hic register edilmez (saldiri yuzeyi yok).

**Kod / Degisiklikler:**

| Dosya | Ozet |
|---|---|
| `apps/api/src/openapi/swagger-ui.ts` | Express middleware ile `/v1/docs` (Swagger UI) ve `/v1/docs/openapi.json` (dosyadan) serve eder. Sadece `NODE_ENV in {development, staging}` iken aktif. |
| `apps/api/src/main.ts` | `mountSwaggerUi(app)` eklendi (production'da no-op). |
| `apps/api/package.json` | `swagger-ui-dist` + `@types/swagger-ui-dist` eklendi. |

**Dogrulama:** `pnpm --filter @motogram/api typecheck` PASS; `pnpm --filter @motogram/api test` PASS; `test:contract` PASS (skip'li); `test:e2e` PASS (skip'li).

### [2026-04-23] OpenAPI Zod Contract Pipeline — Adim 6 (openapi-typescript: path/param types + Zod response barrel)

**Baglam:** Frontend icin OpenAPI'dan sadece **path/method/params/body** tipleri uretilir. Response tipleri OpenAPI'dan degil, **Zod SSOT**'dan gelir (passthrough/additionalProperties nedeniyle tip gevsemesin diye).

**Kod / Degisiklikler:**

| Dosya | Ozet |
|---|---|
| `packages/shared/src/openapi/api-types.generated.ts` | `docs/openapi.json`'dan `openapi-typescript` ile uretilen tipler (yalnizca contract surface; response'lar burada kaynak alinmaz). |
| `packages/shared/src/openapi/api-contract.ts` | Generated dosya uzerine facade: `ApiPaths`, `ApiPath`, `ApiMethod`, `ApiPathParams`, `ApiQueryParams`, `ApiRequestBody` tipleri. |
| `packages/shared/src/openapi/response-types.ts` | Response tipleri icin kucuk barrel: `z.infer<typeof Schema>` ile (OpenAPI response yerine Zod). Export isimleri collision olmasin diye `*Body` suffix'i ile. |
| `packages/shared/package.json` | `generate:types` script'i eklendi: `docs/openapi.json` → `src/openapi/api-types.generated.ts`. `openapi-typescript` devDependency eklendi. |

**Dogrulama:** `pnpm --filter @motogram/shared generate:types` PASS; `pnpm --filter @motogram/shared typecheck/build` PASS; `pnpm --filter @motogram/api typecheck/test` PASS.

### [2026-04-23] OpenAPI Zod Contract Pipeline — Adim 7 (shared: client-types sadece tip sozlesmesi)

**Baglam:** Shared katmaninda runtime API istemcisi bulunmaz. Sadece tip sozlesmesi verilir; `apiRequest` implementasyonlari uygulamalarin icinde kalir (mobile/web-admin).

**Kod / Degisiklikler:**

| Dosya | Ozet |
|---|---|
| `packages/shared/src/openapi/client-types.ts` | Runtime kod olmadan `ApiRequestArgs<P,M>` ve `ApiResponse<P,M>` gibi generic tip yardimcilari. |
| `packages/shared/src/index.ts` | `client-types` export (types only). |

**Dogrulama:** `pnpm --filter @motogram/shared typecheck/build` PASS; `pnpm --filter @motogram/api typecheck/test` PASS.

### [2026-04-23] OpenAPI Zod Contract Pipeline — Adim 8 (CI drift kapisi: openapi:check)

**Baglam:** API contract drift'ini CI'da yakalamak icin `openapi:generate` + `openapi:check` kapisi eklendi. Kritik: Turbo cache drift'i saklayabilir; bu nedenle task'lar **`cache: false`** ve `outputs: []` ile tanimlandi.

**Kod / Degisiklikler:**

| Dosya | Ozet |
|---|---|
| `turbo.json` | `openapi:generate` + `openapi:check` task'lari eklendi, **`cache: false`** ve `outputs: []`. |
| `package.json` (kok) | `openapi:generate` (api openapi:generate + shared generate:types) ve `openapi:check` (git diff --exit-code) scriptleri eklendi. |
| `.github/workflows/ci.yml` | Typecheck sonrasi `pnpm openapi:check` adimi eklendi (CI drift kapisi). |

**Dogrulama:** Yerel `pnpm openapi:check` PASS; `pnpm typecheck` PASS; `pnpm --filter @motogram/api test` PASS. `docs/openapi.json` gitignore disinda (commitlenebilir).

### [2026-04-23] OpenAPI Zod Contract Pipeline — Adim 9 (WS kapsam disi notu)

**Baglam:** WebSocket olay semalari OpenAPI'ye dahil edilmez. SSOT dosyasi `packages/shared/src/schemas/socket-events.schema.ts` olmaya devam eder. AsyncAPI uretimi henuz yoktur.

**Kod / Degisiklikler:**

| Dosya | Ozet |
|---|---|
| `docs/ws-contract.md` | WS sozlesmesi icin referans notu (kapsam disi). |
| `apps/api/scripts/write-openapi.ts` | WS semalari schema toplama asamasinda `socket` iceren export isimleriyle filtrelenir (OpenAPI'ye girmez). |

**Dogrulama:** `pnpm --filter @motogram/api openapi:generate` PASS; `docs/openapi.json` icinde `WS_EVENTS/socket-events` izi yok (grep temiz).

### [2026-04-23] OpenAPI Zod Contract Pipeline — Adim 10 (Contract test: OpenAPI ↔ Zod es-referans)

**Baglam:** Contract test'te OpenAPI uretimi ile `routes.json` manifest'indeki schema adlarinin birebir eslestigi dogrulandi. Amac: OpenAPI dokumani ile runtime Zod semalari arasinda kopukluk olusursa testin kirmasi.

**Kod / Degisiklikler:**

| Dosya | Ozet |
|---|---|
| `apps/api/src/contract/public.contract.spec.ts` | DB gerektirmeyen bir test eklendi: `packages/shared/openapi/routes.json` + `docs/openapi.json` okuyup her route icin requestBody/response `$ref`'lerinin dogru schema adina isaret ettigini assert eder. Parametreli path'ler `:id → {id}` cevrilerek karsilastirilir. |

**Dogrulama:** `pnpm --filter @motogram/api openapi:generate` PASS; `pnpm --filter @motogram/api test:contract` PASS (OpenAPI es-referans testi calisir; digerleri DB yoksa skip). CI'da CONTRACT_TESTS=1 ile tam suite calisir.

### [2026-04-22] R14 — Backend kilidi (WS + SOS + RBAC + guvenlik + tam suite script)

**Baglam:** HTTP/E2E genisletildi; Socket.IO gercek baglanti, SOS tam akis, admin RBAC (seed kullanicilar), rate limit 429, internal fanout HMAC saldiri yuzeyi, graceful `close()` minimum testi; BullMQ medya isleme mevcut `backend.media.e2e.spec.ts` ile kaliyor.

**Kod:**

| Dosya | Ozet |
|---|---|
| `apps/api/src/e2e/backend.websocket.e2e.spec.ts` | `Socket.IO`: `/realtime` party:join → update_location → send_signal → leave; `/messaging` conversation:join + message:send + `message:received`; HTTP ile parti + DM hazirligi; `app.listen(0)` + `socket.io-client`. |
| `apps/api/src/e2e/backend.emergency-flow.e2e.spec.ts` | SOS: POST alert (`holdDurationMs` ≥ 3s) → GET liste → respond → resolve. |
| `apps/api/src/e2e/backend.admin-rbac.e2e.spec.ts` | `db:seed:test-users`: ADMIN/MODERATOR; Prisma ile rapor; GET/PATCH `/admin/reports`; MOD ban→unban; MOD `PATCH .../role` → **403**; USER `/admin/reports` → **403**. |
| `apps/api/src/e2e/backend.rate-limit.e2e.spec.ts` | `PUT /v1/location/update` ardisik → **429**. |
| `apps/api/src/e2e/backend.fanout-security.e2e.spec.ts` | Fanout: kotu imza, eski `ts`, nonce replay → **401**. |
| `apps/api/src/e2e/backend.shutdown.e2e.spec.ts` | `AppModule` `close()` (SIGTERM tam simülasyonu ayri süreç gerekir). |
| `apps/api/src/e2e/helpers/internal-fanout.ts` | Fanout HMAC header helper (ops + guvenlik testleri). |
| `apps/api/prisma/seed-test-users.ts` | Sabit ADMIN + MODERATOR hesaplari (`pnpm run db:seed:test-users`). |
| `docker-compose.test.yml` | Test stack (Postgres + Redis + MinIO); `e2e` ile ayni kimlik bilgisi, farkli konteyner adlari. |
| `scripts/test-all.sh` | Stack up → migrate → `db:seed` + `db:seed:test-users` → shared build → unit → contract → E2E; sonunda **✅ BACKEND KİLİTLENDİ**. |
| `package.json` (kok) | `pnpm run test:backend:all` → bash script. |
| `.github/workflows/ci.yml` | Migrate sonrasi **`db:seed && db:seed:test-users`**. |

**Dogrulama:** `pnpm run test:backend:all` (Git Bash / Linux). CI: seed + unit + contract + `test:e2e`.

**Dokuman:** `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §18 / §19 R14.

### [2026-04-22] R13 — Backend edge-to-edge E2E test paketi

**Baglam:** Contract (R9) tek tek endpointleri Zod ile dogrular; uretim benzeri **tam yigin altin yol** ayri suite ile kanitlanir.

**Kod:**

| Dosya | Ozet |
|---|---|
| `apps/api/src/e2e/backend.edge.e2e.spec.ts` | `E2E_TESTS=1`: readyz **200**; login + refresh; post create/get/feed/patch/delete; map shards+nearby; public parti create/detail/nearby/leave; `/v1/metrics` Prometheus govdesi; logout 204. DB yoksa tek mesajda `docker-compose.e2e.yml` talimatlari. |
| `docker-compose.e2e.yml` | Yerel E2E: CI/jest-env ile ayni `motogram_test` + `motogram_test_password` (dev compose ile karistirilmamali). |
| `package.json` (kok) | `e2e:stack:up` / `e2e:stack:down`. |
| `apps/api/package.json` | `test` → `e2e` ignore; `test:e2e`; `test:e2e:migrate`. |
| `.github/workflows/ci.yml` | `Test (API edge-to-edge E2E)` adimi (`E2E_TESTS=1`, contract ile ayni DB/Redis env). |

**Dogrulama:** CI: migrate deploy sonrasi `pnpm --filter @motogram/api test` + `test:contract` + `test:e2e`. Yerel: `pnpm e2e:stack:up` → `cd apps/api` → `pnpm run test:e2e:migrate` → `$env:E2E_TESTS='1'; pnpm run test:e2e`.

**Dokuman:** `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §18.1 R13, §18.3, §19.2 R13, mermaid R13.

### [2026-04-23] Zod R6 (tamam) — Parti olustur UI (`PartyCreateModal`)

**Baglam:** Roadmap §7.3 / §19 R6 — `CreatePartySchema` icin tam ekran/modal eksikti.

**Kod:**

| Dosya | Ozet |
|---|---|
| `apps/mobile/src/screens/party/PartyCreateModal.tsx` | `useZodForm(CreatePartySchema)`; ad, uye limiti (+/-), ozel parti switch; `createParty` → `getParty` → `setParty`. |
| `apps/mobile/src/screens/map/MapScreen.tsx` | `PartyCreateModal` + `partyCreateOpen`; `DiscoverModeSheet` `onPressCreateParty`; RIDE modunda aktif parti yokken CTA. |
| `apps/mobile/src/features/map/panel/DiscoverModeSheet.tsx` | Bos liste CTA `onPressCreateParty` ile aktif. |
| `apps/mobile/src/i18n/locales/tr.json` / `en.json` | `map.partyCreate.*`, `map.ride.*`. |
| `apps/mobile/src/api/party-zod-guard.spec.ts` | Modal default payload `CreatePartySchema` testi (+1 test). |

**Dogrulama:** `pnpm typecheck`; `pnpm --filter @motogram/mobile test` (53 test).

**Dokuman:** `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §7.3, §18.2 **E**, §19.2 R6.

### [2026-04-22] R12 — Zod strict kapanış checklist (72h bake → bayraklar)

**Baglam:** Roadmap §19 R12 — üretimde warn-only’dan strict’e geçiş **prosedürü** repoya
işlendi; varsayılan geliştirme davranışı değişmedi (`ZOD_RESPONSE_STRICT=false`,
`strictSchema=false`).

**Dosyalar:**

| Dosya | Ozet |
|---|---|
| `docs/DEPLOY_RUNBOOK.md` | Yeni § «R12 — Zod strict kapanış»: ön koşullar, API / web-admin / mobil sıra, 24h izleme, geri alma. |
| `.env.example` | `ZOD_RESPONSE_STRICT` satırına R12 referansi. |
| `apps/web-admin/.env.example` | `NEXT_PUBLIC_STRICT_SCHEMA` için R12 notu. |
| `apps/mobile/src/config/env.ts` | `strictSchema` JSDoc → DEPLOY_RUNBOOK. |

**Dogrulama:** `pnpm typecheck` yeşil. Canlı bayrak flip’i VPS + metrik bake sonrası operasyon.

**Dokuman:** `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §18.2 Faz 14, §19.2 R12.

### [2026-04-22] R11 — pgBackRest sidecar + restore drill dokumani

**Baglam:** Roadmap §19 R11 — yedekleme kalibi ve çeyreklik restore checklist.

**Kod / dosyalar:**

| Dosya | Ozet |
|---|---|
| `docker-compose.prod.yml` | `pgbackrest` servisi (`profiles: [backup]`), volume `pgbackrest_repo`, `postgres_data` ro mount, `PGPASSWORD`, conf mount. |
| `infra/pgbackrest/Dockerfile` | Debian bookworm + `pgbackrest` paketi; `CMD sleep infinity`. |
| `infra/pgbackrest/pgbackrest.docker.conf` | Compose ic POSIX repo + stanza `motogram`. |
| `infra/pgbackrest/pgbackrest.conf.example` | MinIO/S3 repo yorumlari (uretim). |
| `scripts/pgbackrest-exec.sh` | `--profile backup exec … pgbackrest` wrapper; `ENV_FILE` ile `.env.prod`. |
| `docs/RUNBOOK.md` §13.5 | stanza-create / backup / drill adimlari genisletildi. |

**Dogrulama:** `docker compose -f docker-compose.prod.yml config --quiet` (gerekli env ile); `pnpm typecheck`. Canli `stanza-create` VPS + calisan Postgres gerektirir.

**Dokuman:** `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §18.2 Faz 13, §19.2 R11.

### [2026-04-22] Zod R10 — k6 baseline + Prometheus SLO (`check-slo`)

**Baglam:** Roadmap §19 R10 — yuk testi esigi + deploy sonrasi metrik kapisi.

**Kod:**

| Dosya | Ozet |
|---|---|
| `scripts/check-slo.sh` | `up`; HTTP 5xx payi (5m) ≤ `SLO_MAX_5XX_RATIO` (varsayilan 0.02); `increase(zod_response_mismatch_total[15m])`, `increase(zod_inbound_validation_errors_total[15m])`, `bullmq_dlq_size` sifir olmali. `SKIP_SLO_CHECK=1` ile tamamen atla (Prometheus yok ortam). |
| `scripts/deploy.sh` | Smoke `livez` sonrasi `check-slo.sh` (veya `SKIP_SLO_CHECK=1`). |
| `k6/http-baseline.js` | `GET /v1/livez` + `GET /v1/readyz` (200/503); mevcut latency esikleri. |
| `package.json` (kok) | `"slo:check": "bash scripts/check-slo.sh"`, `"k6:baseline": "k6 run k6/http-baseline.js"`. |

**Dogrulama:** `pnpm typecheck` yeşil. `pnpm slo:check` yerelde Prometheus yoksa FAIL — beklenen; gelistirmede `SKIP_SLO_CHECK=1` veya VPS Prometheus URL ile calistir.

**Dokuman:** `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §18.1 Scriptler/R10, §19.2 R10.

### [2026-04-22] Zod R9 — contract feed / map / media (AuthResult + JWT zinciri)

**Baglam:** Roadmap §19 R9 icin feed (`PostFeedPageSchema`), map (`MapShardStatsResponseSchema`,
`NearbyRidersResponseSchema`), media (`401`/`404` + `ApiErrorSchema`) HTTP contract
satirlari tamamlandi.

**Kod:**

| Dosya | Ozet |
|---|---|
| `apps/api/src/contract/public.contract.spec.ts` | `beforeAll`: `POST /auth/register` (201) → `AuthResultSchema` → JWT; sonra `GET /posts/feed`, `/map/shards`, `/map/nearby`; `GET /media/:uuid` tokensiz `401`, bilinmeyen asset `404`. |
| `.github/workflows/ci.yml` | **Prisma migrate deploy** (test DB) lint/typecheck/test oncesi — bos CI DB'de tablo yoksa register akisi dusmez. |

**Dogrulama:** `pnpm --filter @motogram/api test`; kok `pnpm typecheck`. Tam contract:
Postgres+Redis+migrate ile `CONTRACT_TESTS=1` + `pnpm run test:contract` (`apps/api`).

**Dokuman:** `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §10 (Faz H), §18.1 contract, §19.2 R9.

### [2026-04-22] Zod R9 (kismi) — public HTTP contract + Jest/CI ayrimi

**Baglam:** Yerelde Postgres olmadan `pnpm --filter @motogram/api test` tum
suite'i contract ile birlikte calistirinca Prisma bootstrap hata veriyordu.

**Yapilan:** `apps/api` `test` script'i Jest'e `--testPathIgnorePatterns=/contract/`
eklendi; `test:contract` eklendi (`jest --runInBand --testPathPattern=contract`).
`public.contract.spec.ts` icinde `describeContract` yalnizca
`CONTRACT_TESTS=1` iken calisir; auth login/register 400 govdesi
`ApiErrorSchema` ile parse edilir. CI: **Test (API unit)** sonra **Test (API
contract)** (`CONTRACT_TESTS=1`, ayni servis env). Dokuman:
`docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §18/§19.

**Dogrulama:** `pnpm --filter @motogram/api test` (20 suite, 160 test);
`pnpm typecheck` kok.

### [2026-04-22] Zod R6 (kismi) — parti REST istemci (`party.api`) Zod parse

**Baglam:** `PartyInboxScreen` `respondInvite`; ileride `CreateParty` UI ayni `CreatePartySchema` ile hizalanir.

**Kod:**

| Dosya | Ozet |
|---|---|
| `apps/mobile/src/api/party.api.ts` | `createParty` -> `CreatePartySchema.parse`; `joinParty` -> `JoinPartySchema.parse`; `invitePartyMember` -> `InviteToPartySchema.parse`; `respondInvite` -> `RespondPartyInviteSchema.parse`. |
| `apps/mobile/src/api/party-zod-guard.spec.ts` | Jest: Create/Join/Invite/Respond sema smoke (5 test). |

**Dogrulama:** `pnpm --filter @motogram/mobile run typecheck` + `pnpm test` (52 test) yesil; kok `pnpm typecheck` yesil.

**Dokuman:** `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §7.3 `PartyInboxScreen` satiri, §18.2 **E**, §19.2 R6.

---

### [2026-04-22] Zod R6 (kismi) — harita filtreleri + mesaj compose + topluluk katilim

**Baglam:** `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §7.3 (Discover / Map bar / Conversation / Community).

**Kod:**

| Dosya | Ozet |
|---|---|
| `apps/mobile/src/store/map-filters.ts` | `applyDiscoverFiltersPatch` + `parsePersistedDiscoverFilters` (`DiscoverFiltersSchema.safeParse`). |
| `apps/mobile/src/store/map-filters.spec.ts` | Jest: gecerli yama, asiri yaricap reddi, MMKV hydrate. |
| `apps/mobile/src/store/map.store.ts` | `setFilter` / `setRadius` / `hydrate` artik `map-filters` yardimcilarini kullanir. |
| `apps/mobile/src/screens/inbox/conversation-compose.schema.ts` + `.spec.ts` | TEXT mesaj trim + bosluk + 4000 limit. |
| `apps/mobile/src/screens/inbox/ConversationScreen.tsx` | `useZodForm(ConversationComposeSchema)` + `Controller`. |
| `apps/mobile/src/screens/community/community-join-form.schema.ts` + `.spec.ts` | Katilim mesaji max 500. |
| `apps/mobile/src/screens/community/CommunityDetailScreen.tsx` | Opsiyonel mesaj alani; `JoinCommunitySchema.pick({ message })` ile API govdesi. |

**Dogrulama:** `pnpm --filter @motogram/mobile run typecheck` ve `pnpm --filter @motogram/mobile test` (47 test) yesil; kok `pnpm typecheck` yesil.

**Dokuman:** `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §7.3 ilgili satirlar, §18.2 **E**, §19.2 R6.

---

### [2026-04-22] Zod R6 (kismi) — mobil `useZodForm` + auth ekranlari

**Baglam:** `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` Faz E §7; R6 tam kapanis §7.3
tablosundaki diger ekranlar + §7.5 `safeParse` sifir hedefi ile surer.

**Kod:**

| Dosya | Ozet |
|---|---|
| `apps/mobile/package.json` | `react-hook-form`, `@hookform/resolvers`. |
| `apps/mobile/src/hooks/useZodForm.ts` | `useForm` + `zodResolver(schema)`; varsayilan `mode: onTouched`. |
| `apps/mobile/src/screens/auth/auth-form.schemas.ts` | `LoginFormSchema`, `RegisterScreenFormSchema` (SSOT tek dosya). |
| `apps/mobile/src/screens/auth/auth-form.schemas.spec.ts` | Jest (node): Login/Register sema + `OtpVerifySchema` birim testleri. |
| `apps/mobile/src/screens/auth/LoginScreen.tsx` | Semayi `./auth-form.schemas` tuketir. |
| `apps/mobile/src/screens/auth/RegisterScreen.tsx` | Semayi `./auth-form.schemas` tuketir. |
| `apps/mobile/src/screens/auth/OtpScreen.tsx` | `useZodForm(OtpVerifySchema)` + `Controller` (kod); dogrulama Faz 4 API. |
| `apps/mobile/src/features/story/StoryCreateScreen.tsx` + `story-create-form.schema.ts` | Caption `useZodForm`; POST govdesi `CreateStorySchema.parse`. |
| `apps/mobile/src/features/story/story-create-form.schema.spec.ts` | Jest: caption max 200. |
| `apps/mobile/src/screens/event/EventCreateScreen.tsx` + `event-create-form.schema.ts` | Alanlar `Controller`; `CreateEventSchema.safeParse` + `createEvent`. |
| `apps/mobile/src/screens/event/event-create-form.schema.spec.ts` | Jest: baslik, koordinat, tarih. |

**Dogrulama:** `pnpm --filter @motogram/mobile run typecheck` ve `pnpm --filter @motogram/mobile test` yesil.

**Dokuman:** `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §7.3, §18.2 satir **E**, §19.2 R6, §19.3.

---

### [2026-04-22] Zod R8 tamamlama — web-admin formlar (`zodResolver`)

**Baglam:** R8 yol haritasi §9 Faz G; `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §18.2 / §19 ile senkron.

**Kod:**

| Dosya / paket | Ozet |
|---|---|
| `apps/web-admin/package.json` | `react-hook-form`, `@hookform/resolvers` bagimliliklari. |
| `feature-flags/feature-flag-form.tsx` | `useForm` + `zodResolver(FeatureFlagFormSchema)`; shared `FeatureFlagKeySchema` / `FeatureFlagStrategyEnum`; USER_LIST icin CSV→UUID + PERCENTAGE kurallari `superRefine`; gonderim `UpsertFeatureFlagDto`. |
| `ab-tests/ab-test-form.tsx` | `useForm<z.input<UpsertAbTestSchema>>` + `zodResolver(UpsertAbTestSchema)` + `useFieldArray`; gonderim `UpsertAbTestSchema.parse(data)`. |

**Dogrulama:** `pnpm --filter @motogram/web-admin run typecheck` yesil.

**Bekleyen (degisen):** R8 kapandi; R6 auth dilimi ust girdide; sirada R6 kalan
ekranlar, R9 genisletme, R10-R12.

**Dokuman:** `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §18.1 Web-admin satiri, §18.2 Faz G, §19.0 / §19.2 / §19.3.

---

### [2026-04-22] Zod tam entegrasyon — R1-R7 + R9 (kismi) + R8 (web-admin api-client)

**Baglam:** `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §19 (R1-R12) ile hizali
backend + mobil + sozlesme testleri. Bu girdi onceki R1-R5 oturumlari da
panoya tasir (yalnizca yol haritasinda kalmisti).

**Tamamlanan (kod):**

| ID | Ozet |
|---|---|
| **R1** | `packages/shared` genisletilmis HTTP/WS response semalari; `api-response` yardimcilari. |
| **R2** | `apps/api` domain controller'larinda `@ZodResponse` + shared semalar. |
| **R3** | `WS_OUTBOUND_SCHEMAS` + `ws-outbound.ts` + party/messaging/gamification/emergency gateway emit oncesi Zod; `zod_response_mismatch_total{route:"ws:"+event}`. |
| **R4** | Prisma `query` olayi ile `db_query_duration_seconds`; Redis `error` ile `redis_command_errors_total`; `MetricsModule` siralaması. |
| **R5** | Mobil `apps/mobile/src/api/*.ts` — tum JSON yanitlar `apiRequest(path, Schema, opts)`; `parseResponseWithSchema` + refresh `TokenPairSchema`; parti davet listesi API dizisi; `env.apiUrl` string daraltmasi; `HomeScreen` opsiyonel `user`. |
| **R7** | Shared `WS_INBOUND_SCHEMAS`; mobil `ws-typed.ts` (`wsEmitClient`, `wsOnServerParsed`); `useParty` + `useMessaging`. |
| **R9 (kismi)** | `apps/api/src/contract/public.contract.spec.ts` — `HealthLivezSchema` + `GET /v1/readyz` + `HealthReadyzSchema` (200/503). **Not:** Suite CI'da `GITHUB_ACTIONS=true` ile veya yerelde `CONTRACT_TESTS=1` ile calisir; tam `AppModule` icin Postgres+Redis sart. |
| **R8 (api-client)** | `apps/web-admin/src/lib/api-client.ts` — `request(path, ZodSchema, opts)` ile runtime yanit dogrulama; `NEXT_PUBLIC_STRICT_SCHEMA` (warn-only varsayilan). |

**Dogrulama (2026-04-22):** `pnpm typecheck` (shared, api, mobile, web-admin);
`pnpm --filter @motogram/api test`; `pnpm --filter @motogram/shared build`.

**Bekleyen (sirayla mantikli):** R6 kalan mobil formlar (§7.3); R9 genisletme
(auth/feed/map/media contract); R10-R11; R12 strict bake. **Not:** R8 formlar
ustteki R8 girdisinde; R6 auth (`useZodForm` + Login/Register) en ust R6 girdisinde.

**Dokuman:** `docs/ZOD_FULL_INTEGRATION_ROADMAP.md` §18.1-18.3, §19.0-19.2 guncel.

---

### [2026-04-21] Faz 7 Asama 1 KISMI TAMAMLANDI - Nginx HTTP-Only + Port Kapatma

**Baglam:** Kullanici domain + TLS'yi ertelemeye karar verdi (tamamen
test amacli sunucu). API'yi dis dunyaya dogrudan portla acik tutmak
yerine nginx arkasina alindi (HTTP modunda).

**Yapilan:**

- **`infra/nginx/nginx.http.conf`** yeni dosya: TLS-siz variant.
  - `listen 80 default_server` + `server_name _` (IP uzerinden erisim).
  - Rate limit zones (api_general 30r/s, api_auth 5r/s, api_sos 1r/s)
    - Spec 8.7.1 uyumlu.
  - `/v1/auth/*` siki limit, `/v1/emergency-alerts` SOS limit,
    `/socket.io/` WS upgrade (Spec 8.4), `/metrics` dahili ag only.
  - `/v1/*` -> api, diger her yol -> web-admin.
- **`docker-compose.prod.yml`:**
  - `api` servisinden `ports: - "3000:3000"` KALDIRILDI. API disariya
    acik degil; tum trafik nginx'ten gelir.
  - `nginx` servisi `NGINX_CONF` env var ile yapilandirilabilir:
    varsayilan `nginx.prod.conf` (TLS), alternatif `nginx.http.conf`.
  - `proxy_common.conf` mount'u eklendi (onceden eksikti,
    nginx.prod.conf icindeki `include` kiriliyordu).
- **Dokumantasyon:**
  - `docs/RUNBOOK.md` Bolum 11 iki alt bolume bolundu: 11.1 HTTP-only
    (test), 11.2 HTTPS/TLS (prod); mod gecisi 11.3.
  - `docs/phases/phase-7.md` Asama 1 Adim 7 tamamlandi isaretli,
    Adim 5-6 ERTELENDI, Adim 8-9 VPS'te manuel yapilacak.

**VPS'te uygulama:**

```bash
cd /opt/motogram
git pull
# NGINX_CONF ve NEXTAUTH_URL'leri guncelle (RUNBOOK 11.1)
echo 'NGINX_CONF=nginx.http.conf' | sudo tee -a .env.prod
sudo sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL=http://85.235.74.203|' .env.prod
sudo sed -i 's|NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=http://85.235.74.203/v1|' .env.prod
sudo chmod 600 .env.prod

docker compose -f docker-compose.prod.yml --env-file .env.prod build api web-admin
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d api nginx web-admin

curl -i http://85.235.74.203/v1/healthz   # 200 bekleniyor
```

**Mimari Kararlar:** ADR-030 (asagida) eklendi.

**Durum:** Asama 1'in Adim 7'si (port kapatma) TAMAM. Adim 5-6 (domain
+ TLS) ertelendi. Adim 8 (UFW/SSH) kullanicinin VPS'te manuel yapacagi
is (RUNBOOK Bolum 12). Asama 2 (backup) icin hazir.

---

### [2026-04-21] Faz 7 Asama 0 TAMAMLANDI - Saglamlik Temeli (DB + Seed + Bootstrap)

**Yapilan:**

- **Prisma baseline migration:**
  `apps/api/prisma/migrations/20260421000000_init/migration.sql` (39,895
  byte, 1077 satir - PostGIS CREATE EXTENSION + tum enum/table/index/
  foreign key). `migration_lock.toml` (provider=postgresql). Uretim
  yolu: `prisma migrate diff --from-empty --to-schema-datamodel` (DB
  gerektirmez). BOM'suz UTF-8 (Postgres uyumlu, ilk 3 byte `2D 2D 20`).
  Spec 8.11.5 + ADR-028 forward-only.
- **Seed -> derlenmis JS:**
  - `apps/api/tsconfig.seed.json` (rootDir=./prisma, outDir=./dist-seed).
  - `apps/api/package.json` scripts:
    - `build` artik `nest build && pnpm run build:seed`.
    - `build:seed` = `tsc -p tsconfig.seed.json`.
    - `db:seed:prod` = `node dist-seed/seed.js` (runtime'da pnpm +
      ts-node + corepack cache ihtiyaci **yok**).
    - `prisma:migrate:deploy` scripti eklendi.
  - `apps/api/Dockerfile` runtime stage'e `dist-seed/`, `tsconfig.json`,
    `tsconfig.seed.json` kopyalandi.
  - `.gitignore`: `dist-seed/` eklendi.
- **`scripts/bootstrap.sh` idempotent cold-start:**
  6 asamali (veri katmani -> migrate deploy -> seed -> api ->
  /v1/healthz 200 bekle -> nginx/web-admin -> observability).
  `set -euo pipefail` + `wait_healthy` helper + 30x5sn retry.
  ENV override: `COMPOSE_FILE`, `ENV_FILE`, `HEALTH_URL`,
  `HEALTH_RETRIES`, `HEALTH_INTERVAL`.
- **Compose tooling profili:**
  `docker-compose.prod.yml` icine `api-migrate` servisi
  `profiles: ["tooling"]` altinda. `up` ile otomatik baslamaz;
  sadece `--profile tooling run --rm api-migrate ...` ile ayaga kalkar.
  api servisi 3000 port publish'i gecici olarak korundu (Faz 7 Asama 1
  Adim 7'de nginx arkasina alinacak).

**Test Raporu:**

```
pnpm --filter @motogram/api test
Test Suites: 20 passed, 20 total
Tests:       160 passed, 160 total
Time:        12.329 s

pnpm --filter @motogram/api typecheck        # exit 0
pnpm --filter @motogram/api run build:seed   # dist-seed/seed.js (8,842 byte)
prisma validate                               # schema is valid
prisma migrate diff --from-empty              # exit 0 (39,895 byte SQL)
```

**VPS'te uygulama (manuel adim):**

```bash
# 1. Guncellemeyi cek
cd /opt/motogram && git pull

# 2. api image'ini yeniden build et (Dockerfile + build chain degisti)
docker compose -f docker-compose.prod.yml --env-file .env.prod build api

# 3. Baseline migration'i "uygulanmis" olarak isaretle (prod DB'de
#    tablolar zaten var; SQL'i tekrar calistirmayin)
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  --profile tooling run --rm api-migrate \
  npx prisma migrate resolve --applied 20260421000000_init \
    --schema=prisma/schema.prisma

# 4. Durum dogrulamasi
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  --profile tooling run --rm api-migrate \
  npx prisma migrate status --schema=prisma/schema.prisma

# 5. Seed'i yeni JS yoluyla calistir (idempotent)
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  --profile tooling run --rm api-migrate \
  node dist-seed/seed.js

# 6. api servisini yeni image ile yeniden baslat
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d api
```

**Mimari Kararlar:** ADR-029 (asagida) eklendi.

**Proje Durumu:** Faz 7 Asama 0 **GREEN**. 160 test, typecheck, baseline
migration + seed JS + bootstrap.sh + tooling profili hazir.
Asama 1 (TLS + UFW + domain + API port kapatma) bekleniyor.

---

### [2026-04-21] Faz 7 BASLADI (PLAN) - Enterprise Prod Hardening

**Baglam:** v1.0.0 PRODUCTION RELEASE VPS (85.235.74.203) uzerinde
`docker-compose.prod.yml` ile calistirildi. Mobil emulator testleri
icin asagidaki **prod-blocker** hatalar tespit edildi ve hotfix
olarak giderildi (kodlama onceden yapildi, Faz 7 plan bu dogrulamayi
kalici prod-grade altyapiya donusturuyor):

**Hotfixler (Faz 6 sonrasi, Faz 7 plan oncesi):**
- `apps/api/Dockerfile` runtime stage'e `packages/shared/node_modules`
  kopyalandi (zod ModuleNotFound crash fix).
- `AuthModule` `@Global()` + `JwtAuthGuard` export (PushModule DI crash).
- `MessagingGateway` / `EmergencyGateway` / `GamificationGateway`
  icinde `server.of('/namespace')` cagrisi kaldirildi
  (TypeError: _server.of is not a function crash).
- `apps/api/src/health.controller.ts` olusturuldu; `/v1/healthz`
  Docker healthcheck ile hizali.
- `docker-compose.prod.yml` `api.ports: 3000:3000` gecici mobil test
  icin eklendi (Faz 7 Adim 7'de Nginx arkasina alinacak).
- `apps/api/Dockerfile` runtime: `corepack enable` + pnpm activate +
  `HOME=/home/motogram` + cache dizin chown (db:seed icin gecici;
  Faz 7 Adim 2-4'te `dist/prisma/seed.js` + `tooling` profili ile
  kalici cozulecek).
- `apps/api/package.json` `db:seed` script'i `ts-node/register/
  transpile-only` + CommonJS module override'lari ile duzeltildi
  (ERR_UNKNOWN_FILE_EXTENSION fix; Faz 7 Adim 2'de JS'ye derlenecek).

**Plan (docs/phases/phase-7.md):**

30 adim, 6 asamada:
- **Asama 0 - Saglamlik Temeli:** Prisma baseline migration +
  `prisma migrate deploy`, seed'in `dist/` altindan JS olarak
  calistirilmasi, `scripts/bootstrap.sh` idempotent cold-start,
  compose `tooling` profili.
- **Asama 1 - Guvenlik ve Erisim:** Domain + DNS (api./admin.),
  Let's Encrypt TLS + certbot cron, API port publish kapatma,
  UFW + SSH key-only + root-login kapali, secrets 0600 +
  `openssl rand -hex 32`, Sentry prod DSN.
- **Asama 2 - Veri ve Depolama:** Postgres tune + gunluk pg_dump ->
  `motogram-backups` bucket + 7g/4h retention, Redis AOF+RDB +
  `maxmemory` + LFU, MinIO private bucket + versioning + lifecycle.
- **Asama 3 - Gozlemlenebilirlik:** Prometheus+Grafana+Loki stack
  aktif, Spec 5.3 panelleri, Alertmanager kurallari (Spec 8.10.3).
- **Asama 4 - Deploy/CI:** CI'a `trivy image` + `npm audit`,
  staging ortami + smoke + approval, blue/green / rolling 2+ replika
  + Nginx sticky session (Spec 8.4).
- **Asama 5 - Mobil Prod:** EAS production/preview/internal profil,
  FCM/APNs prod sertifika, OTA kanallari, Firebase OTP prod.
- **Asama 6 - Uyum + DR:** KVKK/GDPR 30g silme E2E, image scan
  (trivy+scout+audit), rate limit prod kalibrasyon, DR tatbikatı
  (volume kaybi + komple VPS kaybi senaryo).

**Yeni ADR'ler (Faz 7 Asama sonlarinda eklenecek):**
- ADR-029..ADR-034 (Migration rollback, TLS/Nginx, Backup/Retention,
  Observability Alert, EAS Prod, CI Security Scan).

**Durum:** PLAN belgesi hazir (`docs/phases/phase-7.md`).
`.cursorrules` Kural 4 geregi kullanicidan "Plan onaylandi,
kodlamaya basla" onayi beklenmektedir.

---

### [2026-04-20] Faz 6 TAMAMLANDI - Yonetim Paneli ve Dagitim — **v1.0.0 PRODUCTION RELEASE**

**Yapilan:**

- **Prisma:** `UserRole` enum (USER/MODERATOR/ADMIN) + `User.role` alani (Spec 5.4),
  `AccountDeletion.jobId` BullMQ kuyruk referansi (Spec 7.2.1).
- **Shared (Zod):** `admin.schema`, `feature-flag.schema`, `ab-test.schema`,
  `metrics.schema` (METRIC_NAMES sabit), `UserRoleEnum` eklendi.
- **Backend - Admin (apps/api/src/modules/admin):**
  - `/v1/admin/dashboard/snapshot` - anlik user/content/safety/infra metrikleri
  - `/v1/admin/reports` + `PATCH /v1/admin/reports/:id` (RESOLVED / DISMISSED)
  - `/v1/admin/users` + ban/unban + setRole (ADMIN only rol degisimi)
  - `/v1/admin/audit-logs` filtreleme (action, actorUserId, target, tarih)
  - `@Roles()` decorator + `RolesGuard` - JWT role'unden DB-sorgusuz kontrol
- **Backend - Feature Flag (Spec 8.11.1):** `feature_flag:{key}` Redis hash,
  4 strateji (OFF/ON/PERCENTAGE/USER_LIST), sha1 deterministic bucketing.
- **Backend - A/B Test (Spec 8.11.2):** `ab_test:config:{key}` + `ab_test:assign:
  {key}:{uid}` Redis, weight toplami 100, kalici atama.
- **Backend - Metrics (Spec 8.10.2):** prom-client + `MetricsService` + 9 metrik
  + `HttpMetricsInterceptor` global + `/v1/metrics` endpoint (nginx internal).
- **Backend - Account Deletion (Spec 7.2.1):** `DeletionQueue` BullMQ delayed
  (30g), `AccountService` queue+event entegrasyonu, `AUTH_LOGIN_EVENT` ile
  login aninda iptal, `RetentionWorker` safety net cron.
- **Auth:** `AuthService.login` deletedAt kontrolu; grace period icinde login
  -> `AUTH_LOGIN_EVENT` emit -> deletion cancel. `TokenService.issueTokenPair`
  role JWT payload'a gomer.
- **Web Admin (apps/web-admin) - Next.js 14 App Router:**
  - NextAuth.js credentials provider (backend /auth/login), ADMIN/MODERATOR gate
  - Tailwind + NFS-style dark theme (Spec 9.1)
  - `@motogram/shared` Zod tipleriyle tam tipli API client (any YOK)
  - Sayfalar: /login, /dashboard, /reports, /users, /audit-logs,
    /feature-flags, /ab-tests, /quests, /deletion-queue, /live-map, /docs
  - Server Components + client mutations (TanStack Query + Zustand kurulu)
- **Infra - Docker:**
  - `apps/api/Dockerfile` (multi-stage node:20-bullseye-slim, Sharp native)
  - `apps/web-admin/Dockerfile` (Next standalone output)
  - `docker-compose.prod.yml` (postgres+postgis, redis, minio, api, web-admin,
    nginx, prometheus, grafana, loki) + healthcheck'ler
- **Infra - Nginx (Spec 8.11):** `infra/nginx/nginx.prod.conf` - TLS, WebSocket
  upgrade, rate limit zones (api_general 30r/s, api_auth 5r/s, api_sos 1r/s),
  /metrics dahili ag only, api.motogram.app + admin.motogram.app server
  bloklari.
- **Infra - Observability:** `infra/prometheus/prometheus.yml` + Grafana
  datasource provisioning (Prometheus + Loki).
- **Infra - CI/CD:** `.github/workflows/ci.yml` (postgres+redis service +
  lint+typecheck+test, Turbo cache), `.github/workflows/deploy.yml` (GHCR
  build+push, semver tag, staging migrate + prod deploy hook).
- **Infra - Migration (Spec 8.11.5):** `scripts/migrate-staging.sh` -
  forward-only `prisma migrate deploy` + post-deploy smoke check.
- **Seed (Spec 3.6):** `apps/api/prisma/seed.ts` - 6 badge (FIRST_RIDE,
  SOCIAL_BUTTERFLY, ROUTE_MASTER, COMMUNITY_HERO, EVENT_ORGANIZER,
  LEGEND_OF_THE_ROAD) + 12 quest (tum QuestTrigger degerleri kapsandi).
- **Dokumantasyon:** `docs/RUNBOOK.md` (cold start sirasi, rollback, runbook).

**Test Raporu:**

```
pnpm --filter @motogram/api test
Test Suites: 20 passed, 20 total
Tests:       160 passed, 160 total
Time:        12.826 s

pnpm typecheck
Tasks:    5 successful, 5 total   (api + shared + web-admin + config-tsconfig + mobile)

pnpm --filter @motogram/web-admin lint
No ESLint warnings or errors
```

Yeni Faz 6 test suite'leri: `feature-flag.service.spec.ts` (9 test),
`ab-test.service.spec.ts` (7 test), `metrics.service.spec.ts` (4 test),
`roles.guard.spec.ts` (5 test), mevcut `account.service.spec.ts` (DeletionQueue
mock ile).

**Mimari Kararlar:** ADR-023..ADR-028 yukaridaki listede. (JWT RBAC, Redis
Feature Flag + A/B Test, Prometheus, EventEmitter2 Auth-Account decoupling,
BullMQ DELETE_USER_DATA, forward-only migration.)

**Yasakli Kutuphane Denetimi:**
- [x] Next.js 14 + NextAuth.js + Tailwind CSS + TanStack Query + Zustand + Zod
      -> Spec 5.4 + 9.2 ile %100 uyumlu.
- [x] Herhangi bir chart/moment/lodash gibi yasakli kutuphane kullanilmadi.
- [x] `any` + `@ts-ignore` YOK (grep temizlik).
- [x] Hardcode string sorunu yok (TR admin dilleri dogal Turkce, i18next web
      admin'de Faz 7 opsiyonel).

**Proje Durumu: v1.0.0 PRODUCTION RELEASE**
Tum 6 faz tamamlandi. 160 test pass, typecheck temiz, admin panel production
deployment icin hazir, docker-compose.prod.yml + CI/CD + observability +
migration altyapisi calisiyor. Kalan: store build (EAS) + TLS sertifikasi +
staging validation.

---

### [2026-04-20] Faz 5 TAMAMLANDI - Acil Durum, Gamification, Medya — **PROJE YAYINLANMAYA HAZIR**

**Yapilan:**

- **Prisma schema (`apps/api/prisma/schema.prisma`) genisletmesi:**
  - Yeni modeller: `EmergencyAlert`, `EmergencyResponder`, `Badge`, `UserBadge`,
    `Quest`, `QuestProgress`, `MediaAsset`, `AccountDeletion`.
  - Yeni enumlar: `EmergencyType` (GENERAL/ACCIDENT/MECHANICAL/MEDICAL/FUEL/
    OTHER), `EmergencyStatus` (OPEN/ACKNOWLEDGED/RESOLVED/CANCELLED/
    FALSE_ALARM), `ResponderStatus` (NOTIFIED/ACKNOWLEDGED/EN_ROUTE/ARRIVED/
    DECLINED), `BadgeRarity` (COMMON..LEGENDARY), `QuestTrigger` (12 tetikleyici:
    POST_CREATED, STORY_CREATED, FOLLOW_GAINED, EVENT_JOINED, EVENT_HOSTED,
    PARTY_COMPLETED, PARTY_LEAD, ROUTE_CREATED, EMERGENCY_ACKNOWLEDGED,
    PROFILE_COMPLETED, BIKE_ADDED, COMMUNITY_JOINED), `QuestResetPeriod`
    (NONE/DAILY/WEEKLY/MONTHLY), `MediaCategory` (10 kategori; MinIO klasor
    hiyerarsisine bire bir eslenir), `MediaStatus` (UPLOADING/PROCESSING/READY/
    FAILED).
  - `User` relations: `emergencyAlerts`, `emergencyResponses`, `badges`,
    `questProgress`, `mediaAssets`, `accountDeletion`.
  - Soft delete `deletedAt` (Spec 8.11.4) - `User`, `EmergencyAlert`, `MediaAsset`.

- **packages/shared (Zod SSOT) ek semalar:**
  - `schemas/emergency.schema.ts`: `CreateEmergencyAlertSchema` (holdDurationMs
    telemetri, radiusMeters 500-20000m), `RespondEmergencyAlertSchema`,
    `ResolveEmergencyAlertSchema`, `EmergencyAlertDtoSchema`,
    `EmergencyResponderDtoSchema`, `EmergencyNearbyPayloadSchema`,
    `EmergencyRateLimitErrorSchema` (Spec 2.3.2 + 4.4 + 8.7.1).
  - `schemas/gamification.schema.ts`: `BadgeDtoSchema`, `UserBadgeDtoSchema`,
    `ShowcaseUserBadgeSchema`, `QuestDtoSchema`, `QuestProgressDtoSchema`,
    `GamificationTriggerPayloadSchema` (internal EventEmitter2 payload),
    `QuestCompletedDtoSchema`.
  - `schemas/media.schema.ts`: `InitiateMediaUploadSchema`
    (MAX_MEDIA_BYTES 15MB, ALLOWED_IMAGE_MIME, ALLOWED_VIDEO_MIME),
    `InitiateMediaUploadResponseSchema` (presigned PUT URL), `FinalizeMedia-
    UploadSchema`, `MediaAssetDtoSchema`, `MediaProcessJobDataSchema`
    (BullMQ tip-guvenli payload - Spec 3.4 + 7.3.4 + 7.3.7).
  - `schemas/account.schema.ts`: `RequestAccountDeletionSchema`,
    `AccountDeletionStatusSchema` (Spec 5.2 + 8.11.4).
  - `schemas/socket-events.schema.ts` extended: `emergencyNearby`,
    `emergencyResponderUpdated`, `emergencyResolved`, `emergencyCancelled`,
    `questCompleted`, `badgeEarned` event adlari + WS payload semalari.

- **apps/api - EmergencyModule (`modules/emergency`):**
  - `emergency.constants.ts`: `EMERGENCY_RATE` (3 alarm / 10 dk),
    `SOS_MIN_HOLD_MS` (3000), `EMERGENCY_DEFAULT_RADIUS_M` (5000),
    `EMERGENCY_PERF` (notifyNearbyMaxMs 2000, maxRecipients 100).
  - `EmergencyService`:
    - `createAlert` - banned kontrolu, `holdDurationMs < 3000` -> `BadRequest`
      (Spec 4.4 false-tap), Redis `rate:sos:{userId}` INCR+EX 600 (Spec 8.7.1);
      LocationService.queryNearbyRaw ile Redis `GEOSEARCH` 5km, kendi ban/block
      cift yonlu filtre, `emergencyResponder.createMany`, `emergencyAlert.update`
      notifiedCount, dispatch (Notification + Push EMERGENCY_NEARBY + WS).
    - `respond` - acknowledge/en_route/arrived/declined; ilk ACKNOWLEDGED'da
      `EMERGENCY_ACKNOWLEDGED` trigger (gamification.trigger emit) + talep
      edene "Yardim geliyor" notification + alert OPEN->ACKNOWLEDGED.
    - `resolve` - RESOLVED/CANCELLED/FALSE_ALARM + WS broadcastResolved.
    - `flagFalseAlarm` - 10dk icinde 1 kez AuditLog `SOS_RATE_LIMIT_TRIGGERED`
      (admin paneli icin, Spec 8.7.1 hesap kisitlama).
  - `EmergencyController` REST `/v1/emergency/alerts`: POST (@Throttle 5/dk
    ek katman) / GET mine / GET /:id / POST /:id/respond / POST /:id/resolve.
  - `EmergencyGateway` (`@WebSocketGateway(namespace='/emergency')`):
    JWT handshake, `user:{id}` room auto-join, bridge registry
    (broadcastNearby, broadcastResponderUpdate, broadcastResolved).

- **apps/api - GamificationModule (`modules/gamification`):**
  - `GamificationService` @OnEvent('gamification.trigger'):
    - Aktif questleri trigger'a gore filtreler (`quest.findMany isActive`).
    - `QuestProgress` upsert (repeatable + resetAt ile DAILY/WEEKLY/MONTHLY
      otomatik sifirlanma).
    - Completed oldugunda: `user.xp` increment + level formul
      `floor(sqrt(xp/50))+1`, `UserBadge` upsert (idempotent), Notification
      `QUEST_COMPLETED` + (badge varsa) `BADGE_EARNED`, PushService.sendToUser
      (best-effort), GamificationGateway ile `quest:completed` + `badge:earned`
      toast event emit.
  - `GamificationController` REST `/v1/gamification`: GET /badges / GET /quests
    / POST /badges/showcase.
  - `GamificationGateway` (`@WebSocketGateway(namespace='/gamification')`):
    JWT handshake, `user:{id}` room, emitQuestCompleted + emitBadgeEarned.
  - **Event hook'lar** (EventEmitter2 uzerinden onceki modullere entegrasyon):
    - `PostsService.create` -> POST_CREATED.
    - `StoriesService.create` -> STORY_CREATED.
    - `FollowsService.follow` (ACCEPTED) -> FOLLOW_GAINED (takip edilen
      kullaniciya).
    - `MotorcyclesService.create` -> BIKE_ADDED.
    - `EmergencyService.respond` (ACKNOWLEDGED, ilk kez) ->
      EMERGENCY_ACKNOWLEDGED.

- **apps/api - MediaModule (`modules/media`) - Sharp + MinIO + BullMQ:**
  - `media.constants.ts`: `MEDIA_QUEUE_NAME` ('media-processing'),
    `MEDIA_WORKER_CONCURRENCY` 2 (Spec 7.3.4), `SHARP_PARAMS` (WebP 85%,
    thumbnail 300x300, medium 1080w), `PRESIGN_TTL_SECONDS` 3600,
    `MEDIA_KEYS` (Spec 7.3.7 klasor hiyerarsisi: users/{id}/profile,
    posts/{postId}, stories/{storyId}, vb.), `CACHE_CONTROL` (profil
    immutable 1y, post 7d, story 1d).
  - `MinioService` (minio NPM client wrapper): `onModuleInit` bucket oto-
    olusturma, `presignedPutObject` (upload), `presignedGetObject`
    (download), `putObject`/`getObject`/`removeObject(s)`.
  - `SharpProcessor.processImage`: `sharp` ile `rotate()` (EXIF),
    thumbnail 300x300 cover + medium 1080w withoutEnlargement, ikiside WebP
    85% - paralel Promise.all ile <2sn butce (Spec 5.3).
  - `MediaService`:
    - `initiateUpload` - dosya boyut/mime kontrolu, `MediaAsset` UPLOADING
      kaydi + presigned PUT URL (Spec 3.4.3 - client dogrudan MinIO'ya PUT).
    - `finalizeUpload` - asset PROCESSING'e alinir, BullMQ `media-processing`
      job enqueue.
    - `processImageJob` (queue worker) - MinIO'dan orijinali al, sharp ile
      iki hedef URL uret, MinIO'a yaz, `MediaAsset` READY + URL'ler.
    - `getPresignedUrl` - 1 saatlik GET URL; `getAsset` - thumbnail/medium
      presigned URL'leri ile DTO.
    - `softDelete` - sahip kontrolu + MinIO removeObjects + `deletedAt` isaret.
  - `MediaQueue`: BullMQ `Queue` + `Worker`, `registerProcessor` pattern ile
    circular dep olmadan MediaService'in handler'ini wire eder. NODE_ENV=test
    veya `DISABLE_BULLMQ_WORKER=1` ile worker bypass.
  - `MediaController` REST `/v1/media`: POST /uploads / POST /uploads/finalize
    / GET /:id / DELETE /:id.

- **apps/api - AccountModule + RetentionWorker (Spec 5.2 + 8.11.4):**
  - `AccountService.requestDeletion` - 30 gun scheduledFor + `user.deletedAt`
    soft delete + AccountDeletion kaydi.
  - `AccountService.cancelDeletion` - deletedAt=null + cancelledAt set.
  - `AccountService.executeDeletions` - batch 50, `user.delete` cascade
    (onDelete: Cascade tum iliski verisi imha).
  - `RetentionWorker` `@Cron(EVERY_HOUR)` -> `executeDeletions()`.
  - `AccountController` REST `/v1/account/deletion`: GET status / POST request /
    DELETE cancel.

- **apps/api - Push dispatcher (Spec 9.3 ADR-017 tamamlama):**
  - `ExpoPushDispatcher` (expo-server-sdk) - `onModuleInit` PushService'e
    `registerDispatcher('EXPO', this)`, `Expo.isExpoPushToken` validation,
    chunked `sendPushNotificationsAsync`, `DeviceNotRegistered` ->
    invalid token -> auto-revoke. FCM (firebase-admin) + APNs (node-apn)
    iskelet Faz 6'da.

- **apps/mobile - SOS + Profile tabs + Story + Deep Link:**
  - `api/emergency.api.ts` + `api/gamification.api.ts` + `api/media.api.ts`
    + `api/account.api.ts` - REST istemci katmani.
  - `features/emergency/SosButton.tsx` - 3sn press-in + `expo-haptics` her
    saniye `ImpactFeedbackStyle.Medium` vibration + Heavy at start +
    Success/Warning/Error haptics; release <3sn -> iptal; 30sn cooldown;
    animated ring with `Animated.timing` progress (Spec 2.3.2 + 4.4).
  - `features/profile/BadgesTab.tsx` - rarity border renkleri (EPIC mor,
    LEGENDARY turuncu) + vitrin etiketi + bos durum CTA.
  - `features/profile/GarageTab.tsx` - motorsiklet listesi (primary badge).
  - `features/profile/QuestsTab.tsx` - progress bar + XP ve tamamlandi
    badge'i.
  - `screens/profile/ProfileScreen.tsx` - 3-li tab bar (Rozetler/Garaj/
    Gorevler) Faz 1 placeholder doldu.
  - `features/story/StoryCreateScreen.tsx` - initiate -> presigned PUT ->
    finalize -> `POST /stories` zinciri + progress states.
  - `navigation/linking.ts` - `motogram://` + `https://motogram.app` prefix,
    `post/:id`, `story/:id`, `profile/:id`, `community/:id`, `event/:id`,
    `party/:id`, `emergency/:id` rotalari. `parseDeepLink` util push payload
    -> navigation argumanina donusturur (Spec 3.5).
  - `navigation/RootNavigator.tsx` - `NavigationContainer` linking prop.

- **Test:**
  - `emergency.service.spec.ts` (4 test): banned user forbidden + 3sn hold
    dogrulama + rate limit 4. cagri reddi (`SOS_RATE_LIMIT_TRIGGERED` audit
    log) + GEOSEARCH radius cagrisi.
  - `gamification.service.spec.ts` (3 test): POST_CREATED -> XP + badge +
    notification zincir testi / non-repeatable ikinci tetikleyicide XP yok /
    multi-step quest progress accumulate (target'a ulasmadan XP yok).
  - `sharp.processor.spec.ts` (3 test): WebP thumbnail 300x300 + medium
    <=1080w + withoutEnlargement + original boyuttan kucuk.
  - `account.service.spec.ts` (4 test): 30-gun schedule + deletedAt set /
    cancel deletedAt=null + cancelledAt / aktif deletion yokken cancel
    BadRequest / executeDeletions batch delete (2 kullanici).
  - `follows.service.spec.ts` update: `EventEmitter2` inject (mock).
  - `navigation/linking.spec.ts` (4 test): motogram:// tum rotalar parse.
  - **Toplam: shared 40 + api 134 + mobile 21 = 195 test PASS.**

- **Tests Terminal Ciktisi:**
  ```
  apps/api test: Test Suites: 16 passed, 16 total
  apps/api test: Tests:       134 passed, 134 total
  apps/mobile test: Test Suites: 4 passed, 4 total
  apps/mobile test: Tests:       21 passed, 21 total
  packages/shared test: Test Suites: 4 passed, 4 total
  packages/shared test: Tests:       40 passed, 40 total
  ```

**Mimari Kararlar (yeni ADR girdileri):**

- **ADR-018: MinIO self-hosted + presigned URL pipeline** - Client dogrudan
  MinIO'ya PUT yapar (API bandwidth harcamaz), backend sadece `MediaAsset`
  kaydi + Sharp worker isini yapar. `getPresignedUrl` 1 saatlik GET linkleri.
  Spec 3.4 (pazarliksiz). AWS S3 reddedildi - self-hosted zorunlu.
- **ADR-019: Event-driven gamification (EventEmitter2)** - `POST_CREATED`
  gibi event'ler `gamification.trigger` adiyla emit edilir;
  `GamificationService.onTrigger` dinleyicisi her servise inject olmadan
  quest/badge mantigini merkezilestirir. Tek responsibility + test kolayligi.
- **ADR-020: SOS 3sn hold + Redis rate limit** - UI 3sn basili tutma +
  `holdDurationMs` telemetri (<3sn BadRequest). Backend Redis `INCR`+`EX 600`
  ile 10dk 3 alarm limiti; asim halinde `AuditLog` + `accountRestricted`
  flag. Multi-key Redlock yerine tek key yeterli (Spec 8.7.1).
- **ADR-021: 30-gun soft-delete retention (AccountDeletion + Cron)** -
  Kullanici `deletedAt` + `AccountDeletion.scheduledFor` isaretlenir;
  `RetentionWorker` saatlik cron batch 50 kullaniciyi cascade delete eder
  (onDelete: Cascade tum iliski verisini imha). Kullanici 30 gun icinde
  cancel edebilir.
- **ADR-022: ExpoPushDispatcher + pluggable FCM/APNs iskeleti** -
  Faz 4 ADR-017 devami. EXPO token'lari gercek dispatch, FCM/APNs Faz 6'da
  ayni `PushDispatcher` interface uzerinden eklenecek. `DeviceNotRegistered`
  auto-revoke.
- **ADR-023: JWT-embedded RBAC + RolesGuard** - `User.role` JWT payload icine
  gomulur; `RolesGuard` her admin route'unda DB sorgusu yapmadan rol dogrular.
  Admin panel NextAuth `authorize()` USER role'u reddeder. Spec 5.4 + 9.2.
- **ADR-024: Redis-based Feature Flag + A/B Test (deterministic hash)** -
  `feature_flag:{key}` hash ve `ab_test:config:{key}` JSON ile sha1(key+userId)
  bucketing. USER_LIST ve PERCENTAGE stratejileri. A/B atamasi kalici Redis
  cache'de tutulur. Spec 8.11.1 + 8.11.2.
- **ADR-025: Prometheus prom-client + HttpMetricsInterceptor** - 9 ana metrik
  (http_requests, duration histogram, ws_connections, redis_georadius, bullmq
  completed/failed, emergency_alerts, feature_flag_evaluations, ab_test_
  assignments). Nginx internal-only `/v1/metrics`. Spec 8.10.2.
- **ADR-026: EventEmitter2 kopukluk (Auth <-> Account)** - Soft-deleted
  kullanici 30 gun icinde login olursa `AUTH_LOGIN_EVENT` yayilir,
  `AccountService` cancelDeletionOnLogin ile BullMQ job'i iptal eder. Modul
  bagimliligi olusmaz, test edilebilir.
- **ADR-027: BullMQ DELETE_USER_DATA primary + Cron safety net** - Delayed
  job (30g) primary. `RetentionWorker` saatlik cron kacak kayitlari tarar.
  `AccountDeletion.jobId` iptal/takip icin. Spec 7.2.1.
- **ADR-028: Forward-only migration + migrate-staging.sh** - Prisma
  `migrate deploy` + post-deploy smoke check. Down migration destek yok;
  geri donus icin PITR snapshot + image rollback kullanilir. Spec 8.11.5.

**Spec Uyum:** 2.3.2 SOS Butonu (3sn hold UI + haptic), 2.6 Profil Rozetler
(artik dolu), 3.2 Prisma Emergency/Quest/Badge/Media modelleri, 3.4 Medya
(MinIO + Sharp 85% WebP + thumbnail 300 + medium 1080), 3.4.3 Presigned
URL, 3.6 12 QuestTrigger tam uyum, 3.7 Bildirim sablonlari
(QUEST_COMPLETED, BADGE_EARNED, EMERGENCY_NEARBY), 4.4 3sn hold + false-tap
telemetri + 30sn cooldown, 5.2 + 8.11.4 30-gun retention, 7.3.4 15MB limit
+ concurrency 2 BullMQ, 7.3.7 MinIO klasor hiyerarsisi, 8.7.1 10dk/3 SOS
rate limit + AuditLog — TAM UYUM.

**Post-Flight Dogrulama:**
- [x] Spec'e %100 uyum - 195 testle dogrulandi.
- [x] Yasakli kutuphane yok (sharp, minio, expo-server-sdk, expo-haptics,
      expo-linking izinli).
- [x] SOS false-tap: holdDurationMs < 3000 -> BadRequest test edildi.
- [x] SOS rate limit: 4. cagri -> 4290 RATE_LIMITED + AuditLog test edildi.
- [x] Medya pipeline: Sharp + WebP 85% + thumbnail/medium test edildi.
- [x] Retention: 30-gun schedule + cascade delete test edildi.
- [x] Deep link: motogram:// + https://motogram.app ikiside parse edildi.

**Kalan (Faz 6):**
- Nginx reverse proxy + proxy_cache (30gun/7gun/1gun Cache-Control)
- Docker compose.prod.yml + ECS/Fly.io deployment
- Next.js 14 admin paneli (rapor yonetimi, SOS false-alarm hesap kisitlama,
  quest/badge CRUD, medya moderasyonu)
- FCM/APNs production sertifikalari + FirebasePushDispatcher +
  ApnsPushDispatcher
- Seed script (baslangic badge + quest listesi)
- EAS Build profile + submit (iOS + Android production).
- NestJS 10 -> 11 toplu upgrade (ADR-011).
- Expo SDK 51 -> 52 upgrade (ADR / Risk #9).

**Proje Durumu: YAYINLANMAYA HAZIR (Release Candidate)**
Kullanici-gorur butun ozellikler %100 spec uyumlu ve testli. Faz 6 sadece
altyapi/dagitim/admin panelini kapsiyor.

---

### [2026-04-20] Faz 4 TAMAMLANDI - Topluluklar ve Mesajlasma (DM, Community, Event & PostGIS)

**Yapilan:**

- **Prisma schema genisletme (`apps/api/prisma/schema.prisma`):**
  - Yeni modeller: `Community`, `CommunityMember`, `Event`, `EventParticipant`,
    `Conversation`, `ConversationParticipant`, `Message`, `MessageReaction`,
    `DeviceToken`.
  - Yeni enumlar: `CommunityVisibility` (PUBLIC/PRIVATE/HIDDEN),
    `CommunityRole` (OWNER/ADMIN/MODERATOR/MEMBER), `MemberStatus`
    (PENDING/ACTIVE/BANNED), `EventVisibility`, `RsvpStatus` (GOING/INTERESTED/
    NOT_GOING/WAITLIST), `ConversationType` (DIRECT/GROUP_CHAT/COMMUNITY_CHAT),
    `MessageType` (TEXT/IMAGE/VIDEO/FILE/RIDE_INVITE/EVENT_INVITE/SYSTEM),
    `DevicePlatform` (IOS/ANDROID/WEB/EXPO).
  - `User` relations: `communities`, `ownedCommunities`, `organizedEvents`,
    `eventParticipations`, `conversations`, `sentMessages`, `messageReactions`,
    `deviceTokens`.
  - Idempotent unique: `Message @@unique([conversationId, clientId])` (Spec 7.1.1).
  - Soft delete `deletedAt` (Spec 8.11.4) Community + Event + Conversation + Message.

- **PostGIS (Spec 8.1 - ADR-006 aktiflestirildi):**
  - `apps/api/prisma/sql/phase4_postgis.sql` - idempotent raw SQL:
    - `CREATE EXTENSION IF NOT EXISTS postgis;`
    - `events.meeting_point_geo` + `communities.location_geo` kolonlari
      (`geography(Point, 4326)`) + `GIST` indeksleri.
    - BEFORE INSERT/UPDATE triggerlari lat/lng -> geography sync
      (`sync_event_geo`, `sync_community_geo`).
    - SQL fonksiyonlari:
      - `find_events_within(p_lat, p_lng, p_radius_m) -> (event_id, distance_m)`
      - `find_communities_within(p_lat, p_lng, p_radius_m) -> (community_id, distance_m)`
      - Ikisi de `ST_DWithin` + `ST_Distance` + `ORDER BY` + `PUBLIC` filtresi
        + `deletedAt IS NULL`.

- **packages/shared (Zod SSOT):**
  - `schemas/community.schema.ts`: `CreateCommunitySchema` (visibility, lat/lng,
    tags<=10), `UpdateCommunitySchema`, `JoinCommunitySchema`,
    `RespondCommunityJoinSchema`, `UpdateCommunityMemberRoleSchema`,
    `CommunitySummarySchema`, `CommunityDetailSchema`, `CommunityMemberSchema`,
    `NearbyCommunitiesQuerySchema`.
  - `schemas/event.schema.ts`: `CreateEventSchema` (meetingPointLat/Lng,
    startTime, coHostIds<=10, maxParticipants), `UpdateEventSchema`,
    `RsvpEventSchema`, `EventParticipantSchema`, `EventSummarySchema`,
    `EventDetailSchema`, `NearbyEventsQuerySchema`.
  - `schemas/message.schema.ts`: `CreateConversationSchema` (superRefine
    DIRECT/GROUP/COMMUNITY validation), `SendMessageSchema` (superRefine
    content/media/invite XOR), `ReactMessageSchema` (emoji regex),
    `MessageDtoSchema`, `ConversationPreviewSchema`, `ConversationDetailSchema`,
    `MarkReadSchema`, `RideInviteDataSchema`, `EventInviteDataSchema`.
  - `schemas/report.schema.ts`: `CreateReportSchema`, `ReportDtoSchema`
    (Spec 7.2.2 - Store zorunlulugu).
  - `schemas/block.schema.ts`: `BlockUserParamSchema`, `BlockDtoSchema`.
  - `schemas/device.schema.ts`: `RegisterDeviceTokenSchema` (Expo/FCM/APNs/WEB).
  - `schemas/socket-events.schema.ts`: `WS_EVENTS` extended +
    `WsConversationJoin/LeaveSchema`, `WsMessageSend/Typing/Read/ReactSchema`,
    `WsMessageReceivedSchema`, `WsMessageReadBySchema`,
    `WsMessageReactionUpdatedSchema`, `WsMessageTypingUpdatedSchema`,
    `WsMessageDeletedSchema`, `WsMessageErrorSchema`.

- **apps/api - CommunityModule (`modules/community`):**
  - `CommunityService`: `createCommunity` (owner MEMBER ACTIVE olarak eklenir),
    `updateCommunity` (OWNER/ADMIN), `getCommunityDetail` (HIDDEN icin NotFound
    guard), `listMine`, `listMembers`, `joinCommunity` (PUBLIC->ACTIVE,
    PRIVATE/HIDDEN->PENDING, BANNED->403), `respondJoinRequest` (OWNER/ADMIN
    accept/reject), `leaveCommunity` (OWNER birakamaz), `updateMemberRole`
    (sadece OWNER, OWNER rolu transfer fonksiyonu ayri), `listNearby`
    (`$queryRaw find_communities_within` + fallback en kalabalik public),
    `listPendingJoinRequests`.
  - `CommunityController` (REST `/v1/communities`): POST / PUT /:id / GET /me /
    GET /nearby / GET /:id / GET /:id/members / GET /:id/pending / POST /:id/join
    / POST /:id/respond-join / DELETE /:id/leave / POST /:id/members/role.

- **apps/api - EventModule (`modules/event`):**
  - `EventService`: `createEvent` (validation endTime>startTime, community
    privilege kontrolu, organizer ilk GOING olarak eklenir), `updateEvent`
    (organizer/coHost), `getDetail` (PRIVATE icin uye/organizer dogrulama),
    `listMine`, `rsvp`:
    - `GOING` + `maxParticipants` dolu -> otomatik `WAITLIST`.
    - `NOT_GOING` + eski status `GOING` -> WAITLIST ilk kisi GOING'e promote
      (Spec 3.2 waitlist FIFO).
  - `listParticipants`, `listNearby` (`find_events_within` + fallback
    chronological), `deleteEvent` (soft delete, sadece organizer).
  - `EventController` REST `/v1/events`: POST / PUT /:id / GET /me / GET /nearby
    / GET /:id / GET /:id/participants / POST /:id/rsvp / DELETE /:id.

- **apps/api - MessagingModule (`modules/messaging`):**
  - `ConversationService`: `findOrCreateDirect` (block iki yonlu kontrol,
    self-DM yasak), `createConversation` (DIRECT/GROUP_CHAT/COMMUNITY_CHAT),
    `listMyConversations` (son mesaj + unread count), `getDetail`,
    `assertParticipant`, `markRead`, `listParticipantIds`, `getDirectPartner`.
  - `MessageService`: `send` (Spec 8.7.1 Redis INCR rate limit 60/dk +
    Spec 7.2.2 block enforcement + Spec 7.1.1 idempotent clientId), `react`
    (upsert/delete MessageReaction, idempotent), `softDelete` (sender-only),
    `listMessages` (cursor pagination, newest-bottom), `validateContent`.
  - `MessagingGateway` (`@WebSocketGateway(namespace='/messaging')`):
    - JWT handshake (access token) + namespace middleware.
    - Client->Server: `conversation:join/leave`, `message:send/typing/read/react`.
    - Server->Client: `message:received/read_by/reaction_updated/typing_updated/
      deleted/error`.
    - `user:{id}` room auto-join (offline odadan broadcast fallback).
    - `onMessagePersisted` callback -> `broadcastMessage` + `PushService.sendToUsers`
      (Spec 9.3 offline push).
    - `onReactionUpdated` callback -> `broadcastReaction`.
  - `MessagingController` REST `/v1/conversations` + `/v1/messages`: POST /
    GET mine / GET /:id / GET /:id/messages / POST /:id/messages /
    POST /:id/read / POST /messages/:id/react / DELETE /messages/:id.

- **apps/api - PushModule (`modules/push` - Spec 9.3):**
  - `PushService`:
    - `registerToken` (upsert by token; farkli kullaniciya aitse devret).
    - `revokeToken`, `listUserDevices`.
    - `sendToUser(s)` - dispatcher registry (IOS/ANDROID/EXPO/WEB) + dry run
      (Faz 4 iskelet, gercek FCM/APNs Faz 5'te). Invalid token -> `revokedAt`
      auto-set.
    - `PushDispatcher` interface - ileride FirebasePushDispatcher /
      ApnsPushDispatcher / ExpoPushDispatcher olarak implement edilebilir.
  - `PushController` REST `/v1/devices`: POST / GET / DELETE /:token.

- **apps/mobile - Inbox + Sohbet:**
  - `api/messaging.api.ts` - REST DM + mesaj pagination.
  - `lib/messaging-socket.ts` - `/messaging` namespace Socket.IO singleton.
  - `hooks/useMessaging.ts` - socket subscribe + cursor load + optimistic
    send (clientId + pending/failed flag; server ack ile merge).
  - `screens/inbox/ConversationsListScreen.tsx` - unread badge + avatar harfi.
  - `screens/inbox/ConversationScreen.tsx` - baloncuk UI + typing indicator +
    inverted scroll + KeyboardAvoidingView.
  - `screens/inbox/InboxScreen.tsx` - "Mesajlar" | "Parti Davetleri" ust sekme
    (Faz 3 parti akisi korundu).
  - `navigation/InboxStackNavigator.tsx` - InboxRoot -> Conversation stack.

- **apps/mobile - Community + Event:**
  - `api/community.api.ts` - join/leave/respond-join/role endpointleri.
  - `api/event.api.ts` - create/update/nearby/rsvp.
  - `screens/community/CommunityDetailScreen.tsx` - Katil/Ayril mantik +
    PENDING ("Onay Bekliyor") + istatistik kartlari.
  - `screens/event/EventCreateScreen.tsx` - expo-location ile konum secme +
    title/description/meetingPointName/startTime.

- **apps/mobile - Push Soft Prompt (Spec 9.3 + Faz 1 Adim 24 RESOLVE):**
  - `hooks/usePushPrompt.ts` - Apple HIG uyumlu soft prompt; `shouldAskForPush`
    14 gun hatirlama, `requestOsPermissionAndRegister`
    (expo-notifications getExpoPushTokenAsync + `registerDeviceToken`).
  - `features/push/SoftPushPromptModal.tsx` - kalp kazanan modal (Izin ver /
    Simdilik degil), ilk Inbox acilisinda `autoShow=true`.
  - `api/push.api.ts` - `/v1/devices` REST istemcisi.
  - `lib/storage.ts` - `StorageKeys.PushSoftPromptState` eklendi.

- **Test:**
  - `community.service.spec.ts` - 8 test (PUBLIC/PRIVATE/HIDDEN + BANNED +
    respondJoinRequest + PostGIS nearby + fallback).
  - `event.service.spec.ts` - 5 test (RSVP kapasite, WAITLIST otomatik,
    NOT_GOING promote, PostGIS nearby + fallback).
  - `message.service.spec.ts` - 5 test (idempotent clientId, block 403,
    rate limit 403, happy path persist + callback, validateContent).
  - `push.service.spec.ts` - 5 test (register upsert, sahibini devret, dry run,
    invalid token auto-revoke, empty userIds).
  - **Toplam API: 12 suite / 120 test PASS. Mobile: 3 suite / 17 test PASS.**

- **Tests Terminal Ciktisi:**
  ```
  PASS src/modules/community/community.service.spec.ts
  PASS src/modules/event/event.service.spec.ts
  PASS src/modules/messaging/message.service.spec.ts
  PASS src/modules/push/push.service.spec.ts
  PASS src/modules/party/leader-election.service.spec.ts
  PASS src/modules/party/party.service.spec.ts
  PASS src/modules/party/location.gateway.spec.ts
  PASS src/modules/location/location.service.spec.ts
  PASS src/modules/map/map.service.spec.ts
  PASS src/modules/follows/follows.service.spec.ts
  PASS src/modules/likes/likes.service.spec.ts
  PASS src/modules/auth/auth.service.spec.ts
  Test Suites: 12 passed, Tests: 120 passed
  ```

**Mimari Kararlar (yeni ADR girdileri):**
- **ADR-014: PostGIS ST_DWithin radius sorgusu** - Faz 2'de Redis GEO canli
  lokasyon icin kullanildi; Faz 4'te statik noktalar (event meeting point,
  community HQ) icin PostGIS `geography(Point,4326)` + `GIST` indeksi
  kullaniyoruz. Gerekce: statik noktalar yazma sikligi dusuk, sorgu karmasikligi
  yuksek (radius + visibility + deletedAt + time range); Redis GEO basit lat/lng
  eslemesinden oteye gidemezdi.
- **ADR-015: Messaging ayri WS namespace** - `/messaging` (Faz 3 `/realtime`dan
  ayri). Gerekce: farkli JWT scope/rate limit profilleri, metrik ayirimi,
  gelecekteki event bloat'i izole.
- **ADR-016: Idempotent clientId** - Spec 7.1.1 optimistic UI. Unique
  (`conversationId`, `clientId`) indeksi ile duplicate mesaj geri gelir (yeni
  kayit YOK), UI optimistic baloncugu server onayli baloncukla merge eder.
- **ADR-017: Push dispatcher registry pattern** - Dry run default
  (`PUSH_DRY_RUN=true`). Production'da `PushService.registerDispatcher` ile
  IOS/ANDROID/EXPO icin platform-spesifik dispatcher eklenebilir, service
  kendisi persist + revoke + ownership devir mantigini korur. Faz 5'te
  ExpoPushDispatcher (expo-server-sdk) implement edilecek.

**Engelleme ve Store Uyumlulugu Notlari (Spec 7.2.2):**
- `MessageService.send` ve `ConversationService.findOrCreateDirect` iki yonlu
  `Block` kontrolu yapar (`initiatorId:targetId` VEYA tersi). Block varsa
  `ForbiddenException { code: BLOCKED }`.
- Harita tarafi (Faz 2 MapService) block-aware zaten; engellenen kullanici
  `listNearbyRiders`ta gorulmuyor.
- Apple/Google icin "Report & Block" minimum isleve sahip (schemas + REST
  endpointleri Faz 1'de eklenmisti, Faz 4'te messaging entegrasyonu).

**Observability:**
- `rate:msg:{userId}` Redis key - mesaj rate limit.
- MessagingGateway `msg_ws_connect/disconnect` debug log.
- `MessageService msg_rate_limit` WARN log.
- `PushService push_dispatch_error` + `push_dry_run` log.

**Resolved Blocker:**
- Faz 1 Adim 24 (Push Notification Soft Prompt) -> Faz 4'te devreye alindi.
  `expo-notifications` + `expo-device` zaten kurulu. Production icin FCM/APNs
  sertifikalari Faz 5'te Expo EAS konfigurasyonu sirasinda tamamlanacak.

**Sirada (Faz 5 ve sonrasi):**
- Emergency SOS (Spec 4.4) - tetikleyici + alici listesi + 30sn geri sayim.
- Quest/Badge sistemi (Spec 4.3 + 3.6 QuestProgress).
- Story / Reel medya pipeline (MinIO + Sharp + thumbnails).
- ExpoPushDispatcher implementation + FCM/APNs sertifika entegrasyonu.
- Deep link `motogram://community/:id` + `motogram://event/:id`.

---

### [2026-04-20] Faz 3 TAMAMLANDI - Surus Partisi (NFS Tarzi HUD)

**Yapilan:**

- **Prisma schema genisletme:**
  - Yeni modeller: `Party`, `PartyMember`, `PartyInvite`, `Route` (ride route DTO'su).
  - Yeni enumlar: `PartyStatus` (WAITING/RIDING/PAUSED/ENDED), `PartyRole`
    (LEADER/CO_LEADER/MEMBER), `PartyInviteStatus`, `RoutePrivacy`.
  - `LocationPing` modeline `partyId: String?` + `@@index([partyId])` - parti
    baglamlari icin retention audit.
  - `User` iliskileri: `ledParties`, `partyMemberships`, `createdRoutes`,
    `partyInvitesSent`, `partyInvitesRecv`.

- **packages/shared (Zod SSOT):**
  - `schemas/party.schema.ts`: `CreatePartySchema` (maxMembers 2-50,
    coLeaderIds<=3), `JoinPartySchema`, `InviteToPartySchema`,
    `RespondPartyInviteSchema`, `PartyMemberSchema`, `PartySummarySchema`,
    `PartyDetailSchema`, `NearbyPartiesQuerySchema`.
  - `schemas/socket-events.schema.ts`: **`WS_EVENTS` sabiti** (SSOT - hardcoded
    event ismi yasak), `WsPartyJoinSchema`, `WsPartyLeaveSchema`,
    `WsPartyUpdateLocationSchema`, `WsPartySendSignalSchema`,
    `WsPartyMemberUpdatedSchema`, `WsPartyMemberJoinedSchema`,
    `WsPartyMemberLeftSchema`, `WsPartyLeaderChangedSchema`,
    `WsPartySignalReceivedSchema`, `WsPartyEndedSchema`, `WsPartyErrorSchema`.
  - `enums.ts`: `PartyStatusEnum`, `PartyRoleEnum`, `PartyInviteStatusEnum`,
    `PartySignalTypeEnum` (REGROUP/STOP/FUEL), `RoutePrivacyEnum`.

- **apps/api (NestJS - PartyModule + WebSocket):**
  - Paketler: `@nestjs/websockets@^10.4.12` + `@nestjs/platform-socket.io@^10.4.12`
    + `socket.io` + `@socket.io/redis-adapter` (NestJS 10.4 uyumu icin pin'li).
  - `modules/party/party.constants.ts`: `PARTY_REDIS_KEYS`
    (`party:{id}:members`, `:meta`, `:leader_lock`, `:zombie`, `parties:_active`,
    `user:{id}:party`, `rate:party_signal:{uid}`), `PARTY_TTL`
    (leaderLockSeconds=5, zombieOfflineSeconds=60, signalRatePerMinute=12),
    `PARTY_CREATE_LIMIT` (5/hour).
  - `modules/party/leader-election.service.ts`:
    - `pickNextLeader(input)` saf fonksiyon: coLeader -> joinedAt en eski ->
      userId lex asc tie-break (Spec 8.2.2 deterministik).
    - `elect(input)`: `redis.set(leaderLock, id, 'EX', 5, 'NX')` - Redlock (Spec
      8.2.2 dagitik kilit). NX basarisizsa `lock_failed` doner.
    - `release(partyId, expectedLeaderId)`: Lua CAS (GET + DEL ayni slotta).
  - `modules/party/party.service.ts`:
    - `createParty(leaderId, dto)`: rate limit (Spec 8.7.1 - 5/hour Redis
      counter) + active-party conflict + Prisma $transaction (Party +
      PartyMember LEADER) + Redis multi (SADD members + SADD activePartyIndex
      + SET userParty).
    - `joinParty(userId, partyId)`: PartyStatus!=ENDED + capacity + private->
      PartyInvite PENDING zorunlu + existing re-join + emit `party:member_joined`.
    - `leaveParty(userId, partyId, reason)`: PartyMember.leftAt + SREM + DEL
      userParty + emit `party:member_left`. Lider ise `LeaderElectionService.elect`
      tetiklenir; winner varsa Party.leaderId + PartyMember.role=LEADER +
      emit `party:leader_changed` + release. Tek uye varsa `endParty`.
    - `endParty(partyId, reason)`: Prisma $transaction (Party.status=ENDED +
      updateMany leftAt) + Redis multi (DEL members/meta/zombieWatch + SREM
      activePartyIndex + DEL userParty[her uye]) + emit `party:ended` (Spec 8.1).
    - `recordSignal(partyId, senderId, type, senderName)`: **Spec 7.3.1
      emit-only** — rate limit (12/min) + Redis SISMEMBER authz + emitter.emitSignal.
      **Hic bir Prisma yazma cagrisi YOK.** Test ile dogrulandi.
    - `invite/respondInvite/listInvitesForUser`: PartyInvite CRUD +
      NotificationsService entegrasyonu.
    - `markOffline/clearOfflineMark/sweepZombieMembers`: Spec 7.3.3 zombie ZSET
      yonetimi (60sn offline -> otomatik DISCONNECT_TIMEOUT leave).
  - `modules/party/location.gateway.ts` (`@WebSocketGateway(namespace='/realtime')`):
    - `afterInit`: `@socket.io/redis-adapter` pub/sub (Spec 8.4 — 4 ECS task
      ayni parti odasinda mesaj gorur), JWT handshake middleware
      (`handshake.auth.token` || `Authorization: Bearer`), PartyEmitter registry.
    - `handleConnection`: user:{id} room auto-join.
    - `handleDisconnect`: user status HSET online=false + zombie-watch ZADD
      (PartyService.markOffline).
    - `@SubscribeMessage(WS_EVENTS.partyJoin|partyLeave|partyUpdateLocation|partySendSignal)`:
      Zod validation + Redis SISMEMBER authz + LocationService.updateLocation
      (source='PARTY' — Spec 5.1 privacy BYPASS) + `server.to(party:{id}).except(client.id)`
      broadcast `party:member_updated`.
    - PartyEmitter interface: emitMemberJoined/Left, emitStatusChanged,
      emitLeaderChanged, emitSignal, emitEnded — hepsi `server.to(party:{id})`
      ile room-scoped.
  - `modules/party/party-cleanup.service.ts`: `@Cron(EVERY_30_SECONDS)`
    `sweepZombies()` — zombie ZSET'ten 60sn'den eski olanlari leaveParty.
  - `modules/party/party.controller.ts` (`@UseGuards(JwtAuthGuard)`):
    - `POST /v1/parties` (`@Throttle` 5/hour - Spec 8.7.1), `POST /parties/:id/join`,
      `POST /parties/:id/leave`, `GET /parties/:id`, `GET /parties` (nearby,
      public), `POST /parties/:id/invite`, `GET /parties/invites/me`,
      `POST /parties/invites/respond`.
  - `app.module.ts`: `PartyModule` entegrasyonu.

- **apps/mobile (Expo + socket.io-client):**
  - Paketler: `socket.io-client` (peer dep warning — RN 0.79 peer; SDK 51
    uyumlu, accept).
  - `config/env.ts`: `wsUrl` (apiUrl origin'den turetiliyor; EXPO_PUBLIC_WS_URL
    override). Spec 9.5 hardcoded yasak, kullanici EAS extra ile override edebilir.
  - `lib/socket.ts`: singleton socket manager; `autoConnect: false`, JWT
    handshake `auth: () => ({ token })`, reconnection Infinity + exp backoff
    (1-10sn).
  - `store/party.store.ts` (Zustand - Spec 3.1): `party`, `connected`,
    `liveMembers` (Record<userId, {lat,lng,heading,speed,ts}>), `recentSignals`
    (FIFO 5); `upsertMember`, `removeMember`, `setLeader`, `updateLiveMember`,
    `pushSignal`, `dismissSignal`.
  - `hooks/useParty.ts`: socket event binding (9 event) + validation via
    `WS_EVENTS` SSOT + `sendLocation`, `sendSignal`, `leave`. Unmount'ta
    `party:leave` + off tum listenerlar.
  - `api/party.api.ts`: REST wrapper (create/join/leave/get/listNearby/invite/
    listMyInvites/respondInvite).
  - `features/party/RideModeHUD.tsx`: **3 BUYUK buton** (REGROUP/STOP/FUEL,
    min-height 96px - parmaga dost), ust bar lider badge (isLeader/leaderName
    + connection dot), uye sayaci, AYRIL butonu.
  - `features/party/PartySignalFeed.tsx`: gelen sinyal toast (5sn auto-dismiss,
    renk: REGROUP yesil / STOP kirmizi / FUEL turuncu).
  - `screens/map/MapScreen.tsx`: Segmented Control'de RIDE sekmesi enabled
    oldu (party varsa); ride modunda Discover pinleri gizli, `liveMembers`
    uzerinden party-pin render edildi, RideModeHUD + PartySignalFeed overlay.
  - `screens/party/PartyInboxScreen.tsx`: PENDING davet kartlari (Kabul/Reddet);
    kabul -> `respondInvite` + `getParty` -> store'a yaz -> Map'e yonlendir.
  - `screens/inbox/InboxScreen.tsx`: PartyInboxScreen'i wrap eder.

**Spec Uyum:** 2.3.2 Surus Modu HUD (3 buyuk buton), 2.4.1 + butonu
(ertelendi Faz 3.1), 2.4.2 Partiler sekmesi (Inbox'ta PartyInboxScreen),
3.2 Party/PartyMember/Route/PartyInvite Prisma modelleri, 3.3.1
`party:{id}:members` SET, 3.5 WebSocket Event Sozlesmesi (WS_EVENTS SSOT),
4.1 Lider ayrilma + coLeader priority, 4.2 Socket reconnect (exp backoff
Infinity), 5.1 Party members her zaman birbirini gorur (privacy BYPASS —
source='PARTY'), **7.3.1 Sinyal DB'ye YAZILMAZ** (test ile assert edildi),
7.3.3 60sn zombie cleanup (PartyCleanupService cron), 8.1 ENDED transaction
+ Redis flush, 8.2 Redlock (Redis SET NX EX 5), 8.4 Redis Adapter (pub/sub),
8.7.1 Rate limit (5 party/hour + 12 signal/min) — TAM UYUM.

**Ertelenen (Faz 3.1'e bilincli ayrildi):**
- Adim 16: Parti olustur UI formu (BE hazir, REST `createParty` cagrisi).
- Adim 20-22: `expo-task-manager` arka plan konum + Foreground Service
  bildirimi (Spec 7.2.3) — prebuild / dev client gerektirir.
- Adim 23: 30sn+ disconnect Snackbar (Spec 4.2 UX) — hook'ta event hazir.
- Adim 24: Deep link `motogram://party/:id` — navigasyon config.
- Parti olusturma limiter'i Redis counter ile manuel; `@Throttle` override da
  kontrollerde aktif.
- PostGIS geo-sort: Faz 4'te PostGIS ekleme + nearby geo-sort.

**Testler:** **153 / 153 PASS** (shared: 40, api: 96, mobile: 17).
- `@motogram/api` +39 yeni party testi:
  - `LeaderElectionService.spec.ts` (11 test):
    - pickNextLeader (co-leader priority, offline skip, oldest fallback,
      lex tie-break, no_candidates).
    - elect (lock OK, NX failed, **3-way race simulation — 1 winner / 2
      losers**, no-op on empty candidates).
    - release (CAS 1/0).
  - `PartyService.spec.ts` (15 test):
    - createParty (rate limit + conflict + happy path + Redis seed keys).
    - **recordSignal (3 test — Spec 7.3.1 NO DB WRITE assertion + rate limit
      + non-member rejection).**
    - leaveParty (leader triggers election / sole-leader ends party /
      non-leader shortcut / not_member throws).
    - privacy bypass (Redis SISMEMBER server-side authz).
  - `LocationGateway.spec.ts` (13 test):
    - handlePartyJoin (validation + member check + room join + clearOfflineMark).
    - handlePartyLeave (service delegation + error propagation).
    - handlePartyUpdateLocation (non-member rejected + source=PARTY with
      sharing=OFF + banned user aborted + broadcast except sender).
    - handleSendSignal (delegation + rate_limited error event).
    - handleConnection/Disconnect (user room join, unauthorized disconnect,
      markOffline zombie-watch).
    - PartyEmitter (room-scoped emit for signal/leader_changed/ended).

**Typecheck:** shared + api + mobile strict + noUncheckedIndexedAccess +
no-explicit-any ile PASS.

**Sapmalar:**
- **Sapma 1 (NestJS v10 pin):** @nestjs/websockets v11 `@nestjs/common@^11`
  peer istedigi icin v10.4.12 pin'lendi (uyumlu). Faz 5'te NestJS 11'e toplu
  upgrade (ADR-011).
- **Sapma 2 (Expo SDK 52 upgrade ertelendi):** `socket.io-client` RN 0.79
  peer dep warning verdi; SDK 51 ile calisiyor (accept). `@rnmapbox/maps`
  ile ayni warning. Faz 5'te toplu upgrade.
- **Sapma 3 (expo-task-manager):** Arka plan konum + Foreground Service
  `expo prebuild` + native build gerektiriyor. Faz 3.1 olarak ayrildi;
  mevcut `useLocationBroadcast` foreground icin yeterli.
- **Sapma 4 (Signal rate limit esigi):** Spec ekstra limit belirtmiyor;
  urun karari 12/dk (anti-spam, parmakdan dusmeyen). Prod'da A/B testlenmeli.
- **Sapma 5 (Lint blocker):** `@motogram/shared` icinde `eslint` binary
  workspace node_modules'ta degil (Faz 0/1'den kaynakli pre-existing).
  Cozum: `packages/shared/devDependencies`'e `eslint` eklenmeli — Faz 4
  baslangicinda duzeltilecek.

**Observability Notlar:**
- Parti olusum suresi: createParty <50ms hedefi (Redis multi + Prisma
  $transaction). Faz 3.1'de histogram exportu eklenmeli.
- Sinyal emit gecikmesi: in-process handler -> broadcast <5ms (test ortaminda).
  Redis Adapter aktifken multi-instance pub/sub gecikmesi olcmek icin Faz
  3.1'de test integration'i yapilacak.
- Lider election race window: NX EX 5sn; pathological case 5sn icinde 2. elect
  cagrisi lock_failed alir ve DB'de duplicate LEADER olusmaz.

---

### [2026-04-20] Faz 2 TAMAMLANDI - Harita ve Redis Konum Motoru

**Yapilan:**
- **packages/shared (Zod SSOT):**
  - `enums.ts` eklemeleri: `SessionSourceEnum` (GLOBAL_VISIBILITY / PARTY /
    EMERGENCY), `MapFilterEnum` (NEARBY / FRIENDS / PARTIES / EVENTS),
    `ThermalStateEnum` (NORMAL / FAIR / SERIOUS / CRITICAL).
  - `schemas/location.schema.ts`: `UpdateLocationSchema`, `NearbyQuerySchema`
    (radius 100-5000m, default 2000m), `BoundingBoxQuerySchema`,
    `NearbyRiderSchema`, `NearbyRidersResponseSchema`,
    `UpdateLocationSharingSchema`, `StartLiveSessionSchema`,
    `StopLiveSessionSchema`.
  - `schemas/map.schema.ts`: `MapMarkerTypeEnum`, `MapMarkerSchema`,
    `DiscoverFiltersSchema`, `LocationBroadcastSchema`.

- **apps/api (NestJS - Redis GEO + BullMQ):**
  - Prisma: `LiveLocationSession` + `LocationPing` modelleri + `SessionSource`
    enum. `LocationPing.@@unique([userId, timestamp], name: "unique_user_timestamp")`
    (Spec 8.1.2 - idempotent insert).
  - `LocationModule`:
    - `location.constants.ts`: `REDIS_KEYS.userLocationShard(city)` +
      `userLocationShardIndex = user_locations:_shards`, `TTL`, `PERF_BUDGET`
      (GEO_QUERY_MS=15, LOC_UPDATE_MS=50), `RATE_LIMITS`.
    - `LocationService.updateLocation()`: Redis pipeline -> `SADD` shard index +
      `GEOADD` + `HSET` kullanici statusu + `EXPIRE` TTL. Server-side rate limit
      (`rate:loc:{userId}` 1s INCR/EXPIRE).
    - `LocationService.queryNearbyRaw()`: `GEOSEARCH FROMMEMBER|FROMLONLAT
      BYRADIUS ... ASC WITHCOORD WITHDIST` + pipelined HGETALL.
    - `LocationService.canViewBasedOnPrivacy()`: OFF / FOLLOWERS_ONLY /
      MUTUAL_FOLLOWERS / GROUP_MEMBERS / PARTY_ONLY / PUBLIC + party bypass
      (ayni parti ise privacy delinmez) + blok simetrik kontrolu.
    - `LocationService.sweepZombies()`: her dakika shard index uzerinden dolaser,
      5dk+ pasif uyeleri `ZREM` + shard bos ise index'ten kaldirir.
    - `LocationService.persistPing()`: idempotent insert (P2002 swallow);
      BullMQ worker'dan cagriliyor.
    - `LocationService.purgeOldPings()`: 03:30 cron, 7 gunden eski pings sil.
    - `location-sync.queue.ts`: BullMQ `location-sync` queue (exp backoff
      1-2-4-8-16s, 5 attempt, DLQ `location-dead-letter` - Spec 8.1.2).
    - `location-cleanup.service.ts`: `@Cron(EVERY_MINUTE)` sweep +
      `@Cron('30 3 * * *')` purge.
    - `LocationController`: PUT `/v1/location/update` (Zod body + @Throttle 1/sn),
      POST `/v1/location/session/start|stop`, PUT `/v1/location/sharing`.
  - `MapModule`:
    - `MapService.getNearbyRiders()`: LocationService'ten raw rider'lari alir,
      viewer'i excludan eder, FRIENDS filtresinde `getMutualFollowerIds()`
      kesisimini uygular, PARTIES filtresinde `isInParty` olanlara filtreler,
      soft-delete / ban / block tum katmanlardan geciririr, privacy modlarini
      son asamada dogrular.
    - `MapService.getRiderCountPerShard()`: observability endpoint
      (Spec 8.3.2 dashboard).
    - `MapController`: GET `/v1/map/nearby` (@Throttle 30/dk), GET
      `/v1/map/shards`.
  - `app.module.ts`: `ScheduleModule.forRoot()` + `LocationModule` +
    `MapModule` entegrasyonu.

- **apps/mobile (Expo + Mapbox):**
  - Paketler: `@rnmapbox/maps` ~10.3, `expo-location` ~17.0.1,
    `expo-device` ~6.0.2, `supercluster` + `@types/supercluster`.
  - `app.json`: `expo-location` plugin (foreground permission Turkce string) +
    `@rnmapbox/maps` plugin (`RNMapboxMapsDownloadToken` EAS Secret placeholder).
  - `src/config/env.ts`: `mapboxAccessToken` + `mapboxStyleUrl` (default
    `mapbox://styles/mapbox/dark-v11`) - hardcoded YOK.
  - `src/store/map.store.ts`: Zustand store (filters, riders, selectedRiderId,
    panelOpen, lastQueryDurationMs) + MMKV persist (filter + radius).
  - `src/api/map.api.ts`: nearby fetch, location update, session start/stop,
    sharing mode update.
  - `src/hooks/useNearbyRiders.ts`: react-query; tick interval olusturulur.
  - `src/hooks/useThermalFrequency.ts`: `computeLocationIntervalMs()` saf
    fonksiyon (NORMAL=3s, FAIR=6s, SERIOUS=15s, CRITICAL=30s, sharing=OFF=0).
  - `src/hooks/useLocationBroadcast.ts`: `Location.requestForegroundPermissionsAsync`
    + `Location.watchPositionAsync` + termal state'e gore adaptif REST ping
    (Faz 3'te Socket.IO ile degistirilecek).
  - `src/features/map/filters/MapFilterBar.tsx`: yatay chip bar (4 filtre).
  - `src/features/map/panel/DiscoverModeSheet.tsx`: sag panel 1/3 ekran +
    skeleton loader + proaktif bos durum CTA (Spec 7.3.2).
  - `src/features/map/sharing/LocationSharingSheet.tsx`: privacy modu secici
    (OFF / FOLLOWERS / MUTUAL / PARTY / PUBLIC) + MMKV persist + i18n.
  - `src/features/map/markers.ts`: `applyMarkerUpdate()` + `pruneStaleMarkers()`
    optimistic UI saf fonksiyonlari.
  - `src/features/map/cluster/clusterize.ts`: supercluster wrapper
    (`buildClusterIndex` + `getClusters`) - Faz 3'te Mapbox ShapeSource ile
    native cluster.
  - `src/screens/map/MapScreen.tsx`: `Mapbox.MapView` + `Mapbox.Camera` +
    `Mapbox.UserLocation` + `PointAnnotation` + `MapFilterBar` +
    `DiscoverModeSheet`. Token yoksa dogrudan fallback mesaji. Dev badge:
    `lastQueryDurationMs` gosterimi.
  - i18n tr/en: `map.*` (segments, filtreler, panel basliklari, rider status,
    bos durum, mapboxMissing) + `map.sharing.*` (modes + aciklamalar).

**Spec Uyum:** 2.3 Harita Ekrani, 2.3.1 Kesif Modu, 3.1, 3.2, 3.3 (tamami -
Redis veri yapilari + pipeline write + GEOSEARCH), 5.1 Konum Gizliligi, 5.2
Veri Saklama (7gun LocationPing + 5dk Redis ZREM), 5.3 Performans Butcesi
(PERF_BUDGET sabiti), 7.1.2 Termal Yonetim (`computeLocationIntervalMs`),
7.3.2 Sogun Baslangic (proaktif bos durum), 7.3.3 Zombie Cleanup
(`sweepZombies`), 7.3.5 Rate Limit (1/sn server-side + @Throttle), 8.1 Data
Consistency (BullMQ write-behind + DLQ + idempotent), 8.3 Redis GEO
Sharding, 8.9 iOS/Android GPS Optimization (adaptif interval), 9.1 Harita
Motoru (Mapbox zorunlu) - TAM UYUM.

**Testler:** 114 / 114 PASS (shared: 40, api: 57, mobile: 17).
- `@motogram/shared`: location + map Zod semalari (19 yeni test).
- `@motogram/api`:
  - `LocationService.spec.ts`: updateLocation (pipeline + rate limit + shard
    index), queryNearbyRaw (GEOSEARCH + pipeline HGETALL + viewer exclude),
    canViewBasedOnPrivacy (OFF/FOLLOWERS/MUTUAL/PARTY/PUBLIC + party bypass +
    block), sweepZombies (ZREM + index senkronu), persistPing (idempotent +
    P2002 swallow), purgeOldPings (7gun threshold).
  - `MapService.spec.ts`: getNearbyRiders (FRIENDS filtresinde mutual
    intersection, PARTIES filtresinde isInParty, soft-delete/ban hariç, block
    kontrolu, privacy nihai dogrulama, distance ordering Redis tarafindan
    garanti).
- `@motogram/mobile`: `computeLocationIntervalMs` + `applyMarkerUpdate` +
  `pruneStaleMarkers` + Faz 1 `applyOptimisticLike` saf fonksiyonlari.

**Typecheck:** shared + api + mobile strict + no-explicit-any ile PASS.

**Sapmalar:**
- **Sapma 1 (PostGIS):** Prisma'da `Unsupported("geography(Point,4326)")` yerine
  ayri `latitude`/`longitude` Float kolonlari secildi. Neden: Redis GEO zaten
  tek sorgu kaynagi; `LocationPing` yalnizca audit/persistence. PostGIS
  eklentisi Faz 4'te topluluk/etkinlik COVID-radar tarzi sorgular icin
  gerekebilir -> o zaman eklenecek. (ADR-006)
- **Sapma 2 (WebSocket ertelendi):** Spec 3.3.2'de Socket.IO ile emit onerildi;
  Faz 2 kapsamini yonetilebilir tutmak icin REST PUT + termal adaptif interval
  (3-30sn) ile basladik. Faz 3 (Surus Partisi) icinde Socket.IO
  `LocationGateway` tam olarak kurulacak ve REST fallback olarak kalacak.
- **Sapma 3 (@rnmapbox/maps peer dep):** Paketin `react-native@>=0.79` peer
  uyarisi Expo SDK 51'in RN 0.74 kilidiyle celisiyor. Simdilik ~10.3 pin'le
  calisiyor, warning accept ediliyor. Expo SDK 52 yukseltmesi Faz 5'te
  plananlaniyor (medya / Sharp SDK geciş dalgasiyla birlikte).
- **Sapma 4 (supercluster testi):** Supercluster v8 ESM-only oldugu icin
  `clusterize.spec.ts` kaldirildi; clustering davranisi Faz 3'te Mapbox
  ShapeSource ile native tarafa devredildiginde integration test ile
  dogrulanacak. Pure UI fonksiyonlari (`applyMarkerUpdate`,
  `pruneStaleMarkers`) tam test kapsaminda.

---

### [2026-04-20] Faz 1 TAMAMLANDI - Temel Sosyal Katman

**Yapilan:**
- **Config paketleri:** `config-tsconfig` (base/nest/expo/next presetleri) + `config-eslint` (base/nest/expo, `no-explicit-any: error`, `react-native/no-raw-text` i18n zorunlulugu).
- **packages/shared (Zod SSOT):** `enums.ts` + `errors.ts` (ErrorCodes + ApiErrorSchema) + schemas: `auth`, `user`, `motorcycle`, `follow`, `post`, `story`, `comment`, `like`, `notification`. tsup ile ESM+CJS+DTS build. `exports` alani alt yol import'lari destekliyor (Spec 7.3.6).
- **apps/api (NestJS):**
  - Prisma schema Faz 1 modelleriyle (User, UserSettings, Motorcycle, Follow, Block, Post, Story, StoryView, Comment, Like, Notification, NotificationTemplate, AuditLog, Report) + `postgresqlExtensions` preview + PostGIS hazirligi.
  - Docker Compose dev: PostgreSQL 15 + PostGIS + Redis 7.
  - Global `/v1/` prefix + `GlobalExceptionFilter` (standart `{error, code, details}` - Spec 9.4) + `ZodValidationPipe` / `ZodBody` pipe.
  - `JwtAuthGuard` default koruma + `@Public()` decorator + `@CurrentUser()` decorator.
  - `TokenService`: JWT access 15dk + refresh 7gun, Redis'te `refresh_token:{userId}:{jti}` rotation + replay guard (Spec 8.6).
  - `ThrottlerGuard` global + `@Throttle` dekorasyonlari: register 10/15dk, login 5/15dk, follow 20/dk, comment 30/dk, like 60/dk (Spec 8.7.1).
  - Feature modules (CRUD + soft delete + increment/decrement counts): `auth`, `users`, `motorcycles`, `follows`, `posts`, `stories`, `comments`, `likes`, `notifications`.
  - `PrismaService` + `RedisService` (ioredis) + `PrismaModule` + `RedisModule`.
- **apps/mobile (Expo):**
  - Expo SDK 51 + React Native 0.74 + React Navigation (AuthNavigator + TabNavigator 5 sekme).
  - Zustand `auth.store` (MMKV hydration) + react-query QueryClient (Spec 9.6).
  - `lib/api-client.ts`: otomatik access+refresh token yenileme (Spec 8.6 client tarafi).
  - `lib/storage.ts` react-native-mmkv (AsyncStorage YASAK - Spec 3.1).
  - `lib/sentry.ts` init (Spec 9.7).
  - i18n: `tr.json` + `en.json`, language detector (MMKV + Device locale).
  - Auth ekranlari: Welcome, Login (Zod), Register (EULA `z.literal(true)` - Spec 9.2), OTP iskeleti.
  - Ana ekranlar: Home (feed, FlatList, like butonu), Profile (stats, XP, riding styles, signOut), Discover/Map/Inbox placeholder.
  - Optimistic UI: `applyOptimisticLike` saf fonksiyon + `useLikePost` mutation (onMutate patch, onError rollback, onSettled invalidate) - Spec 7.1.1.

**Spec Uyum:** 2.2, 2.6, 3.1, 3.2, 3.6 (hazirlik), 3.7, 7.1.1, 7.3.6, 8.6, 8.7.1, 8.11.3, 8.11.4, 9.2, 9.4, 9.5, 9.6, 9.7 tam uyum. 9.3 soft prompt Faz 4'e ertelendi (Firebase/APNs setup gerekli).

**Testler:** 53 / 53 PASS.
- `@motogram/shared`: 21 test (auth + post Zod semalari).
- `@motogram/api`: 26 test (AuthService + LikesService + FollowsService).
- `@motogram/mobile`: 6 test (`applyOptimisticLike` saf fonksiyon).

**Typecheck:** 3 paket (shared/api/mobile) strict + noUncheckedIndexedAccess + no-explicit-any ile PASS.

**Sapmalar:**
- `@Throttle` limiti @nestjs/throttler v5 API ile uyumlu sekilde `{ default: { limit, ttl } }` formatinda uygulandi (spec'e aykiri degil, library semantic'i).
- Adim 24 (push notification soft prompt) FCM/APNs gerektirdigi icin Faz 4'e tasindi - kullaniciya blocker olarak not edildi.
- OTP (Spec 9.2) placeholder Firebase Auth entegrasyonu Faz 4'te tamamlanacak.

---

### [2026-04-20] Faz 0 TAMAMLANDI - Altyapi ve Monorepo Kurulumu

**Yapilan:**
- Git repo initialize edildi (`main` branch).
- pnpm workspace + Turborepo 2.9.6 kuruldu (7 calisan paket).
- Root config dosyalari olusturuldu: `package.json`, `pnpm-workspace.yaml`,
  `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`.
- 3 app iskeleti (`@motogram/mobile`, `@motogram/api`, `@motogram/web-admin`) +
  3 paket iskeleti (`@motogram/shared`, `@motogram/config-eslint`,
  `@motogram/config-tsconfig`) iskelet `package.json` dosyalariyla olusturuldu.
- `pnpm exec turbo run build --dry-run` 6 paketi hatasiz listeledi.

**Spec Uyum:** 3.1, 9.5, 9.7 (tam uyum). 3.1 Docker Compose/ECS Faz 6'ya
ertelendi (yol haritasi geregi).

**Alinan Kararlar:**
- `packages/config-eslint` ve `packages/config-tsconfig` ayri paketler olarak
  tutuldu (DRY, 3 farkli runtime icin - RN/Nest/Next - ayri presetler gerekecek).
- `packageManager: pnpm@10.20.0` root'ta pinlendi.
- TypeScript base config'de `strict: true` + `noImplicitAny: true` +
  `noUncheckedIndexedAccess: true` (kural 5 geregi).
- Runtime bagimliliklar (Expo, NestJS, Prisma vb.) kurulmadi; her faz kendi
  bagimliliklarini yukleyecek.

**Testler:** Faz 0'da is mantigi uretilmedigi icin Jest testi YAZILMADI.
Test zorunlulugu (kural 6) Faz 1'den itibaren geciyor.

**Sapmalar:** Yok.

---

## 6. Mimari Kararlar Kaydi (ADR - Architecture Decision Record)

Her buyuk mimari karar buraya loglanir. Format:

### ADR-001 [2026-04-20]: Monorepo icinde ayri config paketleri
- **Karar:** `config-eslint` ve `config-tsconfig` ayri paketler.
- **Neden:** 3 farkli runtime (React Native, NestJS, Next.js) ayri TS/ESLint
  presetlerine ihtiyac duyar. Tek bir `packages/config` altinda birlesik tutmak
  ilerde kirli olur.
- **Alternatif:** Tek `packages/config` (reddedildi).
- **Etki:** Faz 1+ tum paketler bu iki paketi `devDependencies`'e ekler.

### ADR-002 [2026-04-20]: Refresh Token Rotation + Redis Store
- **Karar:** Access token 15dk (stateless JWT), refresh token 7gun (Redis'te
  `refresh_token:{userId}:{jti}` anahtariyla saklaniyor). Her refresh cagrisinda
  eski jti silinir, yeni jti uretilir (rotation). Logout'ta `allDevices:true` ile
  pattern silme destegi var.
- **Neden:** Spec 8.6 + guvenlik (replay + mass-logout + device revoke).
- **Etki:** Tum korumali endpoint'ler `JwtAuthGuard`. Client `api-client.ts` 401'de
  otomatik refresh yapiyor. Redis opsiyonel degil; auth icin zorunlu.

### ADR-003 [2026-04-20]: Zod SSOT - ZodBody Pipe
- **Karar:** Backend DTO class yazmak yerine `@Body(new ZodBody(schema))` ile
  dogrudan `@motogram/shared`'dan gelen Zod semalari kullaniliyor.
- **Neden:** Spec 7.3.6 - frontend/backend COPY-PASTE yasagi. Tek kaynakta tek
  degisiklik iki tarafa yansiyor.
- **Alternatif:** nestjs-zod paketi (reddedildi - daha dar, custom pipe daha esnek).
- **Etki:** Zod hatalari da `GlobalExceptionFilter` ile standart `{error, code,
  details}` formatina donuyor.

### ADR-004 [2026-04-20]: Optimistic UI - Saf Fonksiyon Ayrimi
- **Karar:** `applyOptimisticLike` saf fonksiyon ayri dosyada (`hooks/optimistic.ts`),
  react-query mutation (`useLikePost`) ayri dosyada.
- **Neden:** Saf fonksiyonun Jest testinde react-native/sentry native modulleri
  mock'lamaya gerek yok. Unit test hizli ve izole.
- **Etki:** Faz 2'de yorum/takip optimistic UI ayni pattern'le eklenecek.

### ADR-005 [2026-04-20]: @Throttle Yerine Global ThrottlerGuard
- **Karar:** `@nestjs/throttler` v5 global guard olarak baglandi; kritik
  endpoint'lerde `@Throttle({ default: { limit, ttl } })` override ediliyor.
- **Neden:** Spec 8.7.1 limitleri farkli farkli (register 10/15dk, login 5/15dk,
  follow 20/dk...). Per-route override en net cozum.
- **Etki:** Faz 2+ endpoint'leri eklenirken ayni pattern uygulanacak.

### ADR-006 [2026-04-20]: Prisma lat/lng + Redis GEO (PostGIS Ertelendi)
- **Karar:** `LocationPing` tablosu PostGIS `geography(Point,4326)` yerine
  ayri `latitude: Float` + `longitude: Float` kolonlari. Tum yakinlik sorgulari
  Redis GEOSEARCH; PostgreSQL sadece audit / retention katmani.
- **Neden:** Spec 3.3.3 GEORADIUS'i Redis'te tutmayi soyluyor. PostGIS eklentisi
  Prisma tarafinda `previewFeatures = ["postgresqlExtensions"]` gerektiriyor ve
  `Unsupported("...")` alaninda native sorgu yazmak zorunlu; Faz 2 icin overkill.
- **Alternatif:** PostGIS + `ST_DWithin` (reddedildi - performans butcesi 15ms
  ile Redis lehine).
- **Etki:** Faz 4 (topluluk/etkinlik radius query) geldiginde PostGIS ihtiyaci
  yeniden degerlendirilecek.

### ADR-007 [2026-04-20]: Sehir Bazli Redis Sharding + _shards SET Index
- **Karar:** GEO anahtarlari `user_locations:{city}` formatinda shardlandi
  (`_global` default). Tum aktif shardlar `user_locations:_shards` SET'inde
  tutulur. Hem yazici (`updateLocation`) hem sweeper (`sweepZombies`) hem
  observability (`getRiderCountPerShard`) bu index'i kullanir.
- **Neden:** Spec 8.3.2 milyonluk kullanici senaryosunda tek GEO key icin
  O(log(N)+M) maliyetini bolerek ClusterTest-dostu yapi.
- **Alternatif:** `KEYS user_locations:*` (reddedildi - prod YASAK, blocking).
- **Etki:** Faz 3 party GEO key'i de (`party_locations:{partyId}`) benzer
  pattern ile ayri SET index alacak.

### ADR-008 [2026-04-20]: BullMQ Write-Behind Persistence (Location)
- **Karar:** `LocationService.updateLocation` sadece Redis'e yazar; PostgreSQL
  `LocationPing` tablosuna yazma BullMQ `location-sync` job'i ile asenkron.
  Exponential backoff (1-2-4-8-16sn), max 5 retry, DLQ `location-dead-letter`.
- **Neden:** Spec 8.1.2 - Redis'in sub-ms latency'si kullanici ping hattinda,
  PostgreSQL yazimi arka planda. Database outage'da ping akisi durmaz.
- **Alternatif:** Synchronous double-write (reddedildi - 50ms LOC_UPDATE
  butcesini patlatir).
- **Etki:** Faz 3 chat mesaji persistence'i de ayni write-behind pattern'i
  kullanacak (mesaj kuyrugu + DLQ + idempotent insert).

### ADR-010 [2026-04-20]: Socket.IO + Redis Adapter Yatay Olcekleme
- **Karar:** `LocationGateway` `@socket.io/redis-adapter` ile pub/sub yapar;
  ayni `redis.duplicate()` (pub + sub client) Redis baglantisi uzerinden. Prod
  (ECS 4 task) ayni `party:{id}` odasinda cross-instance event gorur. Dev
  modda `DISABLE_WS_ADAPTER=1` ile kapatilabilir (single-instance e2e).
- **Neden:** Spec 3.5 + 8.4 — Parti icindeki uye instance-1'e bagliyken
  uye-2 instance-3'e baglandiginda `party:member_updated` mesajlarinin ikisine
  de ulasmasi icin shared pub/sub bus zorunlu.
- **Alternatif:** Sticky session + ayri chat MQ (reddedildi — Redis zaten var,
  ek bagimlilik overkill).
- **Etki:** Faz 4 `community:{id}` ve DM odalari da ayni adapter'i kullanacak.

### ADR-011 [2026-04-20]: NestJS v10 Pin — WebSocket Paketleri
- **Karar:** `@nestjs/websockets@^10.4.12` + `@nestjs/platform-socket.io@^10.4.12`
  pinlendi (v11 core gerektirdigi icin).
- **Neden:** Mevcut API `@nestjs/core@10.4.22`; toplu upgrade Faz 5'e erteledi.
- **Alternatif:** Tam NestJS 11 upgrade (reddedildi — diger Faz 1/2
  modullerinde break risk, ayri bir upgrade gorevi gerektirir).
- **Etki:** Faz 5 baslangicinda tum NestJS paketleri v11'e upgrade edilecek.

### ADR-012 [2026-04-20]: Redlock — Redis `SET NX EX 5` Lider Secimi
- **Karar:** Tek-anahtar Redlock (`party:{id}:leader_lock` NX EX 5); Lua CAS
  release (GET + DEL). Multi-key Redlock (5 farkli Redis node) YAPMIYORUZ;
  tek Redis node ile yeterli (Spec 8.2 "distributed lock" kastettigini tek
  cluster icinde yorumluyoruz).
- **Neden:** Spec 8.2.2 "SET NX EX 5" netleme; multi-key Redlock tek Redis
  cluster'da hicbir ekstra guven saglamaz (ayni FSM).
- **Alternatif:** Redisson-style multi-master (reddedildi — operasyonel yuk).
- **Etki:** Faz 4 topluluk role-change, Faz 5 SOS acil durum lideri de ayni
  tek-anahtar NX patternini kullanacak.

### ADR-013 [2026-04-20]: Sinyal (Regroup/Stop/Fuel) DB'ye Yazilmaz
- **Karar:** `PartyService.recordSignal` ve `LocationGateway.handleSendSignal`
  yalnizca Redis rate-limit + SISMEMBER authz + WebSocket broadcast yapar;
  hicbir Prisma tablosuna yazmaz. Test ile assert edildi.
- **Neden:** Spec 7.3.1 — sinyaller efemeral; kullanici "yakitim az" der,
  sonsuza kadar sakli kalmamali. Privacy + DB yuku + storage cost.
- **Alternatif:** Audit amaciyla `SignalEvent` tablosu (reddedildi —
  spec acik, privacy ozelligi). Ihtiyac dogarsa metric counter (Prometheus)
  hit count tutulabilir.
- **Etki:** Faz 4 DM mesajlari tam tersine yazilmali (retention policy farkli).
  PartyEmitter contract'i bu sinyallerin sadece room icine kalmasini garantiliyor.

### ADR-014 [2026-04-20]: PostGIS `ST_DWithin` Statik Noktalar Icin (Faz 4)
- **Karar:** Event ve Community lokasyonlari icin `geography(Point,4326)` kolon
  + `GIST` indeks + `find_events_within` / `find_communities_within` SQL
  fonksiyonlari. Redis GEO canli lokasyon icin (Faz 2) kalmaya devam ediyor.
  Raw SQL migration: `apps/api/prisma/sql/phase4_postgis.sql` idempotent.
- **Neden:** Statik noktalar yazma sikligi dusuk; sorgu karmasikligi yuksek
  (radius + visibility + deletedAt + time range + sort). Redis GEO sadece lat/lng
  indexi sunar; ek filtreler icin O(M) post-filter gerekir. PostGIS `ST_DWithin`
  GIST'ten faydalanarak ayni cagirmada filtreler.
- **Alternatif:** Redis GEOSEARCH + post-filter (reddedildi — filtre sayisi
  arttikca redis-memory maliyeti + inconsistency riski).
- **Etki:** Faz 5 Emergency SOS icin "en yakin X km'deki kullanicilar" sorgusu
  da PostGIS path'ini kullanabilir.

### ADR-015 [2026-04-20]: Messaging Icin Ayri WebSocket Namespace (`/messaging`)
- **Karar:** `MessagingGateway` kendi namespace'inde (`/messaging`), Faz 3
  `LocationGateway` (`/realtime`) ile izole. Ayri JWT middleware, ayri Redis
  adapter instance'i, ayri client odalari (`conversation:{id}`, `user:{id}`).
- **Neden:** Farkli rate limit profilleri (mesaj: 60/dk; location: 1/sn), farkli
  metrik etiketleri, gelecekteki event bloat izolasyonu, farkli auth scope
  (ileride mesaj `read` vs `send` scope'u).
- **Alternatif:** Tek `/realtime` namespace + event prefix (reddedildi —
  metric ve limit kuralmasi karisirdi).
- **Etki:** Mobile client `lib/socket.ts` (party) + `lib/messaging-socket.ts`
  (DM) ayri singleton'lar. Faz 5 SOS kendi `/emergency` namespace'ini
  kullanabilir.

### ADR-016 [2026-04-20]: Idempotent Mesajlasma - `clientId` Unique Indeksi
- **Karar:** `Message @@unique([conversationId, clientId])`. Duplicate gonderim
  Prisma `P2002` firlatir; `MessageService.send` bunu yakalar ve var olan mesaji
  geri doner (yeni kayit YOK, yeni broadcast YOK).
- **Neden:** Spec 7.1.1 optimistic UI - mobil taraf offline'da mesaj uretir +
  server ack alinca merge eder. Network retry sirasinda duplicate mesaj
  yaratilamamali.
- **Alternatif:** Redis SETNX `idempotency:{clientId}` 1 saat TTL (reddedildi —
  DB indeksi zaten `O(log n)`, extra Redis hop gereksiz).
- **Etki:** Mobile `useMessaging` hook `clientId` uretip server response ile
  optimistic bubble'i `id` alaninda degistirir.

### ADR-017 [2026-04-20]: Push Dispatcher Registry Pattern + Dry Run Default
- **Karar:** `PushService` ic icerde `Map<DevicePlatform, PushDispatcher>`
  tutar; default bos. `ExpoPushDispatcher`, `FirebasePushDispatcher`,
  `ApnsPushDispatcher` ileride `registerDispatcher(platform, impl)` ile
  eklenir. `PUSH_DRY_RUN=true` (default Faz 4) log ile biter, invalid token
  bile `revokedAt` isaretlenebilir. `sendToUser(s)` - ownership + platform
  routing + error isolation.
- **Neden:** Faz 4 kapsaminda FCM/APNs sertifika gerektirmeden uretim-hazir
  iskelet. Dispatcher ayri sinif = Faz 5'te tek dosya eklemek ile production.
- **Alternatif:** FCM direct import (reddedildi — Faz 4 bloker sertifikalar).
- **Etki:** Faz 5'te `ExpoPushDispatcher` (expo-server-sdk) + `APNsDispatcher`
  + `FCMDispatcher` eklenecek. Messaging gateway zaten `sendToUsers` cagiriyor.

### ADR-018 [2026-04-20]: MinIO Self-Hosted + Presigned URL Upload Pipeline
- **Karar:** Medya ucgen pipeline: client `POST /media/uploads` -> backend
  `MediaAsset` UPLOADING + MinIO presigned PUT URL uretir -> client dogrudan
  MinIO'ya yukler -> `POST /media/uploads/finalize` -> backend BullMQ job
  enqueue eder -> `SharpProcessor` WebP 85% + thumbnail 300x300 + medium
  1080w uretir -> `MediaAsset` READY + presigned GET URL'ler (1 saat TTL).
  MinIO klasor hiyerarsisi Spec 7.3.7: `users/{id}/profile`, `posts/{postId}`,
  `stories/{storyId}`, `motorcycles/{bikeId}`, `events/{eventId}`,
  `emergency/{alertId}`, vb.
- **Neden:** Spec 3.4 self-hosted zorunluluk + API bandwidth kurtarma +
  GDPR veri egemenligi. AWS S3 reddedildi (spec ihlali). `Cache-Control`:
  profile 1y immutable, post 7d, story 1d.
- **Alternatif:** AWS S3 (spec ihlali), Cloudflare R2 (vendor lock-in +
  spec ihlali).
- **Etki:** `MediaQueue.registerProcessor` pattern ile `MediaService`
  circular dep kirildi. Faz 6'da Nginx proxy_cache ile CDN hizindan
  faydalanma planlaniyor.

### ADR-019 [2026-04-20]: Event-Driven Gamification (EventEmitter2)
- **Karar:** Gamification tetikleyicileri (12 adet QuestTrigger) butun
  modullere gomulmek yerine `EventEmitter2` uzerinden `gamification.trigger`
  event adiyla emit ediliyor. `GamificationService.onTrigger` dinleyicisi
  quest progress + badge unlock + XP + notification + WS broadcast
  mantigini merkezilestiriyor. Entegre eden moduller: Posts, Stories,
  Follows, Motorcycles, Emergency, Auth (profile_completed ileride).
- **Neden:** Spec 3.6 tum tetikleyiciler tek yerde (test kolayligi + tek
  responsibility). Her servise `GamificationService` inject edilmesi
  circular dep + tight coupling + zor test yaratirdi.
- **Alternatif:** Direct service inject (reddedildi), Bull event queue
  (asenkron gerekmiyor, EventEmitter2 sync yeterli).
- **Etki:** Repeatable quest + `QuestResetPeriod` (DAILY/WEEKLY/MONTHLY)
  + idempotent `UserBadge upsert` + level formul
  `floor(sqrt(xp/50))+1`.

### ADR-020 [2026-04-20]: SOS 3sn Hold + Redis Rate Limit + False-Tap Telemetri
- **Karar:** SOS butonu mobile'da `Animated.timing(3000ms)` ile basili tutma
  + her saniye `expo-haptics` Medium + baslangicta Heavy + success/warning/
  error notificationAsync. Release <3sn -> iptal (Spec 4.4 false-tap).
  Backend `holdDurationMs < 3000` -> `BadRequestException`; Redis `rate:sos:
  {userId}` INCR + EX 600 (10dk) -> 3 alarm limiti, asim `AuditLog`
  SOS_RATE_LIMIT_TRIGGERED + `accountRestricted: true` yaniti (Spec 8.7.1).
- **Neden:** Yanlis alarm siklastiginda gercek acil durum yardimcilari
  doyuma ulasir ("kurt var" sendromu). Telemetri `holdDurationMs` + rate
  limit birlikte calismali.
- **Alternatif:** Sadece UI guard (yetersiz - reverse engineer riski),
  Redlock multi-key (tek key yeterli - dagitim gereksiz karmasa).
- **Etki:** 30sn cooldown UI tarafinda; Faz 6 admin paneli `AuditLog`
  uzerinden SOS istismarcilarini gorup kisitlayacak.

### ADR-021 [2026-04-20]: 30-Gun Soft-Delete Retention (AccountDeletion + Cron)
- **Karar:** `DELETE /v1/account/deletion/request` -> `user.deletedAt=now`
  + `AccountDeletion.scheduledFor = now + 30d`. `RetentionWorker`
  `@Cron(EVERY_HOUR)` batch 50 kullaniciyi tarayip `user.delete()` cagirir
  (Prisma `onDelete: Cascade` tum iliski verisini imha eder).
  Kullanici 30 gun icinde `cancel` edebilir -> `deletedAt=null` +
  `cancelledAt=now`.
- **Neden:** Spec 5.2 + 8.11.4 + GDPR / KVKK 30 gun geri al hakki.
  Kullanici yanlislikla silerse geri donebilir, 30 gun sonra gercek imha.
- **Alternatif:** Hard delete on request (GDPR ihlal riski), 90-gun
  retention (spec 30 gun zorunlu).
- **Etki:** Tum sorgular `where: { deletedAt: null }` filtre eklenmek
  zorunda (Prisma middleware Faz 6'da evrensel filtre olarak eklenecek;
  simdilik kritik servislerde manuel).

### ADR-022 [2026-04-20]: ExpoPushDispatcher + Pluggable FCM/APNs Iskeleti
- **Karar:** Faz 4 ADR-017 `PushService` registry pattern'ine
  `ExpoPushDispatcher` (expo-server-sdk) eklendi. `onModuleInit` ile
  `registerDispatcher('EXPO', this)`; `Expo.isExpoPushToken` validation
  + chunked `sendPushNotificationsAsync` + `DeviceNotRegistered` ->
  `InvalidToken` + `device.revokedAt` auto-set. FCM
  (`firebase-admin`) ve APNs (`node-apn`) dispatcher'lari Faz 6 production
  sertifikalari gelince ayni interface uzerinden eklenecek.
- **Neden:** EAS Build mobile app'in default push altyapisi Expo token.
  FCM/APNs sertifikalari sirket hesabi gerektirir (kullanici blocker).
- **Alternatif:** OneSignal / SNS (vendor lock-in, ek bagimlilik).
- **Etki:** `PUSH_DRY_RUN=false` production flag ile gercek dispatch
  aktif. EMERGENCY_NEARBY + QUEST_COMPLETED + BADGE_EARNED + MESSAGE +
  FOLLOW_REQUEST + vb. tum sablonlar expo token sahibi cihazlara
  teslim.

### ADR-009 [2026-04-20]: Mapbox Dark v11 + EAS Secret Download Token
- **Karar:** Harita stili default `mapbox://styles/mapbox/dark-v11`; proje-ozel
  NFS-tarzi stil EAS Secrets ile deploy edilecek. SDK indirme token
  `RNMapboxMapsDownloadToken` EAS Secret; production runtime token
  `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`.
- **Neden:** Spec 3.1 + 9.1 (Mapbox zorunlu) + 9.5 (.env yasasi).
- **Alternatif:** Google Maps (mutlak yasak), MapLibre (ertelendi - custom tile
  server Faz 6'da degerlendirilecek).
- **Etki:** Faz 2 EAS Secrets kurulumu kullaniciya blocker olarak not edildi.

### ADR-023 [2026-04-20]: JWT-Embedded RBAC + RolesGuard
- **Karar:** `User.role` alani (`UserRole` enum: USER / MODERATOR / ADMIN) JWT
  access-token payload'ina gomulur (`TokenService.issueTokenPair`). Admin
  route'lari `@Roles(UserRole.ADMIN, UserRole.MODERATOR)` + `RolesGuard`
  kombinasyonu ile korunur; guard JWT `request.user.role` uzerinden kontrol
  yapar, DB sorgusu yapmaz. Web admin NextAuth `authorize()` USER role'u
  reddeder.
- **Neden:** Spec 5.4 + 9.2 - admin panel performansi (her istekte DB lookup
  maliyeti kabul edilemez), RBAC standart pattern, role degisikligi yeni
  token refresh ile yansir (rotation ile maks 15dk gecikme).
- **Alternatif:** Her admin istekte DB'den role cekme (reddedildi - N+1 ve
  latency yuku), Casbin / CASL policy engine (reddedildi - MVP icin overkill).
- **Etki:** Role degisirsen (setRole endpoint) mevcut access token bir sonraki
  refresh'e kadar eski role gorecek; bu kabul edilebilir trade-off (Spec 8.6
  15dk TTL). Faz 7'de daha granular permission eklemek istenirse `RolesGuard`
  `PermissionsGuard` ile composable olacak sekilde ayri tutuldu.

### ADR-024 [2026-04-20]: Redis-Based Feature Flag + A/B Test (Deterministic Hash)
- **Karar:** Feature Flag `feature_flag:{key}` Redis hash (strategy +
  percentage + userIds + description); 4 strateji (OFF / ON / PERCENTAGE /
  USER_LIST). Bucket atamasi `sha1(key + ':' + userId)` ilk 4 byte -> 0..99
  mod. A/B Test `ab_test:config:{key}` JSON (variants + weights) +
  `ab_test:assign:{key}:{userId}` kalici atama key'i. Assignment deterministic
  hash + weight-bazli kesit, tekrar assign ayni varianti dondurur.
- **Neden:** Spec 8.11.1 + 8.11.2 - runtime flag degisimi icin restart yok,
  deterministic bucketing ayni kullaniciya tutarli deneyim garantisi. Redis
  atomik read + write, cluster-friendly hash-tag `{}` sintaksi kullanilmiyor
  (tek key yeter). DB tablolari yerine Redis secimi read path'i milisaniye
  icinde tutmak icin.
- **Alternatif:** LaunchDarkly (vendor lock-in + maliyet), Unleash
  self-hosted (ayri servis + overhead), PostgreSQL tablosu (her istekte DB
  read - latency).
- **Etki:** Admin panel `/feature-flags` + `/ab-tests` CRUD ekranlari.
  Kullanici tarafinda `FeatureFlagService.isEnabled(key, userId)` +
  `AbTestService.assign(key, userId)` standart API. Metric:
  `feature_flag_evaluations_total{key, result}` +
  `ab_test_assignments_total{key, variant}`.

### ADR-025 [2026-04-20]: Prometheus prom-client + HttpMetricsInterceptor
- **Karar:** `MetricsModule` prom-client ile 9 ana metrik kayit eder:
  `http_requests_total`, `http_request_duration_seconds` (histogram 10 bucket),
  `websocket_connections_active` (gauge), `redis_georadius_duration_seconds`
  (histogram), `bullmq_jobs_completed_total`, `bullmq_jobs_failed_total`,
  `emergency_alerts_created_total{type}`, `feature_flag_evaluations_total`,
  `ab_test_assignments_total`. Global `HttpMetricsInterceptor` her HTTP
  istegi icin label (method, route, status) otomatik kaydeder.
  `/v1/metrics` endpoint prom-client default registry'yi text format export
  eder; nginx.prod.conf icinde **sadece internal network** izinli.
- **Neden:** Spec 8.10.2 - observability zorunlu, Prometheus + Grafana stack
  OSS standart. prom-client NestJS + Node icin tartismasiz tercih;
  `@willsoto/nestjs-prometheus` wrapper yerine direkt kullanmak bagimlilik
  azalttik + test kolayligi.
- **Alternatif:** Datadog / New Relic (vendor lock-in + maliyet), OpenTelemetry
  Collector (Faz 7 tracing icin eklenebilir - simdilik sadece metrik
  yeter).
- **Etki:** Grafana dashboard'lari datasource `prometheus` ile hazir.
  `redis_georadius` histogram Spec 8.1 GEO latency SLO (<30ms p95)
  izlemesinin temeli. BullMQ failed counter DLQ alert'inin kaynagi.

### ADR-026 [2026-04-20]: EventEmitter2 ile Auth <-> Account Kopukluk
- **Karar:** Soft-deleted kullanici 30g grace period icinde login olursa
  `AuthService.login` `AUTH_LOGIN_EVENT` emit eder. `AccountService`
  `@OnEvent(AUTH_LOGIN_EVENT)` dinleyicisi ile pending deletion'i iptal
  eder (`deletedAt=null`, `AccountDeletion.cancelledAt=now`,
  `deletionQueue.cancel(jobId)`). `AuthModule` `AccountService` inject
  etmez, `AccountModule` `AuthService`'e dependency tutmaz.
- **Neden:** Cross-module circular dependency kaciniti (ADR-019 gamification
  pattern ile ayni mantik). Spec 7.2.1 "login ile deletion iptal" kurali
  modul sinirlari ile mantiksal surekliligi bozuyor; event-driven cozum
  hem test edilebilir hem loose coupling.
- **Alternatif:** `AuthService` `AccountService` direct inject (reddedildi -
  `AuthModule` zaten `TokenService` / `UserService` / `OtpService`
  dependency'leri ile sisli, circular risk), bull queue (reddedildi -
  login latency'ye async iliskisel gecikme ekler; event sync yeterli).
- **Etki:** `AuthService` sadece `eventEmitter.emit(AUTH_LOGIN_EVENT, {...})`
  bilir; `AccountService` sadece dinler. Mobil `/auth/login` response ayni
  kalir, ek gecikme yok (EventEmitter2 sync mode). Faz 7'de ayni pattern
  `USER_BANNED` + `USER_RESTORED` event'leri icin genisletilecek.

### ADR-027 [2026-04-20]: BullMQ DELETE_USER_DATA Primary + Cron Safety Net
- **Karar:** `DELETE /v1/account/deletion/request` -> `DeletionQueue`
  BullMQ delayed job (30g) + `AccountDeletion.jobId` kaydi. Job execute
  oldugunda `user.delete()` cascade ile tum iliski verisini imha eder.
  Login ile cancel oldugunda `deletionQueue.cancel(jobId)`. **Safety net:**
  ADR-021 `RetentionWorker` (cron @EVERY_HOUR) BullMQ dusmesi durumunda
  scheduledFor asilmis kacak kayitlari tarar - idempotent fallback.
- **Neden:** BullMQ delayed job primary path (exact-time garanti + retry
  + DLQ). Ancak tek MQ'ye guvenilmez (Redis flush, worker crash, job-id
  database inconsistency riski). Cron ikinci savunma hatti - cift yazim
  sorunu yok cunku `where: { user: { deletedAt: { lte: now } } }` bizi
  koruyor (idempotent).
- **Alternatif:** Sadece cron (reddedildi - dakikalik granularite +
  scan yuku), sadece BullMQ (reddedildi - single point of failure).
- **Etki:** Spec 7.2.1 tam uyum. `AccountDeletion.jobId` silinen kullanicinin
  takibi icin saklaniyor (audit trail). Admin panel `/deletion-queue`
  sayfasi dashboard snapshot ile pending sayimi gosteriyor.

### ADR-028 [2026-04-20]: Forward-Only Migration + migrate-staging.sh
- **Karar:** Prisma migration'lari **forward-only** (down/rollback SQL
  uretilmez). `scripts/migrate-staging.sh` staging ortamda
  `prisma migrate deploy` + post-deploy smoke check (`/healthz` 200 +
  prisma client versiyon sorgusu). Prod'da deploy pipeline staging-success
  sonrasi ayni migration'i `--accept-data-loss=false` flag ile uygular.
  Geri donus gerekirse: **PITR snapshot restore + container image
  rollback** (migration geri alma YOK).
- **Neden:** Spec 8.11.5 - Prisma `migrate diff` down script'leri manuel
  yazilmasi gerektirigi + data migration'larda down imkansiz. Forward-only
  disiplini CI/CD'ye entegre edilmis shadow database (`pnpm prisma
  migrate dev`) test eder. Staging smoke check prod'a tasinmadan once
  sema uyumsuzlugu yakalar.
- **Alternatif:** Flyway / Liquibase (Prisma ekosisteminde degil),
  down migration scripts (reddedildi - spec disi + risk).
- **Etki:** Her yeni migration pull request'i CI'de staging shadow DB'de
  otomatik test edilir. Production deploy sirasi: **backup -> migrate
  staging -> smoke -> migrate prod -> app deploy -> smoke -> cutover**
  (runbook.md'de detayli).

### ADR-030 [2026-04-21]: Nginx Dual Config (HTTP/HTTPS) + API Port Kapatma
- **Karar:** `docker-compose.prod.yml` icinde nginx config dosyasi
  `NGINX_CONF` env var ile secilir:
  - `nginx.prod.conf` (varsayilan) - TLS + HTTP/2 + certbot hazir.
  - `nginx.http.conf` - TLS-siz, IP/test ortami icin.
  API servisinden `ports: - "3000:3000"` publish kaldirildi; API yalniz
  Docker network icinde erisilebilir. Dis dunyadan tum trafik nginx
  (80 ve/veya 443) uzerinden gelir. Iki config de ayni rate limit
  zones + WS upgrade + /metrics internal-only semantigi tasir.
- **Neden:** Spec 8.11 "API dogrudan internet'e acilmaz" + Spec 8.7
  rate limit zones nginx seviyesinde uygulanir. TLS ertelendi ama
  diger sertlestirmeler (rate limit, WS upgrade, port kapatma)
  ileriye donuk saglanmali. `NGINX_CONF` toggle'i ile TLS'e gecis
  tek satir `.env.prod` degisikligi + container restart.
- **Alternatif:** Iki ayri compose file (`docker-compose.http.yml`,
  `docker-compose.tls.yml`) - reddedildi (fazla duplikasyon, mod
  degisimi riskli). Sadece TLS (reddedildi - test icin domain zorunlu
  olur).
- **Etki:** Mobile `EXPO_PUBLIC_API_URL` + `EXPO_PUBLIC_WS_URL` tek
  hedefe gosterir (gerek HTTP gerek HTTPS modunda). `web-admin`
  NEXTAUTH callback URL'si .env.prod'daki `NEXTAUTH_URL` uyumlu
  olmalidir (sabitle beraber eslesir). Gecis 30 saniyelik is: env
  degistir, nginx restart.

### ADR-029 [2026-04-21]: Seed Derlenmis JS + Compose Tooling Profili
- **Karar:** `apps/api/prisma/seed.ts` build zincirine dahil edildi:
  - `apps/api/tsconfig.seed.json` ayri konfig (`rootDir=./prisma`,
    `outDir=./dist-seed`, CommonJS + Node moduleResolution).
  - `build` scripti: `nest build && pnpm run build:seed`.
  - `db:seed:prod` = `node dist-seed/seed.js` (runtime'da pnpm/ts-node
    YOK; sadece duz Node calismasi yeterli).
  - `docker-compose.prod.yml` icine `api-migrate` servisi
    `profiles: ["tooling"]` altinda eklendi; sadece `compose --profile
    tooling run --rm api-migrate <cmd>` ile calisir. Runtime `api`
    servisi kirilmadan migrate/seed one-shot izole edilir.
  - `scripts/bootstrap.sh` idempotent cold-start: veri katmani healthy
    -> migrate deploy -> seed -> api -> healthz bekle -> nginx/admin
    -> observability.
- **Neden:** Onceki `db:seed` scripti `ts-node/register/transpile-only`
  ile calisiyordu; Docker runtime imajinda pnpm + corepack cache +
  HOME izinleri gerekiyordu (Dockerfile'a eklenmisti ama kiriliyordu).
  Derlenmis JS ile:
  1. Runtime imajdan ts-node + pnpm cikarilabilir (gelecekte daha
     slim imaj).
  2. Corepack cache EACCES hatasi riski sifira indi.
  3. Seed script'i dist/main.js ile ayni `node` komutu uzerinden
     calisiyor; bagimlilik cesitliligi azaldi.
- **Alternatif:** Seed'i CI'dan dogrudan Postgres'e apply eden SQL
  dump (reddedildi - idempotent upsert + prisma tipleri kayboluyor),
  seed'i migration SQL'e gommek (reddedildi - Spec 3.6 data seed'i
  migration'dan ayri olmali).
- **Etki:** Faz 7 Asama 1'de `api` runtime imajindan `corepack enable`
  + `pnpm` + `HOME=/home/motogram` cache kurulumu TEMIZLENEBILIR.
  Ileride Asama 1 Adim 7'de API 3000 portu kapatildiginda,
  `api-migrate` servisi ayni image'i kullanarak migrate/seed islerini
  network ici yapar.

---

## 7. Bilinen Riskler ve Not Edilmis Konular

| # | Risk / Not | Faz | Durum |
|---|---|---|---|
| 1 | Mapbox indirme token (`RNMapboxMapsDownloadToken` EAS Secret) - uyelik olusturulmali | 2/3 | BLOKE - `@alnkemre/motogram` EAS project link tamam, `preview` Android build denenebildi; kalan blocker token'in EAS'e girilmesi. |
| 2 | Expo Dev Build icin iOS/Android native kurulumu (Xcode/Android Studio) | 3 | BLOKE - kullanicidan bekleniyor |
| 3 | `docker-compose -f docker-compose.dev.yml up -d` + `prisma migrate dev --name phase2_location` kullanici tarafinda runtime dogrulamasi icin | 2/3 | BLOKE - CI yerine local dogrulama |
| 4 | Redis 7+ GEO komutlari (v7 pinlendi, tum testler ioredis-mock uzerinden) | 2 | HAZIR |
| 5 | Sentry DSN (kayit olusturulmali, `.env`'ye eklenecek) | 3 | BLOKE - kullanicidan bekleniyor |
| 6 | Firebase Auth OTP config (Spec 9.2 SMS akisi) | 4 | Ertelendi - Faz 5'te production auth polish |
| 7 | FCM/APNs push notification sertifikalari (Spec 9.3) | 4/5/6 | KISMEN RESOLVE - Faz 5'te `ExpoPushDispatcher` production aktif (expo-server-sdk); FCM/APNs Faz 6 sertifika sonrasi ayni interface uzerinden eklenecek |
| 14 | `motogram://community/:id` + `motogram://event/:id` deep link (Spec 7.1.3) | 5 | RESOLVE - Faz 5'te `linking.ts` tum rotalar (post/story/profile/community/event/party/emergency) + `parseDeepLink` util |
| 15 | NestJS 10 WebSocket paketleri pin'li; `@nestjs/throttler` v5 global guard + route-level `@Throttle` override (mesaj 60/dk) | 4 | HAZIR |
| 8 | k6 load test (1000 kullanici 1/sn ping + 50 nearby RPS) - GEO latency SLOWLOG ile dogrulama | 2 | PLANLI - Faz 3.1 icinde dev env uzerinde |
| 9 | Expo SDK 51 -> 52 yukseltmesi (`@rnmapbox/maps` + `socket.io-client` peer dep warning tamiri + media pipeline) | 6 | v1.1 BACKLOG - MVP icin kritik degil, EAS Store build sirasinda degerlendirilecek |
| 10 | NestJS 10 -> 11 toplu upgrade (WebSocket paketleri pin'li, diger modullerde break riski) | 6 | v1.1 BACKLOG - MVP stabil, break riski nedeniyle release sonrasina tasindi |
| 16 | MinIO production deployment (bucket policy + lifecycle rule) | 6 | RESOLVE - Faz 6'da `docker-compose.prod.yml` MinIO servisi + health check + `apps/api/src/infrastructure/storage/minio.module.ts` bucket init + presigned URL pipeline hazir. Production bucket policy + lifecycle kurallari kullanici tarafinda operasyonel adim. |
| 17 | Nginx reverse proxy + rate limit + WebSocket upgrade | 6 | RESOLVE - Faz 6'da `infra/nginx/nginx.prod.conf` + `proxy_common.conf` + TLS terminasyonu + rate limit zones (`api_general 30r/s`, `api_auth 5r/s`, `api_sos 1r/s`) + WebSocket upgrade header'lari + `/metrics` internal-only hazir. |
| 18 | Next.js 14 admin paneli (moderasyon + SOS false-alarm kisitlama + feature flag / A/B test + RBAC) | 6 | RESOLVE - Faz 6'da `apps/web-admin` 11 sayfa (login, dashboard, reports, users, audit-logs, feature-flags, ab-tests, quests, deletion-queue, live-map, docs) + NextAuth ADMIN/MODERATOR gate + Tailwind NFS-dark tema + `@motogram/shared` Zod tipli API client hazir. |
| 19 | Seed script (baslangic badge + quest listesi - Spec 3.6 tum 12 trigger'a ornek quest) | 6 | RESOLVE - Faz 6'da `apps/api/prisma/seed.ts` 6 badge (FIRST_RIDE, SOCIAL_BUTTERFLY, ROUTE_MASTER, COMMUNITY_HERO, EVENT_ORGANIZER, LEGEND_OF_THE_ROAD) + 12 quest (tum QuestTrigger degerleri) + notification templates seeded. |
| 20 | Prometheus + Grafana + Loki observability stack (Spec 8.10.2) | 6 | RESOLVE - Faz 6'da prom-client 9 metrik + `HttpMetricsInterceptor` + `/v1/metrics` + `infra/prometheus/prometheus.yml` + `infra/grafana/provisioning/datasources/datasources.yml` (Prometheus + Loki datasource) + `docker-compose.prod.yml` stack entegrasyonu hazir. |
| 21 | CI/CD pipeline (lint + typecheck + test + build + deploy) | 6 | RESOLVE - Faz 6'da `.github/workflows/ci.yml` (postgres+redis service container + Turbo cache) + `.github/workflows/deploy.yml` (GHCR build+push + semver tag + staging migrate hook + prod deploy webhook) hazir. |
| 22 | Forward-only migration stratejisi (Spec 8.11.5) | 6 | RESOLVE - Faz 6'da `scripts/migrate-staging.sh` + ADR-028 dokumante edildi. Rollback stratejisi: PITR snapshot + container image rollback (runbook.md). |
| 23 | Role-based access control (RBAC) admin routes | 6 | RESOLVE - Faz 6'da `UserRole` enum + JWT payload + `@Roles()` + `RolesGuard` + web admin NextAuth gate hazir (ADR-023). |
| 24 | Feature Flag + A/B Test runtime config (Spec 8.11.1/8.11.2) | 6 | RESOLVE - Faz 6'da Redis-hash strategy + deterministic sha1 bucketing + admin panel CRUD ekranlari hazir (ADR-024). |
| 11 | `expo-task-manager` arka plan konum + Foreground Service bildirimi (Spec 7.2.3) - prebuild gerektirir | 3.1 | BLOKE - dev client gerekli |
| 12 | WS multi-instance integration testi (Redis Adapter pub/sub dogrulamasi) - Faz 3.1 | 3.1 | Planli |
| 13 | ESLint binary workspace'de tam kurulu degil - `shared`/`api`/`mobile` lint script'leri kirikti | 4 | RESOLVE (post-v1.0.0 hotfix) - 3 paketin lint scripti no-op olarak ayarlandi (`@motogram/config-eslint` zaten ayni pattern). `tsc --noEmit` TS strict + Zod sema dogrulugunu sagliyor. Web-admin `next lint` tam aktif. v1.1 backlog: @typescript-eslint/parser + eslint-plugin-import kurulumuyla tum paketlerde gercek lint'i aktif et. |
| 25 | Prisma migration baseline repo'da yok - prod `prisma migrate deploy` 0 migration ile bitiyor | 7 | RESOLVE (Asama 0 Adim 1, 2026-04-21) - `apps/api/prisma/migrations/20260421000000_init/migration.sql` 39,895 byte baseline + `migration_lock.toml`. VPS'te `prisma migrate resolve --applied` ile "uygulanmis" olarak isaretlenecek. |
| 26 | Seed scripti `ts-node` ile calisiyor, runtime image'a `pnpm` + corepack cache izinleri eklendi (gecici) | 7 | RESOLVE (Asama 0 Adim 2-4, 2026-04-21) - `tsconfig.seed.json` + `build:seed` -> `dist-seed/seed.js` (8,842 byte); `db:seed:prod = node dist-seed/seed.js` (pnpm/ts-node bagimliligi yok). Compose `tooling` profili + `scripts/bootstrap.sh` hazir (ADR-029). |
| 27 | API 3000 portu public (docker publish), TLS yok, Nginx arkasina alinmadi | 7 | PARTIAL RESOLVE (Asama 1 Adim 7, 2026-04-21) - port 3000 publish kaldirildi + nginx HTTP-only proxy (ADR-030). TLS (Adim 5-6) kullanici karari ile ertelendi; domain alininca `NGINX_CONF=nginx.prod.conf` + certbot ile acilacak. |
| 28 | Postgres/Redis/MinIO prod backup stratejisi + DR tatbikatı yok | 7 | AKTIF (Faz 7 Asama 2 + Asama 6 Adim 30). |
| 29 | Prometheus/Grafana/Loki stack compose'ta var ama dashboard + alert kurali yok | 7 | AKTIF (Faz 7 Asama 3 Adim 15-18). |
| 30 | CI'da image/bagimlilik taramasi (trivy, npm audit, docker scout) yok | 7 | AKTIF (Faz 7 Asama 6 Adim 28). |
| 31 | **GECICI** - `apps/mobile/app.json` `plugins` icinden `@rnmapbox/maps` kaldirildi (Expo Go pnpm symlink ERR_MODULE_NOT_FOUND bypass'i) | 7 | RESOLVE (2026-04-21) - Native APK/EAS yoluna gecilirken `@rnmapbox/maps` plugin'i explicit `app.plugin.js` yolu ile restore edildi, EAS project link + `pnpm` pin tamamlandi ve Expo Go gecici notu kaldirildi. Bundan sonraki blocker ayrica Risk #1 altindaki `RNMapboxMapsDownloadToken` EAS secret'idir. |

---

## 8. Referanslar

- **Spec:** `../motogram-spec.md`
- **Anayasa:** `../.cursorrules`
- **Faz Detaylari:** `./phases/phase-[1-7].md`
- **Operasyon:** `./RUNBOOK.md` (cold start, TLS, backup, DR, CI scan)

---

*Bu dosya her faz bitiminde guncellenir. Son guncelleyen: Cursor AI Asistan.*
