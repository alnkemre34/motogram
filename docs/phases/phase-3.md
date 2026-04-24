# Faz 3: Surus Partisi (NFS Tarzi)

> Kapsam (Spec Bolum 6): Parti olusturma/katilma, Socket.IO WebSocket,
> Surus Modu HUD, Redis parti setleri, lider secimi, sinyal sistemi.
> Tahmini Sure: 2 hafta.

> **LEGACY (2026-04-24+)**: Bu faz dokümanındaki mobil `expo-task-manager` gibi Expo odaklı notlar tarihsel kayıttır.
> Güncel mobil uygulama: `apps/mobile-native` (React Native CLI).

## 1. Baslangic Kontrolu (Pre-Flight Check) - SIHIRLI ADIM
- [x] `.cursorrules` dosyasi bastan sona okundu. (2026-04-20)
- [x] `motogram-spec.md` dosyasindaki asagidaki bolumler dikkatlice analiz edildi:
  - [x] 2.3.2 Surus Modu (Ride Mode) - HUD, 3 buyuk buton (Regroup/Stop/Fuel)
  - [x] 2.4.1 + Butonu Davranisi (Action Sheet)
  - [x] 2.4.2 Parti ve Topluluklar Ana Ekrani (Partiler sekmesi)
  - [x] 3.2 Prisma - Party, PartyMember, Route modelleri + PartyStatus/PartyRole enum
  - [x] 3.3.1 Redis - party:{partyId}:members seti (TTL=Parti bitince)
  - [x] 3.5 Gercek Zamanli Olay Sozlesmesi (TUM WebSocket eventler)
  - [x] 4.1 Parti Lideri Ayrilirsa Ne Olur? (coLeaderIds / joinedAt oncelik)
  - [x] 4.2 Internet Baglantisi Koptugunda / Yeniden Baglanma (exp backoff)
  - [x] 5.1 Konum Gizliligi - Parti uyeleri birbirini HER ZAMAN gorur (bypass)
  - [x] 7.1.2 Batarya (Surus modu kritik)
  - [x] 7.2.3 Arka Plan Konum Izni ve Foreground Service Bildirimi (ZORUNLU)
  - [x] 7.3.1 Sinyal Verilerinin Saklanmamasi (Regroup/Stop/Fuel - DB'ye yazmaz)
  - [x] 7.3.3 Zombi Baglanti (60sn offline -> party:member_left)
  - [x] 8.1 Parti Flush Guvenligi (ENDED -> transaction + DLQ)
  - [x] 8.2 Parti Lider Secimi (Redis dagitik kilit SET NX EX 5 - Redlock)
  - [x] 8.4 Socket.IO Yatay Olcekleme (Redis Adapter pub/sub)
  - [x] 8.9 iOS/Android arka plan GPS (expo-task-manager)
- [x] `docs/PROJECT_BOARD.md` - Faz 2 ertelenen WebSocket/Party notlari okundu.
*(Pre-Flight tamamlandi: 2026-04-20. Kural 6 Adim A - Gelistirme basliyor.)*

## 2. Gelistirme Plani ve Adimlar

### Backend (apps/api) - NestJS WebSocket + PartyService
- [x] Adim 1: `@nestjs/websockets` + `socket.io` + `@socket.io/redis-adapter` kurulumu.
- [x] Adim 2: Redis Adapter yapilandirmasi (Spec 8.4 - pub/sub client'lar).
- [x] Adim 3: Prisma modelleri: Party, PartyMember, PartyInvite, Route.
- [x] Adim 4: Migration + gerekli index'ler (partyId, leaderId, LocationPing.partyId).
- [x] Adim 5: LocationGateway (WebSocket):
  - `party:join` -> DB uyelik kontrolu + SADD + odaya sok + zombie-watch temizle
  - `party:leave` -> PartyService.leaveParty (lider ise otomatik election)
  - `party:update_location` -> LocationService (source=PARTY, privacy bypass) + broadcast (except sender)
  - `party:send_signal` -> sadece event yayinla, DB'ye YAZMA (Spec 7.3.1)
  - `disconnect` -> user:{id}:status online=false + zombie-watch ZSET (60sn sonra oto-leave)
- [x] Adim 6: Server -> Client event yayinlari (WS_EVENTS SSOT):
  party:member_updated, party:member_joined, party:member_left,
  party:status_changed, party:signal_received, party:leader_changed, party:ended, party:error.
- [x] Adim 7: PartyService:
  - createParty(leaderId, dto) - rate limit + conflict (zaten partide mi)
  - joinParty(userId, partyId) - private ise invite zorunlu, SADD + emit
  - leaveParty(userId, partyId, reason) - lider ise `LeaderElectionService.elect`
  - endParty(partyId, reason) - status=ENDED, transaction + Redis flush (Spec 8.1)
  - recordSignal - rate limit + membership + emit-only (Spec 7.3.1)
  - invite + respondInvite (PartyInvite modeli + NotificationsService)
- [x] Adim 8: LeaderElectionService (Spec 8.2):
  - Redis `SET party:{id}:leader_lock NX EX 5` - dagitik kilit
  - Oncelik: coLeaderIds -> joinedAt en eski -> userId lex asc tie-break
  - Event: `party:leader_changed` + Lua CAS release
- [x] Adim 9: REST endpoint'ler (PartyController):
  `POST /v1/parties` (olustur, @Throttle), `GET /v1/parties` (nearby),
  `POST /v1/parties/:id/join`, `POST /v1/parties/:id/leave`,
  `POST /v1/parties/:id/invite`, `GET /v1/parties/invites/me`,
  `POST /v1/parties/invites/respond`, `GET /v1/parties/:id`.
- [x] Adim 10: Rate limit: Parti olusturma saatte 5 (Spec 8.7.1) - Redis counter.
- [x] Adim 11: PartyCleanupService - @Cron(EVERY_30_SECONDS) zombie sweep
      (60sn offline -> DISCONNECT_TIMEOUT leave + event).
      NOT: BullMQ party-flush ileri faza erteledi (LocationSyncQueue zaten her ping'i yaziyor).

### Shared (packages/shared) - Zod + Socket Event Tipleri
- [x] Adim 12: `party.schema.ts`:
      CreatePartySchema, PartyMemberSchema, PartyStatusEnum, PartyRoleEnum,
      PartyInviteStatusEnum, PartySignalTypeEnum (REGROUP/STOP/FUEL),
      PartyDetail, PartySummary, NearbyPartiesQuery.
- [x] Adim 13: `socket-events.schema.ts` - WS_EVENTS sabiti + Client<->Server
      payload Zod semalari (SSOT; hardcoded event ismi yasak).

### Mobile (apps/mobile) - Surus Modu + WebSocket client
- [x] Adim 14: `socket.io-client` kurulumu + `useParty` hook + singleton socket manager
      (autoConnect false, reconnection Infinity, exponential delay) - Spec 4.2.
- [x] Adim 15: PartyInboxScreen - aktif parti karti + PENDING davetiyeler listesi
      (Kabul/Reddet). InboxScreen icine yerlestirildi.
- [ ] Adim 16: Parti olustur akisi (Spec 2.4.1) - Faz 3.1'e ertelendi (UI forma ihtiyac).
- [x] Adim 17: Harita - Segmented Control "Surus" modu aktif (Spec 2.3.2):
  - Parti icindeyken Discover pinleri gizli, live party member pinleri aktif.
  - Aktif parti yokken ride segmenti disabled.
  - NOT: Polyline/kron ikonu Faz 3.1'de.
- [x] Adim 18: RideModeHUD - NFS tarzi 3 buton: Regroup, Stop, Fuel (min 96px).
      Basildiginda `party:send_signal` emit, PartySignalFeed toast ile gelen sinyal feed'i.
- [x] Adim 19: RideModeHUD ust bar - Lider badge (isLeader/leaderName),
      uye sayaci, connection dot, AYRIL butonu.
- [ ] Adim 20: `expo-task-manager` arka plan konum - Faz 3.1'e erteledi
      (Expo prebuild gerekiyor; mevcut useLocationBroadcast foreground icin yeterli).
- [ ] Adim 21: iOS BestForNavigation - Faz 3.1.
- [ ] Adim 22: Android WorkManager - Faz 3.1.
- [ ] Adim 23: Snackbar "Baglanti sorunu" banner - Faz 3.1 (Socket reconnect event dogru).
- [ ] Adim 24: Deep link `motogram://party/:id` - Faz 3.1.

## 3. Kapanis ve Uyum Kontrolu (Post-Flight Check) - SIHIRLI ADIM
- [x] Yazilan kodlar Spec dosyasindaki kurallarla %100 uyumlu. (2026-04-20)
- [x] Yasakli kutuphane kullanilmadigi teyit edildi (Zustand only, Mapbox only,
      Redis only). socket.io-client standart, Spec 3.5 ile uyumlu.
- [x] Optimistic UI - RideModeHUD butonlari `onPress` aninda `socket.emit`
      yapar; sunucudan beklemeden kullaniciya feedback. Gelen sinyaller
      PartySignalFeed toast ile 5sn ekranda kalir.
- [x] **Sinyal verileri DB'ye YAZILMIYOR - sadece WebSocket (Spec 7.3.1).**
      Test ile assert edildi: `party.service.spec.ts` "recordSignal" blogunda
      hic bir prisma yazma metodunun cagrilmadigi dogrulandi.
- [ ] Foreground Service bildirimi - Faz 3.1'e erteledi (expo-task-manager
      prebuild/dev-client gerektirir). PROJECT_BOARD'a kaydedildi.
- [x] Socket.IO Redis Adapter aktif (LocationGateway.afterInit icinde
      createAdapter(pub, sub); DISABLE_WS_ADAPTER=1 ile dev'de kapatilabilir).
      Test: gateway config DISABLE_WS_ADAPTER=1 ile calisiyor.
- [x] **Lider secim dagitik kilit calisiyor** - `leader-election.service.spec.ts`
      "serialises concurrent election attempts — only one wins" testi:
      3 eszamanli elect() cagrisinda sadece bir tanesi locked=true doner.
- [x] Parti ENDED -> PartyService.endParty icinde Prisma $transaction ile
      Party.status=ENDED + PartyMember.leftAt set edilir, Redis multi-flush
      (members/meta/zombieWatch/activePartyIndex/userParty).
- [x] **Parti icindeki uyeler birbirini her zaman goruyor (gizlilik bypass).**
      Gateway test: "writes with source=PARTY and broadcasts member_updated
      except sender" — locationSharing=OFF olsa bile LocationService.updateLocation
      `source: 'PARTY'` ile cagrilir ve broadcast yapilir.

## 4. Test Raporu ve Sonuclar
- [x] Jest unit testleri yazildi:
  - [x] `LeaderElectionService.pickNextLeader` - co-leader/joinedAt/lex
        deterministik oncelik; 5 test.
  - [x] `LeaderElectionService.elect` - Redis NX EX kilit; race condition
        simulasyonu (3 eszamanli elect, 1 winner / 2 lock_failed); 4 test.
  - [x] `LeaderElectionService.release` - Lua CAS, yanlis sahipte return 0; 2 test.
  - [x] `PartyService.createParty` - rate limit + conflict + Redis seed; 3 test.
  - [x] `PartyService.recordSignal` - **NO DB WRITE assertion** + rate limit +
        non-member rejection; 3 test.
  - [x] `PartyService.leaveParty` - leader election trigger + sole-leader ends
        party + non-leader shortcut + not_member; 4 test.
  - [x] `PartyService.privacy bypass` - SISMEMBER uzerinden server-side
        authorization (Spec 5.1 parti uyeleri birbirini gorur); 1 test.
  - [x] `LocationGateway.handlePartyJoin/Leave/UpdateLocation/SendSignal` -
        Zod validation, Redis SISMEMBER, DB member check, broadcast
        except sender, error event; 10 test.
  - [x] `LocationGateway.PartyEmitter` - room-scoped broadcast contract; 3 test.
  - [x] `LocationGateway.connection lifecycle` - user room join, unauthorized
        disconnect, offline zombie-watch seeding (Spec 7.3.3); 3 test.
- [x] Tum testler BASARILI (40 shared + 96 api + 17 mobile = **153 test PASS**).
      Faz 2'de 114 testten +39 yeni parti testi.

**Test Terminal Ciktisi:**
```
@motogram/shared:test: Tests:       40 passed, 40 total
@motogram/api:test:    Tests:       96 passed, 96 total  (+39 party)
@motogram/mobile:test: Tests:       17 passed, 17 total
 Tasks:    5 successful, 5 total
```

**Typecheck:**
```
@motogram/shared:typecheck: PASS
@motogram/api:typecheck:    PASS
@motogram/mobile:typecheck: PASS
 Tasks:    5 successful, 5 total
```

## 5. Hafiza Kaydi (Kritik Son Adim)
- [x] `docs/PROJECT_BOARD.md` dosyasinda Faz 3 tamamlanma tarihi + State guncellendi.
- [x] WebSocket olcekleme + parti mimari kararlari ADR-010..013 olarak eklendi.
- [x] Performans metrikleri (parti olusum suresi, sinyal emit gecikmesi)
      Observability bolumune not edildi.
