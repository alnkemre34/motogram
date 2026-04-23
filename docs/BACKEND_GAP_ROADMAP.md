# Motogram — Backend Gap Closure Roadmap (B‑01 → B‑18)

> **Sürüm:** 1.2 — 2026-04-23  
> **Tamamlanan (kod):** **B‑01** … **B‑03** (önceki commit); **B‑04** … **B‑08** (önceki tur); **B‑09** (`FollowListQuerySchema`, `FollowListPageResponseSchema`, `GET /v1/users/:userId/followers|following`, `GET /v1/users/me/followers|following`).  
> **Kapsam:** `FRONTEND_BLUEPRINT.md` §17 “Backend Eksikleri” listesini (B1–B17) mevcut Zod / OpenAPI pipeline’ı **hiç bozmadan** kapatmak. Hayalet ekran üretmemek için öncelik burada; frontend’in F0/F1 sprintleri bu liste bittikten sonra güvenle açılır.  
> **Anayasa (asla dışına çıkılmaz):**  
> 1. **Zod SSOT** — şema önce `packages/shared/src/schemas/*.ts` içine, oradan export.  
> 2. **Controller pattern** — `@ZodResponse(Schema)` + `@Body(new ZodBody(Schema))` + `@Throttle` + `@Public` (gerekiyorsa) + `@Roles` (admin). Nest’in `@Body/@Query/@Param` imzası dışına çıkma.  
> 3. **OpenAPI registry** — yeni schema’lar `packages/shared/src/openapi/register.ts` içinde kayıtlı (zod‑to‑openapi otomatik toplayacak).  
> 4. **Drift kapısı** — her iş sonunda `pnpm openapi:generate && pnpm openapi:check` (CI’daki aynısı lokal).  
> 5. **Test disiplini** — her iş için (a) shared schema testi, (b) service unit, (c) e2e contract testi.  
> 6. **Dokümantasyon senkron kuralı** — her madde bittiğinde **aynı commit’te**: `docs/API_Contract.md` + `docs/openapi.json` (otomatik), `docs/PROJECT_BOARD.md` §5 log + §1 canlı durum (manuel), `docs/FRONTEND_BLUEPRINT.md` §17 tablo (manuel — satırı `EKSİK` → `HAZIR (B‑XX)` yap).

---

## 0. Başlamadan önce (tek seferlik hazırlık)

### 0.1 Lokal sağlık testi

```bash
pnpm install
pnpm --filter @motogram/shared build
pnpm --filter @motogram/api typecheck
pnpm openapi:generate
pnpm openapi:check          # drift olmamalı
pnpm --filter @motogram/api test
pnpm --filter @motogram/api test:e2e -- --runInBand
```

Hepsi yeşil olmadan **hiçbir adıma başlanmaz**.

### 0.2 Çalışma şablonu (her B‑XX için aynı 10 adım)

| # | Adım | Çıktı |
|---|------|-------|
| 1 | **Plan yazı** | PROJECT_BOARD §5’te kısa madde: “B‑XX başlıyor” |
| 2 | **Şema** — `packages/shared/src/schemas/<dom>.schema.ts` | `ReqSchema`, `ResSchema`, `type Req`, `type Res` |
| 3 | **OpenAPI registry** — `packages/shared/src/openapi/register.ts` | `registry.register('<Name>', Schema)` |
| 4 | **Shared schema testi** — `packages/shared/src/schemas/<dom>.schema.spec.ts` | parse happy + edge fail |
| 5 | **Prisma** — gerekiyorsa `apps/api/prisma/schema.prisma` + migration | `pnpm prisma migrate dev --name <b_xx_...>` |
| 6 | **Service** — `apps/api/src/modules/<dom>/<dom>.service.ts` | pure domain logic + unit test |
| 7 | **Controller** — `@ZodResponse` + `@ZodBody` uyumlu, global prefix `v1/` otomatik | e2e testi yazılabilir |
| 8 | **Module & wiring** — `AppModule` içine `<Dom>Module` eklendiyse ekle | — |
| 9 | **Contract & OpenAPI** — `pnpm openapi:generate` + `pnpm openapi:check` yeşil | `docs/openapi.json` + `docs/API_Contract.md` otomatik güncel |
| 10 | **PROJECT_BOARD + FRONTEND_BLUEPRINT güncelle + commit + push** — CI yeşil beklenir | `feat(b-xx): ...` |

Tek bir maddenin kabul kriteri **bu 10 adımın tamamı yeşil** olmasıdır; atlama yok.

### 0.3 Rollback kuralı

Her B‑XX **tek commit + tek PR**. CI kırmızıya dönerse `git revert` ile geri alınır; kısmi merge yapılmaz.

---

## 1. Öncelik sırası (acıl → olmazsa olmaz → konfor)

| Sıra | Kod | Başlık | Frontend bağımlılığı | Karmaşıklık |
|------|-----|--------|-----------------------|--------------|
| 1 | **B‑01** ✅ | `Post.likedByMe` alanı | Home feed like toggle bug’ı | XS |
| 2 | **B‑02** ✅ | `GET /conversations?type=` filtresi | Inbox “Topluluk Sohbetleri” sekmesi | XS |
| 3 | **B‑03** ✅ | `Party` route sırası fix (`invites/me` önce) | Parti davetleri | XS |
| 4 | **B‑04** ✅ | Auth password change (`POST /auth/password/change`) | Settings ▸ Şifre değiştir | S |
| 5 | **B‑05** ✅ | Forgot + Reset password (`/auth/password/forgot`, `/reset`) | Auth ▸ Şifremi unuttum | M |
| 6 | **B‑06** ✅ | Username change (`PATCH /users/me/username`) | Settings ▸ Kullanıcı adı | S |
| 7 | **B‑07** ✅ | Email change + verify (`/auth/email/change`, `/verify`) | Settings ▸ E‑posta | M |
| 8 | **B‑08** ✅ | User search (`GET /users/search?q=`) | NewConversation, invite flows | S |
| 9 | **B‑09** ✅ | Followers / Following (`GET /users/:userId/followers` / `/following` + `me/…`) | Profile sekmeleri | S |
| 10 | **B‑10** | Blocks modülü (`GET/POST/DELETE /blocks`) | Settings ▸ Engellenmiş kullanıcılar | S (yarı hazır) |
| 11 | **B‑11** | Reports modülü (`POST /reports`) | PostCard/Comment ▸ Rapor et | S (yarı hazır) |
| 12 | **B‑12** | Communities search (`GET /communities/search?q=`) | Discover ▸ arama | S |
| 13 | **B‑13** | Events search (`GET /events/search?q=`) | Discover ▸ arama | S |
| 14 | **B‑14** | Notification preferences (`/notification-preferences`) | Settings ▸ Bildirimler | S |
| 15 | **B‑15** | Emergency contacts (`/emergency/contacts`) | Settings ▸ Acil kişiler | S |
| 16 | **B‑16** | OTP (request/verify) — `/auth/otp/*` | Auth ▸ Otp ekranı | M |
| 17 | **B‑17** | Account deletion tekleştirme (`DELETE /users/me` → deprecate) | DeleteAccount ekranı tutarlılığı | XS |
| 18 | **B‑18** | Conversation mute / group leave | Conversation info ekranı | M |

Tahmini toplam: **~14–16 iş günü** (tek geliştirici, testler dahil).

---

## 2. Maddeler (detay)

### B‑01 · `Post.likedByMe` alanı

**Amaç:** `GET /v1/posts/feed` ve `GET /v1/posts/:id` response’larında kullanıcının postu beğenip beğenmediğini döndürmek. Bu olmadan mobil `HomeScreen` like toggle’ı yanlış (şu an hep `false`).

**Değişecek dosyalar:**

- `packages/shared/src/schemas/post.schema.ts` → `PostApiResponseSchema`’ya `likedByMe: z.boolean()` ekle; `PostFeedPageSchema` içindeki post itemlarına aynı.
- `apps/api/src/modules/posts/posts.service.ts` → feed ve detay sorgularında mevcut kullanıcıya göre `Like` tablosundan `EXISTS` kontrolü (Prisma `_count` + `likes: { where: { userId: current } }` shape).
- `apps/api/src/modules/posts/posts.service.spec.ts` → yeni alan test edilsin.

**Testler:**

- Schema: beğenilmemiş post `likedByMe: false`, beğenilmiş `true`.
- Service unit: iki kullanıcı, biri beğeniyor → diğerinin feed’inde `false`, kendisinin feed’inde `true`.
- E2E: `POST /likes/:postId` sonrası `GET /posts/:id` → `likedByMe === true`.

**Risk:** Feed sorgusu performans — beğenilmiş post listesi için subquery optimum; gerekirse `postIds IN (SELECT)` ile tek seferde çekilir.

**PR başlığı:** `feat(posts): add likedByMe field to post responses (B-01)`

---

### B‑02 · `GET /v1/conversations?type=` filtresi

**Amaç:** Mobilde Inbox’ta “Topluluk Sohbetleri” sekmesini ayırmak için sunucu tarafında tip filtresi.

**Değişecek dosyalar:**

- `packages/shared/src/schemas/message.schema.ts` → `ListConversationsQuerySchema = z.object({ type: ConversationTypeEnum.optional(), cursor: z.string().optional(), limit: z.number().int().min(1).max(50).default(20) })`; response olarak mevcut `ConversationsListResponseSchema` kalır.
- `apps/api/src/modules/messaging/messaging.controller.ts` → `@Query(new ZodQuery(ListConversationsQuerySchema))` parametresi (yeni `ZodQuery` pipe yok ise `ZodBody`’nin ikizi olarak **zaten varsa** `zod-query.pipe.ts` kullan; yoksa bu iş **B‑02 kapsamında eklenir** ve tüm query param kullanan endpoint’ler sonraki adımlarda ona migrate edilir).
- `apps/api/src/modules/messaging/conversation.service.ts` → `listConversations(userId, { type, cursor, limit })`.

**Testler:**

- Schema: geçersiz `type` → fail.
- Service unit: DM + COMMUNITY_CHAT karışık fixture → `type=COMMUNITY_CHAT` sadece 2 döner.
- E2E: authenticated user, filtreli/filtresiz çağrı.

**PR başlığı:** `feat(messaging): support type filter on GET /conversations (B-02)`

---

### B‑03 · Party route sırası düzeltmesi

**Amaç:** `GET /parties/invites/me` yolu, `GET /parties/:id`’den **önce** tanımlanmalı; aksi halde Nest `:id` placeholder’a `invites` geçer.

**Değişecek dosyalar:**

- `apps/api/src/modules/party/party.controller.ts` — metod sırası değişecek; davranış aynı.
- E2E: `GET /parties/invites/me` 200, `GET /parties/abc-id` 200 (veya 404 — id’ye göre).

**PR başlığı:** `fix(party): ensure static routes declared before :id (B-03)`

---

### B‑04 · `POST /v1/auth/password/change` — **TAMAMLANDI (2026-04-23)**

**Amaç:** Oturum içi şifre değiştirme.

**Zod (yeni):** `packages/shared/src/schemas/auth.schema.ts`

```ts
export const ChangePasswordSchema = z.object({
  currentPassword: PasswordSchema,
  newPassword: PasswordSchema,
});
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;

export const ChangePasswordResponseSchema = z.object({
  success: z.literal(true),
  revokedSessions: z.number().int().nonnegative(),
});
```

**Controller:** `auth.controller.ts`  
`@Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })` + `@HttpCode(200)` + `@Post('password/change')` + `@ZodResponse(ChangePasswordResponseSchema)` + `@Body(new ZodBody(ChangePasswordSchema))`.

**Service:** `auth.service.ts → changePassword(userId, dto)`  
- `bcrypt.compare(currentPassword, user.passwordHash)` ≠ true → `UnauthorizedException`.
- `newPassword !== currentPassword` kuralı.
- `bcrypt.hash(newPassword)` + `user.update`.
- **Tüm refresh token’ları iptal et** (`refreshToken.deleteMany({ userId })`) — diğer cihazlar anında düşer.
- Audit log: `AuthEvent.PASSWORD_CHANGED`.

**Testler:**

- Unit: yanlış current → 401; aynı şifre → 400; happy → `revokedSessions > 0`.
- E2E: login → change → eski refresh token 401.

**PR başlığı:** `feat(auth): add password change endpoint (B-04)`

---

### B‑05 · `POST /v1/auth/password/forgot` + `/reset`

**Zod (yeni):**

```ts
export const ForgotPasswordSchema = z.object({ email: z.string().email() });
export const ResetPasswordSchema = z.object({
  token: z.string().min(20),
  newPassword: PasswordSchema,
});
export const ForgotPasswordResponseSchema = z.object({ success: z.literal(true) });
```

**Prisma (yeni model):** `PasswordResetToken { id, userId, tokenHash, expiresAt, usedAt }` — mevcut `RefreshToken` tablosuna benzer pattern.

**Service:**
- `forgot(email)` → kullanıcı varsa rastgele 32 byte token üret, `tokenHash` kaydet, 30 dk TTL, **mail queue** (BullMQ `mail` kuyruğu zaten mevcut — Emergency için kullanılıyor) üzerinden link gönder. Kullanıcı yoksa bile 200 dön (enumeration önleme).
- `reset(token, newPassword)` → hash eşleşmesi, TTL + `usedAt` kontrolü; başarılı ise `usedAt = now`, parola güncelle, tüm refresh’ları iptal et.

**Throttle:** `forgot` için 3 / 15 dk.

**Testler:**
- Unit: expired token → 400; aynı token iki kez → 400.
- E2E: forgot → queue job assertion; reset → login çalışır.

**Güvenlik:** Token hashli; cleartext sadece mailde. Response body’de **asla** token dönme.

**PR başlığı:** `feat(auth): add forgot/reset password flow (B-05)`

---

### B‑06 · `PATCH /v1/users/me/username` *(tamamlandı — 2026-04-23)*

**Zod (yeni):** `packages/shared/src/schemas/user.schema.ts`

```ts
export const ChangeUsernameSchema = z.object({
  username: UsernameSchema, // mevcut RegisterSchema’dan çıkar/ortak kullan
});
```

**Kural:**
- Unique constraint zaten `User.username`.
- **Cooldown:** Son değişiklikten itibaren **30 gün**; `User` tablosuna `usernameChangedAt DateTime?` alanı eklenir (migration).
- Küçük harfe normalize; rezerv listesine karşı kontrol (`admin`, `motogram`, `support`, `help`, `root` vb.) — helper `isReservedUsername`.

**Service:** `users.service.ts → changeUsername(userId, username)`; 409 (unique), 400 (cooldown/reserved).

**Testler:** unique çakışma, cooldown aktif/pasif, reserved, happy path.

**PR başlığı:** `feat(users): allow username change with 30-day cooldown (B-06)`

---

### B‑07 · Email change + verify *(tamamlandı — 2026-04-23)*

**Zod:**

```ts
export const ChangeEmailRequestSchema = z.object({
  newEmail: z.string().email(),
  password: PasswordSchema,
});
export const ChangeEmailVerifySchema = z.object({ token: z.string().min(20) });
export const ChangeEmailResponseSchema = z.object({ success: z.literal(true), pendingEmail: z.string().email() });
```

**Prisma:** `EmailChangeToken { id, userId, newEmail, tokenHash, expiresAt, usedAt }` + `User.pendingEmail`.

**Servis:**
- `requestEmailChange(userId, newEmail, password)` → şifre doğrula, email unique değilse 409, token üret + mail gönder, `pendingEmail` yaz.
- `verifyEmailChange(token)` → TTL + usedAt + hash, kullanıcıya `email = pendingEmail`, `pendingEmail = null`.

**Testler:** yanlış şifre → 401, taken email → 409, expired token → 400.

**PR başlığı:** `feat(auth): email change with verification (B-07)`

---

### B‑08 · `GET /v1/users/search?q=` *(tamamlandı — 2026-04-23)*

**Zod:**

```ts
export const UserSearchQuerySchema = z.object({
  q: z.string().min(2).max(50),
  limit: z.number().int().min(1).max(30).default(10),
  cursor: z.string().optional(),
});
export const UserSearchResponseSchema = z.object({
  items: z.array(UserPublicApiSchema),  // mevcut public user şeması
  nextCursor: z.string().nullable(),
});
```

**Service:** `username ILIKE :q% OR displayName ILIKE %:q%` + `deletedAt IS NULL`; engelleyenler/engellenenler listeden çıkar (B‑10 tamamlanmışsa).

**Throttle:** 30/dk.

**Test:** happy + boş sonuç + 1 karakter 400 + block listesi honored.

**PR başlığı:** `feat(users): add user search endpoint (B-08)`

---

### B‑09 · Followers / Following listesi ✅ (kodlandı)

**Zod:** `packages/shared/src/schemas/follow.schema.ts` — `FollowListQuerySchema`, `FollowListUserSchema`, `FollowListPageResponseSchema` (`items[].isFollowedByMe`).

**Endpoint’ler:**
- `GET /v1/users/:userId/followers`
- `GET /v1/users/:userId/following`
- `GET /v1/users/me/followers`, `GET /v1/users/me/following`

**Servis:** `FollowsService` — `Follow` satırı `id` ile cursor; blok ilişkisindeki kullanıcılar listeden çıkar; `isFollowedByMe` tek `findMany` ile toplu.

**PR başlığı:** `feat(users): add followers/following list endpoints (B-09)`

---

### B‑10 · Blocks modülü

**Mevcut durum:** `Block` Prisma modeli ve `BlockDtoSchema` **zaten var** — sadece module/service/controller eksik.

**Yeni dosyalar:**

- `apps/api/src/modules/blocks/blocks.module.ts`
- `apps/api/src/modules/blocks/blocks.service.ts`
- `apps/api/src/modules/blocks/blocks.controller.ts`
- `packages/shared/src/schemas/block.schema.ts` → `BlocksListResponseSchema` ek (mevcut `BlockDtoSchema` yeterli)

**Endpoint’ler:**
- `GET /v1/blocks` → `BlocksListResponseSchema`
- `POST /v1/blocks/:userId` → `BlockDtoSchema` (idempotent)
- `DELETE /v1/blocks/:userId` → 204

**Kural:**
- `initiatorId === targetId` → 400.
- Block oluşturunca: her iki tarafın takip ilişkisi silinir (varsa); mesaj gönderim/konuşma kontrolleri `MessageService`’te yapılacak:
  - Servis guard: `sendMessage`/`createConversation` DM’de initiator tarafından block varsa 403.
  - Feed filtre: `posts.service.getFeed` `authorId NOT IN (block pair)` 
- `users/search` block çiftini dışarıda bırakır (B‑08 ile birlikte).

**Testler:** block → DM atma denemesi 403; block → feed’de o kullanıcının postu yok; unblock sonrası geri gelir.

**PR başlığı:** `feat(blocks): user block/unblock module (B-10)`

---

### B‑11 · Reports modülü

**Mevcut durum:** `Report` Prisma modeli ve `CreateReportSchema` / `ReportDtoSchema` **zaten var**; admin tarafında listeleme/inceleme var; kullanıcı tarafı **yok**.

**Yeni dosyalar:**

- `apps/api/src/modules/reports/reports.module.ts`
- `apps/api/src/modules/reports/reports.service.ts`
- `apps/api/src/modules/reports/reports.controller.ts`

**Endpoint:**
- `POST /v1/reports` (`CreateReportSchema`) → `ReportDtoSchema`

**Kural:**
- `@Throttle({ default: { ttl: 60_000, limit: 5 } })`.
- `targetType` enum: `POST | COMMENT | USER | COMMUNITY | MESSAGE`.
- Aynı `(reporterId, targetType, targetId)` son 24 saatte ikinci defa → 409.
- Başarılı kayıtta: WS gateway’i yok (admin panelden görülür), ama BullMQ `moderation` kuyruğuna job push (opsiyonel, var ise).

**Testler:** duplicate 409, happy 201, schema invalid 400, admin listeleme çalışmaya devam.

**PR başlığı:** `feat(reports): user content report endpoint (B-11)`

---

### B‑12 · Communities search

**Zod:**
```ts
export const CommunitySearchQuerySchema = z.object({
  q: z.string().min(2).max(50),
  limit: z.number().int().min(1).max(30).default(10),
  cursor: z.string().optional(),
});
```

**Endpoint:** `GET /v1/communities/search` → mevcut `CommunityListItemSchema` array’i ile `NearbyCommunitiesResponseSchema`’ya paralel yeni `CommunitiesSearchResponseSchema`.

**Servis:** `name ILIKE %:q% OR description ILIKE %:q%` + `visibility IN (PUBLIC, INVITE_ONLY)` (PRIVATE hariç).

**PR başlığı:** `feat(communities): add search endpoint (B-12)`

---

### B‑13 · Events search

B‑12 ile birebir aynı pattern; `Event` tablosu, `title ILIKE + status IN (OPEN,ONGOING)`.

**PR başlığı:** `feat(events): add search endpoint (B-13)`

---

### B‑14 · Notification preferences

**Yeni Prisma modeli:** `NotificationPreference { userId PK, pushFollow Boolean @default(true), pushLike Boolean @default(true), pushComment, pushMention, pushParty, pushEmergency, pushCommunity, pushEvent, emailDigest Boolean @default(false) }`.

**Zod:**
```ts
export const NotificationPreferencesSchema = z.object({
  pushFollow: z.boolean(),
  pushLike: z.boolean(),
  pushComment: z.boolean(),
  pushMention: z.boolean(),
  pushParty: z.boolean(),
  pushEmergency: z.boolean(),
  pushCommunity: z.boolean(),
  pushEvent: z.boolean(),
  emailDigest: z.boolean(),
});
export const UpdateNotificationPreferencesSchema = NotificationPreferencesSchema.partial();
```

**Endpoint:**
- `GET /v1/notification-preferences`
- `PATCH /v1/notification-preferences` (`UpdateNotificationPreferencesSchema`)

**NotificationService** yollamadan önce prefs kontrol eder (örn. `like` için `pushLike === true`).

**PR başlığı:** `feat(notifications): user push preferences (B-14)`

---

### B‑15 · Emergency contacts

**Yeni Prisma modeli:** `EmergencyContact { id, userId, name, phone, relationship?, createdAt }` (max 5 per user).

**Zod:**
```ts
export const CreateEmergencyContactSchema = z.object({
  name: z.string().min(1).max(50),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),  // E.164
  relationship: z.string().max(30).optional(),
});
```

**Endpoint’ler:**
- `GET /v1/emergency/contacts`
- `POST /v1/emergency/contacts`
- `DELETE /v1/emergency/contacts/:id`

**Emergency servisi** SOS alert’te bu kişilere SMS/email kuyruğuna job düşer (future integration; şimdilik audit log + WS event yeterli — MD’de not düş).

**PR başlığı:** `feat(emergency): user emergency contacts (B-15)`

---

### B‑16 · OTP request/verify

**Kullanım niyeti:** Şu an `OtpScreen` form var ama route’a bağlı değil. Kullanıcı onayını **telefon doğrulama** olarak modellemek en hizalı yoldur.

**Zod:**
```ts
export const OtpRequestSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
});
export const OtpVerifySchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  code: z.string().length(6).regex(/^\d+$/),
});
```

**Prisma:** `OtpCode { id, userId?, phone, codeHash, expiresAt, attemptCount, usedAt }`.

**Servis:**
- `request(phone)` — 6 haneli kod üret, hashle, 5 dk TTL, SMS queue; **her 60 sn’de 1 kod** throttle, aynı telefon için.
- `verify(phone, code)` — 5 deneme sonrası kilitle; başarılıysa `User.phoneVerifiedAt`.

**Auth şemasına hizalama:** Register/Login’de zorunlu değil — opsiyonel telefon doğrulama.

**PR başlığı:** `feat(auth): phone OTP request/verify (B-16)`

---

### B‑17 · Account deletion tekleştirme

**Amaç:** Mevcut iki yol (`DELETE /users/me` ve `/account/deletion`) arasındaki tutarsızlığı kaldır.

**Plan:**
- `DELETE /users/me` → controller içinde **deprecation flag** döndür (HTTP 308 permanent redirect YAPMA — sadece service’te `AccountService.requestDeletion` çağır + `deprecated: true` içeren response; schema’ya `AccountDeletionStatusSchema` wrap).
- Yanıt schema’sı **aynı** `AccountDeletionStatusSchema` → OpenAPI’da birleşik görünür.
- `POST /users/me/cancel-deletion` → `AccountService.cancel` çağır.
- Frontend zaten sadece `/account/deletion`’ı kullanacak (blueprint §10.4).

**Test:** `DELETE /users/me` sonrası `GET /account/deletion` → `pending` status.

**PR başlığı:** `refactor(users): route DELETE /users/me through account deletion flow (B-17)`

---

### B‑18 · Conversation mute + group leave

**Zod:**
```ts
export const MuteConversationSchema = z.object({ mutedUntil: z.string().datetime().optional() }); // null → unmute
export const LeaveConversationResponseSchema = z.object({ success: z.literal(true) });
```

**Yeni Prisma alanları:** `ConversationParticipant.mutedUntil DateTime?`, `leftAt DateTime?`.

**Endpoint’ler:**
- `POST /v1/conversations/:id/mute` (body `MuteConversationSchema`) → 200 `OkTrueSchema`
- `POST /v1/conversations/:id/leave` → `LeaveConversationResponseSchema`
  - DM için 400 (ayrılamaz, sadece block/delete).
  - GROUP_CHAT / COMMUNITY_CHAT için `leftAt = now`; son kalan admin ise otomatik transfer veya 400 (karar: transfer to oldest member).

**MessageService:**
- `sendMessage` participant’ın `leftAt === null` kontrolü.
- Push: `mutedUntil > now` ise push **gönderilmez** (okunmamış sayısı artmaya devam eder).

**PR başlığı:** `feat(messaging): mute/leave conversation (B-18)`

---

## 3. Her madde sonrası doküman güncelleme (zorunlu adım 10)

Her B‑XX merge öncesi aynı PR’da şu dosyalar **bir arada** güncellenir:

1. **`docs/openapi.json`** — `pnpm openapi:generate` çıktısı (commit).
2. **`docs/API_Contract.md`** — `pnpm openapi:generate` çıktısı (commit).
3. **`docs/PROJECT_BOARD.md`** §5 log satırı (örn.):  
   ```
   - 2026-04-25 — B-04 TAMAMLANDI: `/auth/password/change` eklendi; tüm refresh token'lar iptal; 5 dk throttle. Test: 14 test yeşil. Drift yok.
   ```
   + §1 **Son Tamamlanan**, **Son Güncelleme**, (gerekirse) **Aktif Faz** satırlarını güncelle.
4. **`docs/FRONTEND_BLUEPRINT.md`** §17 tablo — ilgili satır:  
   - Eski: `| B4 | POST /v1/auth/password/change | Oturumiçi şifre değiştir | YES |`  
   - Yeni: `| B-04 ✅ | POST /v1/auth/password/change | Oturumiçi şifre değiştir | DONE |`
5. Ayrıca §18 Mevcut mobil hataları listesinde ilgili madde kilitleri kalktıysa işaretle (örn. B‑14 sonrası Home like state madde #2).

---

## 4. Test disiplini — kabul seti

Her B‑XX merge’den **önce** lokalde:

```bash
pnpm --filter @motogram/shared test              # schema testleri
pnpm --filter @motogram/api test                 # unit + controller
pnpm --filter @motogram/api test:e2e -- --runInBand
pnpm --filter @motogram/api typecheck
pnpm openapi:generate && pnpm openapi:check      # drift yok
pnpm --filter @motogram/api build                # prod build hazır
```

**CI’da** ek olarak:
- `security-audit` job’u yeni password/OTP endpoint’lerinde throttle assertion.
- `e2e` job’u `docker-compose.test.yml` ile (Postgres + Redis + MinIO + MailHog) — mail queue’yu MailHog üzerinden dinleyerek B‑05/B‑07 doğrular.

**Kabul kriterleri:**
- Yeni endpoint için **en az** 1 happy + 2 edge test.
- Schema diff: sadece yeni eklenen şemalar; mevcut schema’ların breaking change’i **yok** (CI `openapi:breaking-check` — yeni iş, ayrı ve opsiyonel maddede).

---

## 5. Hata / sapma protokolü

Bir madde sırasında:
- **Şema drift’i** (beklenmeyen `openapi:check` kırmızısı) → commit’i **pushlama**, drift kaynağını izole et (`git diff docs/openapi.json`), ilgili schema’yı onar.
- **Prisma migration conflict** → yeni migration silinir, `prisma migrate reset --skip-seed` (sadece lokal), tekrar oluşturulur.
- **E2E kırılması** → değişiklik revert, yeniden başla. Hacky “skip” yok.
- **Breaking change gerekli** (ör. bir response şemasını değiştirmek) → madde iptal edilir, **ayrı bir B‑XX** olarak tekrar yazılır; MAJOR version kararı `PROJECT_BOARD` üstünden alınır.

---

## 6. Zaman çizelgesi (öneri, tek geliştirici)

| Gün | Madde |
|-----|-------|
| 1 | B‑01, B‑02, B‑03 (üç küçük iş, tek gün) |
| 2–3 | B‑04, B‑05 (password flow) + mail queue ayakta |
| 4 | B‑06, B‑07 (username + email change) |
| 5 | B‑08, B‑09 (user search + followers) |
| 6 | B‑10 (blocks) — mesajlaşma/feed filtreleri dahil |
| 7 | B‑11 (reports) |
| 8 | B‑12, B‑13 (search endpoints) |
| 9 | B‑14 (notification prefs) |
| 10 | B‑15 (emergency contacts) |
| 11 | B‑16 (OTP) |
| 12 | B‑17, B‑18 (account deletion + conversation mute/leave) |
| 13 | Regresyon sprint: tüm test setini çalıştır, mobil blueprint §17 tablosu tamamen yeşile çekilir, README güncelleme. |

Her gün sonu:
- `git push` + CI yeşil
- `PROJECT_BOARD` log entry
- `API_Contract.md` diff’i gözden geçir (artan satır sayısı = yeni endpoint = beklenen).

---

## 7. Bu roadmap bittiğinde frontend tarafında serbest kalan işler

Her B‑XX tamamlandığında `FRONTEND_BLUEPRINT.md` içinde şu ekranlar “aktif” konuma geçer:

| Madde sonrası | Aktif olacak ekran/akış |
|---------------|--------------------------|
| B‑01 | Home like toggle düzeltilir (mobil bug #2) |
| B‑02 | Inbox ▸ Topluluk Sohbetleri sekmesi |
| B‑03 | Parti davetleri düzgün |
| B‑04 | Settings ▸ ChangePassword |
| B‑05 | Auth ▸ ForgotPassword + ResetPassword |
| B‑06 | Settings ▸ ChangeUsername |
| B‑07 | Settings ▸ ChangeEmail |
| B‑08 | NewConversation, invite arama |
| B‑09 | Profile ▸ Followers/Following |
| B‑10 | Settings ▸ BlockedUsers |
| B‑11 | PostCard/Comment ▸ ReportContent modalı |
| B‑12 | Discover ▸ Topluluk araması |
| B‑13 | Discover ▸ Etkinlik araması |
| B‑14 | Settings ▸ NotificationPrefs |
| B‑15 | Settings ▸ EmergencyContacts |
| B‑16 | Auth ▸ OtpScreen |
| B‑17 | DeleteAccount tek yol (temiz) |
| B‑18 | Conversation info ▸ mute/leave |

Bu tablo **tamamen yeşile** döndüğünde frontend F0 sprintine (navigator temizliği + token refresh bug) geçilebilir ve hayalet ekran kalmaz.

---

## 8. Neyi DEĞİŞTİRMEYECEĞİZ

Tekrar altını çiziyorum — bu roadmap süresince aşağıdakiler **sabit**:

- Nest modül yapısı (`apps/api/src/modules/*`).
- Decorator sözlüğü (`@Public`, `@Roles`, `@CurrentUser`, `@ZodBody`, `@ZodResponse`, `@Throttle`).
- Global prefix `v1`.
- Auth stratejisi (JWT access + refresh + MMKV client tarafında).
- BullMQ kuyrukları (mail, emergency, moderation…).
- Prisma client versiyonu (Dependabot major update’leri ignore ediliyor).
- Socket.IO namespace’leri (`/realtime`, `/messaging`, `/emergency`, `/gamification`).
- OpenAPI drift kapısı ve Zod SSOT.
- `docs/*` otomatik dosyalarının generate komutu.

Herhangi bir B‑XX’de yukarıdakilerden birini değiştirmek gerekirse **önce ayrı bir RFC** açılır (`PROJECT_BOARD` §6 RFC tablosu), onaylanmadan kod yazılmaz.

---

## 9. Bir sonraki adım

Onay verirsen **B‑01**’den başlarım (tek gün içinde B‑01 + B‑02 + B‑03 bitirilir — üçü de XS), her birinin sonunda:

- `openapi:check` yeşil, 
- testler yeşil,
- `PROJECT_BOARD`, `API_Contract.md`, `openapi.json`, `FRONTEND_BLUEPRINT.md` güncel,
- commit mesajı `feat(<dom>): ... (B-XX)` ve tek PR,

yazarım; sorun çıkarsa bu dosyaya “Hata / sapma” bölümü altında log düşer ve durum sana raporlanır.
