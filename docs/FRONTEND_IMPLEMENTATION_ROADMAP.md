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
| A3 | Home + story rail + üst bar | Feed, hikayeler, bildirim/mesaj kısayolu | Plan |
| A4 | 4 sekme / navigasyon hedefi | `FRONTEND_UI_UX_BLUEPRINT` §navigasyon; TabNavigator sadeleştirme | Plan |
| A5 | Profil + ayarlar | `users/me`, public profil, garaj, şifre/blocks/hesap | Kısmi |
| A6 | Harita + parti + topluluk polish | Mapbox, ride mode, community/party ekranları | Kısmi |
| A7 | WS yüzeyleri | `/messaging` tam, `/realtime` sürüş, gamification/emergency | Kısmi |

Detay: Blueprint §17.4 “İdeal uygulama sırası” ile uyumludur; Inbox aşaması netleştirilerek yukarı taşındı.

---

## 3. Test stratejisi (mobil)

- **Birim (Jest, `ts-jest`, `node` ortamı):** Saf mantık — örn. `messaging-path.ts` URL inşası; form şemaları (`zodResolver`); store/reducer; navigasyon `linking` eşlemesi. `api-client` veya `expo-constants` çeken modülleri testten **ayır** (saf yardımcı modül + re-export).
- **Bileşen:** `@testing-library/react-native` (mevcut projede ağırlık formlar ve kritik ekranlarda).
- **E2E (ileride):** Maestro / Detox — smoke: giriş, Inbox 3 sekmesi, bir sohbet açma (CI’da opsiyonel).
- **Regresyon:** `pnpm --filter @motogram/mobile typecheck` + `pnpm --filter @motogram/mobile test` her PR’da yeşil.

---

## 4. Inbox (A2) kabul kriterleri

- [x] `GET /v1/conversations?type=DIRECT` ve `GROUP_CHAT` DM ekranında; `COMMUNITY_CHAT` ayrı sekmede.
- [x] `inbox.*` i18n anahtarları (TR/EN).
- [x] Üst sekme: cam (blur) + karanlık tema ile tutarlı vurgu.
- [x] Jest: konuşma listesi URL sorgusu.

---

## 5. Revizyon günlüğü

- **2026-04-23:** A2 (Inbox) yol haritası ve test stratejisi eklendi; Blueprint v1.2 ile eşgüdüm.
