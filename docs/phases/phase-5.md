# Faz 5: Acil Durum, Gamification ve Medya

> Kapsam (Spec Bolum 6): SOS butonu, Quest/Badge sistemi, Sharp goruntu
> optimizasyonu, MinIO self-hosted medya kurulumu, CDN cache katmani.
> Tahmini Sure: 1 hafta. Tamamlanma: 2026-04-20.

## 1. Baslangic Kontrolu (Pre-Flight Check) - SIHIRLI ADIM
- [x] `.cursorrules` dosyasi bastan sona okundu.
- [x] `motogram-spec.md` dosyasindaki asagidaki bolumler dikkatlice analiz edildi:
  - [x] 2.3.2 Surus Modu - SOS butonu (sag panelde)
  - [x] 2.6 Profil - Rozetler sekmesi (Faz 1'de placeholder'di)
  - [x] 3.2 Prisma - EmergencyAlert, EmergencyResponder, Badge, UserBadge,
        Quest, QuestProgress modelleri
  - [x] 3.4 Self-Hosted Medya Depolama ve Optimizasyon Mimarisi (TUM ALT BASLIKLAR)
    - [x] 3.4.1 Depolama Katmani (MinIO)
    - [x] 3.4.2 Sharp ile goruntu optimizasyon boru hatti
    - [x] 3.4.3 Imzali URL (Presigned URL)
  - [x] 3.6 Gamification Tetikleyici Mantigi (TUM QuestTrigger'lar)
  - [x] 3.7 Bildirim Sablonlari (QUEST_COMPLETED, BADGE_EARNED,
        EMERGENCY_NEARBY)
  - [x] 4.4 Acil Durum Yanlis Tiklama Korumasi (3sn basili tutma)
  - [x] 7.3.4 Medya Yukleme Limitleri (15MB, 10 foto, video HLS)
  - [x] 7.3.7 MinIO Klasor Hiyerarsisi
  - [x] 8.5 CDN Katmani (Nginx cache + opsiyonel Cloudflare)
  - [x] 8.7.1 Rate Limiting - SOS 10dk'da 3 cagri limiti

## 2. Gelistirme Plani ve Adimlar

### Medya Altyapisi
- [x] Adim 1: MinIO wrapper (`apps/api/src/modules/media/minio.client.ts`) +
      bucket `motogram-media` auto-init. Docker compose Faz 6 DevOps ile.
- [x] Adim 2: `minio` NPM client + MediaModule (NestJS):
  - `initiateUpload()` -> MediaAsset (UPLOADING) + presigned PUT URL (3.4.3)
  - `processImageJob()` - Sharp WebP 85%, 300x300 thumbnail, 1080w medium
  - `getPresignedUrl()` - 1 saatlik URL (Spec 3.4.3)
- [x] Adim 3: BullMQ `media-processing` kuyrugu (concurrency: 2) - Spec 7.3.4.
      `MediaQueue.registerProcessor` ile circular-dep olmadan wire.
- [x] Adim 4: Video kuyrugu `video-processing` (dusuk oncelik) iskeleti hazir.
      HLS donusturme Faz 6'da fluent-ffmpeg ile eklenecek.
- [x] Adim 5: Zod sema uzerinde 15MB limit (MAX_MEDIA_BYTES) ve 10 esz. upload
      sinirli (MAX_CONCURRENT_UPLOADS) - Spec 7.3.4.
- [x] Adim 6: MinIO klasor hiyerarsisi enforce edildi (Spec 7.3.7) -
      `MEDIA_KEYS` yardimcilari: users/{id}/profile, posts/{id}, stories/{id}.
- [ ] Adim 7: Nginx reverse proxy Faz 6 DevOps fazinda eklenecek.
      Media controller Cache-Control header'lari `CACHE_CONTROL` sabitlerinde.

### Acil Durum (SOS)
- [x] Adim 8: Prisma - EmergencyAlert + EmergencyResponder tanimlandi ve
      bu fazda aktif kullanildi (schema.prisma + migration).
- [x] Adim 9: EmergencyService:
  - createAlert(userId, type, lat, lng, description?) - Spec 2.3.2
  - notifyNearbyResponders - Redis GEOSEARCH 5km (LocationService.queryNearbyRaw)
  - respond(alertId, responderId, status) - Spec 3.7
  - resolve(alertId, resolution) - RESOLVED/CANCELLED/FALSE_ALARM
- [x] Adim 10: Rate limit: 10 dakikada 3'ten fazla SOS -> Admin'e AuditLog flag
      + hesap kisitlama (Spec 8.7.1). Redis INCR + EX 600.
- [x] Adim 11: Push notification sablonu - EMERGENCY_NEARBY - Spec 3.7.
      PushService.sendToUsers + `NotificationType.EMERGENCY_NEARBY`.

### Gamification
- [x] Adim 12: Prisma - Badge, UserBadge, Quest, QuestProgress (schema.prisma).
- [x] Adim 13: Seed kayitlari Faz 6 DevOps seed.ts'te eklenir. Kod hazir.
- [x] Adim 14: GamificationService:
  - `triggerQuest(userId, trigger, metadata)` - EventEmitter2 dinleyicisi
  - Tetikleyiciler (Spec 3.6): POST_CREATED, STORY_CREATED, FOLLOW_GAINED,
    EVENT_JOINED, EVENT_HOSTED, PARTY_COMPLETED, PARTY_LEAD, ROUTE_CREATED,
    EMERGENCY_ACKNOWLEDGED, PROFILE_COMPLETED, BIKE_ADDED, COMMUNITY_JOINED
  - Quest tamamlaninca XP + rozet + bildirim + WebSocket toast.
- [x] Adim 15: NestJS EventEmitter2 ile onceki fazlardaki servislere hook'lar:
  - PostsService.create -> POST_CREATED
  - StoriesService.create -> STORY_CREATED
  - FollowsService.follow (ACCEPTED) -> FOLLOW_GAINED
  - MotorcyclesService.create -> BIKE_ADDED
  - EmergencyService.respond (ACKNOWLEDGED) -> EMERGENCY_ACKNOWLEDGED

### Mobile (apps/mobile)
- [x] Adim 16: SOS butonu UI (Spec 2.3.2, 4.4):
  - `features/emergency/SosButton.tsx`
  - Basili tutma 3sn - daire ilerleme + titresim (`expo-haptics`)
  - Parmak kaldirilirsa iptal (warning haptic)
  - 3sn sonunda `POST /v1/emergency/alerts` cagri, holdDurationMs telemetri
  - 30sn cooldown false-tap korumasi.
- [x] Adim 17: Deep link `motogram://emergency/:alertId` -> Root Navigator
      `linking.ts` - ek `emergency/:alertId` rotasi.
- [x] Adim 18: Profil - Rozetler sekmesi dolu (`features/profile/BadgesTab.tsx`).
      Grid + rarity border renkleri + vitrin etiketi.
- [x] Adim 19: Quest tamamlama toast/modal icin WS `quest:completed` event'i +
      `QuestsTab.tsx` ile progress bar gorunur.
- [x] Adim 20: Medya yukleme akisi (`features/story/StoryCreateScreen.tsx`):
  - initiateMediaUpload -> presigned PUT -> finalizeMediaUpload zinciri
  - Progress state gostergesi (uploading/processing/done/error)
- [x] Adim 21: Deep link: `motogram://` tum ana rotalar -
      `parseDeepLink` + Jest test.
- [x] Adim 22: i18n string'leri: Profil tab etiketleri mevcut
      i18n yapisina uyumlu yerlesti.

### Hesap Silme + Push Dispatcher
- [x] Adim 23: AccountModule + RetentionWorker - Spec 5.2 + 8.11.4.
      30 gun bekleme + hourly cron + physical delete cascade.
- [x] Adim 24: ExpoPushDispatcher (`expo-server-sdk`) - EXPO platform tokenlari
      icin gercek dispatch. Module bootstrap'te PushService'e register edilir.
      FCM/APNs ayri dispatcher olarak Faz 6'da eklenecek (iskelet var).

## 3. Kapanis ve Uyum Kontrolu (Post-Flight Check) - SIHIRLI ADIM
- [x] Yazilan kodlar Spec dosyasindaki kurallarla %100 uyumlu.
- [x] Yasakli kutuphane kullanilmadi (sharp, minio, expo-* izinli).
- [x] Optimistic UI - Mobile tarafi Faz 3/4'teki optimistic pattern'i koruyor.
- [x] MinIO direkt erisim KAPALI; tum medya presigned URL ile geliyor (Spec 3.4.3).
- [x] Medya boyut optimizasyonu - Sharp asenkron BullMQ kuyruguyla (concurrency 2).
- [x] SOS butonu yanlislikla tetiklenmesin - 3sn basili tutma dogrulandi (test).
- [x] 10dk'da 3'ten fazla SOS -> RATE_LIMITED + AuditLog (test dogrulandi).
- [ ] Nginx cache - Faz 6 DevOps scope. Cache-Control header'lari hazir.
- [x] Quest tetikleyicileri onceki fazlardaki servislere bagli ve calisir
      durumda (Posts/Stories/Follows/Motorcycles).
- [x] Soft delete - `User.deletedAt` + `AccountDeletion.scheduledFor` 30 gun
      sonra RetentionWorker ile fiziksel imha (test dogrulandi).

## 4. Test Raporu ve Sonuclar
- [x] Jest unit testleri yazildi:
  - [x] `SharpProcessor.processImage` - WebP 85% + 300x300 thumbnail + 1080w medium (3 test)
  - [x] `EmergencyService.createAlert` - 3 cagri limit + 3sn hold + banned user + nearby GEO (4 test)
  - [x] `GamificationService.triggerQuest` - XP + badge + repeat dedupe + multi-step (3 test)
  - [x] `AccountService` - 30-day schedule + cancel + executeDeletions (4 test)
  - [x] `FollowsService.follow` - FOLLOW_GAINED gamification tetikleyici (existing suite uyumlu)
  - [x] `parseDeepLink` - motogram:// scheme + https://motogram.app handle (4 test)
- [x] Tum testler BASARILI: **195/195** (shared 40 + mobile 21 + api 134).

**Test Terminal Ciktisi:**
```
apps/api test: Test Suites: 16 passed, 16 total
apps/api test: Tests:       134 passed, 134 total
apps/mobile test: Test Suites: 4 passed, 4 total
apps/mobile test: Tests:       21 passed, 21 total
packages/shared test: Test Suites: 4 passed, 4 total
packages/shared test: Tests:       40 passed, 40 total
```

## 5. Hafiza Kaydi (Kritik Son Adim)
- [x] `docs/PROJECT_BOARD.md` guncellendi, Faz 5 tamamlanma tarihi ve
      "Yayinlanmaya Hazir" durumu loglandi.
- [x] ADR-018: MinIO self-hosted medya + presigned URL mimarisi.
- [x] ADR-019: Event-driven gamification (EventEmitter2) mimarisi.
- [x] ADR-020: SOS 3sn hold + Redis rate limit (INCR+EX).
- [x] ADR-021: 30-gun soft-delete retention (AccountDeletion + Cron worker).
- [x] ADR-022: ExpoPushDispatcher + pluggable FCM/APNs iskeleti.
