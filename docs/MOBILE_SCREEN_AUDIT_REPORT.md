# Ön uç (frontend) denetim raporu — Mobil + Web-Admin

**Rapor sürümü:** 2.0 (tam denetim)  
**Tarih:** 2026-04-22  
**Kapsam:** `apps/mobile` (React Native / Expo), `apps/web-admin` (Next.js), backend `apps/api` ile yol/semre çapraz kontrol.  
**Yöntem:** Tüm ekran/modal/nav import grafiği, `src/api/*.ts` kullanım matrisi, `apps/api` controller yolları ile eşleştirme, statik inceleme, `pnpm --filter @motogram/mobile typecheck` + `test` (CI’da cihaz E2E yok).

> Bu belge, **“backend ile uyumlu, ölü ekran / işlevsiz buton olmayan, ürünü yansıtan”** hedefe göre **mevcut gerçekliği** ve **açık işleri** listeler.

---

## 1) Yönetici özeti

| Boyut | Durum |
|-------|--------|
| **Kritik uyumsuzluk (düzeltildi)** | `GarageTab` yanlış path (`/motorcycles`) ve eski alan adları (`make` vs backend `brand`) — **2026-04-22** commit’te `GET /motorcycles/me` + `MotorcycleListResponseSchema` ile hizalandı. |
| **Kritik ürün açıkları (kod hâlâ uygulamada yok)** | `EventCreateScreen`, `CommunityDetailScreen`, `StoryCreateScreen` **hiçbir navigator’da yok**; menü/derin link olmadan kullanıcı açamaz. |
| **Orta** | `HomeScreen` beğeni her zaman `currentlyLiked: false`; **unlike** veya sunucu “kullanıcı beğenmiş” alanı yok (DTO tarafı da kontrol edilmeli). `OtpScreen` form var, **API yok** (Faz 4 yorumu). `account.api.ts` **import edilmiyor** (hesap silme / iptal yok). |
| **Web-admin** | Raporlar / kullanıcılar / feature flag / A-B / audit log / dashboard **API’li**; **Canlı Harita** ve **Quest** sayfaları **açıkça placeholder**; silme kuyruğu sadece snapshot sayacı. |
| **Otomasyon** | Mobile: 11 Jest suite, 53 test (çoğunluk şema/yardımcı); **entegrasyon veya ekran E2E yok** — “tam uçtan uca doğrulama” için yetersiz. |

---

## 2) Yöntem (tekrarlanabilir kontrol listesi)

1. `src/**/*.tsx` “Screen/Modal” envanteri + `navigation/*` import zinciri.  
2. `grep` ile her `api/*.ts` modülünün **en az bir** tüketicisi.  
3. Kritik REST path’lerin `apps/api` controller ile **bire bir** eşi (`motorcycles` örneği gibi).  
4. `web-admin` sidebar → her `page.tsx` (server/client, `adminApi` / placeholder).  
5. Derin link: `linking.ts` yapısı vs **gerçek** `TabNavigator` (düz tab) uyumu.  

**Yapılmadı (sınır):** Fiziksel cihazda E2E, App Store sürümü, prod env.

---

## 3) Mobil: navigasyon ve erişilebilirlik

### 3.1 Kök akış

| Bileşen | Davranış |
|---------|----------|
| `RootNavigator` | `accessToken` + `userId` yok → `AuthNavigator`; var → `TabNavigator`. |
| `NavigationContainer` `linking` | Sadece oturum açıkken — doğru. |

### 3.2 Auth stack (`AuthNavigator`)

| Ekran | Backend / işlev | Not |
|--------|------------------|-----|
| `WelcomeScreen` | — | Sadece yönlendirme, sorun yok. |
| `LoginScreen` | `POST` auth ( `auth.api` ) | R6 `useZodForm`. |
| `RegisterScreen` | Register | Aynı. |
| `OtpScreen` | *Planlı değil* | Submit **stub**; üretim OTP akışı yok. |

### 3.3 Tab bar (kullanıcıya açık ana ekranlar)

| Tab | Bileşen | API / veri | Risk |
|-----|---------|------------|------|
| Home | `HomeScreen` | `fetchFeed` (`/posts/feed`) | Beğeni **sadece like yolu**; toggle yok. Yorum tıkı yok. |
| Discover | `DiscoverScreen` | *Yok* | Kasıtlı iskelet (“coming soon”) — **ürün boş**. |
| Map | `MapScreen` | `map`, `location`, `party` | Mapbox yoksa harita yok; `PartyCreateModal`, `SosButton`, `DiscoverModeSheet` bağlı. |
| Inbox | `InboxStackNavigator` | mesaj, parti | `InboxScreen` (DM + parti sekmeleri) → `Conversation` stack. |
| Profile | `ProfileScreen` | `/users/me` **şemasız** `apiRequest<MeResponse>` | Drift + tip güveni R5’le tam uyumlu değil. |

**Tab dışı — repo’da var, navigasyona bağlı değil (“ölü ekran”):**

| Dosya | Planlanan API | Neden “ölü” |
|--------|----------------|---------------|
| `EventCreateScreen` | `event.api` / `createEvent` | **Hiç import yok**; ekran UI kodu durağan. |
| `CommunityDetailScreen` | `community.api` | **Hiç import yok**. |
| `StoryCreateScreen` | `media.api` + hikâye | **Hiç import yok**; sadece bu dosyada toplanmış. |

Bu üçü için **R6 belgesinde** geçmek, gerçek rotalar eklenmedikçe “tamamlanmış özellik” anlamına gelmez.

### 3.4 Inbox modülü

| Parça | Durum |
|--------|--------|
| `ConversationsListScreen` + `listConversations` | Bağlı; hata state zayıf (ağ hatası boş liste gibi). |
| `ConversationScreen` + `useMessaging` | WS + REST; `useZodForm` (compose). |
| `PartyInboxScreen` | `party.api`; `onJumpToMap` → `navigate('Map')` (çoğu RN6 kurulumda çalışır; hata yutulmuş `try/catch` sessizce başarısız olabilir). |

### 3.5 `src/api` modülleri — kullanım

| Modül | Tüketici(ler) | Kullanılmıyor |
|--------|----------------|---------------|
| `auth.api` | Login, Register | — |
| `posts.api` | Home | — |
| `likes.api` | `useLikePost` | — |
| `map.api` | `useLocationBroadcast`, `useNearbyRiders`, `LocationSharingSheet` | — |
| `party.api` | Map, Party modallar, Inbox | — |
| `messaging.api` | Conversations, `useMessaging` | — |
| `push.api` | `usePushPrompt` | — |
| `emergency.api` | `SosButton` | — |
| `gamification.api` | `BadgesTab`, `QuestsTab` | — |
| `event.api` | **sadece** `EventCreateScreen` (navi yok) | *de facto* uygulamada yok |
| `community.api` | **sadece** `CommunityDetailScreen` (navi yok) | *de facto* yok |
| `media.api` | **sadece** `StoryCreateScreen` (navi yok) | *de facto* yok |
| `account.api` | **yok** | Tüm `account` istemcisi **ölü** |

### 3.6 Profil sekmeleri (detay)

| Tab | API | Bu rapor öncesi sorun | Güncel |
|-----|-----|------------------------|--------|
| Rozetler | `/gamification/badges` | Uyumlu. | — |
| Görevler | `/gamification/quests` | Uyumlu. | — |
| Garaj | `GET /motorcycles/me` | **Hatalı:** `GET /motorcycles` (404) + DTO uyuşmazlığı (`make` vs `brand`). | **Düzeltildi:** `/motorcycles/me` + `MotorcycleListResponseSchema` + `brand`/`model`/`photos[0]`. |

### 3.7 Derin bağlantı (`linking.ts`)

- `parseDeepLink` **unit test ile kapalı** — iyi.  
- `config.screens` içinde `Home` altında `Feed` / `Post` gibi **nested ekran adları** var; **gerçek `TabNavigator` iç içe stack değil**. React Navigation eşleşmesi **tam olmayabilir** — ayrı bir `RootStack` (veya tab içi stack) eklendikten sonra `linking` tekrar eşitlenmeli.  

### 3.8 Stil / i18n

- `ProfileScreen` sekmeleri: “Rozetler / Garaj / Gorevler” **sabit TR**; `t()` yok.  
- Birçok inbox/parti string’i hâlâ **hardcoded** — çok dilli sözleşmeyle uyumsuz.

---

## 4) Web-Admin (Next.js)

| Rota (sidebar) | Veri kaynağı | Not |
|----------------|--------------|-----|
| `/dashboard` | `adminApi.dashboard` | **Canlı**; hata mesajı gösterimi var. |
| `/reports` | `listReports` + `reviewReport` | API’li. |
| `/users` | `listUsers`, ban, rol | API’li. |
| `/audit-logs` | `listAuditLogs` | API’li. |
| `/feature-flags` | formlar + `adminApi` | API’li. |
| `/ab-tests` | Aynı | API’li. |
| `/deletion-queue` | Sadece dashboard snapshot’tan **sayı**; liste yok | Açıklama: “v1.1'de `.../deletion-queue`”. |
| `/live-map` | **Yok** | Açık placeholder. |
| `/quests` | **Yok** (statik tablo) | Doküman referansı; yönetimsel API yok. |
| `/docs` | — | Statik. |
| `login` | next-auth | Guard’lı. |

**Sonuç:** Admin, **içerik yönetimi** tarafında büyük ölçüde **backend’e bağlı**; ama canlı harita/quest yönetimi ve silme kuyruğu detayı **henüz backend entegrasyonu yok denecek kadar sınırlı** veya açıkça ertelenmiş.

---

## 5) Backend yüzeyi (örnek) vs mobil tüketim

- **Covered (örnekler):** auth, feed, likes, map/location, party, messaging, push, emergency, gamification, users/me (typedsiz), motorcycles/me (düzeltildikten sonra).  
- **Büyük ölçüde yok (mobil):** yorum listesi, bildirim merkezi, `follow`/`unfollow` akışı, hikâye **feed/viewer** UI, topluluk/etkinlik ekranları, hesap silme, motor CRUD, çoğu `comments` uçu.  
- **admin** uçları yalnız **web-admin**’de.

---

## 6) Test ve kalite

| Katman | Durum |
|--------|--------|
| Jest (mobile) | 53 test — çoğunluk Zod, map store, link parse. |
| E2E cihaz | **Yok**; backend E2E `apps/api` ayrı pipeline. |
| Görsel regresyon | **Yok**. |

**Hedefe “tam yansıma” için** öneri: en azından **kritik akış** (auth → home → beğeni → profil → garaj) ve **navi açılan** tüm ekranlar için Maestro/Detox veya Expo E2E planı.

---

## 7) Öncelikli yol haritası (ürün = kod)

**P0 (blokaj / güven / yanlış yol):**  
- [x] Garaj: `/motorcycles/me` + sema (bu commit).  
- [ ] `Event` / `Community` / `Story` için **ortak root stack** ve rota (veya mevcut ekranları kaldırmak / feature flag).  
- [ ] `Profile` `/users/me` → `packages/shared` şeması.  

**P1 (davranış):**  
- [ ] Home beğeni: DTO’da `viewerHasLiked` (veya eşdeğeri) + `useLikePost` argümanı.  
- [ ] `OtpScreen` veya ekran gizleme.  
- [ ] `account.api` + ayar ekranı veya modül kaldırma.  

**P2 (müşteri dili, deep link):**  
- [ ] `linking` ↔ gerçek navigator.  
- [ ] Profil/i18n.  

**P3 (web-admin):** canlı harita, quest ve silme kuyruğu listesi (backend uç + UI).

---

## 8) Değişiklik günlüğü (rapor dosyası)

| Sürüm | Tarih | Değişiklik |
|--------|--------|------------|
| 1.0 | 2026-04-22 | İlk mobile odaklı tarama. |
| 2.0 | 2026-04-22 | Mobil + web-admin, API matrisi, `GarageTab` bugfix, genişletilmiş yol haritası. |

---

*Üretim kararı öncesi: `pnpm --filter @motogram/mobile typecheck` + `test` ve istenen ortamda manuel tümden tıklama (smoke) önerilir.*
