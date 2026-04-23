# Motogram — Frontend uygulama yol haritası

> Tarih: 2026-04-23 (P6 kapanış; **P7 planı: §8**)  
> İlişkili: `docs/FRONTEND_UI_UX_BLUEPRINT.md` (v1.5+), `docs/API_Contract.md`, `packages/shared`  
> Amaç: Mobil `apps/mobile` ve (ileride) `web-admin` için öncelik sırası, test disiplinini ve kabul kriterlerini sabitlemek.  
> **Hızlı “nerede kaldık”:** Aşağıdaki §7 + `docs/SESSION_HANDOFF.md` üst bölüm.

---

## 1. İlkeler

- Endpoint ve şema: **SADECE** `API_Contract.md` + `packages/shared` (Zod) ile hizalama; hayalet ekran yok.
- i18n: Kullanıcı metni `react-i18next` (TR/EN); hardcoded yasak.
- State: Zustand (UI), TanStack Query (sunucu), MMKV (kalıcı).
- Hata/ölçüm: Sentry; kritik formlar ve API sınırları için Jest.

---

## 2. Aşamalar (öncelik sırası)

| # | Aşama | Kapsam | Durum |
|---|--------|--------|--------|
| A1 | Auth tamamlama | Apple/Google + şifre + OTP; token yenileme; hata i18n | Devam (backend hazır) |
| A2 | Gelen kutusu (Inbox) | DM bölümlü + Topluluk + Parti; `GET /v1/conversations?type=` (B-02) | Uygulandı (v1.2) |
| A3 | Home + story rail + üst bar | Feed, hikayeler, bildirim/mesaj kısayolu | Uygulandı (2026-04-23: tren + `StoryViewer` + `GET /stories/feed` + görüntülenme) |
| A4 | 4 sekme / navigasyon hedefi | `FRONTEND_UI_UX_BLUEPRINT` §navigasyon; TabNavigator sadeleştirme | Uygulandı (P4) |
| A5 | Profil + ayarlar | `users/me`, public profil, garaj, şifre/blocks/hesap | Uygulandı (P5 + `UserProfile` + `ChangePassword` + **2026-04-23:** `ChangeEmail` / `VerifyEmail` B-07, `ChangeUsername` B-06, `Devices` GET/DELETE push, hikâye **video** `expo-av`) |
| A6 | Harita + parti + topluluk polish | Mapbox, ride mode, community/party ekranları | **Uygulandı (2026-04-23 P6 kapanış):** SOS `SosButton` haritada; `PartySignalFeed` + `PartyInboxScreen` i18n; `LocationSharingSheet` `GROUP_MEMBERS`; Discover/Community görünürlük etiketi; dev `map.devNearbyMs` |
| A7 | WS yüzeyleri | `/messaging` tam, `/realtime` sürüş, gamification/emergency | Kısmi |

Detay: Blueprint §17.4 “İdeal uygulama sırası” ile uyumludur; Inbox aşaması netleştirilerek yukarı taşındı.

---

## 2.1 Uygulama fazları (P1–P7) — kodlama emri

Her faz bitince: `typecheck` + `test` (mobil), gerekirse `PROJECT_BOARD` §5, bu tablodaki “Durum” sütunu.

| Faz | Ad | Teslim (belge) | Doğrulama |
|-----|----|-----------------|-----------|
| **P1** | Auth OAuth + sözleşme | `FRONTEND_UI_UX_BLUEPRINT` §6; `auth.schema` Apple/Google | Apple/Google/şifre giriş; EULA; hata i18n |
| **P2** | (A2) Gelen kutusu | §10 Inbox | `?type=` DM / topluluk / parti; i18n |
| **P3** | Home + üst bar | Story rail, bildirim/mesaj kısayolu (root stack) | Tamam: tren, tam ekran yürütücü, **video** `expo-av`, bildirimler ayrılırken okundu |
| **P4** | Tab navigasyon 4 | `FRONTEND_UI_UX_BLUEPRINT` §5; Inbox tab’dan kaldır | Tamam: `AppStack` + 4 tab |
| **P5** | Profil + ayarlar | §11, Settings | Tamam: `Settings` + alt ekranlar, `PATCH /users/me`, tercihler, acil, blocks, `account/deletion` |
| **P6** | Harita + topluluk/parti polish | §8–9 | **Tamam** (SOS haritada, parti inbox/sinyal i18n, konum modu tam enum, topluluk görünürlük metinleri) |
| **P7** | WS + gamification + acil | §14 | **Aktif faz** — namespace’ler blueprint ile |

**Aktif sıra (2026-04-23):** P1–**P6** tam; **P7** sıradaki (WS yüzeyleri, gamification, acil entegrasyon derinliği).

---

## 3. Test stratejisi (mobil)

- **Birim (Jest, `ts-jest`, `node` ortamı):** Saf mantık — örn. `messaging-path.ts` URL inşası; form şemaları (`zodResolver`); store/reducer; navigasyon `linking` eşlemesi. `api-client` veya `expo-constants` çeken modülleri testten **ayır** (saf yardımcı modül + re-export).
- **Bileşen:** `@testing-library/react-native` (mevcut projede ağırlık formlar ve kritik ekranlarda).
- **E2E (ileride):** Maestro / Detox — smoke: giriş, Inbox 3 sekmesi, bir sohbet açma (CI’da opsiyonel).
- **Regresyon:** `pnpm --filter @motogram/mobile typecheck` + `pnpm --filter @motogram/mobile test` her PR’da yeşil.

---

## 4. P1 (Auth) kabul kriterleri

- [x] `POST /v1/auth/oauth/apple` / `.../google` `AuthResultSchema` ile parse
- [x] `SocialAuthBlock` + EULA; kayıtta form EULA’sı ile hizalı
- [x] `EXPO_PUBLIC_GOOGLE_*` yoksa Google CTA yok; Apple yalnız `isAvailableAsync`
- [ ] Üretim: iOS `apple`, Android/iOS `google` client id’leri doldurulduğunda cihaz testi (manuel)

---

## 5. Inbox (A2) kabul kriterleri

- [x] `GET /v1/conversations?type=DIRECT` ve `GROUP_CHAT` DM ekranında; `COMMUNITY_CHAT` ayrı sekmede.
- [x] `inbox.*` i18n anahtarları (TR/EN).
- [x] Üst sekme: cam (blur) + karanlık tema ile tutarlı vurgu.
- [x] Jest: konuşma listesi URL sorgusu.

---

## 6. Revizyon günlüğü

- **2026-04-23 (7):** **P7 planı eklendi:** `FRONTEND_IMPLEMENTATION_ROADMAP.md` **§8** — Blueprint §14/§17.4 ile hizalı dalgalar 7.1–7.5 (`/realtime`, `/messaging`, `/gamification`, `/emergency`, kabul + §13 paralel notu); SSOT `socket-events.schema.ts`, referans `PROJECT_BOARD`.
- **2026-04-23 (6):** **P6 kapanış:** `SosButton` harita üstü (konum + üst üste binmeyi azaltmak için sürüş HUD’da `bottom` offset); `PartySignalFeed` / `PartyInboxScreen` tam i18n; `LocationSharingSheet` — `GROUP_MEMBERS` modu; `CommunityDetail` + `Discover` görünürlük `community.visibility.*`; `map.sos.*`, `map.devNearbyMs`, `inbox.party*`.
- **2026-04-24 (3):** P6 (topluluk): `DiscoverScreen` — yakın (`/communities/nearby`), benim (`/communities/me`), B-12 arama; `searchCommunities` + `canQueryCommunitySearch` Jest; `CommunityDetail` `AppStack` + `linking` `community/:id` + i18n; `MapScreen` parti ayrılma i18n.
- **2026-04-24 (2):** A5 tamamlama: `getUserByUsername`, `follows.api` (follow/unfollow, `checkIsFollowingUser`), `UserProfile` + `UserProfile:home/story` navigasyon, `changePasswordRequest` + `ChangePasswordScreen`, `linking` `user/:username` ve `settings/password`.
- **2026-04-24 (1):** Oturum handoff: `SESSION_HANDOFF.md` mobil özet tablosu; bu belgeye **§7 Nerede kaldık**; `PROJECT_BOARD` §1 tarih/commit; mobil `typecheck` + `test` tekrar koşuldu (15/59).
- **2026-04-23 (5):** P5: `updateCurrentUser` (`PATCH /users/me`); `blocks.api`; `notification-preferences` GET/PATCH; acil `contacts` CRUD; `SettingsScreen` + `EditProfile` + tercihler + engellenenler + `AccountDeletionScreen`; `ProfileScreen` i18n + ayar; `linking` `settings/*`; `parseRidingStyleCommas` Jest.
- **2026-04-23 (4):** P3 kapanış: `stories.api` (`/stories/feed`, `/stories/:id/views`), `StoryRail` + `StoryViewer` (`AppStack`), `groupStoryFeedByUser` test; bildirim `mark-read` ekran çıkışında; `motogram://story/:initialStoryId` link; **video** şimdilik bilgi metni (expo-av ileri faz).
- **2026-04-23 (3):** P4: `AppStackNavigator` (MainTabs + Inbox + Notifications), 4 sekmeli tab, `linking` AppStack. P3: Home üst bar (gelen + bildirim), `GET /notifications` + `unread-count`, feed beğeni `likedByMe` düzeltmesi, `Inbox`→Harita `MainTabs/Map` geçişi.
- **2026-04-23 (2):** P1 faz tablosu (P1–P7), OAuth implementasyonu, `auth-path` test.
- **2026-04-23:** A2 (Inbox) yol haritası ve test stratejisi eklendi; Blueprint v1.2 ile eşgüdüm.

---

## 7. Nerede kaldık / sırada ne var (hızlı)

| Nerede? | Ne yapıldı (özet) | Sırada |
|--------|-------------------|--------|
| **P1–P6** | A5 ardıllar (e-posta, cihaz, kullanıcı adı) + topluluk + **P6** harita/parti polish | Kabul: `typecheck` + `test` yeşil |
| **A5** | Public profil, ayarlar, cihaz/e-posta/kullanıcı adı, şifre | Tamam (mobil kapsamı) |
| **A6** | Harita: SOS, filtre, panel, sürüş HUD, parti inbox/sinyal i18n, konum `GROUP_MEMBERS` | P7’ye geçildi |
| **Hikâye video** | `expo-av` tam ekran oynatıcı | Uygulandı |
| **Belge eşgüdüm** | `SESSION_HANDOFF` üst tablo, bu §7, `PROJECT_BOARD` §1 | Yeni faza geçerken aynı üçlüyü güncelle |

**Son doğrulama (yerel, tekrarlanabilir):** `pnpm --filter @motogram/mobile typecheck` ve `pnpm --filter @motogram/mobile test` (16 suite / 62 test, 2026-04-24).

---

## 8. P7 — Uygulama sırası ve teslimler (Blueprint §14, §17.4: 7–8)

> **Amaç:** `FRONTEND_UI_UX_BLUEPRINT.md` **§14** (WebSocket) ve **§17.4** maddeleri 7 (Gamification realtime) + 8 (Emergency polish) ile hizalı, PR’lara bölünebilir mobil iş paketleri.  
> **SSOT olay sözleşmesi:** `packages/shared/src/schemas/socket-events.schema.ts` (`WS_EVENTS` + Zod payload’lar). Olay adı / payload bu dosyadan şaşmamalı.  
> **Mevcut kod (çıkış noktası):** `apps/mobile/src/lib/socket.ts` + `useParty` (`/realtime`); `messaging-socket.ts` ( `/messaging` , henüz ekranlarla tam sarılmamış olabilir); `ws-typed.ts`. Backend ve gateway ayrıntıları: `docs/PROJECT_BOARD.md` (R7, R14, Messaging/Party gateway).

### 8.1 Dalga özeti (önerilen uygulama sırası)

| Sıra | Dalga | Namespace / odak | Blueprint | Teslim (mobil) |
|------|--------|------------------|------------|----------------|
| **1** | **7.1** | `/realtime` sertleştirme | §14.1 (zorunlu) | Oturum kesintisinde **yeniden `party:join`**, arka plandan dönüş; `party:status_changed` ile store / ekran senkronu; konum: REST zinciri + **isteğe bağlı** `party:update_location` ile backend PROJECT_BOARD hizası (çift yol kabul edilmez, tek strateji seç). |
| **2** | **7.2** | `/messaging` tam | §14.1 (zorunlu) | Konuşma ekranında **Socket.IO** lifecycle: `connectMessagingSocket`, `conversation:join` / `leave`, `message:send` / `message:received` (Zod `ws-typed`); typing (`message:typing`); `message:read` ↔ liste okunmuş; offline / reconnect stratejisi. |
| **3** | **7.3** | `/gamification` | §14.2 (önerilen) + §17.4 (7) | Ayrı client (`io(…/gamification)`) veya mevcut pattern ile: **`quest:completed` / `badge:earned`** → toast / üst bant; profil sekmesinde `GET /v1/gamification/*` (rozet, quest) verileriyle birleşik. |
| **4** | **7.4** | `/emergency` | §14.2 (önerilen) + §17.4 (8) | `emergency:nearby` (ve ilgili server→client) dinleyiciler; harita veya global overlay’de “yakın SOS” (mevcut `SosButton` REST akışı ile çakışmayı ürün kararına göre netleştir: bilgilendirme vs. yönlendirme). |
| **5** | **7.5** | Sertleştirme | — | `typecheck` + `test` + kısa **manuel smoke**: dört namespace bağlantı, auth token yenileme sonrası reconnect. Jest: mümkünse `ws-typed` / handler saf fonksiyonları; native socket’i mock’la. |

**Not:** Aynı sprint içinde `docs/PROJECT_BOARD` ile backend’de `GamificationGateway` / `EmergencyGateway` hazır mı diye eşgüdüm; yalnız mobilde “dinleyici + UI” yetmezse API önce merge edilmeli.

### 8.2 Blueprint §13 ile paralel (P7 dışı ama aynı dönemde açılabilir)

Ürün dışı kalmamak için (§13) şu REST yüzeyleri ayrı iş paketi olarak planlanabilir; **P7 WS bitişini bloke etmez:** kullanıcı arama / takip listeleri, `POST /v1/reports`, konuşma `mute` / `leave` — `API_Contract` + mevcut şemalar.

### 8.3 P7 kapanış kabulü (Checklist)

- [ ] Blueprint §14.1: `/realtime` + `/messaging` “görünür” kullanım maddeleri karşılandı; §14.2 gamification + emergency en az **dinleme + kullanıcıya görünen geri bildirim** ile işaretlendi.  
- [ ] Tüm yeni UI metinleri `en.json` / `tr.json`.  
- [ ] Sentry: WS bağlantı / parse hataları `captureException` ile mevcut kalıba uygun.  
- [ ] `SESSION_HANDOFF.md` + bu belge **§2 / §7** + `PROJECT_BOARD` §1 güncel; commit referansı yazıldı.
