# MOTOGRAM — Ultra Mega Production Specification v4.2

**Sürüm:** 4.2 (Redis GEO + Self‑Hosted Storage — Production Ready)  
**Durum:** İnşa Edilebilir Tam Spesifikasyon — Maliyet Optimizasyonlu ve Yüksek Performanslı  
**Hazırlayan:** Ürün ve Mühendislik Liderliği  
**Doküman Tipi:** Motogram v1 uygulamasının yazılım gereksinimleri, kullanıcı deneyimi, teknik mimari (Redis GEO öncelikli), self‑hosted medya yönetimi, veri modeli, güvenlik, performans, gamification tetikleyicileri, çok dilli bildirim şablonları ve operasyonel detaylarını uçtan uca tanımlayan tek kaynak.

---

## 1. Yönetici Özeti ve Ürün Tanımı

### 1.1 Ürün Adı
**Motogram**

### 1.2 Konsept
Motogram, motosiklet sürücüleri için **harita öncelikli** bir sosyal platformdur. Instagram benzeri bir sosyal akış, gerçek zamanlı grup sürüşü (Need for Speed benzeri HUD), topluluk yönetimi, acil durum asistanı ve garaj koleksiyonu özelliklerini tek bir mobil uygulamada birleştirir.

### 1.3 Temel Değer Önermeleri
- **Keşfet:** Harita üzerinde yakındaki sürücüleri, aktif sürüş partilerini ve etkinlikleri anında gör.
- **Sür:** Parti liderinin belirlediği rotada, tüm üyelerin canlı konumlarını gösteren, dikkat dağıtmayan bir HUD ile grup sürüşü yap.
- **Sosyalleş:** Gönderi paylaş, hikaye ekle, beğen, yorum yap, takip et.
- **Güvende Kal:** Tek dokunuşla (basılı tutarak) acil durum bildirimi gönder ve yakındaki yardımsever sürücülere ulaş.
- **Garajını Yönet:** Sahip olduğun, sattığın veya hayalini kurduğun motosikletleri profilde sergile.
- **Kazan ve İlerle:** Görevleri tamamla, rozetler kazan, seviye atla (güvenli sürüş odaklı).

---

## 2. Kritik Önyüz Mimarisi ve Ekran Spesifikasyonları

Bu bölüm, uygulamanın kullanıcıya dönük yüzünün **değiştirilemez** tasarım ve davranış kurallarını tanımlar.

### 2.1 Global Alt Navigasyon (Tab Bar)
- **Konum:** Ekranın en altı, 5 ana sekme.
- **Öğeler (soldan sağa):**
    1.  **Ana Sayfa** (Feed)
    2.  **Harita** (Keşif / Sürüş)
    3.  **Oluştur (+)** (Overlay menü açar)
    4.  **Mesajlar** (Sohbet)
    5.  **Profil** (Kullanıcı)

### 2.2 Ana Sayfa – “Birebir Instagram Klonu”
Uygulama açıldığında gösterilen ilk ekrandır. Instagram’ın ana akış sayfasının işlevsel ve görsel kopyasıdır.

- **Üst Çubuk (Header):**
  - Sol: Motogram logosu/yazısı.
  - Sağ: Bildirimler (zil) ve Mesajlar (uçak) ikonları.
- **Hikayeler (Stories Rail):**
  - Yatay kaydırılabilir, dairesel profil resimleri.
  - **İçerik:** 24 saatlik geçici medya; konum, garaj ve “sürüşteyim” çıkartmaları desteklenir.
  - **Etkileşim:** Hikayeye dokununca tam ekran açılır, sola/sağa kaydırarak geçiş yapılır.
- **Gönderi Akışı (Post Feed):**
  - Sonsuz kaydırmalı (sayfalama), `react-native-flash-list` ile optimize edilmiş.
  - **Gönderi Kartı Bileşenleri (yukarıdan aşağıya):**
    1.  **Başlık:** Profil resmi, kullanıcı adı, konum etiketi, üç nokta menüsü (şikayet et, paylaş, kaydet).
    2.  **Medya:** Tekil resim veya **yatay kaydırılabilir karusel**. Çift dokunma → beğen.
    3.  **Aksiyon Çubuğu:** Beğen (kalp), Yorum (balon), Paylaş (uçak), Kaydet (yer imi).
    4.  **Beğeni Sayısı:** “X kişi beğendi”.
    5.  **Açıklama:** Kullanıcı adı, gönderi metni, hashtag’ler.
    6.  **Yorumlar Önizleme:** Son 1-2 yorum ve “X yorumun tümünü gör” bağlantısı.
- **Gönderi Detayı (Alt Sayfa – Bottom Sheet):**
  - Herhangi bir gönderiye dokunulduğunda ekranın altından yukarı kayan bir sayfa açılır.
  - Medya daha büyük gösterilir, yorum listesi ve yorum yazma alanı bulunur.

### 2.3 Harita Ekranı – “Uygulamanın Kalbi”
Bu ekran **Segmented Control** (üstte iki seçenek) ile yönetilir: **Keşif** ve **Sürüş**. Harita altlığı her iki modda da tam ekrandır.

#### 2.3.1 Keşif Modu (Discover Mode)
**Amaç:** Etrafındaki motosiklet ekosistemini (sürücüler, partiler, etkinlikler) görsel olarak taramak.

- **Harita:** Kullanıcının konumu mavi nokta ile gösterilir. Diğer pinler seçili filtreye göre kümelenmiş (supercluster) veya tekli gösterilir.
- **Filtre Çubuğu (Haritanın üstünde, sola kaydırılabilir yatay liste):**
  - **Yakındakiler:** Konum paylaşımı açık olan sürücülerin pinleri.
  - **Arkadaşlar:** Sadece karşılıklı takip edilenlerin pinleri.
  - **Partiler:** Aktif sürüş partilerinin özel bayrak/logo pinleri.
  - **Etkinlikler:** Yaklaşan halka açık etkinliklerin pinleri.
- **Filtre Değişiminde Harita Tepkisi:** Filtre değiştiği an harita otomatik olarak görünür alan içindeki yeni pinleri getirir. Yükleme esnasında sağ panelde **iskelet yükleyici (skeleton loader)** gösterilir.
- **Sağ Panel (Açılır/Kapanır Çekmece – Drawer):**
  - Haritanın sağ kenarının ortasında dikey bir tutamak (handle) bulunur.
  - Tutamağa dokununca veya sürükleyince ekranın **sağdan 1/3’ünü kaplayan** bir panel açılır. Panel açıkken harita otomatik olarak `map.setPadding({ right: screenWidth/3 })` ile pinlerin panelin altında kalmasını engeller.
  - **Panel İçeriği (Seçili filtreye göre dinamik):**
    - *Yakındakiler / Arkadaşlar seçiliyken:* En yakındaki 20 sürücünün listesi. Her satırda profil resmi, isim, mesafe ve “Profile Git” ikonu.
    - *Partiler seçiliyken:* Haritadaki aktif partilerin listesi. Her parti kartında **Parti Adı**, **Lider**, **Üye Sayısı** ve **“Katıl”** butonu.
    - *Etkinlikler seçiliyken:* Yakındaki etkinliklerin listesi. Tarih, konum ve **“İncele”** butonu.

#### 2.3.2 Sürüş Modu (Ride Mode)
**Amaç:** Aktif bir sürüş partisindeyken kullanılan, dikkat dağıtmayan, yalnızca parti ve rota odaklı arayüz. **Sadece Parti Üyeleri ve Rota gösterilir.** Diğer tüm harita pinleri gizlenir.

- **Aktivasyon:** Kullanıcı bir partiye katıldığında veya lider “Sürüşü Başlat” dediğinde otomatik geçilir.
- **Harita Görünümü:**
  - **Rota:** Liderin belirlediği rota, turuncu renkte kalın bir çizgi (`Polyline`) ile çizilir.
  - **Parti Üyeleri:** Her üyenin canlı konumu, **yön oku (bearing)** ile gösterilir.
    - **Lider:** Altın sarısı taç ikonu veya özel parlak pin.
    - **Üyeler:** Standart motosiklet ikonu.
- **HUD (Baş Üstü Göstergesi):**
  - **Üstte:** Parti adı ve aktif üye sayısı.
  - **Altta Ortada (3 Büyük Buton – NFS Tarzı):**
    1.  **Yeniden Toplan (Regroup):** Tüm üyelere “Lider sizi bekliyor” sinyali gönderir.
    2.  **Mola (Stop):** Mevcut konuma geçici bir mola işaretçisi bırakır.
    3.  **Yakıt (Fuel):** Yakıt ikmali ihtiyacını bildirir.
- **Sağ Panel (Bu modda da aktif):**
  - Tutamak aynı yerdedir, panel açıldığında şunları gösterir:
    1.  **Üye Listesi:** Partideki herkesin adı, rolü (Lider/Üye) ve varsa yaklaşık mesafesi.
    2.  **Acil Durum Butonu (SOS):** **Basılı tutarak aktifleşen**, kırmızı zeminli büyük buton. (Detaylar Bölüm 4.6’da)
    3.  **Partiden Ayrıl Butonu:** Partiden çıkar ve kullanıcıyı **Keşif Moduna** geri döndürür.
- **Rota Yoksa:** Eğer parti bir rotaya bağlı değilse, HUD’da “Serbest Sürüş” yazar, rota çizgisi gösterilmez.

### 2.4 Oluştur (+) Butonu ve Parti / Topluluk Yönetim Ekranı

#### 2.4.1 + Butonu Davranışı (Alt Sayfa – Action Sheet)
Alt navigasyonun ortasındaki **+** butonuna basıldığında ekranın altından bir **Aksiyon Menüsü** açılır.
- **Seçenekler:**
  1.  **Gönderi Oluştur:** Medya seçme, filtreler, açıklama yazma ve paylaşma akışını başlatır.
  2.  **Hikaye Oluştur:** Doğrudan kamerayı açar.
  3.  **Parti ve Topluluklar:** Kullanıcıyı **Parti ve Topluluklar Ana Ekranına** yönlendirir.

#### 2.4.2 Parti ve Topluluklar Ana Ekranı
- **Üst Kısım:** Segmentli Kontrol → `Partiler` | `Topluluklar`

##### Sekme 1: Partiler
- **Aktif Partim Kartı (Varsa):**
  - Parti adı, lider, üye sayısı.
  - **Butonlar:** `Sürüşe Git` (Harita → Sürüş Modu) | `Ayrıl` (Onay ister).
- **Yakındaki Partiler Listesi:**
  - Her kart: Parti adı, lider, mesafe, üye sayısı.
  - **Katıl Butonu:** Tıklanınca, eğer kullanıcı başka bir partideyse “Aktif partiden ayrılıp buna katılmak istiyor musun?” diye sorar.

##### Sekme 2: Topluluklar (Communities)
- **Topluluklarım:** Kullanıcının üye olduğu kalıcı grupların listesi. Bir topluluğa tıklayınca **Topluluk Detay Sayfası** açılır.
- **Yakındaki Önerilen Topluluklar:** Konum ve ilgi alanına göre listelenir.
  - **Herkese Açık Topluluk:** `Katıl` butonu.
  - **Özel Topluluk (Onay Gerektirir):** `Katılma İsteği Gönder` butonu.

#### 2.4.3 Topluluk Detay Sayfası
- **Başlık:** Kapak fotoğrafı, topluluk adı, açıklama, üye sayısı.
- **İçerik (Sekmeli):**
  - **Duyurular:** Yöneticilerin paylaştığı gönderiler.
  - **Üyeler:** Üye listesi (rolle birlikte).
  - **Etkinlikler:** Bu topluluğa özel etkinlikler.
  - **Sohbet:** Topluluk grup sohbeti (isteğe bağlı).

### 2.5 Mesajlar Ekranı
- **Üst Sekmeler:** `Kişiler` | `Gruplar`
- **Kişiler Sekmesi:** Birebir sohbetlerin listesi. Son mesaj önizlemesi, okunmamış sayısı.
- **Gruplar Sekmesi:** Toplulukların ve etkinliklerin grup sohbetlerinin listesi.
- **Sohbet Odası (Chat Room):**
  - Mesaj baloncukları, okundu bilgisi (çift tik).
  - **Medya Paylaşımı:** Galeriden veya kameradan.
  - **Özel Mesaj Tipleri:** `Rota Daveti`, `Etkinlik Daveti` – özel bir kart olarak gösterilir, tıklanınca ilgili içeriğe yönlendirir.

### 2.6 Profil Ekranı – “Birebir Instagram”
- **Header (Üst Bilgi):**
  - Büyük yuvarlak profil resmi.
  - **İstatistikler:** Gönderi, Takipçi, Takip Edilen sayıları.
  - **Biyografi:** İsim, açıklama, şehir, link.
  - **Aksiyon Butonları:** Kendi profiliyse `Profili Düzenle`, başkasının profiliyse `Takip Et` / `Takip Ediliyor` ve `Mesaj Gönder`.
- **İçerik Sekmeleri (Alt alta, Instagram Reels sekmeleri gibi):**
  1.  **Gönderiler:** 3 sütunlu ızgara. Tıklayınca ilgili gönderi detayı alt sayfası açılır.
  2.  **Garaj:** Eklenen motosikletlerin listesi (ızgara veya liste görünümü). Bir motosiklete tıklayınca **Motosiklet Detay Sayfası** açılır (büyük fotoğraflar, marka/model, takma ad, modifikasyonlar, kilometre ve “Bu motosikletle yapılan sürüşler” listesi).
  3.  **Topluluklar:** Kullanıcının üye olduğu toplulukların logoları/ızgarası.
  4.  **Rozetler:** Kullanıcının kazandığı rozetlerin koleksiyonu.

---

## 3. Teknik Mimari ve Arka Uç Hizmetleri

### 3.1 Teknoloji Yığını (Pazarlıksız)
| Katman          | Teknoloji Seçimi                               |
| :-------------- | :--------------------------------------------- |
| **Mobil**       | React Native (Expo Geliştirme Derlemesi)        |
| **Web Yönetim** | Next.js 14 (App Router), shadcn/ui, Tailwind    |
| **Arka Uç**     | NestJS (TypeScript)                             |
| **Veritabanı**  | PostgreSQL 15+ (PostGIS eklentili) – **sadece kalıcı depolama** |
| **Canlı Konum** | **Redis 7+ (GEO komutları ile)** – yüksek performanslı yakınlık sorguları |
| **Önbellek & Kuyruk** | Redis (BullMQ)                            |
| **Gerçek Zaman**| Socket.IO (WebSocket)                           |
| **Medya Depolama** | **Self‑Hosted MinIO** veya Yerel Dosya Sistemi + **Sharp** optimizasyonu |
| **Altyapı**     | Docker Compose (geliştirme), ECS/Kubernetes (prod)|

### 3.2 Zenginleştirilmiş Veritabanı Şeması (Prisma)
Aşağıdaki şema, önceki sürümlerdeki eksiklikleri gidermiş, **uçtan uca üretim** için optimize edilmiştir.

```prisma
// Kullanıcı ve Ayarlar
model User {
  id                String    @id @default(uuid())
  username          String    @unique
  email             String    @unique
  phoneNumber       String?   @unique
  passwordHash      String?
  name              String?
  bio               String?
  avatarUrl         String?
  coverImageUrl     String?
  city              String?
  country           String?
  ridingStyle       String[]
  isPrivate         Boolean   @default(false)
  locationSharing   LocationSharingMode @default(OFF)
  isVerified        Boolean   @default(false)
  isBanned          Boolean   @default(false)
  followersCount    Int       @default(0)
  followingCount    Int       @default(0)
  postsCount        Int       @default(0)
  xp                Int       @default(0)
  level             Int       @default(1)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  lastSeenAt        DateTime?

  // İlişkiler
  settings          UserSettings?
  liveSession       LiveLocationSession?
  locationPings     LocationPing[]
  motorcycles       Motorcycle[]
  posts             Post[]
  stories           Story[]
  parties           PartyMember[]
  groups            GroupMember[]
  communities       CommunityMember[]
  emergencies       EmergencyAlert[]
  emergencyResponses EmergencyResponder[]
  badges            UserBadge[]
  questProgress     QuestProgress[]
  notifications     Notification[]
  auditLogs         AuditLog[]

  @@map("users")
}

model UserSettings {
  id                String    @id @default(uuid())
  userId            String    @unique
  user              User      @relation(fields: [userId], references: [id])
  language          String    @default("tr")
  unitsMetric       Boolean   @default(true)
  theme             String    @default("system")
  notificationPrefs Json
  privacyPrefs      Json
  mapVisibilityPrefs Json
  safetyPrefs       Json
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@map("user_settings")
}

enum LocationSharingMode {
  OFF
  FOLLOWERS_ONLY
  MUTUAL_FOLLOWERS
  GROUP_MEMBERS
  PARTY_ONLY
  PUBLIC
}

// Garaj
model Motorcycle {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  brand             String
  model             String
  year              Int
  displacement      Int?
  nickname          String?
  photos            String[]
  modifications     String?
  status            BikeStatus @default(ACTIVE)
  isPrimary         Boolean   @default(false)
  mileage           Int?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@map("motorcycles")
}

enum BikeStatus {
  ACTIVE
  SOLD
  WISHLIST
  PROJECT_BUILD
}

// Sosyal Grafik
model Follow {
  id                String    @id @default(uuid())
  followerId        String
  followingId       String
  status            FollowStatus @default(ACCEPTED)
  createdAt         DateTime  @default(now())

  @@unique([followerId, followingId])
  @@map("follows")
}

enum FollowStatus {
  PENDING
  ACCEPTED
  BLOCKED
}

// Gönderiler
model Post {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  caption           String?
  mediaUrls         String[]
  mediaType         MediaType
  routeId           String?
  eventId           String?
  groupId           String?
  likesCount        Int       @default(0)
  commentsCount     Int       @default(0)
  sharesCount       Int       @default(0)
  latitude          Float?
  longitude         Float?
  locationName      String?
  hashtags          String[]
  mentionedUserIds  String[]
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  comments          Comment[]
  likes             Like[]

  @@map("posts")
}

enum MediaType {
  IMAGE
  VIDEO
  CAROUSEL
  ROUTE_RECAP
}

model Story {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  mediaUrl          String
  mediaType         StoryMediaType
  caption           String?
  locationSticker   Json?
  garageSticker     Json?
  viewsCount        Int       @default(0)
  createdAt         DateTime  @default(now())
  expiresAt         DateTime

  views             StoryView[]

  @@map("stories")
}

enum StoryMediaType {
  IMAGE
  VIDEO
}

model StoryView {
  id                String    @id @default(uuid())
  storyId           String
  story             Story     @relation(fields: [storyId], references: [id], onDelete: Cascade)
  viewerId          String
  viewedAt          DateTime  @default(now())

  @@unique([storyId, viewerId])
  @@map("story_views")
}

model Comment {
  id                String    @id @default(uuid())
  postId            String
  post              Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  content           String
  mentionedUserIds  String[]
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@map("comments")
}

model Like {
  id                String    @id @default(uuid())
  postId            String
  post              Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt         DateTime  @default(now())

  @@unique([postId, userId])
  @@map("likes")
}

// Mesajlaşma
model Conversation {
  id                String    @id @default(uuid())
  type              ConversationType
  name              String?
  avatarUrl         String?
  isGroup           Boolean   @default(false)
  groupId           String?
  lastMessageAt     DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  participants      ConversationParticipant[]
  messages          Message[]

  @@map("conversations")
}

enum ConversationType {
  DIRECT
  GROUP_CHAT
  COMMUNITY_CHAT
}

model ConversationParticipant {
  id                String    @id @default(uuid())
  conversationId    String
  conversation      Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  isMuted           Boolean   @default(false)
  lastReadAt        DateTime?
  joinedAt          DateTime  @default(now())

  @@unique([conversationId, userId])
  @@map("conversation_participants")
}

model Message {
  id                String    @id @default(uuid())
  conversationId    String
  conversation      Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderId          String
  sender            User      @relation(fields: [senderId], references: [id], onDelete: Cascade)
  content           String?
  mediaUrls         String[]
  messageType       MessageType @default(TEXT)
  inviteData        Json?
  isDeleted         Boolean   @default(false)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  reactions         MessageReaction[]

  @@map("messages")
}

enum MessageType {
  TEXT
  IMAGE
  VIDEO
  FILE
  RIDE_INVITE
  EVENT_INVITE
  SYSTEM
}

model MessageReaction {
  id                String    @id @default(uuid())
  messageId         String
  message           Message   @relation(fields: [messageId], references: [id], onDelete: Cascade)
  userId            String
  emoji             String
  createdAt         DateTime  @default(now())

  @@unique([messageId, userId, emoji])
  @@map("message_reactions")
}

// Topluluklar (Kalıcı Gruplar) – PARTİLERDEN AYRI
model Community {
  id                String    @id @default(uuid())
  name              String
  description       String?
  avatarUrl         String?
  coverImageUrl     String?
  visibility        CommunityVisibility @default(PUBLIC)
  region            String?
  tags              String[]
  rules             String?
  ownerId           String
  membersCount      Int       @default(0)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  members           CommunityMember[]
  events            Event[]
  conversations     Conversation[]

  @@map("communities")
}

enum CommunityVisibility {
  PUBLIC
  PRIVATE
  HIDDEN
}

model CommunityMember {
  communityId       String
  userId            String
  role              CommunityRole @default(MEMBER)
  status            MemberStatus @default(PENDING)
  joinedAt          DateTime  @default(now())

  @@id([communityId, userId])
  @@map("community_members")
}

enum CommunityRole {
  OWNER
  ADMIN
  MODERATOR
  MEMBER
}

enum MemberStatus {
  PENDING
  ACTIVE
  BANNED
}

// Etkinlikler
model Event {
  id                String    @id @default(uuid())
  title             String
  description       String?
  organizerId       String
  coHostIds         String[]
  groupId           String?
  routeId           String?
  meetingPointLat   Float
  meetingPointLng   Float
  meetingPointName  String
  startTime         DateTime
  endTime           DateTime?
  visibility        EventVisibility @default(PUBLIC)
  difficulty        String?
  distance          Float?
  category          String?
  maxParticipants   Int?
  rules             String?
  participantsCount Int       @default(0)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  participants      EventParticipant[]
  posts             Post[]

  @@map("events")
}

enum EventVisibility {
  PUBLIC
  PRIVATE
  GROUP_ONLY
}

model EventParticipant {
  id                String    @id @default(uuid())
  eventId           String
  event             Event     @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId            String
  rsvpStatus        RsvpStatus @default(GOING)
  checkedIn         Boolean   @default(false)
  joinedAt          DateTime  @default(now())

  @@unique([eventId, userId])
  @@map("event_participants")
}

enum RsvpStatus {
  GOING
  INTERESTED
  NOT_GOING
  WAITLIST
}

// Rotalar
model Route {
  id                String    @id @default(uuid())
  creatorId         String
  name              String
  description       String?
  waypoints         Json
  distance          Float
  estimatedDuration Int
  difficulty        String?
  terrain           String[]
  roadStyle         String[]
  privacy           RoutePrivacy @default(PUBLIC)
  usageCount        Int       @default(0)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  events            Event[]
  posts             Post[]
  parties           Party[]

  @@map("routes")
}

enum RoutePrivacy {
  PUBLIC
  FOLLOWERS_ONLY
  PRIVATE
}

// ============ KRİTİK: CANLI SÜRÜŞ VE KONUM YÖNETİMİ ============
model Party {
  id                String    @id @default(uuid())
  name              String
  leaderId          String
  coLeaderIds       String[]
  routeId           String?
  route             Route?    @relation(fields: [routeId], references: [id])
  eventId           String?
  status            PartyStatus @default(WAITING)
  startedAt         DateTime?
  endedAt           DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  members           PartyMember[]
  locationSessions  LiveLocationSession[]

  @@map("parties")
}

enum PartyStatus {
  WAITING
  RIDING
  PAUSED
  ENDED
}

model PartyMember {
  partyId           String
  userId            String
  role              PartyRole @default(MEMBER)
  isOnline          Boolean   @default(true)
  joinedAt          DateTime  @default(now())
  leftAt            DateTime?

  @@id([partyId, userId])
  @@map("party_members")
}

enum PartyRole {
  LEADER
  CO_LEADER
  MEMBER
}

model LiveLocationSession {
  id                String    @id @default(uuid())
  userId            String    @unique
  user              User      @relation(fields: [userId], references: [id])
  sourceType        SessionSource
  sourceId          String?
  visibilityMode    LocationSharingMode
  startedAt         DateTime  @default(now())
  expiresAt         DateTime
  isActive          Boolean   @default(true)

  pings             LocationPing[]

  @@map("live_location_sessions")
}

enum SessionSource {
  GLOBAL_VISIBILITY
  PARTY
  EMERGENCY
}

model LocationPing {
  id                String    @id @default(uuid())
  sessionId         String
  session           LiveLocationSession @relation(fields: [sessionId], references: [id])
  userId            String
  point             Unsupported("geography(Point,4326)")
  heading           Float?
  speed             Float?
  batteryLevel      Float?
  accuracy          Float?
  timestamp         DateTime  @default(now()) @db.Timestamptz

  @@index([timestamp])
  @@index([point], type: Gist)
  @@map("location_pings")
}

// ============ KRİTİK: ACİL DURUM ============
model EmergencyAlert {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id])
  type              EmergencyType
  description       String?
  point             Unsupported("geography(Point,4326)")
  status            EmergencyStatus @default(ACTIVE)
  createdAt         DateTime  @default(now())
  resolvedAt        DateTime?
  canceledAt        DateTime?

  responders        EmergencyResponder[]
  auditLogs         AuditLog[]

  @@map("emergency_alerts")
}

enum EmergencyType {
  BREAKDOWN
  ACCIDENT
  MEDICAL
  THEFT
  FUEL_SHORTAGE
  UNSAFE_SITUATION
}

enum EmergencyStatus {
  ACTIVE
  ACKNOWLEDGED
  RESOLVED
  CANCELED
}

model EmergencyResponder {
  alertId           String
  userId            String
  status            ResponderStatus @default(NOTIFIED)
  acknowledgedAt    DateTime?
  arrivedAt         DateTime?

  @@id([alertId, userId])
  @@map("emergency_responders")
}

enum ResponderStatus {
  NOTIFIED
  ACKNOWLEDGED
  EN_ROUTE
  ARRIVED
}

// ============ GAMIFICATION ============
model Badge {
  id                String    @id @default(uuid())
  name              String    @unique
  description       String
  iconUrl           String
  rarity            BadgeRarity
  createdAt         DateTime  @default(now())

  userBadges        UserBadge[]
  quests            Quest[]

  @@map("badges")
}

enum BadgeRarity {
  COMMON
  RARE
  EPIC
  LEGENDARY
}

model UserBadge {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  badgeId           String
  badge             Badge     @relation(fields: [badgeId], references: [id], onDelete: Cascade)
  earnedAt          DateTime  @default(now())

  @@unique([userId, badgeId])
  @@map("user_badges")
}

model Quest {
  id                String    @id @default(uuid())
  name              String
  description       String
  type              QuestType
  trigger           QuestTrigger
  targetCount       Int
  rewardXp          Int
  rewardBadgeId     String?
  rewardBadge       Badge?    @relation(fields: [rewardBadgeId], references: [id])
  isDaily           Boolean   @default(false)
  isWeekly          Boolean   @default(false)
  isMonthly         Boolean   @default(false)
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())

  progress          QuestProgress[]

  @@map("quests")
}

enum QuestType {
  RIDE_DISTANCE
  JOIN_EVENTS
  CREATE_POSTS
  INVITE_FRIENDS
  COMPLETE_ROUTES
  HELP_EMERGENCY
  COMPLETE_PROFILE
  ADD_BIKE
  JOIN_COMMUNITY
}

enum QuestTrigger {
  POST_CREATED
  STORY_CREATED
  FOLLOW_GAINED
  EVENT_JOINED
  EVENT_HOSTED
  PARTY_COMPLETED
  PARTY_LEAD
  ROUTE_CREATED
  EMERGENCY_ACKNOWLEDGED
  PROFILE_COMPLETED
  BIKE_ADDED
  COMMUNITY_JOINED
}

model QuestProgress {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  questId           String
  quest             Quest     @relation(fields: [questId], references: [id], onDelete: Cascade)
  currentCount      Int       @default(0)
  isCompleted       Boolean   @default(false)
  completedAt       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@unique([userId, questId])
  @@map("quest_progress")
}

// ============ BİLDİRİMLER ============
model Notification {
  id                String    @id @default(uuid())
  userId            String
  type              NotificationType
  title             String
  body              String
  data              Json?
  isRead            Boolean   @default(false)
  createdAt         DateTime  @default(now())

  @@map("notifications")
}

enum NotificationType {
  FOLLOW
  LIKE
  COMMENT
  MENTION
  MESSAGE
  EVENT_INVITE
  PARTY_INVITE
  EMERGENCY_NEARBY
  QUEST_COMPLETED
  BADGE_EARNED
  GROUP_INVITE
  SYSTEM
}

model NotificationTemplate {
  id                String    @id @default(uuid())
  type              NotificationType
  language          String    @default("tr")
  titleTemplate     String
  bodyTemplate      String
  isActive          Boolean   @default(true)

  @@unique([type, language])
  @@map("notification_templates")
}

// ============ DENETİM ============
model AuditLog {
  id                String    @id @default(uuid())
  actorUserId       String?
  action            String
  targetType        String?
  targetId          String?
  metadata          Json?
  createdAt         DateTime  @default(now())

  @@map("audit_logs")
}

model Report {
  id                String    @id @default(uuid())
  reporterId        String
  targetType        ReportTargetType
  targetId          String
  reason            String
  description       String?
  status            ReportStatus @default(PENDING)
  reviewedBy        String?
  reviewedAt        DateTime?
  createdAt         DateTime  @default(now())

  @@map("reports")
}

enum ReportTargetType {
  USER
  POST
  COMMENT
  MESSAGE
  GROUP
  EVENT
}

enum ReportStatus {
  PENDING
  REVIEWING
  RESOLVED
  DISMISSED
}

3.3 Redis Tabanlı Gerçek Zamanlı Konum Mimarisi (GÜNCELLENDİ)
3.3.1 Redis Veri Yapıları
Anahtar (Key)	Veri Tipi	Açıklama	TTL
user:{userId}:status	Hash	{ online: "true/false", inParty: "partyId|null", privacyMode: "PUBLIC|FOLLOWERS_ONLY|...", lastPing: timestamp }	60 saniye
user_locations	Sorted Set (GEO)	GEOADD user_locations <lng> <lat> <userId>	Yok (aktif kullanıcılar için sürekli güncellenir, 5 dk pasif kalınca ZREM ile silinir)
party:{partyId}:members	Set	Partideki aktif üyelerin userId'leri	Parti bitince silinir
user:{userId}:ping	String	Son konum güncellemesinin timestamp'i	30 saniye
3.3.2 Konum Güncelleme Akışı (Yüksek Performans)
Mobil Uygulama:

Keşif Modu: 15 saniyede bir map:update_location olayı gönderir.

Sürüş Modu: 3-5 saniyede bir party:update_location olayı gönderir.

NestJS Gateway (LocationService):

Gelen koordinatları GEOADD user_locations <lng> <lat> <userId> ile Redis'e yazar.

Kullanıcının durumunu HSET user:{userId}:status online true privacyMode ... olarak günceller.

Eğer inParty doluysa, SADD party:{partyId}:members <userId> ile parti setini günceller. Parti içinde gizlilik bypass edilir: Parti üyeleri birbirini her zaman görür.

Arka Plan Senkronizasyonu (Write‑Behind):

BullMQ'da dakikada bir çalışan cron job:

Redis'teki tüm user_locations üyelerini tarar.

Son 5 dakikada güncellenmiş olanları (user:{userId}:status içindeki lastPing ile kontrol) topluca LocationPing tablosuna INSERT eder.

5 dakikadır güncellenmeyen kullanıcıları ZREM user_locations <userId> ile siler.

Parti ENDED olduğunda, o partiye ait tüm konum geçmişi anında PostgreSQL'e flush edilir ve parti seti silinir.

3.3.3 Yakındaki Sürücüleri Sorgulama (Keşif Modu)

// MapService.getNearbyRiders()
async getNearbyRiders(currentUserId: string, lat: number, lng: number, radius: number = 10000) {
  // 1. Redis'ten ham konumları al (milisaniyeler içinde)
  const nearby = await redis.georadius(
    'user_locations',
    lng, lat,
    radius, 'm',
    'WITHDIST', 'WITHCOORD', 'ASC'
  ) as [string, string, [string, string]][]; // [userId, distance, [lng, lat]]

  if (!nearby.length) return [];

  // 2. Bu kullanıcıların durumlarını pipeline ile topluca çek
  const pipeline = redis.pipeline();
  nearby.forEach(([userId]) => {
    pipeline.hgetall(`user:${userId}:status`);
  });
  const statuses = await pipeline.exec();

  // 3. Gizlilik filtrelemesi
  const visibleUsers = [];
  for (let i = 0; i < nearby.length; i++) {
    const [userId, distance, [lng, lat]] = nearby[i];
    const status = statuses[i][1];
    if (!status || status.online !== 'true') continue;

    // Partide olanlar herkese görünür (gizlilik bypass)
    if (status.inParty) {
      visibleUsers.push({ userId, distance, lat: parseFloat(lat), lng: parseFloat(lng) });
      continue;
    }

    // Partide değilse, privacyMode'a göre kontrol et
    if (await this.canViewBasedOnPrivacy(currentUserId, userId, status.privacyMode)) {
      visibleUsers.push({ userId, distance, lat: parseFloat(lat), lng: parseFloat(lng) });
    }
  }

  return visibleUsers;
}

Performans Karşılaştırması:

PostgreSQL/PostGIS ST_DWithin: 200-500 ms (1000 aktif kullanıcı)

Redis GEORADIUS + Pipeline: < 15 ms (aynı koşullar)

3.4 Self‑Hosted Medya Depolama ve Optimizasyon Mimarisi (GÜNCELLENDİ)
3.4.1 Depolama Katmanı
Birincil Depolama: MinIO (Docker Compose ile ayağa kaldırılmış, S3‑uyumlu API).

Yedekleme: MinIO veri dizini (/data/minio), sunucunun yerel diskine bağlanır ve düzenli olarak rclone veya rsync ile yedeklenir.

Önbellek: Sık erişilen profil resimleri ve gönderi thumbnail'leri için nginx reverse proxy proxy_cache kullanılır.

3.4.2 Görsel Optimizasyon Boru Hattı (NestJS + Sharp)
Kullanıcı bir görsel yüklediğinde:

Geçici Yükleme: Dosya multer ile /tmp/uploads altına kaydedilir.

İşleme (BullMQ Job):

sharp kütüphanesi ile:

WebP'ye dönüştürme: Kalite %85.

Boyutlandırma:

thumbnail: 300x300 px (profil önizlemeleri)

medium: 1080px genişlik (feed gönderileri)

original: opsiyonel olarak saklanır (orijinal çözünürlük)

MinIO'ya Yükleme: İşlenmiş dosyalar MinIO bucket'ına (motogram-media) yazılır.

Veritabanı Kaydı: Post.mediaUrls veya User.avatarUrl alanına MinIO'daki kalıcı URL (örn: http://minio:9000/motogram-media/posts/abc123_medium.webp) yazılır.

Temizlik: /tmp altındaki geçici dosya silinir.

3.4.3 Güvenlik ve Erişim
Doğrudan Erişim Kapalı: MinIO bucket'ı private moddadır.

İmzalı URL (Presigned URL): Frontend bir görseli göstermek istediğinde, backend minioClient.presignedGetObject() ile 1 saat geçerli bir URL üretir. Bu sayede medya linkleri dışarı sızmaz ve yetkisiz erişim engellenir.

Örnek NestJS Servis Metodu:
async getPresignedUrl(objectKey: string): Promise<string> {
  return this.minioClient.presignedGetObject('motogram-media', objectKey, 3600);
}

3.5 Gerçek Zamanlı Olay Sözleşmesi (WebSocket)
Olay Adı (Client → Server)	Yük (Payload)	Açıklama
party:join	{ partyId: string }	Parti odasına katıl
party:leave	{}	Aktif partiden ayrıl
party:update_location	{ lat, lng, heading, speed }	Konum güncellemesi gönder (Sürüş modunda)
party:send_signal	{ type: 'REGROUP'|'STOP'|'FUEL' }	Parti sinyali gönder
Olay Adı (Server → Client)	Yük (Payload)	Açıklama
party:member_updated	{ userId, lat, lng, heading }	Bir üyenin konumu güncellendi
party:member_joined	{ userId, username, avatar }	Partiye yeni üye katıldı
party:member_left	{ userId }	Üye partiden ayrıldı
party:status_changed	{ status: PartyStatus }	Parti durumu değişti
party:signal_received	{ type, senderName }	Sinyal alındı
party:leader_changed	{ newLeaderId }	Lider değişti

3.6 Gamification Tetikleyici Mantığı (Servis Katmanı)

Aşağıdaki tablo, hangi olayın hangi QuestTrigger ile eşleştiğini ve backend'de nasıl işleneceğini tanımlar.

Kullanıcı Aksiyonu	Tetikleyici (QuestTrigger)	İş Kuralı
Gönderi oluşturma	POST_CREATED	Her yeni gönderi için ilerleme +1
Hikaye oluşturma	STORY_CREATED	Günlük görev
Takip edilme	FOLLOW_GAINED	Takipçi sayısı hedefli görevler
Etkinliğe katılma	EVENT_JOINED	Etkinlik katılım sayacı
Etkinlik düzenleme	EVENT_HOSTED	Organizatör görevleri
Parti tamamlama	PARTY_COMPLETED	Parti ENDED olduğunda tüm üyelere
Parti liderliği	PARTY_LEAD	Lidere özel
Rota oluşturma	ROUTE_CREATED	Yeni rota eklendiğinde
Acil duruma yardım	EMERGENCY_ACKNOWLEDGED	EmergencyResponder onayladığında
Profil tamamlama	PROFILE_COMPLETED	Biyografi, şehir vs. doldurulduğunda
Motosiklet ekleme	BIKE_ADDED	Garaja ilk motosiklet
Topluluğa katılma	COMMUNITY_JOINED	Üyelik ACTIVE olduğunda

3.7 Bildirim Şablonları ve Çok Dilli Destek
NotificationTemplate tablosu kullanılarak, her bildirim tipi için dile özgü metinler saklanır.

Örnek Şablonlar (seed.sql):
INSERT INTO notification_templates (type, language, title_template, body_template) VALUES
('FOLLOW', 'tr', '{{followerUsername}} seni takip etti.', 'Profilini görüntülemek için tıkla.'),
('FOLLOW', 'en', '{{followerUsername}} followed you.', 'Tap to view profile.'),
('LIKE', 'tr', '{{likerUsername}} gönderini beğendi.', '{{captionPreview}}...'),
('LIKE', 'en', '{{likerUsername}} liked your post.', '{{captionPreview}}...'),
('COMMENT', 'tr', '{{commenterUsername}} yorum yaptı: {{commentText}}', 'Yanıtlamak için tıkla.'),
('PARTY_INVITE', 'tr', '{{leaderName}} seni {{partyName}} partisine davet etti.', 'Katılmak için tıkla.'),
('EMERGENCY_NEARBY', 'tr', 'Yakınında bir sürücü yardım istiyor.', 'Yardım edebilir misin?'),
('QUEST_COMPLETED', 'tr', 'Görev tamamlandı!', '{{questName}} görevini tamamladın ve {{xp}} XP kazandın.'),
('BADGE_EARNED', 'tr', 'Yeni rozet kazandın!', '{{badgeName}} rozetini kazandın.');

4. Kritik Kullanıcı Akışları ve Edge‑Case Yönetimi
4.1 Parti Lideri Ayrılırsa Ne Olur?
Lider “Ayrıl” butonuna basar.

Sistem partideki diğer çevrimiçi üyeleri kontrol eder.

Başka üye varsa: En eski üye (veya coLeaderIds içindeki ilk kişi) yeni lider atanır. party:leader_changed olayı gönderilir.

Başka üye yoksa: Parti ENDED olur, 1 saat sonra soft-delete olur.

4.2 İnternet Bağlantısı Koptuğunda / Yeniden Bağlanma
Socket.IO exponential backoff ile yeniden bağlanır.

30 saniyeden uzun kopmada kullanıcıya Snackbar ile uyarı gösterilir.

Bağlantı dönünce client son konumunu gönderir, sunucu eksik event'leri göndermez (state günceldir).

4.3 Çevrimdışı (Offline) Mod
Ana Sayfa / Profil: react-query önbelleğinden okunur. Beğeni/yorum kuyruğa alınır.

Harita: “Çevrimdışısınız” mesajı gösterilir, parti işlemleri devre dışıdır.

4.4 Acil Durum (SOS) Yanlış Tıklama Koruması
SOS butonuna basılı tutarak (3 saniye) aktifleşir.

Süre boyunca titreşim ve dairesel ilerleme çubuğu.

Parmak kaldırılırsa iptal edilir.

4.5 Boş Durum (Empty State) Tasarımları
Parti listesi boş: İllüstrasyon + “Yakında aktif parti yok. Hemen bir tane oluştur!” + Parti Oluştur butonu.

Takipçi yok: “Profilini tamamla ve sürücüleri keşfet!” + Keşfet butonu.

5. Güvenlik, Gizlilik ve Uyumluluk
5.1 Konum Gizliliği Politikası (Redis Entegrasyonlu)
Keşif Modu: Kullanıcının privacyMode Redis'ten okunur. Partideyse (inParty dolu) gizlilik bypass edilir. Değilse, privacyMode ve takip ilişkisine göre filtreleme yapılır.

Parti Modu: Parti üyeleri birbirini her zaman görür; Redis'teki party:{partyId}:members seti kullanılır.

5.2 Veri Saklama ve İmha Politikası
Redis Konum Verileri: 5 dakika pasif kalan kullanıcı ZREM ile silinir.

PostgreSQL Arşivi: LocationPing tablosundaki veriler 7 gün sonra silinir (GDPR uyumlu).

Hesap Silme: 30 gün içinde tüm kişisel veriler asenkron olarak silinir.

5.3 Performans Bütçesi ve Metrikler
Metrik	Hedef	Ölçüm Aracı
Soğuk Başlatma	< 2.0 saniye	Firebase Performance
Redis GEORADIUS Sorgusu	< 15 ms	Redis CLI SLOWLOG
Konum Güncelleme Gecikmesi	< 50 ms	Özel metrik
Medya Optimizasyon Süresi	< 2 sn (asenkron)	BullMQ job süresi
Feed Kaydırma	60 FPS	RN Perf Monitor
5.4 Admin Paneli (Next.js) Özellikleri
Rapor kuyruğu (içerik, kullanıcı, mesaj).

Canlı Harita İzleme (Redis'ten anlık konumları okuyarak).

Denetim Kayıtları (Audit Log).

Quest ve Rozet Yönetimi (CRUD).

6. Uygulama Yol Haritası ve Teslimat Planı
Faz	Süre (Tahmini)	Kapsam
1. Temel Sosyal Katman	2 Hafta	Auth, Profil, Garaj, Ana Sayfa (Instagram Klonu), Takip, Beğeni, Yorum
2. Harita ve Redis Konum Motoru	2 Hafta	Harita entegrasyonu, Redis GEO kurulumu, Keşif Modu, Sağ Panel Çekmecesi
3. Sürüş Partisi (NFS Tarzı)	2 Hafta	Parti oluşturma/katılma, WebSocket, Sürüş Modu, Redis parti setleri
4. Topluluklar ve Mesajlaşma	2 Hafta	Topluluklar, Mesajlar (Kişi ve Grup), Profil Sekmeleri (Garaj, Topluluk, Rozet)
5. Acil Durum, Gamification, Medya	1 Hafta	SOS, Quest tetikleyicileri, Sharp optimizasyonu, MinIO kurulumu
6. Yönetim Paneli ve Dağıtım	1 Hafta	Admin paneli, Docker Compose prod yapılandırması, CI/CD

---

7. Üretim Cilaları ve Mühendislik Prensipleri (Kritik Uygulama Notları)

Bu bölüm, ana spesifikasyonda tanımlanmış olmakla birlikte, geliştirme sırasında sıklıkla gözden kaçan veya uygulamanın mağaza reddi, batarya tüketimi ve kullanıcı memnuniyeti açısından **kritik önem taşıyan** mühendislik detaylarını içerir. Aşağıdaki maddeler, kodlama aşamasında **kontrol listesi** olarak kullanılmalıdır.

7.1 Kullanıcı Deneyimi ve Performans Prensipleri

7.1.1 Optimistik UI (Anında Geri Bildirim) – Zorunlu
- **Kapsam:** Beğeni, yorum gönderme, kaydetme, takip etme, parti sinyalleri (`Regroup`, `Stop`, `Fuel`).
- **Prensip:** Kullanıcı bir aksiyonu tetiklediğinde, **sunucudan başarılı yanıt (`200 OK`) dönene kadar beklenmez.** UI anında başarılı varsayılarak güncellenir.
- **Uygulama:** `react-query`'nin `onMutate` callback'i kullanılır. İşlem başarısız olursa, önceki state'e geri döndürülür (`rollback`).
- **Örnek (Beğeni):**
  ```typescript
  const likeMutation = useMutation({
    mutationFn: (postId) => api.likePost(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries(['post', postId]);
      const previousPost = queryClient.getQueryData(['post', postId]);
      queryClient.setQueryData(['post', postId], (old) => ({
        ...old, isLiked: true, likesCount: old.likesCount + 1
      }));
      return { previousPost };
    },
    onError: (err, postId, context) => {
      queryClient.setQueryData(['post', postId], context.previousPost);
      toast.error('Beğeni alınamadı, tekrar dene.');
    },
  });
  
7.1.2 Batarya ve Termal Yönetim – Sürüş Modu İçin Hayati
Sorun: Motosiklet gidonunda güneş altında, ekran sürekli açık ve GPS aktifken telefon aşırı ısınır, şarj hızla biter veya kapanır.

Çözüm: React Native için react-native-device-info veya Expo Device API ile termal durum izlenmelidir.

Kural:

Normal Durum: Konum güncelleme frekansı 3 saniye.

Termal Uyarı (Serious/Critical): Konum güncelleme frekansı otomatik olarak 8-10 saniyeye düşürülür. Kullanıcıya Pil tasarrufu için konum güncelleme sıklığı azaltıldı şeklinde sessiz bir uyarı gösterilir.

Arka Plan Konumu: expo-task-manager ile accuracy: balanced kullanılmalıdır. Sürüş modunda ekran kapansa bile konum paylaşımı devam etmelidir (Foreground Service bildirimi ile).

7.1.3 Deep Linking (Derin Bağlantı) – Büyüme Stratejisi
Amaç: motogram://party/abc123 gibi bir linke tıklayan kullanıcıyı doğrudan ilgili içeriğe götürmek.

Konfigürasyon:

iOS (Info.plist): CFBundleURLSchemes altına motogram eklenir.

Android (AndroidManifest.xml): <data android:scheme="motogram" /> intent-filter'ı eklenir.

Yönlendirme Haritası:

/party/:id -> Harita Ekranı (Sürüş Modu) ve Parti Katılma Diyaloğu.

/user/:username -> Profil Ekranı.

/post/:id -> Gönderi Detayı Alt Sayfası.

/community/:id -> Topluluk Detay Sayfası.

7.2 Mağaza Uyumluluğu ve Yasal Gereklilikler (Red Kriterleri)
7.2.1 Hesap Silme (GDPR / KVKK / Store Politikası) – Zorunlu
Gereksinim: Kullanıcı, uygulama içinden hesabını kalıcı olarak silebilmelidir. Bu buton Ayarlar > Gizlilik > Hesabı Sil yolunda bulunmalıdır.

Backend İşleyişi:

User kaydı deletedAt ile soft-delete yapılır.
BullMQ kuyruğuna DELETE_USER_DATA işi eklenir.
İş kuyruğu 30 gün içinde kullanıcının tüm gönderilerini, mesajlarını, konum geçmişini (LocationPing) ve medyalarını (MinIO'dan) fiziksel olarak siler.
Bu 30 günlük süre içinde kullanıcı tekrar giriş yaparsa, silme işlemi iptal edilir.
7.2.2 İçerik Raporlama ve Engelleme – Zorunlu
UI: Her gönderinin sağ üst köşesindeki üç nokta menüsünde "Şikayet Et" seçeneği bulunmalıdır. Profil sayfasında da "Kullanıcıyı Engelle" ve "Şikayet Et" butonları olmalıdır.

Anında Etki: Bir kullanıcı Engellendiğinde, Block ilişkisi kurulur ve Redis'teki user:{blockedId}:status anında güncellenir. Engellenen kullanıcı, engelleyeni haritada göremez, mesaj atamaz ve profilini görüntüleyemez.

7.2.3 Arka Plan Konum İzni ve Bildirimi – Zorunlu
Sorun: iOS ve Android, arka planda GPS kullanan uygulamaların bunu bir Foreground Service Bildirimi ile kullanıcıya açıklamasını zorunlu kılar.

Uygulama: Sürüş modu aktifken, bildirim çubuğunda Motogram aktif sürüşte. Konumunuz paylaşılıyor. yazmalıdır. Bu bildirime tıklanınca uygulama açılır. Bildirim kapatılırsa, işletim sistemi uygulamanın GPS erişimini kesebilir.

7.3 Veri Tutarlılığı ve Uç Durum Yönetimi
7.3.1 Sinyal Verilerinin Saklanmaması – Performans Optimizasyonu
Kapsam: Regroup, Stop, Fuel butonları.

Prensip: Bu veriler asla veritabanına yazılmamalıdır. Sadece WebSocket odasına (party:{partyId}) party:signal_received event'i olarak yayınlanır.

İstisna: Sadece Acil Durum (SOS) butonu ve Kaza Tespiti (opsiyonel) EmergencyAlert tablosuna kaydedilir ve kalıcıdır.

7.3.2 Soğuk Başlangıç (Cold Start) ve Boş Durum Yönetimi
Harita İlk Yükleme: Kullanıcı haritayı açtığında Redis'te henüz konum verisi yoksa (örneğin sabah erken saatler), ekrana Konum verileri alınıyor... yazıp bir ActivityIndicator göstermek yeterli değildir.

Çözüm: Kullanıcıya proaktif bir mesaj gösterilmelidir: "Etrafta aktif sürücü görünmüyor. Sürüşe çıkan ilk kişi sen ol!" ve altında Parti Oluştur butonu.

7.3.3 Zombi Bağlantı ve Konum Temizliği
Senaryo: Sürücü tünele girdi veya telefon kapandı. Socket bağlantısı koptu ama Redis'teki konumu kaldı.

Temizlik Mekanizması:

Socket disconnect: Sunucu, disconnect event'inde user:{userId}:status içindeki online alanını false yapar.
Periyodik Temizlik: Her dakika çalışan cron job, lastPing değeri 5 dakikadan eski olan kullanıcıları ZREM user_locations ile setten çıkarır.
Parti Odası: Bir partideki kullanıcı 60 saniye boyunca offline kalırsa, party:member_left event'i otomatik tetiklenir ve diğer üyelerin haritasından kaldırılır.
7.3.4 Medya Yükleme Limitleri ve Kuyruk Yönetimi
Dosya Boyutu: multer limiti 15 MB olarak ayarlanmalıdır. Daha büyük dosyalar 413 Payload Too Large hatası almalıdır.

Eş Zamanlı Yükleme: Kullanıcı aynı anda 10 fotoğraf seçerse, her biri için ayrı bir BullMQ işi oluşturulmalıdır. İşler concurrency: 2 ile sırayla işlenmelidir ki sunucu CPU'su şişmesin.

Video İşleme: Video yüklendiğinde ffmpeg (fluent-ffmpeg) ile HLS formatına dönüştürülmeli veya en azından bir poster (thumbnail) resmi oluşturulmalıdır. Video optimizasyonu ağır bir işlemdir, mutlaka ayrı bir kuyrukta (video-processing) ve düşük öncelikte çalıştırılmalıdır.

7.3.5 Güvenlik Duvarı ve Rate Limiting
Konum Ping'i: Bir kullanıcı saniyede 1'den fazla konum ping'i atarsa, IP bazlı geçici engelleme uygulanmalıdır.

Acil Durum Butonu: Bir kullanıcı 10 dakika içinde 3'ten fazla SOS çağrısı yaparsa, hesap otomatik olarak kısıtlı moda alınmalı ve Admin Paneline bildirim düşmelidir (False Alarm Koruması).

Auth Denemeleri: 15 dakikada 5 başarısız giriş -> Hesap geçici kilitlenir.

7.3.6 Ortak Doğrulama (Zod) ve Tip Güvenliği – Mimari Zorunluluk
Amaç: Frontend (React Hook Form) ve Backend (NestJS DTO) doğrulama kuralları arasında tutarsızlık oluşmasını engellemek.

Uygulama: Tüm API sözleşmeleri için Zod şemaları, monorepo içindeki packages/shared dizininde tanımlanmalıdır.

Örnek Yapı:
// packages/shared/src/schemas/post.schema.ts
export const CreatePostSchema = z.object({
  caption: z.string().max(2200).optional(),
  mediaUrls: z.array(z.string().url()).min(1).max(10),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
});
export type CreatePostDto = z.infer<typeof CreatePostSchema>;

Backend Kullanımı: NestJS'te ZodValidationPipe ile entegre edilir.

Frontend Kullanımı: react-hook-form ile zodResolver üzerinden bağlanır. Bu sayede 15MB dosya limiti veya maksimum 10 medya gibi kurallar tek bir yerden yönetilir.

7.3.7 Medya Depolama Klasör Yapısı (MinIO / S3)
Amaç: Yüz binlerce medya dosyası arasında hızlı erişim, kullanıcı bazlı silme işlemleri ve yetkilendirme kolaylığı sağlamak.

Zorunlu Hiyerarşi:
/{bucket-name}/
    /users/{userId}/
        profile/
            avatar_thumbnail.webp
            avatar_medium.webp
            cover_medium.webp
        garage/{motorcycleId}/
            photo1_medium.webp
            photo2_medium.webp
    /posts/{postId}/
        image1_medium.webp
        image2_medium.webp
        video1_hls.m3u8
    /stories/{storyId}/
        story_media.mp4

Uygulama Notu: Dosya isimlendirmesinde asla UUID'yi tek başına kullanmayın. {uuid}_{boyut}_{kalite}.uzantı formatı (örn: a1b2c3_medium_85.webp) hem insan tarafından okunabilir hem de silme scriptleri için kolaylık sağlar.

Veritabanı İlişkisi: Medya URL'leri yalnızca string olarak tutulur. Klasör hiyerarşisi MediaService tarafından yönetilir ve şema seviyesinde bir kısıt değildir.

---

## 8. Production Hardening ve Ölçeklenebilirlik (v4.3 Critical Patch)

Bu bölüm, v4.2 spesifikasyonunda tanımlı sistemin **üretim ortamında yüksek trafik, hata toleransı ve veri tutarlılığı** gereksinimlerini karşılamak için zorunlu olan ek mühendislik katmanlarını tanımlar. Aşağıdaki maddeler, sistemin `enterprise-ready` seviyesine yükseltilmesi için **atlanmaması gereken** yapısal iyileştirmelerdir.

### 8.1 Redis + PostgreSQL Veri Tutarlılığı (Write‑Behind Güvenliği)

#### 8.1.1 Problem
- Redis anlık konum verilerini tutar, PostgreSQL'e yazma işlemi gecikmelidir (cron job ile dakikada bir).
- Bu süreçte sistem çökmesi veya ağ hatası durumunda **veri kaybı** yaşanabilir.

#### 8.1.2 Çözüm: Idempotent Yazma ve Dead Letter Queue
- **Idempotent `LocationPing` Ekleme:**
  ```sql
  ALTER TABLE location_pings ADD CONSTRAINT unique_user_timestamp 
  UNIQUE (user_id, timestamp);
  
  // Insert sırasında ON CONFLICT DO NOTHING kullanılır
await prisma.$executeRaw`
  INSERT INTO location_pings (id, session_id, user_id, point, heading, speed, battery_level, accuracy, timestamp)
  VALUES (${id}, ${sessionId}, ${userId}, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326), ${heading}, ${speed}, ${battery}, ${accuracy}, ${timestamp})
  ON CONFLICT (user_id, timestamp) DO NOTHING;
`;

BullMQ Retry Mekanizması:

location-sync kuyruğu için exponential backoff (1sn, 2sn, 4sn, 8sn, 16sn) ile maksimum 5 yeniden deneme.

5 deneme sonrası başarısız işler location-dead-letter kuyruğuna taşınır.

Parti Flush Güvenliği:

Parti sonlandığında (ENDED), o partiye ait tüm konum verileri tek bir veritabanı transaction'ı içinde yazılır. Başarısızlık durumunda işlem geri alınır ve party-flush kuyruğuna eklenir.

8.2 Parti Lider Seçimi (Deterministik ve Race‑Condition Korumalı)
8.2.1 Problem
v4.2'de lider ayrıldığında "en eski üye" kuralı tanımlıdır, ancak eş zamanlı ayrılmalarda (network partition) çift lider oluşabilir.

8.2.2 Çözüm: Redis Tabanlı Dağıtık Kilit
Seçim Önceliği:

coLeaderIds listesindeki ilk aktif üye.
Partiye katılım sırasına göre en eski aktif üye (joinedAt).
Yukarıdakilerin hiçbiri yoksa, userId hash'ine göre deterministik seçim.

Kilit Mekanizması (Redlock benzeri):
const lockKey = `party:${partyId}:leader_lock`;
const locked = await redis.set(lockKey, newLeaderId, 'NX', 'EX', 5);
if (!locked) {
  throw new Error('Leader election already in progress');
}
// Lider değişikliğini gerçekleştir
await redis.del(lockKey);

Lider değişimi sırasında parti üyelerine party:leader_changed event'i gönderilir.

8.3 Redis GEO Ölçeklenebilirliği (Partitioning)
8.3.1 Problem
v4.2'de tüm kullanıcılar tek bir user_locations Sorted Set'inde tutulur. 100.000+ eş zamanlı kullanıcıda GEORADIUS performansı düşer.

8.3.2 Çözüm: Şehir/Bölge Bazlı Sharding
Anahtar Yapısı:
user_locations:{city}     // Örn: user_locations:istanbul
user_locations:{region}   // Örn: user_locations:marmara

Yazma ve Sorgulama:

Kullanıcı konum güncellediğinde, User.city alanına göre doğru shard'a yazılır.

Keşif sorguları, kullanıcının bulunduğu şehrin shard'ına yönlendirilir. Komşu şehirler için paralel sorgu yapılabilir.

Fallback: v1 için şehir bilgisi olmayan kullanıcılar user_locations:global shard'ında tutulur.

8.4 Socket.IO Yatay Ölçeklenebilirliği (Multi‑Instance)
8.4.1 Problem
NestJS birden fazla instance olarak çalıştırıldığında (örneğin ECS'te 4 task), WebSocket bağlantıları farklı sunuculara dağılır ve birbirinden habersiz olur.

8.4.2 Çözüm: Redis Adapter
Kurulum:
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);

const io = new Server(server, {
  adapter: createAdapter(pubClient, subClient)
});

Yük Dengeleme: AWS ALB veya Nginx, WebSocket bağlantıları için sticky session (IP hash) kullanmalıdır. Redis Adapter sayesinde, A sunucusundaki bir kullanıcı B sunucusundaki odaya mesaj gönderebilir.

8.5 Medya Dağıtımı ve CDN Katmanı
8.5.1 Problem
Self‑hosted MinIO, yüksek çözünürlüklü görselleri her seferinde sunucudan gönderir. Bu hem bant genişliğini tüketir hem de uzak bölgelerde gecikmeye neden olur.

8.5.2 Çözüm: Nginx Cache ve Cloudflare
Nginx proxy_cache Yapılandırması:
proxy_cache_path /var/cache/nginx/motogram levels=1:2 keys_zone=motogram_cache:10m max_size=10g inactive=7d;
server {
  location /media/ {
    proxy_pass http://minio:9000/motogram-media/;
    proxy_cache motogram_cache;
    proxy_cache_valid 200 30d;
    proxy_cache_key "$uri";
    add_header X-Cache-Status $upstream_cache_status;
  }
}

Cache Politikaları:

Profil resimleri: Cache-Control: public, max-age=31536000, immutable

Gönderi görselleri: max-age=604800 (1 hafta)

Hikaye medyaları: max-age=86400 (1 gün)

Opsiyonel Cloudflare: DNS yönlendirmesi yapılarak global CDN ve DDoS koruması sağlanır.

8.6 Kimlik Doğrulama ve Oturum Yönetimi (Refresh Token Flow)
8.6.1 Problem
v4.2'de sadece JWT Access Token tanımlıdır. Uzun süreli oturumlar için Refresh Token mekanizması eksiktir.

8.6.2 Çözüm
Token Süreleri:

Access Token: 15 dakika (kısa ömürlü)

Refresh Token: 7 gün (Redis'te refresh_token:{userId}:{tokenId} olarak saklanır)

Akış:

Login → Access Token + Refresh Token döner.
Access Token expire olduğunda, client /auth/refresh endpoint'ine Refresh Token ile istek atar.
Sunucu Redis'te Refresh Token'ı doğrular ve yeni Access Token üretir.
Logout ve Çoklu Cihaz Yönetimi:

Logout'ta Refresh Token Redis'ten silinir (blacklist).

Kullanıcı "Tüm Cihazlardan Çıkış Yap" dediğinde, refresh_token:{userId}:* pattern'i ile tüm token'ları temizlenir.

8.7 Suistimal ve Spam Koruması
8.7.1 Rate Limiting (Redis + express‑rate‑limit)
Eylem	Limit	Süre
Beğeni	60	dakika
Yorum	30	dakika
Takip Etme	20	dakika
Parti Oluşturma	5	saat
SOS Çağrısı	3	10 dakika
Aşım Durumu: IP ve kullanıcı ID bazlı geçici engelleme (429 Too Many Requests).

Shadow Ban: Spam skoru yüksek kullanıcıların gönderileri ve yorumları sadece kendilerine gösterilir, topluluktan gizlenir (User.shadowBanned flag'i).

8.7.2 Sahte Hesap Tespiti
Çok kısa sürede aşırı takip/beğeni yapan hesaplar flagged_for_review durumuna alınır ve Admin Paneline bildirilir.

8.8 Feed Sıralama Algoritması (Basitleştirilmiş Scoring)
8.8.1 Problem
v4.2'de "light ranking" ifadesi vardır ancak formül tanımlanmamıştır.

8.8.2 Çözüm: Ağırlıklı Skor
SELECT 
  p.*,
  (
    (p.likes_count * 3) + 
    (p.comments_count * 5) + 
    (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600) ^ 0.8 * (-0.5) +
    CASE WHEN f.follower_id IS NOT NULL THEN 10 ELSE 0 END
  ) AS score
FROM posts p
LEFT JOIN follows f ON f.following_id = p.user_id AND f.follower_id = $currentUserId
ORDER BY score DESC
LIMIT 20;

Keşfet Feed'i: Kullanıcının takip etmediği ancak kendi bölgesinde popüler olan gönderiler için benzer bir skor hesaplanır.

8.9 Batarya ve GPS Gerçek Hayat Optimizasyonu (İşletim Sistemi Farkındalığı)
8.9.1 iOS Arka Plan Limitleri
iOS, arka planda sınırsız konum güncellemesine izin vermez. expo-task-manager ile accuracy: kCLLocationAccuracyBestForNavigation kullanılmalı, ancak sistem "location updates paused" uyarısı verdiğinde frekans otomatik düşürülmelidir.

8.9.2 Android Doze Mode
Android 6.0+ Doze modunda ağ ve GPS kısıtlanır. Uygulama, yüksek öncelikli AlarmManager veya WorkManager ile periyodik konum alımı yapmalı, setExactAndAllowWhileIdle kullanılmamalıdır (batarya dostu).

8.9.3 İzin Düşürme (Degrade Mode)
Kullanıcı konum iznini "Sadece uygulama kullanımdayken" seviyesine çekerse, arka plan konum paylaşımı devre dışı kalır. Kullanıcıya bilgi verilmeli ve sürüş sırasında uygulamanın açık kalması gerektiği hatırlatılmalıdır.

8.10 DevOps ve Observability (Gözlemlenebilirlik)
8.10.1 Merkezi Loglama
Tüm servisler (NestJS, Nginx, MinIO) yapılandırılmış JSON logları üretmeli ve Loki veya ELK stack'ine gönderilmelidir.

Log seviyeleri: info (işlemler), warn (rate limit aşımı), error (servis hataları).

8.10.2 Metrik Toplama ve İzleme
Prometheus endpoint'i (/metrics) aşağıdakileri yayınlamalıdır:

http_requests_total (endpoint bazlı)

websocket_connections_active

redis_georadius_duration_seconds

bullmq_jobs_completed_total

emergency_alerts_created_total

Grafana dashboard'ları ile canlı takip.

8.10.3 Uyarı (Alerting) Kuralları

Kural	Eşik	Süre
Yüksek CPU Kullanımı	> %80	5 dakika
Artan 5xx Hataları	> %5	2 dakika
Redis Bağlantı Hatası	> 0	anlık
Emergency Alert Artışı	> 10	1 dakika
Dead Letter Queue Boyutu	> 100	10 dakika

8.11 Ek Mühendislik İyileştirmeleri
8.11.1 Feature Flag Sistemi
Yeni özellikleri kademeli olarak devreye almak için remote config (örneğin Firebase Remote Config veya kendi Redis tabanlı servis) kullanılmalıdır.

Örnek flag'ler: enable_voice_rooms, enable_creator_channels, map_clustering_enabled.

8.11.2 A/B Test Altyapısı
Kullanıcılar userId hash'ine göre deney gruplarına ayrılabilir (A, B). Feed algoritması veya UI değişiklikleri bu gruplara göre ölçümlenmelidir.

8.11.3 API Sürümlendirme
Tüm REST endpoint'leri /v1/ prefix'i ile sunulmalıdır. Yeni geriye dönük uyumsuz değişiklikler /v2/ altında yapılmalıdır.

8.11.4 Soft Delete Standardı
Tüm ana modellerde (User, Post, Comment, Party, Community, Event) deletedAt alanı bulunmalı ve silme işlemleri fiziksel yerine mantıksal yapılmalıdır. Gerçek silme işlemi BullMQ job'ları ile 30 gün sonra gerçekleştirilmelidir.

8.11.5 Veritabanı Migration Stratejisi
Prisma migration'ları geri alınabilir olmalıdır. Her migration için up ve down SQL script'leri ayrıca saklanmalıdır.

## 9. Cursor ve AI Asistanlar İçin "Kusursuzlaştırma" Notları (Uygulama Zorunlulukları)

Geliştirme aşamasında AI kodlama asistanlarının (Cursor vb.) aşağıdaki standartları varsayılan olarak kabul etmesi ve uygulaması zorunludur:

### 9.1 Harita ve Lokasyon Motoru
- **Sağlayıcı:** Harita altyapısı ve özel koyu tema (NFS stili HUD) için **MapLibre (OSM / vektör tile tabanlı)** kullanılacaktır. Google Maps veya Apple Maps default bırakılmamalıdır.
- Harita stilleri, dikkat dağıtmayacak şekilde minimalist ve yüksek kontrastlı (örneğin siyah/koyu gri zemin üzerine altın sarısı/turuncu rotalar) tasarlanmalıdır.

### 9.2 Kimlik Doğrulama (Auth) ve Kayıt Akışı
- **Yöntemler:** Email/Şifre girişine ek olarak, telefon numarası (OTP) ile doğrulama (Firebase Auth vb. üzerinden) desteklenmelidir.
- **Apple Kuralı:** Eğer herhangi bir sosyal giriş (Google vb.) eklenecekse, App Store kuralları gereği "Sign in with Apple" zorunlu olarak entegre edilmelidir.
- **EULA:** Kayıt ekranında zorunlu bir "Kullanıcı Sözleşmesi (EULA)" onay kutusu bulunmalı, EULA'yı kabul etmeyenlerin kaydı engellenmelidir (App Store UGC kuralı).

### 9.3 Anlık Bildirimler (Push Notifications)
- Bildirim altyapısı için **Expo Push Notifications** veya **Firebase Cloud Messaging (FCM)** kullanılmalıdır.
- Kullanıcıya bildirim izni sorulurken, aniden sistem pop-up'ı çıkartmak yerine, öncesinde uygulamanın tasarım diline uygun "Neden bildirim izni istiyoruz?" (örneğin: "Acil durum çağrılarını veya parti davetlerini kaçırmamak için...") açıklamasını içeren bir ön-ekran (Soft Prompt) gösterilmelidir.

### 9.4 Test ve Güvenilirlik Altyapısı
- Kritik iş mantıkları (özellikle Redis konum hesaplamaları, Lider seçimi, Gamification tetikleyicileri) için **Jest** ile unit testler yazılmalıdır.
- Cursor, backend servislerini oluştururken varsayılan olarak hata yakalama (try/catch blokları) ve hata durumunda standart formatta API yanıtı dönme (`{ error: string, code: number }`) prensibini uygulamalıdır.

### 9.5 Çevresel Değişkenler ve Güvenlik (Env Vars)
- Hiçbir API anahtarı / URL (Map style URL, tile provider anahtarları, AWS/MinIO key, Redis URL) koda hardcoded yazılmayacak, kesinlikle `.env` dosyalarından okunacak şekilde yapılandırılacaktır. Cursor, projeyi oluştururken örnek bir `.env.example` dosyası hazırlamak zorundadır.

### 9.6 Frontend State, Storage ve i18n Mimarisisi
- **Global State:** Asenkron veri çekme ve optimistic UI için `react-query` kullanılacak olup, uygulamanın senkron global state yönetimi (UI durumları, aktif filtreler) için kesinlikle **Zustand** kullanılacaktır. Redux veya Context API kullanılmayacaktır.
- **Local Storage:** Cihaz içi veri saklama işlemleri (Oturum token'ları, offline tercihler) için standart AsyncStorage yerine, yüksek performanslı **react-native-mmkv** kullanılmalıdır.
- **Çok Dilli Destek:** Mobil uygulamanın arayüzü `react-i18next` kullanılarak en başından itibaren çok dilli (i18n) mimariye uygun tasarlanacaktır. Hiçbir metin (string) koda doğrudan yazılmayacak, dil dosyalarından okunacaktır.

### 9.7 Altyapı: Monorepo, Paket Yönetimi ve Hata İzleme
- **Workspace:** Proje; `apps/mobile-native` (React Native CLI), `apps/api`, `apps/web-admin` ve `packages/shared` yapısını içeren bir Monorepo olarak kurulacaktır. Bu yapılandırma için paket yöneticisi olarak **pnpm** ve görev koşucusu olarak **Turborepo** kullanılacaktır.
- **Crash Reporting:** Mobil uygulama canlı ortamda çökmeleri ve performans sorunlarını izlemek üzere **Sentry** (sentry-react-native) entegrasyonu ile başlatılmalıdır.

Deployment öncesi staging ortamında migration test edilmelidir.




Bu bölüm, Motogram v4.2 spesifikasyonunun ayrılmaz bir parçasıdır ve geliştirme sürecinde referans alınmalıdır.

Bu doküman, Motogram uygulamasının yazılım yaşam döngüsü boyunca referans alınacak tek yetkili kaynaktır. Redis GEO ve self‑hosted medya mimarisi ile yüksek performans, düşük maliyet ve tam veri kontrolü sağlanmıştır.

Eğer bu dökümana şunları da küçük birer not olarak eklersen, uygulama "kusursuz" olur:

