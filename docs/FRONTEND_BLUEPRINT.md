# Motogram — Frontend Blueprint (Mobil & Web-Admin)

> **Sürüm:** 1.0 — 2026-04-23  
> **Kapsam:** `apps/mobile` (React Native / Expo) ve dolaylı olarak `apps/web-admin` (Next.js).  
> **Amaç:** Login’den logout’a kadar **hayalet ekran, bağlanmamış buton ve şemasız çağrı kalmayacak** biçimde, mevcut backend (REST + WS) sözleşmesine **birebir** uyumlu bir frontend planı üretmek.  
> **Kaynak doğrulama:**
> - REST/WS yüzeyi: `docs/API_Contract.md`, `docs/openapi.json`, `docs/ws-contract.md`
> - Şemalar: `packages/shared/src/schemas/*`
> - Mevcut mobil durum: `docs/MOBILE_SCREEN_AUDIT_REPORT.md` + bu çalışmadaki taze ekran/data layer denetimi
> - Tüm yollar `apps/api` `main.ts` içinde global prefix `v1` ile yayınlanır → **`/v1/...`**

---

## 0. Yönetici özeti

Mevcut backend **113 REST + 4 WS namespace** yayınlıyor (Auth, Users, Posts, Stories, Comments, Likes, Follows, Motorcycles, Notifications, Location, Map, Party, Community, Event, Messaging, Push, Emergency, Gamification, Media, Account, FeatureFlags, AbTests, Admin, Health, Internal). Mobil uygulamada bu yüzeyin **yaklaşık %35–40’ı** ekrana bağlı; geri kalanı `src/api/*.ts` içinde **yetim** veya navigasyon ağacında **erişilemez** durumda.

Bu blueprint üç şeyi yapar:

1. Tüm **navigasyon ağacını yeniden** tanımlar (Tab + Stack + Modal) ve her ekrana **route adı** verir.
2. Her ekran için **(UI öğeleri + state + REST/WS uçları + Zod + boş/yükleniyor/hata + giriş/çıkış)** beşli kontrol listesi üretir.
3. Backend’de **eksik olan** uçları (OTP doğrulama, e‑posta doğrulama, raporlama, engelleme, gizlilik; tam liste §17) **“Backend Eksikleri”** başlığı altında toplar — bu uçlar gelmeden ekran açılmamalı (hayalet üretmemek için).

---

## 1. Teknik altyapı (mobil)

### 1.1 Çalışma ortamı

- **Framework:** Expo SDK (managed). Native modüller: `react-native-mmkv`, `expo-location`, `expo-notifications`, `expo-image-picker`, `expo-linking`, `react-native-mapbox-gl` (yalnız mapbox şartı).
- **State:** Zustand (auth, map, party) + TanStack Query (server state).
- **Form:** `react-hook-form` + `@hookform/resolvers/zod` (`useZodForm` wrapper, `apps/mobile/src/lib/forms.ts`).
- **Network:** `apiRequest` (`apps/mobile/src/lib/api-client.ts`) → tüm REST `/v1/...` ve Zod `parse`.
- **Realtime:** `socket.io-client` v4, iki namespace (`/realtime`, `/messaging`) artı **eklenecek** `/emergency` ve `/gamification` (server zaten yayında).
- **Storage:** MMKV (`StorageKeys.AccessToken`, `RefreshToken`, `MapFilters`, `PushPromptShownAt`).
- **i18n:** `react-i18next` tek namespace (`translation`); `tr` (default) + `en`. Tüm yeni metinler **mutlaka** anahtar üzerinden gelecek.

### 1.2 `apiRequest` & token yenileme — düzeltilecek davranış

Bugün `tryRefresh` 401’de **sadece refresh token’ı** MMKV’ye yazıyor; access token güncellenmiyor → bir sonraki istek hâlâ eski token ile gidiyor. Plan:

- `tryRefresh` başarıyla `TokenPairResponseSchema` parse ettiğinde **hem access hem refresh** token’ı MMKV’ye yazsın **ve** Zustand `auth.store.setSession({...})` çağrılsın.
- Mobil `apiRequest` import’ları için tek bir `auth.api.refreshRequest` fonksiyonu kullanılsın (inline `fetch` kaldırılsın).
- `logoutRequest` her **gönüllü** çıkışta çağrılsın (bugün sadece `clearSession` yapılıyor).

### 1.3 React Query anahtar standardı

Dağınık string anahtarları `apps/mobile/src/lib/query-keys.ts` altında merkezîleşecek:

```ts
export const qk = {
  me: ['users', 'me'] as const,
  userPublic: (username: string) => ['users', 'public', username] as const,
  feed: (cursor?: string) => ['posts', 'feed', cursor] as const,
  postById: (id: string) => ['posts', id] as const,
  comments: (postId: string) => ['comments', postId] as const,
  storiesFeed: ['stories', 'feed'] as const,
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversations', id] as const,
  messages: (id: string) => ['conversations', id, 'messages'] as const,
  motorcycles: ['motorcycles', 'me'] as const,
  notifications: ['notifications'] as const,
  notificationsUnread: ['notifications', 'unread-count'] as const,
  myCommunities: ['communities', 'me'] as const,
  community: (id: string) => ['communities', id] as const,
  nearbyCommunities: (lat: number, lng: number, radius: number) =>
    ['communities', 'nearby', lat, lng, radius] as const,
  myEvents: ['events', 'me'] as const,
  event: (id: string) => ['events', id] as const,
  partyInvites: ['parties', 'invites', 'me'] as const,
  party: (id: string) => ['parties', id] as const,
  nearbyParties: (lat: number, lng: number, radius: number) =>
    ['parties', 'nearby', lat, lng, radius] as const,
  nearbyRiders: (q: object) => ['map', 'nearby', q] as const,
  myBadges: ['gamification', 'badges'] as const,
  myQuests: ['gamification', 'quests'] as const,
  myDevices: ['devices', 'me'] as const,
  emergencyAlerts: ['emergency', 'alerts'] as const,
  emergencyAlert: (id: string) => ['emergency', 'alerts', id] as const,
  accountDeletion: ['account', 'deletion'] as const,
  flagEval: (key: string) => ['feature-flags', 'evaluate', key] as const,
  abAssignment: (key: string) => ['ab-tests', key, 'assignment'] as const,
};
```

### 1.4 Hata / boş / yükleniyor standardı

Her ekran zorunlu olarak şu üç state’i karşılayacak — kabul kriteri:

- **Loading:** `Skeleton` (liste/kart) veya `ActivityIndicator` (modal) — **ekran asla bomboş kalmasın**.
- **Empty:** İllustrasyon + tek CTA (örn. “İlk gönderini paylaş”) → ilgili oluşturma ekranına gider.
- **Error:** Toast + “Tekrar dene” butonu (`refetch`); 401 → otomatik logout (refresh fail).
- **Offline:** `@tanstack/query` `networkMode: 'offlineFirst'`, banner.

### 1.5 Tema & komponent kütüphanesi

Mobilde tek bir `apps/mobile/src/ui/` paketi:

`Button`, `IconButton`, `TextInput`, `PasswordInput`, `Avatar`, `UserBadge`, `PostCard`, `StoryRing`, `EventCard`, `CommunityCard`, `PartyCard`, `MotorcycleCard`, `ConversationRow`, `MessageBubble`, `MapMarker`, `RiderMarker`, `EmptyState`, `ErrorState`, `Skeleton`, `BottomSheet`, `Modal`, `ActionSheet`, `ListSection`, `Divider`, `Tag/Pill`, `Toast` (sonner-rn), `Confirm`. Hepsi a11y (label, role) destekli.

### 1.6 Deep link şeması (final)

`motogram://` + `https://motogram.app/`:

| URL | Ekran |
|-----|-------|
| `motogram://post/:id` | `PostDetailScreen` |
| `motogram://user/:username` | `UserProfileScreen` |
| `motogram://story/:id` | `StoryViewerScreen` |
| `motogram://conversation/:id` | `ConversationScreen` |
| `motogram://party/:id` | `PartyDetailScreen` (Map içinde modal) |
| `motogram://community/:id` | `CommunityDetailScreen` |
| `motogram://event/:id` | `EventDetailScreen` |
| `motogram://emergency/:id` | `EmergencyDetailScreen` |
| `motogram://settings` | `SettingsScreen` |

Bunlar **`linking.ts`** içinde **gerçekten var olan ekranların** path’leriyle eşleştirilecek; bugünkü `linking.ts` `Feed/Post/Story/Emergency` gibi var olmayan iç içe isimlere işaret ediyor → **yeniden yazılacak**.

---

## 2. Hedef navigasyon ağacı

Tek tip: **Bottom Tab (5 tab)** + her tab altında bir **Native Stack** + uygulama düzeyinde bir **Modal Stack** (story/sheet/medya).

```
RootNavigator
├─ AuthStack           (kullanıcı yoksa)
│   ├─ Welcome
│   ├─ Login
│   ├─ Register
│   ├─ Otp                       ← backend hazır olunca aktif
│   ├─ ForgotPassword            ← backend ekleyince
│   └─ ResetPassword             ← backend ekleyince
│
├─ MainTab            (kullanıcı varsa)
│   ├─ HomeStack
│   │   ├─ Feed
│   │   ├─ PostDetail            (param: { postId })
│   │   ├─ Comments              (param: { postId })
│   │   ├─ StoryViewer           (param: { storyId | userId })
│   │   ├─ UserProfile           (param: { username })
│   │   └─ Followers / Following (LATER — backend gerekir)
│   │
│   ├─ DiscoverStack
│   │   ├─ Discover (sekme: Topluluklar | Etkinlikler | Partiler)
│   │   ├─ NearbyCommunities
│   │   ├─ NearbyEvents
│   │   ├─ NearbyParties
│   │   ├─ CommunityDetail       (param: { id })
│   │   ├─ CommunityMembers      (param: { id })
│   │   ├─ CommunityRequests     (param: { id })  (admin/mod)
│   │   ├─ EventDetail           (param: { id })
│   │   └─ EventParticipants     (param: { id })
│   │
│   ├─ MapStack
│   │   ├─ Map
│   │   ├─ PartyDetail           (param: { id })
│   │   ├─ PartyMembers          (param: { id })
│   │   ├─ NearbyRidersList      (filtre paneli açık liste görünümü)
│   │   └─ EmergencyDetail       (param: { id })
│   │
│   ├─ InboxStack
│   │   ├─ InboxRoot (sekme: Mesajlar | Davetler | Topluluk Sohbetleri)
│   │   ├─ Conversation          (param: { id })
│   │   ├─ ConversationInfo      (param: { id })
│   │   ├─ NewConversation       (DM başlat)
│   │   └─ NewGroupChat
│   │
│   └─ ProfileStack
│       ├─ Profile (own)
│       ├─ EditProfile
│       ├─ Garage  (kendi motosikletleri)
│       ├─ MotorcycleEditor      (create/update)
│       ├─ Badges
│       ├─ Quests
│       ├─ Notifications
│       ├─ Settings
│       │   ├─ Account
│       │   │   ├─ ChangeUsername       ← BACKEND EKSİK
│       │   │   ├─ ChangePassword       ← BACKEND EKSİK
│       │   │   ├─ Email                ← BACKEND EKSİK
│       │   │   ├─ ConnectedDevices     (push tokens)
│       │   │   └─ DeleteAccount
│       │   ├─ Privacy
│       │   │   ├─ LocationSharing
│       │   │   ├─ BlockedUsers         ← BACKEND EKSİK
│       │   │   └─ DataExport           ← BACKEND EKSİK
│       │   ├─ Notifications (in-app preferences)
│       │   ├─ Appearance (tema/dil)
│       │   ├─ EmergencyContacts        ← BACKEND EKSİK
│       │   ├─ Help & Feedback
│       │   ├─ About
│       │   └─ Logout
│       └─ FollowersFollowing (LATER)
│
└─ ModalStack                    (her yerden açılabilir)
    ├─ CreatePost
    ├─ CreateStory
    ├─ CreateCommunity
    ├─ CreateEvent
    ├─ CreateParty
    ├─ MediaPicker
    ├─ ReportContent             ← BACKEND’de yok, eklenecek
    ├─ EmergencySos
    ├─ ShareSheet (deep link)
    └─ SystemAlert (announcement) — feature-flag controlled
```

**Yetim ekranlar (`CommunityDetailScreen`, `EventCreateScreen`, `StoryCreateScreen`) yukarıda hedef konumlara taşınıp navigator’a kaydedilecek.**

---

## 3. Auth akışı (Welcome → Logout)

### 3.1 WelcomeScreen
- **Route:** `Auth/Welcome`
- **Backend:** —
- **UI:** Logo, slogan, `[Giriş yap]` `[Hesap oluştur]` butonları, dil seçici küçük ikon.
- **Çıkış:** `Login` veya `Register`.

### 3.2 LoginScreen
- **Route:** `Auth/Login`
- **REST:** `POST /v1/auth/login` → `LoginSchema` → `AuthResultSchema`
- **State:** Form (`useZodForm(LoginFormSchema)`), `useMutation`.
- **Başarı:** `auth.store.setSession({ accessToken, refreshToken, userId })`, MMKV’ye yaz, `getCurrentUser` prefetch, `Home` tab’ına geç.
- **Hata:** 400/401 → form alanı altında metin (“E‑posta veya şifre hatalı”), 429 → “Çok fazla deneme, X dakika sonra…”.
- **Ek butonlar:** `[Şifremi unuttum]` → ForgotPassword (Backend gelince aktif).
- **Loading:** Buton içinde spinner, alanlar disable.
- **Empty:** —

### 3.3 RegisterScreen
- **Route:** `Auth/Register`
- **REST:** `POST /v1/auth/register` → `RegisterSchema` (email, username, displayName, password) → `AuthResultSchema`
- **State:** `useZodForm(RegisterScreenFormSchema)` + ileride **şartlar onay** kutusu.
- **Doğrulama kuralları:** username `3–30 char [a-z0-9_.]`, password min 8, displayName min 2 — şu anki `RegisterSchema` ile bire bir.
- **Başarı:** Otomatik login token döner → `auth.store.setSession` → **(Hazır olunca)** `Otp` ekranına it.
- **Hata:** `422` (`username taken` / `email taken`) → ilgili alana inline mesaj.

### 3.4 OtpScreen *(BACKEND EKSİK)*
- Bugün form var, **endpoint yok** (`auth.controller`’da OTP route yok).
- Plan: Backend `/v1/auth/otp/request` + `/v1/auth/otp/verify` ekleyene kadar **navigatorda erişilmez tutulur**, `app.json`’da hidden flag.
- Hazır olunca: `useZodForm(OtpVerifySchema)` zaten var; `apiRequest('/auth/otp/verify', { POST, body, schema: AuthResultSchema })`.

### 3.5 ForgotPasswordScreen / ResetPasswordScreen *(backend B‑05 hazır)*
- API: `POST /v1/auth/password/forgot` (email → `{ success: true }`; mail BullMQ `AUTH_PASSWORD_RESET_MAIL`) + `POST /v1/auth/password/reset` (`token` + `newPassword` → `ChangePasswordResponse` şekli).
- Mobil: ekranları bu uçlara bağla; deep link `reset-password?token=…` ile reset ekranı.

### 3.6 Logout
- Buton: `SettingsScreen → Account → Logout` ve `ProfileScreen` üst sağ ikon.
- Çağrı sırası:  
  1. `logoutRequest({ allDevices: false })` → `POST /v1/auth/logout`  
  2. `socket.disconnect()` (her iki namespace)  
  3. `queryClient.clear()`  
  4. `auth.store.clearSession()` + MMKV temizle  
  5. RootNavigator otomatik `AuthStack`’e geçer.

---

## 4. Ana sekmeler (Tab’lar)

5 sekme: `Home`, `Discover`, `Map`, `Inbox`, `Profile`. Sekme barı **rozetli** (Inbox’ta okunmamış, Profile’de bildirim).

| Tab | İkon | Backend besleme |
|-----|------|------------------|
| Home | feed | `GET /posts/feed` + `GET /stories/feed` + `GET /notifications/unread-count` |
| Discover | compass | nearby endpoint’ler + arama (Backend: arama eksik) |
| Map | map-pin | `GET /map/nearby`, `/map/shards`, party WS |
| Inbox | mail | `GET /conversations`, `GET /parties/invites/me` |
| Profile | user | `GET /users/me`, gamification, garage |

Tab badge sayısı için `useQuery(qk.notificationsUnread)` 60 sn polling + `notification:new` (eklenmesi gereken push event).

---

## 5. Home akışı

### 5.1 FeedScreen
- **Route:** `HomeStack/Feed`
- **REST:** `GET /v1/posts/feed?cursor&limit` → `PostFeedPageSchema` (infinite query).
- **WS yok.** Like/unlike: `POST /v1/likes/:postId` ve `DELETE /v1/likes/:postId` → `LikeToggleResponseSchema`.
- **State:** `useInfiniteQuery(qk.feed, … getNextPageParam: lastPage.nextCursor)`.
- **UI:** Üstte horizontal `StoryRow` (StoryRing avatar listesi), altta dikey `PostCard` listesi (kapak medya, başlık, içerik, like/comment/share, lokasyon chip’i).
- **Aksiyon butonları:**
  - `❤ Like` → `useLikePost` — backend artık `post.likedByMe` döndürüyor (`PostApiResponseSchema` / `PostFeedItemSchema`); mobilde `currentlyLiked` bu alandan beslenmeli (§18 madde 2).
  - `💬 Comment` → `Comments` ekranına it.
  - `↗ Share` → `motogram://post/:id` deep link kopyala.
  - `⋯` → `ActionSheet`: Rapor (BACKEND EKSİK), Engelle (BACKEND EKSİK), Sil (sadece kendi postu → `DELETE /v1/posts/:id`).
- **Boş:** “Henüz bir şey yok” + `[Takip etmeye başla]` → Discover.
- **Loading:** 3 adet `PostCardSkeleton`.
- **Pull‑to‑refresh:** `refetch` + story listesi de tazelenir.

### 5.2 PostDetailScreen
- **Route:** `HomeStack/PostDetail`
- **REST:** `GET /v1/posts/:id` → `PostApiResponseSchema`. Yorum sayfası ayrı (5.3).
- **Sahip aksiyonları:** `Düzenle` → modal `EditPost` → `PATCH /v1/posts/:id` (`UpdatePostSchema`). `Sil` → `DELETE /v1/posts/:id` → geri.
- **Deep link:** `motogram://post/:id`.

### 5.3 CommentsScreen
- **Route:** `HomeStack/Comments`
- **REST:**
  - List: `GET /v1/comments/post/:postId?cursor&limit` → `CommentListPageResponseSchema`
  - Create: `POST /v1/comments` (`CreateCommentSchema`) → `CommentRowResponseSchema`
  - Update: `PATCH /v1/comments/:id` (`UpdateCommentSchema`)
  - Delete: `DELETE /v1/comments/:id`
- **UI:** En altta sabit `TextInput`, gönder butonu. Mesaj başına long‑press → düzenle/sil (sadece kendi).
- **Optimistic update:** Listeye eklerken `tempId` ile placeholder, mutate başarılı olunca gerçek id ile değiştir.

### 5.4 CreatePostScreen (modal)
- **Route:** `Modal/CreatePost`
- **REST:**
  1. `POST /v1/media/uploads` (`InitiateMediaUploadSchema`) → `uploadUrl` (presigned)
  2. `PUT uploadUrl` (binary)
  3. `POST /v1/media/uploads/finalize` → `MediaAssetDtoSchema`
  4. `POST /v1/posts` (`CreatePostSchema` — `mediaIds`, caption, location?)
- **UI:** Görsel/video seçici (`expo-image-picker`), açıklama TextInput, lokasyon chip’i (cihaz GPS ile veya “Konum ekleme”), ileri.
- **Empty/Hata:** Upload progress bar, hatada “Yeniden dene”.

### 5.5 StoryRow + StoryViewerScreen
- **REST:** `GET /v1/stories/feed` → `StoryFeedResponseSchema`
- **Görüntüleme:** `StoryViewerScreen` (modal) — her story 5 sn, sağ/sol tap.
- **View kaydı:** `POST /v1/stories/:storyId/views` (her geçişte 1 kez).
- **Oluşturma:** **CreateStory modal** (mevcut `StoryCreateScreen`’i taşı):
  1. Media upload chain (5.4 ile aynı)
  2. `POST /v1/stories` (`CreateStorySchema`) → `StoryRowResponseSchema`
  - Bugün `StoryCreateScreen` `apiRequest('/stories', { POST }, …)` yanıt **şemasız** çağırıyor → Zod `StoryRowResponseSchema` ile `parse` zorunlu.

### 5.6 UserProfileScreen (başkasının)
- **Route:** `HomeStack/UserProfile`
- **REST:** `GET /v1/users/:username` → `UserPublicApiResponseSchema`
- **Liste:** `GET /v1/posts/user/:userId` (infinite).
- **Aksiyon:** Takip et → `POST /v1/follows/:userId` (`FollowActionResponseSchema`); takipten çık → `DELETE /v1/follows/:userId`.
- **Mesaj gönder:** `POST /v1/conversations` `{ type: 'DIRECT', userIds: [me, them] }` → `Conversation` ekranına geç.
- **Followers/Following sayfası:** `GET /v1/users/:userId/followers` & `/following` (+ `GET /v1/users/me/followers` / `me/following`) — `FollowListPageResponseSchema`.

---

## 6. Map akışı

### 6.1 MapScreen
- **Route:** `MapStack/Map`
- **REST:** `GET /v1/map/nearby` (`NearbyQuerySchema` → `lat`, `lng`, `radiusMeters`, opsiyonel filtreler) → `NearbyRidersResponseSchema` (60 sn cache + manuel refresh).
- **Yardımcı:** `GET /v1/map/shards` (debug paneli için, üretimde gizli).
- **Konum güncelleme:**
  - `useLocationBroadcast` her 15 sn (foreground) `PUT /v1/location/update` (`UpdateLocationSchema`) — throttle 1/s server tarafında.
  - Live session başlat/durdur: `POST /v1/location/session/start` & `/stop`.
  - Sharing modu: `PUT /v1/location/sharing` (`LocationSharingUserResponseSchema`).
- **Parti WS:** `useParty` → `/realtime` namespace, event listesi:
  - **client → server:** `party:join`, `party:leave`, `party:update_location`, `party:send_signal`
  - **server → client:** `party:member_joined`, `party:member_updated`, `party:member_left`, `party:status_changed`, `party:signal_received`, `party:leader_changed`, `party:ended`, `party:error`
- **UI:**
  - Üstte arama+filtre çipleri (motor markası, vites, mesafe).
  - `BottomSheet` (3 snap point): Liste görünümü → seçili rider kartı → parti durumu.
  - `[+ Parti Oluştur]` FAB → CreateParty modal.
  - `[SOS]` butonu → EmergencySos modal (bkz. §17).
- **Boş:** “Çevrede sürücü yok” + “Yarıçapı artır” CTA.
- **Hata:** GPS izni reddedilmişse `EmptyState` + `[Ayarları aç]`.

### 6.2 PartyDetailScreen
- **REST:** `GET /v1/parties/:id` → `PartyDetailSchema`. (NOT: backend route sırası `:id` `invites/me` çakışmasını düzeltir veya client her zaman doğru `id` ile çağırır.)
- **Aksiyon:** Katıl `POST /v1/parties/:id/join`, ayrıl `POST /v1/parties/:id/leave`.
- **Davet et:** `POST /v1/parties/:id/invite` (`InviteToPartySchema`).
- **WS:** `useParty(id)` event akışı yukarıdaki gibi.
- **UI:** Liderin avatarı, üye listesi (canlı konum noktalarıyla), sinyal butonları (`thumbs_up`, `slow_down`, `stop`, `help` — `WsPartySendSignalSchema` enum’ı).

### 6.3 NearbyPartiesScreen
- **REST:** `GET /v1/parties` (`NearbyPartiesQuerySchema`) → `NearbyPartiesResponseSchema` — Map BottomSheet içinde liste sekmesi.

### 6.4 CreatePartyModal (mevcut)
- `POST /v1/parties` (`CreatePartySchema`) — başlık, başlangıç noktası, görünürlük (PUBLIC/PRIVATE), max üye, başlangıç saati. Başarı sonrası direkt `PartyDetail`.

### 6.5 EmergencyDetailScreen
- **REST:**
  - Detay: `GET /v1/emergency/alerts/:id` → `EmergencyAlertDtoSchema`
  - Yanıtla: `POST /v1/emergency/alerts/:id/respond` (`RespondEmergencyAlertSchema`)
  - Çöz: `POST /v1/emergency/alerts/:id/resolve` (`ResolveEmergencyAlertSchema`)
- **WS:** `/emergency` namespace’ine **mobil bağlanmıyor bugün** → eklenecek; subscribe: `emergency:nearby`, `emergency:responder_updated`, `emergency:resolved`.
- **UI:** Harita içinde alert konumu, “Yardıma gidiyorum” butonu (otomatik konum izni iste).

---

## 7. Discover akışı

### 7.1 DiscoverScreen (3 sekme)
- **Sekme 1: Topluluklar**
  - `GET /v1/communities/me` → `CommunitiesMineResponseSchema` (üyesi olduklar)
  - `GET /v1/communities/nearby` (`NearbyCommunitiesQuerySchema`) → `NearbyCommunitiesResponseSchema` (yakındakiler)
  - Arama: **Backend Eksik** (`/v1/communities/search` yok) → şimdilik client‑side filter, sonra eklenir.
- **Sekme 2: Etkinlikler**
  - `GET /v1/events/me`, `GET /v1/events/nearby`
- **Sekme 3: Partiler**
  - `GET /v1/parties` (yakın partiler)
- **CTA:**
  - FAB `+` → ActionSheet: “Topluluk oluştur”, “Etkinlik oluştur”, “Parti oluştur” → ilgili modal.

### 7.2 CommunityDetailScreen
- **REST:**
  - Detay: `GET /v1/communities/:id` → `CommunityDetailSchema`
  - Üyeler: `GET /v1/communities/:id/members` → `CommunityMembersResponseSchema`
  - Bekleyen istekler (admin/mod): `GET /v1/communities/:id/pending` → `CommunityPendingRequestsResponseSchema`
  - Katıl: `POST /v1/communities/:id/join` (`JoinCommunitySchema`) — opsiyonel `joinMessage`
  - Yanıtla istek: `POST /v1/communities/:id/respond-join` (`RespondCommunityJoinSchema`) — admin
  - Ayrıl: `DELETE /v1/communities/:id/leave`
  - Rol değiştir: `POST /v1/communities/:id/members/role` (`UpdateCommunityMemberRoleSchema`)
  - Düzenle: `PUT /v1/communities/:id` (`UpdateCommunitySchema`) — yetki: OWNER/ADMIN
- **Sekme:** “Hakkında | Üyeler | Sohbet | Etkinlikler”
  - “Sohbet” sekmesi: backend’deki `COMMUNITY_CHAT` conversation’ı; eğer yoksa **otomatik** `POST /v1/conversations { type: 'COMMUNITY_CHAT', communityId }` ile oluştur, sonra `Conversation` ekranını göm.

### 7.3 CommunityMembersScreen / CommunityRequestsScreen
- Yukarıdaki listeleri göstermek için ayrı stack ekranları.

### 7.4 CreateCommunityModal *(yeni)*
- `POST /v1/communities` (`CreateCommunitySchema`) — ad, açıklama, görünürlük (`PUBLIC | PRIVATE | INVITE_ONLY`), şehir/lokasyon, kapak medyası (önce media upload chain), max üye sayısı.
- Başarı → `CommunityDetail` push.

### 7.5 EventDetailScreen
- **REST:**
  - `GET /v1/events/:id` → `EventDetailSchema`
  - `GET /v1/events/:id/participants` → `EventParticipantsResponseSchema`
  - `POST /v1/events/:id/rsvp` (`RsvpEventSchema`) — status: `GOING | INTERESTED | NOT_GOING`
  - Düzenle: `PUT /v1/events/:id` (`UpdateEventSchema`) — yetki: oluşturan
  - Sil: `DELETE /v1/events/:id`
- **UI:** Üst kapak, başlık, başlangıç/bitiş, harita önizleme (toplanma noktası), katılımcı avatar listesi, RSVP butonları.

### 7.6 CreateEventModal (mevcut `EventCreateScreen` taşınır)
- `POST /v1/events` (`CreateEventSchema`) — bugünkü ekran ile uyumlu; kapak için media upload chain ekle.
- **DİKKAT:** Bugün ekran `navigation.goBack()` çağırıyor; modal stack’te bu kalır.

---

## 8. Inbox akışı

### 8.1 InboxScreen (3 alt sekme)
- **Mesajlar:** `ConversationsListScreen` (mevcut)
- **Davetler:** `PartyInboxScreen` (mevcut) — `GET /v1/parties/invites/me` → `PartyInvitesMineResponseSchema`
- **Topluluk Sohbetleri:** `GET /v1/conversations?type=COMMUNITY_CHAT` (`ListConversationsQuerySchema`) — sunucu tarafı filtre; client-side filtre gereksiz.

Tab badge: `unreadCount` toplamı + bekleyen davet sayısı.

### 8.2 ConversationsListScreen
- **REST:** `GET /v1/conversations` → `ConversationsListResponseSchema`
- **CTA:** sağ üst `+` → ActionSheet:
  - “Yeni mesaj” → `NewConversationScreen` (kullanıcı arama → seç → DM aç)
  - “Yeni grup” → `NewGroupChatScreen` (çoklu seçim → ad + avatar)
- **Pull‑to‑refresh + WS** (yeni `conversation:created` event ekleyince real-time push).

### 8.3 ConversationScreen
- **REST init:**
  - Konuşma detayı: `GET /v1/conversations/:id` → `ConversationDetailSchema`
  - Mesaj sayfası: `GET /v1/conversations/:id/messages?cursor&limit` (infinite) → `MessageListPageResponseSchema`
  - Okundu işaretle: `POST /v1/conversations/:id/read` (`MarkReadSchema`)
  - Mesaj sil: `DELETE /v1/messages/:id`
  - Reaksiyon: `POST /v1/messages/:id/react` (`ReactMessageSchema`)
- **WS** (`/messaging`):
  - **outgoing:** `conversation:join`, `conversation:leave`, `message:send`, `message:typing`, `message:read`, `message:react`
  - **incoming:** `message:received`, `message:read_by`, `message:reaction_updated`, `message:typing_updated`, `message:deleted`, `message:error`
- **Gönderim:** `useMessaging` hook’u sadece WS `message:send` kullanır; **hata durumunda fallback** `POST /v1/conversations/:id/messages` (`SendMessageSchema`).
- **Form:** `useZodForm(ConversationComposeSchema)` (mevcut).
- **Mesaj bubble:** kendi/başkası, durum noktası (gönderildi/okundu), reaksiyon listesi, long‑press → ActionSheet (kopyala, yanıtla, sil).
- **Loading:** `MessageBubbleSkeleton`.
- **Boş:** Tek başına emoji + “İlk mesajı sen yaz”.

### 8.4 NewConversationScreen / NewGroupChatScreen
- **Backend:** `POST /v1/conversations` (`CreateConversationSchema`)
  - DIRECT: `{ type: 'DIRECT', userIds: [other] }`
  - GROUP_CHAT: `{ type: 'GROUP_CHAT', userIds: [...], title }`
  - COMMUNITY_CHAT: yalnız topluluk akışından otomatik.
- **Kullanıcı arama:** **Backend Eksik** → `/v1/users/search?q=` eklenmeli; geçici olarak takip listesinden seç.

### 8.5 ConversationInfoScreen
- Üye listesi, sessize al, sil/grup terk et — backend’de mute endpoint **yok** (eklenmeli), terk için DM yok, grup için → admin/mod akışı tanımlamak gerekecek (Backend Eksiği).

---

## 9. Profile akışı

### 9.1 ProfileScreen (kendi)
- **REST:** `GET /v1/users/me` → `UserMeResponseSchema`
- **Üst sağ:** Ayarlar simgesi → `Settings`.
- **Sekmeler:** Gönderiler | Garaj | Rozetler | Görevler
  - Gönderiler: `GET /v1/posts/user/:userId` (infinite)
  - Garaj: `GET /v1/motorcycles/me` → `MotorcycleListResponseSchema`
  - Rozetler: `GET /v1/gamification/badges` → `UserBadgesListResponseSchema`
  - Görevler: `GET /v1/gamification/quests` → `UserQuestsListResponseSchema`
- **CTA:**
  - “Profili düzenle” → `EditProfile`
  - “Motor ekle” → `MotorcycleEditor` (create)
  - Rozet üzerinde long‑press → `POST /v1/gamification/badges/showcase` ile vitrine ekle.

### 9.2 EditProfileScreen
- **REST:** `PATCH /v1/users/me` (`UpdateProfileSchema`) → `UserPublicApiResponseSchema`
- **Form alanları (şemaya göre):** `displayName`, `bio`, `city`, `birthDate`, `phone`, `website`, `avatarMediaId`, `coverMediaId`. (`username` YOK — bkz. §20.)
- **Avatar/cover yükleme:** Media upload chain → mediaId → patch.

### 9.3 GarageTab → MotorcycleEditor
- **REST:**
  - List: `GET /v1/motorcycles/me` → `MotorcycleListResponseSchema`
  - Create: `POST /v1/motorcycles` (`CreateMotorcycleSchema`) — `brand`, `model`, `year`, `displacementCc`, `nickname`, `colorHex`, `imageMediaId`
  - Update: `PATCH /v1/motorcycles/:id` (`UpdateMotorcycleSchema`)
  - Delete: `DELETE /v1/motorcycles/:id`
- **Mevcut bug not:** `GarageTab` 2026‑04‑22’de düzeltildi (`/motorcycles/me` + `brand`); blueprint bunu standart kabul ediyor.

### 9.4 BadgesScreen / QuestsScreen
- Liste + filtre (kazanılan / vitrindeki). Quest tamamlanma WS event’i `/gamification` namespace’inden gelecek (eklenecek subscribe).

### 9.5 NotificationsScreen
- **REST:**
  - List: `GET /v1/notifications?cursor&limit` → `NotificationListPageResponseSchema`
  - Unread sayı: `GET /v1/notifications/unread-count` → `NotificationUnreadCountResponseSchema`
  - Okundu işaretle: `POST /v1/notifications/mark-read` (`MarkNotificationReadSchema`)
- **Tipler:** Yeni takipçi, yeni yorum, beğeni, parti daveti, etkinlik hatırlatması, topluluk istekleri, acil durum, badge, quest. Her tip için tıklanınca uygun ekrana git (deep link mantığı).
- **Boş:** “Henüz bildirim yok”.

---

## 10. Settings akışı

### 10.1 SettingsScreen (kök liste)
Bölümler:

| Bölüm | Madde | Hedef ekran | Backend |
|--------|-------|-------------|---------|
| Hesap | Kullanıcı adı | `ChangeUsername` | **EKSİK** |
| Hesap | Şifre | `ChangePassword` | **EKSİK** |
| Hesap | E‑posta | `ChangeEmail` | **EKSİK** |
| Hesap | Bağlı cihazlar | `ConnectedDevices` | `GET/DELETE /v1/devices` |
| Hesap | Hesabı sil | `DeleteAccount` | `/v1/account/deletion` (3 method) |
| Gizlilik | Konum paylaşımı | `LocationSharing` | `PUT /v1/location/sharing` |
| Gizlilik | Engellenmiş kullanıcılar | `BlockedUsers` | **EKSİK** |
| Gizlilik | Veri indir | `DataExport` | **EKSİK** |
| Bildirimler | Push tercihleri | `NotificationPrefs` | (lokal flag + ileride backend) |
| Görünüm | Tema (sistem/aydınlık/karanlık) | inline | lokal |
| Görünüm | Dil (tr/en) | inline | lokal |
| Acil | Acil durum kişileri | `EmergencyContacts` | **EKSİK** |
| Yardım | SSS / İletişim | `Help` | (statik veya CMS) |
| Yardım | Sürüm bilgisi | `About` | — |
| — | **Çıkış yap** | logout flow | `POST /v1/auth/logout` |

### 10.2 ConnectedDevicesScreen
- **REST:**
  - Liste: `GET /v1/devices` → `DevicesListResponseSchema`
  - Sil: `DELETE /v1/devices/:token`
  - **(Background)** Her uygulama açılışında `POST /v1/devices` (`RegisterDeviceTokenSchema`) ile mevcut Expo push token kayıtlı tutulur.
- **UI:** Cihaz adı, OS, son kullanım, “Bu cihazdan çıkış yap”.

### 10.3 LocationSharingScreen
- **REST:** `PUT /v1/location/sharing` (`UpdateLocationSharingSchema`) → `LocationSharingUserResponseSchema`
- **Modlar:** `EVERYONE | FOLLOWERS | PARTY_ONLY | NOBODY` (şemaya bak); modlardan biri seçildiğinde `useLocationBroadcast` davranışı güncellenir.

### 10.4 DeleteAccountScreen
- **REST:**
  - Durum: `GET /v1/account/deletion` → `AccountDeletionStatusSchema`
  - İste: `POST /v1/account/deletion` (`RequestAccountDeletionSchema` — opsiyonel `password`, `reason`)
  - İptal: `DELETE /v1/account/deletion`
- **UX:**
  - Geri sayım göster: `daysRemaining` + `scheduledFor`.
  - Onay metni: “30 gün içinde tekrar giriş yaparsan iptal edilir.”
  - Pending durumdayken `Profile/Edit` butonları disable.
- **NOT:** `DELETE /v1/users/me` ile **karıştırma**. Mobil **sadece** `/account/deletion` 3’lüsünü kullanır; `/users/me` DELETE backend tarafında eski/soft path olarak kalsın.

### 10.5 ChangeUsername / ChangePassword / ChangeEmail
- **Şifre (hazır):** `POST /v1/auth/password/change` + `ChangePasswordSchema` / `ChangePasswordResponseSchema` — başarıda tüm refresh oturumları iptal; mobil access JWT süresi dolana kadar geçerli kalır → kullanıcıya “Diğer cihazlarda yeniden giriş gerekir” + isteğe bağlı `logoutRequest({ allDevices: true })`.
- **Kullanıcı adı / e-posta (BACKEND EKSİK):** navigator’da gizli taslak; uçlar gelince açılır:
  - Username: `PATCH /v1/users/me/username` (`{ username }`) → 409 conflict handling.
  - Email: `POST /v1/auth/email/change` (`{ newEmail, password }`) → doğrulama maili → `POST /v1/auth/email/verify`.

### 10.6 EmergencyContactsScreen *(BACKEND EKSİK)*
- Plan: `GET/POST/DELETE /v1/emergency/contacts` (kişi adı + telefon). SOS tetiklendiğinde bu kişilere SMS/notification.

### 10.7 BlockedUsersScreen *(BACKEND EKSİK)*
- Plan: `GET /v1/blocks`, `POST /v1/blocks/:userId`, `DELETE /v1/blocks/:userId`.

---

## 11. Hikâye / Gönderi / Topluluk / Etkinlik / Parti oluşturma — modal kısa kontrol

| Modal | Backend zinciri | Zod | Notlar |
|-------|-----------------|-----|--------|
| `CreatePost` | media upload chain → `POST /v1/posts` | `CreatePostSchema` → `PostApiResponseSchema` | §5.4 |
| `CreateStory` | media upload chain → `POST /v1/stories` | `CreateStorySchema` → `StoryRowResponseSchema` | mevcut ekrana Zod parse ekle |
| `CreateCommunity` | (kapak için media upload) → `POST /v1/communities` | `CreateCommunitySchema` → `CommunityDetailSchema` | yeni |
| `CreateEvent` | (kapak için media upload) → `POST /v1/events` | `CreateEventSchema` → `EventDetailSchema` | mevcut ekran navigator’a tak |
| `CreateParty` | `POST /v1/parties` | `CreatePartySchema` → `PartySummarySchema` | mevcut |

---

## 12. Acil durum (SOS) akışı

### 12.1 EmergencySosModal
- **Tetik:** Map FAB veya cihaz volume‑down x3 (gelecek).
- **REST:** `POST /v1/emergency/alerts` (`CreateEmergencyAlertSchema`) → `EmergencyAlertDtoSchema` — Throttle 3/10dk.
- **Akış:**
  1. 5 sn geri sayım, iptal butonu.
  2. Konum + son lokasyon + opsiyonel mesaj gönder.
  3. Yanıt geldikten sonra ekran `EmergencyDetail`’a yönlenir.
- **Liste:** `GET /v1/emergency/alerts` → `EmergencyAlertsListResponseSchema` (Profile/Settings altında “Geçmiş” menüsü).

### 12.2 WS gateway (`/emergency`)
- Sosyal yarıçap içindeki riderlar için: `emergency:nearby`, `emergency:responder_updated`, `emergency:resolved`. Mobil `apps/mobile/src/lib/emergency-socket.ts` (yeni) oluşturulup `RootNavigator` içinde authenticated user için bağlanır → push gibi davranır (toast + inApp banner + tap ile detay).

---

## 13. Bildirimler & Push

### 13.1 Expo push kayıt
- İlk authenticated render’da `usePushPrompt` (mevcut) → izin → token al → `POST /v1/devices` (`RegisterDeviceTokenSchema`) → mağaza ID’sini MMKV’ye yaz.
- Logout’ta: `DELETE /v1/devices/:token`.

### 13.2 İçeride badge
- `qk.notificationsUnread` 60 sn polling + WS event geldiğinde manual invalidate.

### 13.3 Push tıklama
- Payload `{ type, target }` → `linking.parseDeepLink` → ilgili stack’e push.

---

## 14. Gamification (`/gamification` WS)

- Subscribe: `quest:completed` ve `badge:earned` → in‑app toast + `qk.myBadges` / `qk.myQuests` invalidate. `apps/mobile/src/lib/gamification-socket.ts` (yeni) oluştur.
- Görsel: confetti animasyonu (rozet kazanımı).

---

## 15. Feature flags & A/B

- Açılışta `GET /v1/feature-flags/evaluate?keys=…` (kullanıcı bazlı) → `FeatureFlagEvaluationSchema`.
- A/B atama: `GET /v1/ab-tests/:key/assignment` → variant.
- Mobilde `useFeatureFlag('home.new-feed-layout')` ve `useAbVariant('home.cta-color')` hook’ları.
- **Kullanım:** Yeni özellikler default olarak kapalı, flag açık olduğunda render — uydurma ekran üretmemenin koruyucusu.

---

## 16. Web‑Admin (Next.js) blueprint kısa kontrol

| Sayfa | Endpoint | Durum |
|-------|----------|-------|
| `/login` | aynı `/v1/auth/login` (admin rolü gerekli) | hazır |
| `/dashboard` | `GET /v1/admin/dashboard/snapshot` | hazır |
| `/reports` | `GET /v1/admin/reports`, `PATCH /v1/admin/reports/:id` | hazır |
| `/users` | `GET /v1/admin/users`, `POST/DELETE ban`, `PATCH role` | hazır |
| `/audit-logs` | `GET /v1/admin/audit-logs` | hazır |
| `/feature-flags` | `GET/POST/DELETE /v1/feature-flags` | hazır |
| `/ab-tests` | `GET/POST/DELETE /v1/ab-tests` | hazır |
| `/live-map` | placeholder | **hayalet — kaldır veya gerçek `GET /v1/map/shards` + admin overlay ile yeniden yaz** |
| `/quests` | placeholder | **hayalet — backend admin endpoint’i yok, eklenmedikçe gizle** |

Web‑admin için aynı çıktı standardı: hayalet sayfa kaldırılacak, sadece backend uçları gerçek olan menüler görünecek.

---

## 17. Backend Eksikleri (frontend hayalet üretmemek için BACKEND’de açılması gereken iş listesi)

| # | Endpoint | Amaç | Zorunlu |
|---|----------|------|---------|
| ~~B1~~ | ~~`POST /v1/auth/password/forgot` + `/reset`~~ | **TAMAMLANDI (2026-04-23)** — `PasswordResetToken` + mail kuyruğu | — |
| ~~B2~~ | ~~`POST /v1/auth/password/change`~~ | **TAMAMLANDI (2026-04-23)** | — |
| ~~B3~~ | ~~`PATCH /v1/users/me/username`~~ | **TAMAMLANDI (2026-04-23)** — 30 gün cooldown + rezerv liste + küçük harf | — |
| ~~B4~~ | ~~`POST /v1/auth/email/change` + `/verify`~~ | **TAMAMLANDI (2026-04-23)** — `pendingEmail` + `EmailChangeToken` + mail kuyruğu | — |
| B5 | `POST /v1/auth/otp/request` + `/verify` | Telefon/email OTP | EVET (Otp ekranı için) |
| ~~B6~~ | ~~`GET /v1/users/search?q=`~~ | **TAMAMLANDI (2026-04-23)** — blok filtresi + sayfalama | — |
| ~~B7~~ | ~~`GET /v1/users/:userId/followers` & `/following`~~ | **TAMAMLANDI (2026-04-23)** — `me/…` kolaylığı + `FollowListPageResponseSchema` | — |
| B8 | `GET/POST/DELETE /v1/blocks` | Engelle | YES |
| B9 | `POST /v1/reports` (post/comment/user/community) | İçerik raporlama | YES |
| B10 | `GET/POST/DELETE /v1/emergency/contacts` | Acil durum kişileri | OPSIYONEL |
| B11 | `GET/POST /v1/notification-preferences` | Bildirim tercihleri | OPSIYONEL |
| B12 | `GET /v1/users/me/data-export` | KVKK / veri indirme | OPSIYONEL |
| B13 | `GET /v1/communities/search?q=` & `/v1/events/search?q=` | Discover arama | YES |
| ~~B14~~ | ~~Posts response `likedByMe`~~ | **TAMAMLANDI (2026-04-23)** — `GET/POST/PATCH` post yanıtları + feed | — |
| B15 | `POST /v1/conversations/:id/mute` & `/leave` | Grup yönetimi | OPSIYONEL |
| ~~B16~~ | ~~`?type=` filtresi `GET /v1/conversations`~~ | **TAMAMLANDI (2026-04-23)** — `ListConversationsQuerySchema` | — |
| B17 | Sosyal giriş (Apple/Google) | İsteğe bağlı | OPSIYONEL |

> Bu liste, frontend’in **hayalet ekran açmaması** için bir koruma kapısıdır. B1–B9 arası **mobil GA için zorunludur**; gerisi v1.1.

---

## 18. Mevcut mobil hatalar/temizlikler (mutlaka düzelt)

1. **`api-client.tryRefresh`** access token’ı yenilemiyor — düzelt (§1.2).
2. **`HomeScreen` like toggle** hâlâ `currentlyLiked: false` sabitliyor — backend `likedByMe` döndürüyor; mobilde `post.likedByMe` kullanılacak şekilde düzelt (F0).
3. **`OtpScreen`** route’u erişilemez — OTP uçları (§17 satırı **B5**) gelene kadar gizle.
4. **`CommunityDetailScreen`, `EventCreateScreen`, `StoryCreateScreen`** yetim — yukarıdaki ağaca bağla.
5. **`SosButton`, `LocationSharingSheet`** kullanılmıyor — ilgili Settings ve Map akışlarına bağla.
6. **`auth.api.logoutRequest` ve `refreshRequest`** import edilmiyor — sırasıyla §3.6 ve §1.2 ile bağla.
7. **`['my-communities']`** invalidation’a karşılık gelen query yok — `qk.myCommunities` ile hizala.
8. **`StoryCreateScreen`** Zod parse’sız POST ediyor — `StoryRowResponseSchema` parse ekle.
9. **`linking.ts`** mevcut yapıyla uyumsuz iç içe path’ler içeriyor — §1.6’daki tabloya göre yeniden yaz.
10. **`account.api.ts`** tamamı kullanılmıyor — `DeleteAccount` ekranına bağla.
11. **`/emergency`** ve **`/gamification`** WS namespace’lerine mobil hiç bağlanmıyor — §12.2 ve §14’e göre subscribe ekle.

---

## 19. Çevrimdışı, performans ve a11y

- React Query `persistQueryClient` (MMKV adapter) → uygulama açılır açılmaz cache’ten render.
- Image: `expo-image` (memory + disk cache).
- FlatList: `getItemLayout`, `removeClippedSubviews`, `windowSize=10`.
- Erişilebilirlik:
  - Tüm dokunulabilirlerde `accessibilityLabel`.
  - Renk kontrastı WCAG AA.
  - Dynamic type desteği (font scaling).
- i18n: tüm yeni metinler `t('namespace.key')` ile (mevcut tek namespace `translation`); tarih/saat `Intl.DateTimeFormat('tr-TR'|'en-US')`.

---

## 20. Güvenlik notları

- Token MMKV’de değil **`expo-secure-store`** içine taşınmalı (orta vadeli iyileştirme).
- 401 sonrası refresh tek seferlik kuyrukla yönetilsin (race koşulu önlemek için `subscribe` pattern).
- Rate limit hatası `429` → kullanıcıya “Çok hızlı işlem” banner.
- Coğrafi konum ekranlarında izin reddedilirse uygulama mantıksal yolu **kırılmadan** devam etsin (Map empty state, MapStack’ı kapatma).

---

## 21. Test & QA matrisi

Her ekran için en az:

- **Unit:** `useZodForm` resolver testi (form validasyon).
- **Hook:** API hook’u happy + error path (msw veya stub `apiRequest`).
- **Component:** snapshot + accessibility (jest-axe-rn).
- **Integration (Detox/Maestro):** Auth flow, Post create, Send DM, Create party, RSVP event, Logout.
- **Contract:** `packages/shared/src/openapi/api-contract.ts` üzerinden response tip eşleştirmesi (TS derlemesi yeterli).

---

## 22. Faz planı (öneri)

| Faz | Süre | Çıktı |
|-----|------|--------|
| **F0 – Düzeltmeler** | 1 sprint | §18 1‑11 düzeltmeleri, navigator yetimleri bağla, MMKV access token, like state, story Zod. |
| **F1 – Settings & Hesap** | 1 sprint | Settings ağacı, ConnectedDevices, DeleteAccount, LocationSharing. |
| **F2 – Discover & Topluluk** | 2 sprint | DiscoverScreen 3 sekme, CommunityDetail tam akış, CreateCommunity modal. |
| **F3 – Etkinlik & Map** | 2 sprint | EventDetail/Create, NearbyEvents, Map BottomSheet 3‑snap, EmergencyDetail + WS. |
| **F4 – Mesajlaşma genişletme** | 1 sprint | NewConversation, NewGroupChat, Community chat sekmesi, message info. |
| **F5 – Backend kilidi açılınca** | 2 sprint | OTP, ChangeUsername/Password/Email, ForgotPassword, BlockedUsers, Report, Search. |
| **F6 – Gamification & Polish** | 1 sprint | `/gamification` WS, badge confetti, quest progress, a11y/perf. |

---

## 23. Kabul kriterleri (genel)

- Bir ekran prod build’ine alınabilmesi için **şu maddelerin tümünü** geçmeli:
  - Backend uç noktası gerçekten yayında ve bu blueprint’te yazılı (uydurma yok).
  - Zod parse ile cevap tipi doğrulanıyor.
  - Loading, Empty, Error, Offline state’leri **gözle** görülüyor.
  - i18n anahtarları tr+en mevcut.
  - A11y label tüm dokunulabilirlerde.
  - Deep link (varsa) çalışıyor.
  - En az 1 hook + 1 component testi yeşil.

Bu blueprint, tek başına **frontend yol haritası**dır; bir ekran burada **yoksa** ya uydurma sayılır ve eklenmez ya da eklenmesi için önce bu dosyaya işlenir.
