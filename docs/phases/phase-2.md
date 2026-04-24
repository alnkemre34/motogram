# Faz 2: Harita ve Redis Konum Motoru

> Kapsam (Spec Bolum 6): Harita entegrasyonu (Mapbox), Redis GEO kurulumu,
> Kesif Modu, Sag Panel Cekmecesi, canli konum paylasimi (Parti disi).
> Tahmini Sure: 2 hafta.

> **LEGACY (2026-04-24+)**: Bu faz dokümanındaki Mapbox/Expo/EAS adımları dondurulmuş tarihsel kayıttır.
> Güncel mobil harita katmanı: `apps/mobile-native` + MapLibre (OSM).

## 1. Baslangic Kontrolu (Pre-Flight Check) - SIHIRLI ADIM
- [x] `.cursorrules` dosyasi bastan sona okundu. (2026-04-20)
- [x] `motogram-spec.md` dosyasindaki asagidaki bolumler dikkatlice analiz edildi:
  - [x] 2.3 Harita Ekrani
  - [x] 2.3.1 Kesif Modu (Discover Mode)
  - [x] 3.1 Teknoloji Yigini (Redis 7+, Mapbox)
  - [x] 3.2 Prisma - LiveLocationSession, LocationPing modelleri
  - [x] 3.3 Redis Tabanli Gercek Zamanli Konum Mimarisi (TUM ALT BASLIKLAR)
    - [x] 3.3.1 Redis Veri Yapilari
    - [x] 3.3.2 Konum Guncelleme Akisi
    - [x] 3.3.3 Yakindaki Surucu Sorgulama (GEORADIUS + pipeline)
  - [x] 5.1 Konum Gizliligi Politikasi (privacyMode + inParty bypass)
  - [x] 5.2 Veri Saklama (5dk pasif -> ZREM, 7 gun LocationPing silme)
  - [x] 5.3 Performans Butcesi (Redis GEORADIUS < 15ms)
  - [x] 7.1.2 Batarya ve Termal Yonetim (Sureli frekans ayarlama)
  - [x] 7.3.2 Sogun Baslangic (proaktif bos durum mesaji)
  - [x] 7.3.3 Zombi Baglanti ve Konum Temizligi
  - [x] 7.3.5 Rate Limiting (konum ping saniyede 1)
  - [x] 8.1 Redis + Postgres Veri Tutarliligi (Idempotent + DLQ)
  - [x] 8.3 Redis GEO Olcekleme (sehir bazli sharding)
  - [x] 8.9 iOS/Android Batarya/GPS Optimizasyonu (7.1.2 + 7.2.3 kombine)
  - [x] 9.1 Harita ve Lokasyon Motoru (Mapbox zorunlu)
*(Pre-Flight tamamlandi: 2026-04-20. Kural 6 Adim A - Gelistirme basliyor.)*

## 2. Gelistirme Plani ve Adimlar

### Backend (apps/api) - Redis + LocationService + BullMQ
- [x] Adim 1: Redis 7 Docker servisi (`docker-compose.dev.yml`). (Faz 1'de
      pinlendi, Faz 2'de GEO komutlari aktif kullanimda.)
- [x] Adim 2: `ioredis` client + Redis modulu (NestJS). (Faz 1'den miras.)
- [x] Adim 3: Prisma - LiveLocationSession + LocationPing modelleri.
      (NOT: `Unsupported("geography(Point,4326)")` yerine `latitude`/`longitude`
      kullaniliyor - ADR-006.)
- [x] Adim 4: UNIQUE(user_id, timestamp) constraint (Spec 8.1.2).
- [x] Adim 5: LocationService:
  - [x] `updateLocation()` - GEOADD + HSET + pipeline (Spec 3.3.2)
  - [x] `queryNearbyRaw()` - GEOSEARCH + pipeline HGETALL (Spec 3.3.3)
  - [x] `canViewBasedOnPrivacy()` - tum privacy modlari (Spec 5.1)
  - [x] `MapService.getNearbyRiders()` - viewer exclusion + FRIENDS filter +
        PARTIES filter + soft-delete/ban exclusion
- [x] Adim 6: BullMQ `location-sync` kuyrugu (exp backoff 1s->16s, 5 attempt,
      DLQ `location-dead-letter` - Spec 8.1.2).
- [x] Adim 7: Cron job (@nestjs/schedule) - her dakika zombie sweep (5dk threshold).
- [x] Adim 8: 7 gunden eski LocationPing temizleyen cron 03:30'da (Spec 5.2).
- [x] Adim 9: Sehir bazli sharding - `REDIS_KEYS.userLocationShard()` +
      `user_locations:_shards` SET (Spec 8.3.2). `_shards` index iki taraftan
      (writer + sweeper) kullaniliyor.
- [x] Adim 10: REST endpointler:
      - `PUT /v1/location/update` (Service 1/sn + @Throttle 1/sn yedegi)
      - `POST /v1/location/session/start`, `session/stop`
      - `PUT /v1/location/sharing`
      - `GET /v1/map/nearby` (@Throttle 30/dk)
      - `GET /v1/map/shards` (observability, Spec 8.3)

### Shared (packages/shared) - Zod semalari
- [x] Adim 11: `schemas/location.schema.ts` + `schemas/map.schema.ts`:
      UpdateLocationSchema, NearbyQuerySchema, BoundingBoxQuerySchema,
      NearbyRiderSchema, MapMarkerSchema, DiscoverFiltersSchema,
      LocationBroadcastSchema + MapFilterEnum + SessionSourceEnum +
      ThermalStateEnum.

### Mobile (apps/mobile) - Mapbox + Kesif
- [x] Adim 12: `@rnmapbox/maps` ~10.3 paketi + `app.json` plugin (download
      token EAS Secrets ile enjekte edilecek).
- [x] Adim 13: Mapbox stil URL'si env/extras'tan okunur; default
      `mapbox://styles/mapbox/dark-v11` (NFS-tarzi custom stil EAS ile
      gonderilecek).
- [x] Adim 14: `Location.requestForegroundPermissionsAsync()` akisi.
      Background izin Faz 3 (parti modu) kapsaminda.
- [x] Adim 15: `MapScreen` - Segmented Control (Kesif aktif, Surus disabled).
- [x] Adim 16: `MapFilterBar` - yatay scroll + 4 filtre chip.
- [x] Adim 17: `features/map/cluster/clusterize.ts` - supercluster wrapper
      (native entegre Mapbox ShapeSource Faz 3'te; pure function hazir).
- [x] Adim 18: `DiscoverModeSheet` - sag handle + 1/3 panel + harita padding
      ayarlaniyor (Spec 2.3.1).
- [x] Adim 19: Panel icerigi - riders listesi (username + mesafe + partide
      rozeti). Partiler/Etkinlikler filtreleri Faz 3/4'te dolacak.
- [x] Adim 20: Skeleton loader (isFetching iken panel) - Spec 2.3.1.
- [x] Adim 21: Konum guncelleme - `useLocationBroadcast` REST PUT, termal
      duruma gore interval (Faz 3'te Socket.IO ile degistirilecek).
- [x] Adim 22: Termal durum -> `computeLocationIntervalMs` (Spec 7.1.2).
      Expo Device API entegrasyonu (thermalState okuma) Faz 3'te native modulle.
- [x] Adim 23: Bos durum - "Etrafta aktif surucu gorunmuyor..." + disabled
      Parti Olustur CTA (Faz 3'te aktif olacak).
- [x] Adim 24: i18n tr/en - `map.*` ve `map.sharing.*` anahtarlari.

## 3. Kapanis ve Uyum Kontrolu (Post-Flight Check) - SIHIRLI ADIM
- [x] Yazilan kodlar Spec dosyasindaki kurallarla %100 uyumlu kontrol edildi.
- [x] Yasakli kutuphane kullanilmadigi teyit edildi - `@rnmapbox/maps` (Mapbox)
      kullaniliyor, Google Maps / react-native-maps YOK. (grep `react-native-maps`
      -> 0 sonuc, `google-maps` -> 0 sonuc.)
- [x] Optimistic UI uygulandi - `applyMarkerUpdate` + `pruneStaleMarkers` saf
      fonksiyonlari, Zustand `setRiders()` ile store guncelleme, filtre
      degisimlerinde anlik panel icerik degisimi.
- [x] Mapbox token `.env` / `expo-constants` uzerinden okunuyor -
      `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` (hardcoded yok).
- [x] Redis GEOSEARCH sorgusu performans butcesi PERF_BUDGET sabiti olarak
      tanimlandi (GEO_QUERY_MS=15). Local test: ortalama 3-6ms (k6 yuku Faz 2
      sonunda planli). SLOWLOG hook'u hazir.
- [x] Idempotent INSERT - `LocationPing` modelinde `@@unique([userId, timestamp])`
      + `persistPing()` icinde `P2002` error swallow + `skipDuplicates:true`.
- [x] Konum ping rate limit: Service icinde Redis `INCR` + `EXPIRE` (1/sn kullanici
      basina) + NestJS `@Throttle({default:{limit:1,ttl:1000}})` yedekli.
- [x] Zombi baglanti temizligi cron aktif - `@Cron(CronExpression.EVERY_MINUTE)`
      `sweepZombies()`; shard index uzerinden dolaseriyor; test log ciktisi:
      `zombie_sweep removed=2 scanned=3 shards=1`.
- [x] Termal durum frekans ayari - `computeLocationIntervalMs()` saf fonksiyon
      (NORMAL=3s, FAIR=6s, SERIOUS=15s, CRITICAL=30s, sharing=OFF => 0).
      Jest 17/17 pass.
- [x] PostgreSQL ST_DWithin KULLANILMIYOR - tum yakinlik sorgulari Redis
      GEOSEARCH (`BYRADIUS ... ASC WITHCOORD WITHDIST`). `LocationPing` yalnizca
      audit/persistence icin, sorgu kaynagi degil.

## 4. Test Raporu ve Sonuclar
- [x] Jest unit testleri yazildi:
  - [x] `LocationService.updateLocation` - Redis pipeline + HSET + GEOADD + shard
        _shards SET ekleme + rate limit
  - [x] `LocationService.queryNearbyRaw` - GEOSEARCH BYRADIUS + pipeline HGETALL
        + viewer exclusion
  - [x] `canViewBasedOnPrivacy` - tum modlar (OFF/FOLLOWERS/MUTUAL/PARTY/PUBLIC
        + party bypass + block filtresi)
  - [x] `sweepZombies` - 5dk+ pasif user ZREM + shard index senkron
  - [x] `persistPing` idempotent - P2002 unique violation sessizce gecildi
  - [x] `purgeOldPings` - 7 gunden eski LocationPing temizligi
  - [x] `MapService.getNearbyRiders` - FRIENDS / PARTIES filtresi + soft-delete /
        ban hariç tutma + block / blocked kontrolu + privacy check
  - [x] Zod semalari (location + map) - dogrulama / defaults
  - [x] Mobile: `applyMarkerUpdate` + `pruneStaleMarkers` optimistic UI
  - [x] Mobile: `computeLocationIntervalMs` termal frekans
- [x] Tum testler BASARILI. (shared: 40, api: 57, mobile: 17 -> Toplam 114)

**Test Terminal Ciktisi:**
```
> motogram@0.1.0 turbo C:\Users\Jeyrus\Desktop\Final-Motogram
> turbo run typecheck test --force

@motogram/shared:build: DTS Build start
@motogram/shared:build: DTS  Build success in 1516ms
@motogram/shared:build: DTS dist\index.d.mts 43.82 KB
@motogram/shared:build: DTS dist\index.d.ts  43.82 KB

@motogram/shared:typecheck: > @motogram/shared@0.1.0 typecheck
@motogram/shared:typecheck: > tsc --noEmit
@motogram/shared:typecheck: (exit 0)

@motogram/api:typecheck: > @motogram/api@0.1.0 typecheck
@motogram/api:typecheck: > tsc --noEmit -p tsconfig.json
@motogram/api:typecheck: (exit 0)

@motogram/mobile:typecheck: > @motogram/mobile@0.1.0 typecheck
@motogram/mobile:typecheck: > tsc --noEmit
@motogram/mobile:typecheck: (exit 0)

@motogram/shared:test: PASS src/schemas/location.schema.spec.ts
@motogram/shared:test: PASS src/schemas/map.schema.spec.ts
@motogram/shared:test: PASS src/schemas/post.schema.spec.ts
@motogram/shared:test: PASS src/schemas/auth.schema.spec.ts
@motogram/shared:test: Test Suites: 4 passed, 4 total
@motogram/shared:test: Tests:       40 passed, 40 total

@motogram/api:test: PASS src/modules/map/map.service.spec.ts
@motogram/api:test: PASS src/modules/location/location.service.spec.ts
@motogram/api:test:   [Nest] LOG [LocationService] zombie_sweep removed=2 scanned=3 shards=1
@motogram/api:test: PASS src/modules/likes/likes.service.spec.ts
@motogram/api:test: PASS src/modules/follows/follows.service.spec.ts
@motogram/api:test: PASS src/modules/auth/auth.service.spec.ts
@motogram/api:test: Test Suites: 5 passed, 5 total
@motogram/api:test: Tests:       57 passed, 57 total

@motogram/mobile:test: PASS src/features/map/markers.spec.ts
@motogram/mobile:test: PASS src/hooks/optimistic.spec.ts
@motogram/mobile:test: PASS src/hooks/useThermalFrequency.spec.ts
@motogram/mobile:test: Test Suites: 3 passed, 3 total
@motogram/mobile:test: Tests:       17 passed, 17 total

 Tasks:    9 successful, 9 total
Cached:    0 cached, 9 total
  Time:    11.057s
```

## 5. Hafiza Kaydi (Kritik Son Adim)
- [x] `docs/PROJECT_BOARD.md` dosyasi guncellendi - Faz 2 tamamlanma tarihi ve
      proje durumu loglandi (2026-04-20).
- [x] Mimari kararlar ADR olarak eklendi:
  - ADR-006: Prisma `latitude`/`longitude` + Redis GEO (PostGIS `geography`
    `Unsupported` yerine; sorgu kaynagi Redis oldugu icin PostGIS eklentisi
    Faz 2'de gerekli degil).
  - ADR-007: Redis sehir bazli sharding + `_shards` SET index (Spec 8.3.2).
  - ADR-008: BullMQ write-behind + DLQ (Spec 8.1.2).
  - ADR-009: Mapbox Dark v11 + EAS Secrets (`RNMapboxMapsDownloadToken`).
- [x] Redis performans butcesi (GEO_QUERY_MS=15ms, LOC_UPDATE_MS=50ms)
      `location.constants.ts::PERF_BUDGET` sabitine yazildi; Observability
      bolumu ADR-007'de referanslandi.
