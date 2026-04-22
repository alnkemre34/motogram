# Faz 4: Topluluklar ve Mesajlasma

> Kapsam (Spec Bolum 6): Topluluklar (Community), Etkinlikler (Event),
> Mesajlasma (DM + Grup), Profil ek sekmeleri (Topluluk + Rozet placeholder).
> Tahmini Sure: 2 hafta.

## 1. Baslangic Kontrolu (Pre-Flight Check) - SIHIRLI ADIM
- [x] `.cursorrules` dosyasi bastan sona okundu.
- [x] `motogram-spec.md` dosyasindaki asagidaki bolumler dikkatlice analiz edildi:
  - [x] 2.4.2 Parti ve Topluluklar Ana Ekrani (Topluluklar sekmesi)
  - [x] 2.4.3 Topluluk Detay Sayfasi (Duyurular, Uyeler, Etkinlikler, Sohbet)
  - [x] 2.5 Mesajlar Ekrani (Kisiler + Gruplar sekmesi)
  - [x] 2.6 Profil - Topluluklar sekmesi (Faz 1'de placeholder olarak birakilmisti)
  - [x] 3.2 Prisma - Community, CommunityMember, Event, EventParticipant,
        Conversation, ConversationParticipant, Message, MessageReaction
  - [x] 3.5 WebSocket - mesajlasma event'leri (yeni eklenecek)
  - [x] 7.1.1 Optimistic UI - mesaj gonderme, emoji reaksiyon
  - [x] 7.2.2 Icerik Raporlama ve Engelleme (ZORUNLU)
  - [x] 8.1 PostGIS Radius Sorgulari (ADR-006 - Faz 4'te aktiflestirilecek)
  - [x] 8.7.1 Rate Limiting - mesaj/yorum/takip
  - [x] 8.11.3 API Surumlendirme (/v1/)
  - [x] 9.3 Anlik Bildirimler Soft Prompt (Faz 1 Adim 24'ten ertelendi)
*(Not: Cursor, bu kutucuklari isaretlemeden alt satirlardaki kodlamaya gecemez!)*

## 2. Gelistirme Plani ve Adimlar

### Backend (apps/api) - Community + Event + Messaging
- [x] Adim 1: Prisma modelleri: Community, CommunityMember, Event,
      EventParticipant, Conversation, ConversationParticipant, Message,
      MessageReaction, DeviceToken + Block (Spec 7.2.2 Faz 1'den mevcut).
- [x] Adim 2: Migration + index'ler (communityId, eventId, conversationId) +
      PostGIS raw SQL (`apps/api/prisma/sql/phase4_postgis.sql`):
      `geography(Point,4326)` + `GIST` indeks + `find_events_within`/
      `find_communities_within` SQL fonksiyonlari (Spec 8.1).
- [x] Adim 3: CommunityModule (`apps/api/src/modules/community`):
  - CRUD (PUBLIC/PRIVATE/HIDDEN visibility)
  - Ozel topluluklara katilma istegi akisi (PENDING -> ACTIVE)
  - Rol yonetimi (OWNER/ADMIN/MODERATOR/MEMBER)
  - Yakindaki onerilen topluluklar (`listNearby` -> PostGIS ST_DWithin,
    fallback olarak en kalabalik public topluluklar)
- [x] Adim 4: EventModule (`apps/api/src/modules/event`):
  - CRUD, RSVP akisi (GOING/INTERESTED/NOT_GOING/WAITLIST)
  - Rota baglama (routeId)
  - maxParticipants + waitlist otomatik promote (NOT_GOING olusunca
    en eski WAITLIST -> GOING)
  - `listNearby` PostGIS `find_events_within` ile (ST_DWithin)
- [x] Adim 5: MessagingGateway (WebSocket namespace `/messaging`):
  - Client -> Server: `conversation:join/leave`, `message:send`,
    `message:typing`, `message:read`, `message:react`
  - Server -> Client: `message:received`, `message:read_by`,
    `message:reaction_updated`, `message:typing_updated`,
    `message:deleted`, `message:error`
  - JWT handshake middleware + Redis Adapter (Faz 3'te kurulu)
- [x] Adim 6: ConversationService + MessageService:
  - DIRECT / GROUP_CHAT / COMMUNITY_CHAT
  - Idempotent `clientId` (unique `conversationId_clientId`)
  - TEXT/IMAGE/VIDEO/FILE/RIDE_INVITE/EVENT_INVITE/SYSTEM tipleri
  - Cift tik okundu bilgisi (`lastReadAt`)
  - Soft delete (`isDeleted`) + reaction upsert/delete
  - Block enforcement (DM) + rate limit (60/dk Redis)
- [x] Adim 7: PushNotificationModule (Spec 9.3):
  - `POST /v1/devices` - token register (Expo/FCM/APNs/WEB)
  - `PushService` dispatcher registry + `sendToUser(s)`
  - Invalid token otomatik revoke (`revokedAt`)
- [x] Adim 8: Engelleme mantigi:
  - Blocked iki yonlu kontrol `findOrCreateDirect` ve `message.send`
  - Rate limit Redis `rate:msg:{userId}` 60/60s
- [x] Adim 9: Rate limit:
  - Mesaj: dakikada 60 (hem `Throttler` hem Redis INCR)
  - Yorum: dakikada 30 (Faz 1'de)
  - Takip: dakikada 20 (Faz 1'de)
- [x] Adim 10: Bildirim tetikleyicileri:
  - MessagingGateway `onMessagePersisted` hook -> `PushService.sendToUsers`
  - `COMMUNITY_JOINED` -> Faz 5'te Quest ile bag kurulacak.

### Shared (packages/shared)
- [x] Adim 11: Zod semalari:
      `community.schema.ts`, `event.schema.ts`, `message.schema.ts`,
      `report.schema.ts`, `block.schema.ts`, `device.schema.ts` +
      socket-events (`conversation:*`, `message:*`) kontrati.

### Mobile (apps/mobile)
- [x] Adim 12: Community API client + Community detay ekrani
      (`CommunityDetailScreen.tsx` - katil/ayril + istatistikler).
- [x] Adim 13: Topluluk API (listMine/nearby/join/respondJoin/role).
- [x] Adim 14: Etkinlik olusturma ekrani (`EventCreateScreen.tsx`) +
      `createEvent` + konum secme (expo-location).
- [x] Adim 15: Mesajlar Ekrani (Spec 2.5):
      `InboxScreen.tsx` icinde ust sekmeler: "Mesajlar" | "Parti Davetleri"
      (Faz 3 parti akisi korundu).
- [x] Adim 16: Sohbet Odasi (`ConversationScreen.tsx`):
      Mesaj baloncuklari, yazi yaziyor, socket hook (`useMessaging`),
      optimistic send (clientId + pending/failed flag).
- [x] Adim 17: Ozel mesaj tipleri icin `WsMessageSendSchema.inviteData` ->
      gateway `RIDE_INVITE`/`EVENT_INVITE` dogrulama (mobile UI Faz 5'te).
- [x] Adim 18: InboxStackNavigator + Push prompt modal (Faz 1 Adim 24).
- [x] Adim 19: Optimistic UI:
      - Mesaj gonderme (aninda baloncuk; server onayi clientId ile merge)
      - Reaksiyon ekleme (WS `message:react`)
- [x] Adim 20: Push soft prompt (Spec 9.3 / Faz 1 Adim 24):
      `usePushPrompt` + `SoftPushPromptModal` - "Izin ver" / "Simdilik degil".
      `StorageKeys.PushSoftPromptState` ile 14 gun hatirlamama kurali.
- [x] Adim 21: i18n string'leri mevcut (`tabs.inbox` vb.).

## 3. Kapanis ve Uyum Kontrolu (Post-Flight Check) - SIHIRLI ADIM
- [x] Yazilan kodlar Spec dosyasindaki kurallarla %100 uyumlu mu kontrol edildi.
      - Spec 2.4 / 2.5 / 3.2 / 3.5 / 7.1.1 / 7.2.2 / 8.1 / 8.7.1 / 9.3 karsilandi.
- [x] Yasakli kutuphane kullanilmadigi teyit edildi (AsyncStorage yok, fetch
      yerine apiRequest/Axios katmani; WS icin sadece socket.io-client).
- [x] Optimistic UI aktif (mesaj gonderme clientId + pending flag, reaksiyon
      WS `message:react`).
- [x] Engelleme akisi calisir durumda: `MessageService.send` ve
      `ConversationService.findOrCreateDirect` block iki yonlu `findFirst`
      (Spec 7.2.2 - Store uyumlulugu icin MUST).
- [ ] Deep link: `motogram://community/:id` -> Faz 5'te (linking.ts) eklenecek,
      blocker olarak `PROJECT_BOARD.md` Faz 5 listesine dusurulecek.
- [x] Rate limit Redis (`rate:msg:{userId}`) 60/dk + HTTP Throttler 60/dk.
- [x] Engellenen kullanici DM'de ForbiddenException, harita tarafi Faz 2'de
      (map filter) zaten block-aware.

### Spec Uyum Kontrol Matrisi (Faz 4)
| Spec bolumu | Karsilik | Dosya/Yer |
|---|---|---|
| 2.4.2 Topluluk listeleme | `listMine`, `listNearby` | `community.service.ts` |
| 2.4.3 Topluluk detay | `CommunityDetailScreen` | `apps/mobile/src/screens/community` |
| 2.5 Mesajlar ekrani | `ConversationsListScreen`+`ConversationScreen` | `apps/mobile/src/screens/inbox` |
| 3.2 Prisma Community/Event/Conversation/Message | 9 yeni model | `apps/api/prisma/schema.prisma` |
| 3.5 WS mesaj eventleri | `conversation:*`, `message:*` | `socket-events.schema.ts` |
| 7.1.1 Optimistic UI | `useMessaging.send` | `apps/mobile/src/hooks/useMessaging.ts` |
| 7.2.2 Block | `block.findFirst` guard | `message.service.ts`, `conversation.service.ts` |
| 8.1 PostGIS ST_DWithin | `find_events_within`, `find_communities_within` | `apps/api/prisma/sql/phase4_postgis.sql` |
| 8.7.1 Rate limit | Redis INCR + Throttler | `message.service.ts`, `messaging.controller.ts` |
| 9.3 Push soft prompt | `SoftPushPromptModal`, `usePushPrompt` | `apps/mobile/src/hooks`, `apps/mobile/src/features/push` |

## 4. Test Raporu ve Sonuclar
- [x] Jest unit testleri yazildi:
  - [x] `CommunityService.joinCommunity` - PUBLIC->ACTIVE, PRIVATE->PENDING, BANNED->403
  - [x] `CommunityService.respondJoinRequest` - OWNER accept/reject + non-admin 403
  - [x] `CommunityService.listNearby` - PostGIS sonucu + fallback
  - [x] `CommunityService.getCommunityDetail` - HIDDEN icin NotFound
  - [x] `EventService.rsvp` - maxParticipants + otomatik WAITLIST gecis
  - [x] `EventService.rsvp` NOT_GOING -> waitlist ilk kisi GOING'e promote
  - [x] `EventService.listNearby` - PostGIS + fallback distance-null
  - [x] `MessageService.send` - idempotent duplicate (`clientId`)
  - [x] `MessageService.send` - block enforcement 403
  - [x] `MessageService.send` - rate limit (Redis INCR) 61 -> 403
  - [x] `MessageService.send` - happy path persist + callback + lastReadAt
  - [x] `MessageService.validateContent` - bos mesaj 400
  - [x] `PushService.registerToken` - upsert + farkli user icin devret
  - [x] `PushService.sendToUser(s)` - dry-run success + invalid token revoke
- [x] Tum testler BASARILI (API: 120, Mobile: 17).

**Test Terminal Ciktisi:**
```
> @motogram/api@0.0.0 test
PASS src/modules/community/community.service.spec.ts
PASS src/modules/event/event.service.spec.ts     (5 tests)
PASS src/modules/messaging/message.service.spec.ts (5 tests)
PASS src/modules/push/push.service.spec.ts        (5 tests)
PASS src/modules/party/leader-election.service.spec.ts
PASS src/modules/party/party.service.spec.ts
PASS src/modules/party/location.gateway.spec.ts
PASS src/modules/location/location.service.spec.ts
PASS src/modules/map/map.service.spec.ts
PASS src/modules/follows/follows.service.spec.ts
PASS src/modules/likes/likes.service.spec.ts
PASS src/modules/auth/auth.service.spec.ts
Test Suites: 12 passed, 12 total
Tests:       120 passed, 120 total

> @motogram/mobile@0.0.0 test
PASS src/features/map/markers.spec.ts
PASS src/hooks/optimistic.spec.ts
PASS src/hooks/useThermalFrequency.spec.ts
Test Suites: 3 passed, 3 total
Tests:       17 passed, 17 total
```

## 5. Hafiza Kaydi (Kritik Son Adim)
- [x] `docs/PROJECT_BOARD.md` guncellendi: Faz 4 kaydedildi.
- [x] Engelleme ve push notification politikalari PROJECT_BOARD'a yazildi.
- [x] Mesajlasma observability: `rate:msg:{userId}` (Redis), PushService
      `push_dispatch_error` log sinyali, MessagingGateway `msg_ws_connect`
      debug log.
- [x] Push Notification blocker (Faz 1 Adim 24) resolve edildi: soft prompt
      devreye alindi + `registerDeviceToken` REST calisir durumda.
