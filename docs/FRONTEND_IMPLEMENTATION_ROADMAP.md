# Motogram — Frontend uygulama yol haritası

> Tarih: 2026-04-23  
> İlişkili: `docs/FRONTEND_UI_UX_BLUEPRINT.md` (v1.2+), `docs/API_Contract.md`, `packages/shared`  
> Amaç: Mobil `apps/mobile` ve (ileride) `web-admin` için öncelik sırası, test disiplinini ve kabul kriterlerini sabitlemek.

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
| A5 | Profil + ayarlar | `users/me`, public profil, garaj, şifre/blocks/hesap | Uygulandı (2026-04-23: `PATCH /users/me`, ayarlar hub, bildirim tercihleri, acil kişi, `GET/DELETE` blocks, hesap silme; **ardıl:** `GET /users/:username` başka profil) |
| A6 | Harita + parti + topluluk polish | Mapbox, ride mode, community/party ekranları | Kısmi |
| A7 | WS yüzeyleri | `/messaging` tam, `/realtime` sürüş, gamification/emergency | Kısmi |

Detay: Blueprint §17.4 “İdeal uygulama sırası” ile uyumludur; Inbox aşaması netleştirilerek yukarı taşındı.

---

## 2.1 Uygulama fazları (P1–P7) — kodlama emri

Her faz bitince: `typecheck` + `test` (mobil), gerekirse `PROJECT_BOARD` §5, bu tablodaki “Durum” sütunu.

| Faz | Ad | Teslim (belge) | Doğrulama |
|-----|----|-----------------|-----------|
| **P1** | Auth OAuth + sözleşme | `FRONTEND_UI_UX_BLUEPRINT` §6; `auth.schema` Apple/Google | Apple/Google/şifre giriş; EULA; hata i18n |
| **P2** | (A2) Gelen kutusu | §10 Inbox | `?type=` DM / topluluk / parti; i18n |
| **P3** | Home + üst bar | Story rail, bildirim/mesaj kısayolu (root stack) | Tamam: tren, tam ekran yürütücü, video için geçici metin, bildirimler ayrılırken okundu |
| **P4** | Tab navigasyon 4 | `FRONTEND_UI_UX_BLUEPRINT` §5; Inbox tab’dan kaldır | Tamam: `AppStack` + 4 tab |
| **P5** | Profil + ayarlar | §11, Settings | Tamam: `Settings` + alt ekranlar, `PATCH /users/me`, tercihler, acil, blocks, `account/deletion` |
| **P6** | Harita + topluluk/parti polish | §8–9 | Mapbox; ekranlar contract ile |
| **P7** | WS + gamification + acil | §14 | Namespace’ler blueprint ile |

**Aktif sıra (2026-04-23):** P1–P5 tam; **ardıl:** (opsiyonel) `expo-av` hikâye video; public profil ekranı; **P6** harita + topluluk/parti polish.

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

- **2026-04-23 (5):** P5: `updateCurrentUser` (`PATCH /users/me`); `blocks.api`; `notification-preferences` GET/PATCH; acil `contacts` CRUD; `SettingsScreen` + `EditProfile` + tercihler + engellenenler + `AccountDeletionScreen`; `ProfileScreen` i18n + ayar; `linking` `settings/*`; `parseRidingStyleCommas` Jest.
- **2026-04-23 (4):** P3 kapanış: `stories.api` (`/stories/feed`, `/stories/:id/views`), `StoryRail` + `StoryViewer` (`AppStack`), `groupStoryFeedByUser` test; bildirim `mark-read` ekran çıkışında; `motogram://story/:initialStoryId` link; **video** şimdilik bilgi metni (expo-av ileri faz).
- **2026-04-23 (3):** P4: `AppStackNavigator` (MainTabs + Inbox + Notifications), 4 sekmeli tab, `linking` AppStack. P3: Home üst bar (gelen + bildirim), `GET /notifications` + `unread-count`, feed beğeni `likedByMe` düzeltmesi, `Inbox`→Harita `MainTabs/Map` geçişi.
- **2026-04-23 (2):** P1 faz tablosu (P1–P7), OAuth implementasyonu, `auth-path` test.
- **2026-04-23:** A2 (Inbox) yol haritası ve test stratejisi eklendi; Blueprint v1.2 ile eşgüdüm.
