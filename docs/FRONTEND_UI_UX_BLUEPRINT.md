# Motogram — Frontend UI/UX Blueprint

> Sürüm: 1.7  
> Tarih: 2026-04-24  
> Kapsam: `apps/mobile-native` odaklı frontend şartnamesi, `apps/web-admin` için görünür olmayan backend yüzeyleri notları  
> Ana hedef: mobil uygulamanın ekran, navigasyon, state, veri akışı ve UX davranışlarını backend sözleşmesine birebir oturtmak  
> Tek gerçek kaynaklar:
> - `motogram-spec.md`
> - `docs/API_Contract.md`
> - `packages/shared/src/schemas/*`
> - `apps/mobile-native/src/*` (güncel)
> - `apps/mobile/src/*` (legacy: Expo/EAS + Mapbox)

---

## 1. Amaç

Bu belge, Motogram mobil uygulamasının:

1. Görsel ve etkileşim mimarisini,
2. Navigasyon ağacını,
3. Her ekranın hangi endpoint ile besleneceğini,
4. Hangi backend yüzeylerinin frontend'te görünür olacağını,
5. Hangi backend yüzeylerinin şu an görünmemesi gerektiğini,
6. Hangi alanlarda ürün kalitesini ciddi biçimde artıracak önerilerin uygulanmasını

tek bir yerde toplar.

Bu belge kod üretiminde şu cümleyle kullanılmalıdır:

> "`docs/FRONTEND_UI_UX_BLUEPRINT.md`, `docs/API_Contract.md` ve `packages/shared` şemalarına göre mobil uygulamayı inşa et; bu belgelerde tanımlı olmayan ekran veya endpoint uydurma."

---

## 2. Tasarım ve ürün ilkeleri

### 2.1 Görsel kimlik

- Arka plan: `#0A0F0D` (Abyss Black)
- Vurgu: `#FF8C00` (Neon Amber)
- İkincil: `#00E5FF` (Arctic Teal)
- Tipografi:
  - Başlık ve gövde: `Inter`
  - Sayısal veri, teknik sayaç, mesafe, hız: `Space Mono`

### 2.2 Görsel dil

- Ana atmosfer: karanlık, modern, teknolojik, premium
- Ana hissiyat: "rider HUD + modern sosyal ağ"
- Kart ve panel dili: glassmorphism
- Etkileşim dili: hafif ama kaliteli mikro hareketler
- Aşırı dekoratif değil; yüksek performanslı ve okunabilir

### 2.3 UX prensipleri

- Her ekranda mutlaka `loading`, `empty`, `error` durumu bulunur.
- Her aksiyonun görsel geri bildirimi vardır.
- Her ağ çağrısı için kullanıcı ne olduğunu anlar.
- "Hayalet ekran" yasak: backend'de karşılığı olmayan akış görünmez.
- "Hayalet buton" yasak: dokunulabilir her öğe gerçek bir aksiyona bağlı olur.
- i18n zorunlu: sabit string yok.
- Optimistic UI yalnızca iş kuralları net olan aksiyonlarda kullanılır:
  - beğeni
  - takip
  - mesaj gönderim placeholder
  - bildirim okundu işaretleme

---

## 3. Önerilen modern UI/UX yaklaşımı

Bu bölüm zorunlu mimari değil, kalite önerisidir. Kod üretirken uygulanması önerilir.

### 3.1 Glassmorphism kullanım standardı

Glass efekti tüm ekrana değil, yalnızca şu bölgelerde kullanılmalıdır:

- üst segmented control
- harita sağ paneli / bottom sheet
- feed post kartları
- profil header kartı
- floating action button yüzeyleri
- modal yüzeyleri

Önerilen stil katmanları:

- blur
- yarı saydam koyu dolgu
- ince açık border
- çok hafif iç parlama hissi

Kritik not:

- Uzun metin blokları tam blur üstüne bindirilmemeli.
- Düşük segment Android cihazlarda büyük blur alanları performans riski oluşturur.
- Feed’de tam ekran blur yerine kart bazlı blur tercih edilmelidir.

### 3.2 "Magic" etkileşim standardı

- Tüm butonlar:
  - basınca hafif küçülme
  - bırakınca spring geri dönüş
  - kısa haptic
- Feed like:
  - çift dokunuşta merkezde kısa kalp patlaması
- Sekme geçişleri:
  - yatay kayma + fade
- Harita paneli:
  - sürüklenebilir, momentumlu
- Modal açılışları:
  - alttan yumuşak yükselme
- Başarı aksiyonları:
  - küçük toast + renkli mikro animasyon

### 3.3 Teknik öneriler

Mobil uygulamada modern hissi artırmak için şu kombinasyon çok uygundur:

- `expo-blur`
- `react-native-reanimated`
- `react-native-gesture-handler`
- `expo-haptics`
- `expo-image`
- Map için kesinlikle `@rnmapbox/maps`

Not: Bu belge paket isimlerini zorunlu kılmaz; fakat `motogram-spec.md` içindeki yasak ve zorunlular geçerlidir.

---

## 4. Tek gerçek API ve veri ilkesi

Frontend şu sırayla backend'e bağlanır:

1. `docs/API_Contract.md`
2. `packages/shared` Zod şemaları
3. `apps/mobile/src/api/*.ts`

Kurallar:

- Endpoint yolu contract'ta neyse odur.
- Query param isimleri `packages/shared` şemalarıyla birebir uyumlu olur.
- Body alan adları birebir shared schema ile aynı olur.
- Response parse edilmeden UI state'e sokulmaz.
- Endpoint varsa ama mobilde görünmeyecekse bu belge içinde "görünmeyen backend yüzeyi" olarak belirtilir.

---

## 5. Hedef mobil navigasyon mimarisi

Kullanıcının son isteğine göre hedef yapı **4 ana sekme** olacaktır.

```text
RootNavigator
├─ AuthStack
│  ├─ WelcomeScreen
│  ├─ LoginScreen
│  ├─ RegisterScreen
│  ├─ ForgotPasswordScreen
│  ├─ ResetPasswordScreen
│  ├─ OtpScreen
│  └─ OAuth entry points (Login/Register içinde CTA veya sheet)
│
├─ MainTabNavigator
│  ├─ HomeStack
│  ├─ MapStack
│  ├─ CommunityStack
│  └─ ProfileStack
│
└─ GlobalModalStack
   ├─ StoryViewerScreen
   ├─ CreatePostModal
   ├─ CreateStoryModal
   ├─ CreatePartyModal
   ├─ CreateCommunityModal
   ├─ CreateEventModal
   ├─ NotificationsScreen
   ├─ InboxStack
   ├─ CommentsScreen
   ├─ ConversationScreen
   ├─ EditProfileScreen
   └─ SettingsScreen
```

### 5.1 Tab bar

4 ana sekme:

1. Ana Sayfa
2. Harita
3. Topluluk
4. Profil

### 5.2 Mevcut durumdan hedefe fark

Bugünkü mobil uygulamada `TabNavigator` 5 sekmeli:

- Home
- Discover
- Map
- Inbox
- Profile

Hedef şartnameye göre:

- `Inbox` ayrı tab olmayacak
- `Notifications` da ayrı tab olmayacak
- her ikisi de Home üst bardan açılacak
- `Discover` ile `Community` kavramsal olarak birleştirilecek

Bu dönüşüm ürün tarafında daha temiz ve premium bir bilgi mimarisi sağlar.

---

## 6. AuthStack — ekranlar, endpointler, öneriler

## 6.1 WelcomeScreen

Amaç:

- markayı tanıtmak
- login veya register akışına giriş sağlamak

UI:

- logo
- kısa slogan
- iki ana CTA: `Giriş Yap`, `Hesap Oluştur`
- alt bölümde dil seçici

Backend:

- doğrudan çağrı yok

### Öneri

- Bu ekran minimal tutulmalı.
- Fazla metin yerine hızlı giriş hissi verilmeli.

## 6.2 LoginScreen

Endpoint:

- `POST /v1/auth/login`

İstek:

- `LoginSchema`

Yanıt:

- `AuthResultSchema`

Alanlar:

- `identifier`
- `password`

UI:

- e-posta / kullanıcı adı alanı
- şifre alanı
- giriş butonu
- "şifremi unuttum"
- sosyal giriş butonları (Apple / Google)

Davranış:

- başarıda token kaydedilir
- `GET /v1/users/me` prefetched edilir
- Root, `MainTabNavigator`'a geçer

Hata:

- `invalid_credentials`
- `account_banned`
- `account_deleted`
- rate limit

### Öneri

- Sosyal giriş butonları klasik outline değil, daha premium glass capsule görünümlü olabilir.
- `Apple` butonu iOS'ta öncelikli, `Google` ikinci sırada gösterilebilir.

## 6.3 RegisterScreen

Endpoint:

- `POST /v1/auth/register`

İstek:

- `RegisterSchema`

Yanıt:

- `AuthResultSchema`

Zorunlu alanlar:

- `email`
- `username`
- `password`
- `eulaAccepted: true`
- `preferredLanguage`

Opsiyonel:

- `name`

UI:

- ad soyad
- kullanıcı adı
- e-posta
- şifre
- eula onay kutusu
- dil seçimi

### Kritik uyum notu

Register body içinde `eulaAccepted` zorunludur. Frontend bunu atlayamaz.

## 6.4 ForgotPasswordScreen

Endpoint:

- `POST /v1/auth/password/forgot`

İstek:

- `ForgotPasswordSchema`

Yanıt:

- `ForgotPasswordResponseSchema`

Davranış:

- enumeration yok; kullanıcı var/yok fark etmeden başarı mesajı gösterilir

## 6.5 ResetPasswordScreen

Endpoint:

- `POST /v1/auth/password/reset`

İstek:

- `ResetPasswordSchema`

Yanıt:

- `ResetPasswordResponseSchema`

Akış:

- mail / deep link içindeki token ile açılır

## 6.6 OtpScreen

Endpointler:

- `POST /v1/auth/otp/request`
- `POST /v1/auth/otp/verify`

Şemalar:

- `OtpRequestSchema`
- `OtpVerifySchema`
- `OtpRequestResponseSchema`
- `OtpVerifyResponseSchema`

Kullanım:

- telefon doğrulama
- kayıt sonrası isteğe bağlı güvenlik akışı

## 6.7 Social auth

Endpointler:

- `POST /v1/auth/oauth/apple`
- `POST /v1/auth/oauth/google`

Şemalar:

- `AppleSignInSchema`
- `GoogleSignInSchema`

Kritik not:

- Apple ve Google body’lerinde de `eulaAccepted: true` ve `preferredLanguage` vardır.
- backend yapılandırılmamışsa bu uçlar `503` dönebilir

UI mesajı:

- "Sosyal giriş şu an kullanılamıyor" fallback’i olmalı

---

## 7. Ana sayfa (HomeStack)

## 7.1 Header

Sol:

- Motogram logosu / wordmark

Sağ:

1. Zil → `NotificationsScreen`
2. Uçak → `InboxScreen`

Bu yapı kullanıcı isteğine tam uyumludur.

## 7.2 Stories rail

Endpointler:

- `GET /v1/stories/feed`
- `POST /v1/stories/:storyId/views`

Şemalar:

- `StoryFeedResponseSchema`
- `SuccessTrueSchema`

UI:

- yatay story listesi
- hikayesi olan kullanıcıya teal halka
- dokununca `StoryViewerScreen`

## 7.3 Post feed

Endpointler:

- `GET /v1/posts/feed`
- `POST /v1/likes/:postId`
- `DELETE /v1/likes/:postId`
- `GET /v1/comments/post/:postId`
- `POST /v1/comments`
- `PATCH /v1/comments/:id`
- `DELETE /v1/comments/:id`
- `POST /v1/reports`

Şemalar:

- `PostFeedPageSchema`
- `LikeToggleResponseSchema`
- `CommentListPageResponseSchema`
- `CreateCommentSchema`
- `UpdateCommentSchema`
- `CreateReportSchema`

Kart yapısı:

1. profil alanı
2. medya alanı
3. aksiyon barı
4. beğeni sayısı
5. açıklama
6. yorum önizlemesi

### Kritik backend uyum notları

- `likedByMe` feed item üzerinden kullanılmalı; client kendi state’ini uydurmamalı.
- Yorum gönderiminde response `CommentRowResponseSchema` parse edilmelidir.
- Report akışı vardır; frontend görünmelidir.

### Öneri

- Feed kartı tam glass olabilir, ama medya bölümünde blur kullanılmamalı.
- Like animasyonu kısa ve sert değil, elastik olmalı.
- Yorum açılışı shared-element yerine slide-up comment sheet olarak da tasarlanabilir; daha güvenli ve sürdürülebilir.

## 7.4 Post creation

Endpoint zinciri:

1. `POST /v1/media/uploads`
2. upload URL'e binary yükleme
3. `POST /v1/media/uploads/finalize`
4. `POST /v1/posts`

Şemalar:

- `InitiateMediaUploadSchema`
- `InitiateMediaUploadResponseSchema`
- `FinalizeMediaUploadSchema`
- `MediaAssetDtoSchema`
- `CreatePostSchema`
- `PostApiResponseSchema`

---

## 8. Harita (MapStack)

## 8.1 Genel yapı

Üstte:

- glass segmented control: `Keşif | Sürüş`

Sağda:

- sürüklenebilir panel

Altta:

- harita aksiyon FAB’leri

## 8.2 Keşif modu

Endpointler:

- `GET /v1/map/nearby`
- `GET /v1/parties`
- `GET /v1/events/nearby`
- `GET /v1/communities/nearby`
- `POST /v1/follows/:userId`
- `DELETE /v1/follows/:userId`
- `POST /v1/conversations`
- `POST /v1/parties/:id/join`

Harita query uyumu:

`GET /v1/map/nearby` için şu query mantığı kullanılmalı:

- `lat`
- `lng`
- `radius`
- `filter`
- `limit`
- `city`

Bu alanlar `NearbyQuerySchema` ile uyumludur.

### Kritik not

Mevcut mobil `map.api.ts` zaten:

- `lat`
- `lng`
- `radius`
- `filter`
- `city`

gönderiyor. Bu iyi. Ancak belge düzeyinde bunun zorunlu olduğu açıkça yazılmalıdır.

## 8.3 Sürüş modu

Endpointler:

- `GET /v1/parties/:id`
- `POST /v1/parties/:id/leave`
- `POST /v1/location/session/start`
- `POST /v1/location/session/stop`
- `PUT /v1/location/update`
- `PUT /v1/location/sharing`

WebSocket:

- `/realtime`

Harita davranışı:

- yalnız parti üyeleri görünür
- rota ve lider vurgulanır
- diğer discover pin’leri gizlenir

### Öneri

- Sağ panel aslında "right drawer" yerine geniş ekranlarda sağ panel, dar ekranlarda bottom sheet olabilir.
- Bu hibrit yapı UX kalitesini ciddi artırır.

## 8.4 SOS ve acil durum

Endpointler:

- `POST /v1/emergency/alerts`
- `GET /v1/emergency/alerts`
- `GET /v1/emergency/alerts/:id`
- `POST /v1/emergency/alerts/:id/respond`
- `POST /v1/emergency/alerts/:id/resolve`
- `GET /v1/emergency/contacts`
- `POST /v1/emergency/contacts`
- `DELETE /v1/emergency/contacts/:id`

Görünürlük:

- Map içinde büyük kırmızı SOS butonu
- Settings içinde emergency contacts yönetimi
- geçmiş kayıtları Profile / Settings altından açılabilir

### Öneri

- SOS butonu yanlışlıkla tetiklenmeyecek biçimde basılı tutma veya slide-to-confirm ile çalışmalı.

---

## 9. Topluluk (CommunityStack)

## 9.1 Üst yapı

İki ana bölüm:

1. Topluluk
2. Parti

Bu, kullanıcının istediği CommunityStack yapısıyla uyumludur.

## 9.2 Topluluk bölümü

Endpointler:

- `GET /v1/communities/me`
- `GET /v1/communities/nearby`
- `GET /v1/communities/search`
- `GET /v1/communities/:id`
- `GET /v1/communities/:id/members`
- `GET /v1/communities/:id/pending`
- `POST /v1/communities`
- `PUT /v1/communities/:id`
- `POST /v1/communities/:id/join`
- `DELETE /v1/communities/:id/leave`
- `POST /v1/communities/:id/respond-join`
- `POST /v1/communities/:id/members/role`

### Kritik notlar

- Arama query’si `q` için minimum 2 karakter gerekir.
- `community search` response `CommunitiesSearchResponseSchema` döner; `nearby` ile karıştırılmamalı.

## 9.3 Parti bölümü

Endpointler:

- `GET /v1/parties`
- `POST /v1/parties`
- `GET /v1/parties/:id`
- `POST /v1/parties/:id/invite`
- `POST /v1/parties/:id/join`
- `POST /v1/parties/:id/leave`
- `GET /v1/parties/invites/me`
- `POST /v1/parties/invites/respond`

### Kritik notlar

- `POST /v1/parties` yanıtı `201` + `PartySummarySchema`
- frontend `200` varsaymamalı

### Öneri

- CommunityStack içinde "Topluluk | Parti" üst geçişi swipeable olabilir
- Ama parti detayına girildiğinde kullanıcıyı map sürüş moduna taşımak daha güçlü bir akış olur

---

## 10. Mesajlar (Inbox)

Kullanıcının istediği yapıya göre Inbox tab değil, Home’dan açılan stack/screen olmalıdır.

### 10.0 Bilgi mimarisi (onaylanan UX — v1.2)

Gelen kutusu **üst satırda üç sekme** sunar: **DM** · **Topluluk** · **Parti** (üçüncü sekme, Spec 2.5 parti davet akışıdır).

**Mesaj** tarafı kullanıcının tercih ettiği sade ayrımdır:

- **DM sekmesi (tek ekran, iki bölüm):**
  - **Direkt mesajlar:** `DIRECT` — bire bir sohbetler (liste üstte).
  - **Gruplar:** `GROUP_CHAT` — topluluk dışı arkadaş grupları (aynı sekmede, bire bir listenin *hemen altında*; ayrı bölüm başlığı).
- **Topluluk sekmesi (ayrı ana sekme):** yalnız `COMMUNITY_CHAT` — topluluk kökenli sohbetler. `GROUP_CHAT` bu sekmede **gösterilmez** (kaybolmaz: DM sekmesinde kalır).
- **Parti sekmesi:** `GET /v1/parties/invites/me` / `respond` (mevcut `PartyInboxScreen`).

Böylece “iki ana mesaj ayrımı” (bire bir + gruplar *bir* tarafta, topluluk *öteki* tarafta) korunur; `GROUP_CHAT` ayrı bir üst sekme olmadan erişilebilir kalır.

## 10.1 Liste (REST)

Endpointler:

- `GET /v1/conversations?type=` — B-02 (zorunlu client kullanımı: tip başına ayrı istek veya aynı ekranda paralel sorgu)
- `POST /v1/conversations`
- `GET /v1/parties/invites/me`
- `POST /v1/parties/invites/respond`

Filtre (paylaşılan şema: `ListConversationsQuerySchema`):

- Direkt: `type=DIRECT`
- Gruplar: `type=GROUP_CHAT`
- Topluluk: `type=COMMUNITY_CHAT`

**Not:** Tüm tipler için `ConversationsListResponseSchema` aynıdır; UI bölümlerini sorgu türüne göre birleştirir.

## 10.2 Conversation screen

Endpointler:

- `GET /v1/conversations/:id`
- `GET /v1/conversations/:id/messages`
- `POST /v1/conversations/:id/messages`
- `POST /v1/conversations/:id/read`
- `POST /v1/conversations/:id/mute`
- `POST /v1/conversations/:id/leave`
- `DELETE /v1/messages/:id`
- `POST /v1/messages/:id/react`

WebSocket:

- `/messaging`

### Kritik uyum notları

- `POST /v1/conversations/:id/messages` yanıtı `201` + `MessageSendResponseSchema`
- `POST /v1/conversations/:id/read` yanıtı `204`; body beklenmemeli
- `mute` için request body `MuteConversationSchema`

### Öneri

- Mesaj ekranında her bubble için tamamen glass görünüm yerine daha sade yarı opak yapı daha okunabilir olur.
- Typing indicator ve message status minimal tutulmalı.

---

## 11. Profil (ProfileStack)

## 11.1 Profil ana ekranı

Endpoint:

- `GET /v1/users/me`

Şema:

- `UserMeResponseSchema`

### Kritik not

Bu ekran `UserPublicApiResponseSchema` ile değil, `UserMeResponseSchema` ile parse edilmelidir.

## 11.2 Başka kullanıcı profili

Endpoint:

- `GET /v1/users/:username`

Şema:

- `UserPublicApiResponseSchema`

### Kritik not

Route paramı `:userId` değil `:username`'dır.

### Mobil uygulama (v1.6)

- `AppStack` ekranı **UserProfile** — `GET /v1/users/:username` (`encodeURIComponent`); `AppStack` **ChangePassword** — `POST /v1/auth/password/change` (B-04). Ana feed’de gönderi başlığına dokunma ve hikâye hücresinde **uzun basma** aynı kullanıcının public profilini açar. `motogram://user/:username`, `motogram://settings/password`.
- Takip: `POST/DELETE /v1/follows/:userId` — profilde mevcut. Engel: mevcut `blocks` API ile uyumlu.

## 11.3 Profil sekmeleri

Gönderiler:

- `GET /v1/posts/user/:userId`

Garaj:

- `GET /v1/motorcycles/me`
- `POST /v1/motorcycles`
- `PATCH /v1/motorcycles/:id`
- `DELETE /v1/motorcycles/:id`

Topluluklar:

- `GET /v1/communities/me`

Rozetler:

- `GET /v1/gamification/badges`
- `POST /v1/gamification/badges/showcase`

Görevler:

- `GET /v1/gamification/quests`

## 11.4 Profil düzenleme

Endpoint:

- `PATCH /v1/users/me`

Şema:

- `UpdateProfileSchema`

Gerçek alanlar:

- `name`
- `bio`
- `city`
- `country`
- `ridingStyle`
- `isPrivate`
- `avatarUrl`
- `coverImageUrl`

### Kritik not

- `username` bu endpoint'in parçası değildir
- username değişimi ayrı endpoint’tir

## 11.5 Ayarlar

Endpointler:

- `POST /v1/auth/password/change`
- `POST /v1/auth/email/change`
- `POST /v1/auth/email/verify`
- `PATCH /v1/users/me/username`
- `GET /v1/blocks`
- `POST /v1/blocks/:userId`
- `DELETE /v1/blocks/:userId`
- `GET /v1/devices`
- `POST /v1/devices`
- `DELETE /v1/devices/:token`
- `GET /v1/notification-preferences`
- `PATCH /v1/notification-preferences`
- `PUT /v1/location/sharing`
- `GET /v1/emergency/contacts`
- `POST /v1/emergency/contacts`
- `DELETE /v1/emergency/contacts/:id`
- `GET /v1/account/deletion`
- `POST /v1/account/deletion`
- `DELETE /v1/account/deletion`
- `POST /v1/users/me/cancel-deletion`
- `POST /v1/auth/logout`

### Hesap silme kararı

Frontend tek bir silme akışı seçmelidir:

- önerilen: `/v1/account/deletion` üçlüsü

`DELETE /v1/users/me` kullanıcıya açık ana yol olmamalı; ikincil veya eski yol olarak kalabilir.

### Mobil uygulama (v1.5)

- `AppStack` içinde **Settings** hub; alt ekranlar: profil düzenleme (`PATCH /v1/users/me`), bildirim tercihleri (`GET/PATCH /v1/notification-preferences`), acil kişiler (`/v1/emergency/contacts*`), engellenenler (`GET /v1/blocks`, `DELETE /v1/blocks/:userId`), hesap silme (`/v1/account/deletion*`). **Profil** sekmesinden üst sağda erişim. Derin link: `motogram://settings`, `motogram://settings/profile`, `.../settings/notifications`, `.../settings/emergency`, `.../settings/blocks`, `.../settings/account`. Şifre/e-posta/cihaz yönetimi bu sürümde ayrı ekran olarak eklenmedi (§11.5 endpoint listesi ardıl).

---

## 12. Bildirimler

Görünür endpointler:

- `GET /v1/notifications`
- `POST /v1/notifications/mark-read`
- `GET /v1/notifications/unread-count`
- `GET /v1/notification-preferences`
- `PATCH /v1/notification-preferences`

UX:

- Home header zili
- Profile / Settings içinde tam bildirim ekranı
- unread badge

### Öneri

- Bildirim satırları tür bazlı ikonlarla ayrılmalı:
  - follow
  - like
  - comment
  - community
  - party
  - event
  - emergency
  - badge

---

## 13. Frontend’te görünmeyen ama backend’de olan yüzeyler

Bu bölüm özellikle istendiği için ayrı tutulur.

Bu endpointler backend’de vardır, fakat ana son kullanıcı mobil UI’sinde doğrudan görünmesi gerekmez veya yalnızca dolaylı kullanılır.

### 13.1 Admin-only yüzeyler

- `GET /v1/admin/audit-logs`
- `GET /v1/admin/dashboard/snapshot`
- `GET /v1/admin/reports`
- `PATCH /v1/admin/reports/:id`
- `GET /v1/admin/users`
- `POST /v1/admin/users/:id/ban`
- `DELETE /v1/admin/users/:id/ban`
- `PATCH /v1/admin/users/:id/role`
- `GET/POST/DELETE /v1/feature-flags*` (admin CRUD)
- `GET/POST/DELETE /v1/ab-tests*` (admin CRUD)

Bunlar mobil son kullanıcıda görünmemeli. `apps/web-admin` kapsamındadır.

### 13.2 Operasyonel / sistem yüzeyleri

- `GET /v1/livez`
- `GET /v1/readyz`
- `GET /v1/healthz`
- `GET /v1/metrics`
- `POST /v1/internal/fanout`
- `GET /v1/map/shards`

Not:

- `livez`, `readyz` ve `metrics` son kullanıcı ekranında görünmez.
- `map/shards` yalnızca debug / observability amaçlıdır.

### 13.3 Görünmez ama frontend için stratejik yüzeyler

Bu endpointler kullanıcı tarafından "ekran" olarak görülmez ama uygulama kalitesi için kritik olabilir:

- `POST /v1/auth/refresh`
- `GET /v1/notifications/unread-count`
- `POST /v1/notifications/mark-read`
- `GET /v1/feature-flags/evaluate`
- `GET /v1/ab-tests/:key/assignment`

Bunlar görünmeyen ama ürün davranışını şekillendiren yüzeylerdir.

### 13.4 Henüz görünmeyen ama gösterilebilecek güçlü yüzeyler

Backend’de hazır olup mobilde ürün değeri taşıyan ama çoğu akışta henüz görünmeyen alanlar:

- `GET /v1/users/search`
- `GET /v1/users/:userId/followers`
- `GET /v1/users/:userId/following`
- `GET /v1/users/me/followers`
- `GET /v1/users/me/following`
- `POST /v1/reports`
- `POST /v1/conversations/:id/mute`
- `POST /v1/conversations/:id/leave`
- `GET /v1/emergency/contacts`
- `PATCH /v1/notification-preferences`

Bu yüzeyler frontend’te görünmelidir; şu an eksikse backlog değil, doğrudan UI kapsamıdır.

---

## 14. WebSocket yüzeyleri

Mobil için aktif veya aktif edilmesi gereken namespace’ler:

- `/realtime`
- `/messaging`
- `/gamification`
- `/emergency`

### 14.1 Zorunlu görünür kullanım

- `/realtime`: sürüş modu / parti üyeleri
- `/messaging`: sohbet

### 14.2 Önerilen görünür kullanım

- `/gamification`: anlık rozet / görev tamamlama
- `/emergency`: yakın SOS bildirimi

**Uygulama notu (mobil, 2026-04-23):** P7.1 kapsamında `/realtime` tarafında `party:status_changed` istemci store ile senkronize edildi; el sıkışmasında `auth` için Socket.IO `auth(cb)` biçimi kullanılarak reconnect sonrası güncel JWT ile uyum hedeflendi. **P7.2:** `/messaging` — `conversation:join` yeniden bağlantıda; `message:received` birleştirme + `message:error` (optimistic hata); `message:read_by` + sohbet detayı `lastReadAt` tohumu ile son giden mesajda okundu metni; sohbet ekranı i18n. **P7.3 / P7.4:** `/gamification` ve `/emergency` için ayrı Socket.IO istemcileri; `quest:completed` / `badge:earned` ve `emergency:*` olaylarında global üst toast (`realtime.*` i18n) + ilgili `react-query` invalidation. **AppState:** arka planda gamification/emergency disconnect; `/messaging` konuşmasında `conversation:leave` + yazıyor temiz, ön planda yeniden `join`. Tam P7: `docs/FRONTEND_IMPLEMENTATION_ROADMAP.md` §8.

---

## 15. Mevcut mobil uygulamadan hedefe geçiş farkları

Bugünkü mobil taramada görülen önemli farklar:

1. `RootNavigator` şu an yalnız auth var/yok bazlı basit ayrım yapıyor; global modal yapısı yok.
2. `TabNavigator` **4 sekmeli**; `Inbox` `AppStack` içinde (v1.2+).
3. `HomeScreen` şu an:
   - story rail: `GET /v1/stories/feed`, kullanıcı başına halka, `StoryViewer` + `POST .../views`
   - üst barda Gelen / Bildirim; `GET /v1/notifications/unread-count` rozeti
   - feed beğenisi `likedByMe` + optimistik `likedByMe` güncellemesi
   - **video hikâye:** `expo-av` tam ekran oynatıcı (mobil; hata/fallback i18n)
4. `InboxStack` ayrı root ekran: **DM** + **Topluluk** + **Parti**; B-02; cam üst sekmeler.
5. `ProfileScreen` şu an:
   - üst sağda ayarlar (Settings) ile `AppStack` hub’a gider (v1.5+)
   - logout doğrudan profil altında (ayrıca hesap silme ekranında da)
   - gönderiler sekmesi yok; topluluk keşfi **Community (Discover) sekmesinde** (v1.7+)
6. `MapScreen` zaten en olgun alanlardan biri; fakat son hedefte UI polish ve right-panel davranışı daha net tanımlanmalı.

Bu farklar belgeye göre giderilmelidir.

---

## 16. Ekran bazlı API eşleşme matrisi

| Ekran | Endpointler | Durum |
|------|-------------|-------|
| Welcome | yok | ürün |
| Login | `/v1/auth/login` | hazır |
| Register | `/v1/auth/register` | hazır |
| ForgotPassword | `/v1/auth/password/forgot` | hazır |
| ResetPassword | `/v1/auth/password/reset` | hazır |
| OTP | `/v1/auth/otp/request`, `/v1/auth/otp/verify` | hazır |
| Home Feed | `/v1/posts/feed`, `/v1/likes/:postId`, `/v1/comments*`, `/v1/stories/feed` | hazır |
| Notifications | `/v1/notifications*`, `/v1/notification-preferences*` | hazır |
| Map Discover | `/v1/map/nearby`, `/v1/parties`, `/v1/events/nearby`, `/v1/communities/nearby` | hazır |
| Ride Mode | `/v1/parties/:id`, `/v1/parties/:id/leave`, `/v1/location/*`, WS `/realtime` | hazır |
| Community (Discover) | `/v1/communities/nearby`, `/me`, `/search`, `/:id`, `/:id/join`… | uygulandı (v1.7) |
| Inbox | `GET /v1/conversations?type=` (DIRECT, GROUP_CHAT, COMMUNITY_CHAT), diğer `/v1/conversations*`, `/v1/messages*`, `/v1/parties/invites*`, WS `/messaging` | A2 uygulandı (v1.2) |
| Profile | `/v1/users/me`, `/v1/users/:username`, `/v1/posts/user/:userId`, `/v1/motorcycles*`, `/v1/gamification*` | hazır |
| Settings | `/v1/auth/password/change`, `/v1/auth/email/*`, `/v1/users/me/username`, `/v1/blocks*`, `/v1/devices*`, `/v1/account/deletion*`, `/v1/emergency/contacts*` | P5: tercihler + acil + blocks + hesap silme + `PATCH /users/me`; şifre/e-posta/cihaz ardıl |

---

## 17. Önerilen ürün kararları

### 17.1 Bilgi mimarisi

- 4 tab yapısı daha iyi.
- Inbox ve Notifications’ın Home üst barına taşınması doğru karar.
- Community + Party aynı sekme altında tutulabilir.

### 17.2 Modern premium görünüm için

- Karanlık tema sabit
- Tek accent rengi `Neon Amber`
- İkincil vurgular `Arctic Teal`
- Feed ve map panelinde glass, sohbet ekranında daha sade yüzey

### 17.3 Teknik kalite için

- Tüm API katmanı `query-keys` standardına bağlanmalı
- tüm response’lar Zod parse edilmeli
- auth refresh tek merkezde yönetilmeli
- feature flags mobilde gerçekten kullanılmalı

### 17.4 Öncelik önerisi

İdeal uygulama sırası:

1. Auth tamamlama
2. Home polish
3. 4-tab navigasyon dönüşümü
4. Inbox genişletme
5. Profile + Settings tamamlama
6. Community/Party polish
7. Gamification realtime
8. Emergency polish

---

## 18. Kabul kriterleri

Bir frontend ekranı bu belgeye göre "tamamlandı" sayılabilmesi için:

- ilgili endpoint gerçekten contract’ta olmalı
- request body shared schema ile eşleşmeli
- response shared schema ile parse edilmeli
- loading/empty/error state olmalı
- i18n olmalı
- erişilebilir dokunulabilir öğeler olmalı
- navigation hedefi gerçek olmalı
- kullanıcı aksiyonu backend’e bağlanmış olmalı

---

## 19. Son karar

Bu belgeye göre Motogram mobil frontend:

- backend’e %100 yakın hizalanmış,
- modern premium görsel dile sahip,
- son kullanıcı için net,
- geliştirici için uygulanabilir,
- hayalet ekran ve hayalet endpoint üretmeyen

bir ürün blueprint’ine sahip olur.

Bu dosya frontend üretimi için yeterli ana şartnamedir; fakat implementasyon sırasında her zaman:

- `docs/API_Contract.md`
- `packages/shared`
- `motogram-spec.md`

ile çapraz kontrol zorunludur.
