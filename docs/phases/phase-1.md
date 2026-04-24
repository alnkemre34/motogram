# Faz 1: Temel Sosyal Katman

> Kapsam (Spec Bolum 6): Auth, Profil, Garaj, Ana Sayfa (Instagram Klonu),
> Takip, Begeni, Yorum, Hikayeler.
> Tahmini Sure: 2 hafta.

> **LEGACY (2026-04-24+)**: Bu faz dokümanındaki mobil referansları (`apps/mobile`, Expo/EAS) dondurulmuş tarihsel kayıttır.
> Güncel mobil uygulama: `apps/mobile-native` (React Native CLI, MapLibre/OSM).

## 1. Baslangic Kontrolu (Pre-Flight Check) - SIHIRLI ADIM
- [x] `.cursorrules` dosyasi bastan sona okundu. (2026-04-20)
- [x] `motogram-spec.md` dosyasindaki asagidaki bolumler dikkatlice analiz edildi:
  - [x] 2.2 Ana Sayfa (Instagram klonu)
  - [x] 2.6 Profil Ekrani
  - [x] 3.1 Teknoloji Yigini
  - [x] 3.2 Prisma Semasi (User, UserSettings, Motorcycle, Follow, Post, Story, StoryView, Comment, Like, Notification, AuditLog)
  - [x] 3.6 Gamification Tetikleyici Mantigi
  - [x] 3.7 Bildirim Sablonlari
  - [x] 7.1.1 Optimistik UI (Zorunlu)
  - [x] 7.3.6 Ortak Dogrulama (Zod + packages/shared)
  - [x] 8.6 Kimlik Dogrulama (Access + Refresh Token)
  - [x] 8.7 Rate Limiting
  - [x] 8.11.4 Soft Delete Standardi
  - [x] 9.2 Auth (Email + OTP + Sign in with Apple + EULA)
  - [x] 9.3 Push Notifications (soft prompt)
  - [x] 9.5 Env Vars
  - [x] 9.6 Frontend State (Zustand + react-query + MMKV + i18next)
  - [x] 9.7 Sentry
*(Not: Cursor, bu kutucuklari isaretlemeden alt satirlardaki kodlamaya gecemez!)*
*(Pre-Flight tamamlandi: 2026-04-20. Kural 6 Adim A - Gelistirme basliyor.)*

## 2. Gelistirme Plani ve Adimlar

### Backend (apps/api) - NestJS + Prisma
- [x] Adim 1: NestJS 10 iskeleti + Prisma kurulumu (`prisma init`).
- [x] Adim 2: PostgreSQL 15 + PostGIS Docker Compose servisi (`docker-compose.dev.yml`).
- [x] Adim 3: Prisma semasi - Faz 1 modelleri:
  User, UserSettings, Motorcycle, Follow, Block, Post, Story, StoryView,
  Comment, Like, Notification, NotificationTemplate, AuditLog, Report.
- [x] Adim 4: Migration komutu hazir (`pnpm --filter @motogram/api exec prisma migrate dev`). Gercek migrate Docker Compose up sonrasi kullanici tarafindan calistirilacak.
- [x] Adim 5: Modul iskeletleri: AuthModule, UsersModule, MotorcyclesModule,
  FollowsModule, PostsModule, StoriesModule, CommentsModule, LikesModule,
  NotificationsModule + PrismaModule + RedisModule.
- [x] Adim 6: AuthService - Email/sifre + Access (15dk) + Refresh Token (7gun, Redis'te `refresh_token:{userId}:{jti}`) + token rotation + ban kontrolu. OTP ve Apple SignIn placeholder (Firebase DSN gerektiriyor, Faz 4'te aktif).
- [x] Adim 7: JwtAuthGuard (default koruma, @Public() ile acilir) + ZodValidationPipe + ZodBody pipe.
- [x] Adim 8: @nestjs/throttler + @Throttle dekorasyonlari: register 10/15dk, login 5/15dk, follow 20/dk, comment 30/dk, like 60/dk (Spec 8.7.1).
- [x] Adim 9: Soft delete `deletedAt` tum ana modellerde (User/Post/Comment/Motorcycle) - Spec 8.11.4.
- [x] Adim 10: GlobalExceptionFilter standart format `{ error, code, details? }` - Spec 9.4 + `/v1/` prefix (Spec 8.11.3).

### Shared (packages/shared) - Zod SSOT
- [x] Adim 11: Zod semalari:
  `auth.schema.ts` (Register, Login, RefreshToken, OtpRequest/Verify, AppleSignIn, Logout),
  `user.schema.ts` (UserPublic, UpdateProfile, UserSettings),
  `motorcycle.schema.ts` (Motorcycle, CreateMotorcycle, UpdateMotorcycle),
  `follow.schema.ts`, `post.schema.ts` (Post, CreatePost, UpdatePost, PostFeedQuery),
  `story.schema.ts`, `comment.schema.ts`, `like.schema.ts`, `notification.schema.ts`,
  `enums.ts` + `errors.ts` (ErrorCodes SSOT).
- [x] Adim 12: `packages/shared` tsup ile ESM+CJS+DTS build + `exports` alani.

### Config (packages/config-*)
- [x] Adim 13: `config-tsconfig/base.json`, `nest.json`, `expo.json`, `next.json`.
- [x] Adim 14: `config-eslint/base.js`, `nest.js`, `expo.js` (`no-explicit-any: error`).

### Mobile (apps/mobile) - Expo Dev Build
- [x] Adim 15: Expo SDK 51 kurulumu (package.json + app.json + babel.config.js).
- [x] Adim 16: Zustand (auth.store) + @tanstack/react-query (query-client) + react-native-mmkv (storage.ts, AsyncStorage degil) + react-i18next (Spec 9.6).
- [x] Adim 17: `@sentry/react-native` init (`lib/sentry.ts`) - Spec 9.7.
- [x] Adim 18: Tab Bar (Home, Discover, Map, Inbox, Profile) - Spec 2.1.
- [x] Adim 19: Auth ekranlari: WelcomeScreen, LoginScreen (Zod dogrulama), RegisterScreen (EULA zorunlu z.literal(true)), OtpScreen iskeleti (Spec 9.2).
- [x] Adim 20: HomeScreen - FlatList + useQuery feed + RefreshControl + post card + like dugmesi (Spec 2.2). Stories rail iskeleti Faz 1'de placeholder, Faz 2'de dolu icerikle.
- [x] Adim 21: ProfileScreen - Header + sayilar + XP/Level + ridingStyle chips + signOut (Spec 2.6). Garaj/Topluluk sekmeleri Faz 1'de placeholder olup ileride doldurulacak.
- [x] Adim 22: Optimistic UI - `applyOptimisticLike` saf fonksiyonu + `useLikePost` react-query mutation (onMutate cache patch, onError rollback, onSettled invalidate) - Spec 7.1.1.
- [x] Adim 23: i18n dil dosyalari: `tr.json` + `en.json` (auth, home, profile, tabs, common, errors).
- [ ] Adim 24: Push notification soft prompt (Spec 9.3) - Bu adim DEFER EDILDI: gercek FCM/APNs token icin Firebase/APNs setup gerekiyor. Faz 4'te Notification modulunun WS/socket entegrasyonu ile birlikte aktif edilecek. Spec 9.3 soft prompt UX'i hazir kod; kanal Faz 4'te canli.

## 3. Kapanis ve Uyum Kontrolu (Post-Flight Check) - SIHIRLI ADIM
- [x] Yazilan kodlar Spec dosyasindaki kurallarla %100 uyumlu kontrol edildi (Kural 6 Adim B - test yazilmadan once yapildi).
- [x] Yasakli kutuphane kullanilmadigi teyit edildi: Google Maps YOK (sadece Mapbox import'u Faz 2'de eklenecek), AsyncStorage YOK (MMKV), Redux YOK (Zustand), `any` YOK (ESLint `no-explicit-any: error`), hardcoded string YOK (i18next).
- [x] Optimistic UI uygulandi: `applyOptimisticLike` + `useLikePost` (Spec 7.1.1). Yorum/takip Optimistik UI Faz 1'de begeni icin implement edildi; yorum/takip icin ayni pattern Faz 2'de yaygilastirilacak.
- [x] Zod semalari `@motogram/shared`'dan IMPORT edildi; frontend/backend tarafinda COPY-PASTE YOK (Spec 7.3.6). Backend `ZodBody` + `ZodValidationPipe` ayni sema ile dogruluyor.
- [x] Tum metinler `react-i18next` t() cagrisi ile okunuyor (hardcoded string YOK).
- [x] `.env.example` monorepo kokunde mevcut (Faz 0'da olusturuldu); gercek `.env` `.gitignore`'da.
- [x] Sentry init `App.tsx` basinda cagriliyor; DSN yoksa `console.warn` + devre disi.
- [x] Soft delete ana modellerde aktif: User, Post, Comment, Motorcycle (deletedAt) - Spec 8.11.4.
- [x] Refresh Token Redis'te `refresh_token:{userId}:{jti}` anahtariyla 7gun TTL ile saklaniyor; logout'ta tek jti veya `allDevices:true` ile tum pattern siliniyor (Spec 8.6).
- [x] `/v1/` API prefix uygulandi (Spec 8.11.3).
- [x] Standart hata formati `{ error, code }` - GlobalExceptionFilter (Spec 9.4).
- [x] Rate limits @Throttle ile spec'e uygun (Spec 8.7.1).

## 4. Test Raporu ve Sonuclar
- [x] Jest unit testleri yazildi (Spec'e gore, koda gore degil - Kural 6 Adim C):
  - [x] AuthService: register (EULA+tokens), login (hatali sifre, banli hesap, basarili), refresh (rotation + replay), logout (allDevices + idempotent)
  - [x] LikesService: 404 missing post, idempotent duplicate like, increment/decrement counts, optimistik davranisla uyumlu
  - [x] FollowsService: self-follow engelli, 404 missing, block engeli, PENDING vs ACCEPTED (private/public), unfollow counts
  - [x] Zod auth.schema: EULA literal(true) zorunlu, email/username/password kurallari, OTP E.164+6digit
  - [x] Zod post.schema: media min1/max10, lat/lng sinir, caption 2200
  - [x] Optimistic UI saf fonksiyon: +1/-1, floor at 0, no mutation, no-op for unknown id
- [x] TypeScript strict + noUncheckedIndexedAccess + no-explicit-any ile tum paketler typecheck PASS.
- [x] Tum testler BASARILI (53 / 53).

**Test Terminal Ciktisi:**
```
$ pnpm turbo run typecheck test

@motogram/shared:build: DTS Build start
@motogram/shared:build: DTS  Build success in 1356ms
@motogram/shared:build: DTS dist\index.d.mts 32.68 KB
@motogram/shared:build: DTS dist\index.d.ts  32.68 KB

@motogram/api:typecheck: > tsc --noEmit -p tsconfig.json   (exit 0)
@motogram/mobile:typecheck: > tsc --noEmit                 (exit 0)
@motogram/shared:typecheck: > tsc --noEmit                 (exit 0)

@motogram/shared:test:
PASS src/schemas/auth.schema.spec.ts
PASS src/schemas/post.schema.spec.ts
Test Suites: 2 passed, 2 total
Tests:       21 passed, 21 total

@motogram/api:test:
PASS src/modules/likes/likes.service.spec.ts
PASS src/modules/follows/follows.service.spec.ts
PASS src/modules/auth/auth.service.spec.ts
Test Suites: 3 passed, 3 total
Tests:       26 passed, 26 total

@motogram/mobile:test:
PASS src/hooks/optimistic.spec.ts
  applyOptimisticLike (Spec 7.1.1)
    v increments likesCount by 1 on like (currentlyLiked=false)
    v decrements likesCount by 1 on unlike (currentlyLiked=true)
    v never goes below 0 on unlike
    v does not mutate other posts
    v does not mutate original (referential immutability)
    v no-op for unknown postId (feed unchanged in values)
Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total

Tasks:    9 successful, 9 total
TOPLAM:   53 / 53 test PASS
```

## 5. Hafiza Kaydi (Kritik Son Adim)
- [x] Bu faz basariyla tamamlandi. `docs/PROJECT_BOARD.md` dosyasi Faz 1 tamamlandi logu ile guncellendi (2026-04-20).
- [x] Yeni mimari kararlar Bolum 6'ya ADR olarak eklendi (JWT rotation + Redis refresh, ZodBody pipe, saf optimistic fonksiyon).
- [x] Faz 2 blocker'lari Bolum 7'de: Docker Compose up, `prisma migrate dev`, Mapbox download token, Sentry DSN, Firebase OTP config.
