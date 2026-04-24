# Motogram — Evde Yapılacaklar Listesi

> İşyerinde tamamladıklarımızın üzerine eve geldiğinde bu dosyadaki adımları
> sırayla uygulayacaksın. Her adımın sonunda kutucuğu işaretlersen kaldığın
> yeri kaybetmezsin. Toplam aktif iş süresi: ~25 dk, geri kalan cloud build
> beklemesi (~15 dk).

> **Güncel (2026-04-24+)**: Mobil hedef artık **`apps/mobile-native` (React Native CLI, Expo yok)**.
> Bu dokümandaki `apps/mobile` / EAS / Mapbox adımları **legacy** kabul edilir.

---

## 0) Elinde olması gereken bilgiler

| Kalem | Değer / Nereden | Durum |
|---|---|---|
| GitHub repo | https://github.com/alnkemre34/motogram | ✅ push edildi |
| Expo e-posta (hesap) | `motogram.social@gmail.com` | [expo.dev](https://expo.dev) → Account → e-postayı buradan güncelle, doğrula |
| Expo kullanıcı adı (slug, `app.json` → `owner`) | `alnkemre` | `eas whoami` ile teyit et; `owner` aynı olmalı |
| Expo password | (Expo hesap şifren) | hatırla |
| Expo project ID | `49c6782e-d363-4910-81aa-eeffb0a0b65a` | ✅ `apps/mobile/app.json`’da (alnkemre hesabı) |
| Expo project slug | `motogram` | ✅ |
| Mapbox PUBLIC token | (Mapbox hesabından `pk.` ile başlayan) | ✅ sende, repoda tutma |
| Mapbox SECRET token | (Mapbox’tan `sk.` ile başlayan, Downloads:Read) | ✅ sende, repoda tutma |
| GitHub PAT (yeni) | Aşağıda oluşturacaksın | ❌ |
| Android Studio + AVD | Evdeki PC’de kurulu | kontrol et |

> **Güvenlik:** Mapbox SECRET token + GitHub PAT’i **repo’ya, Git’e, chat’e
> yazma**. Sadece Windows Credential Manager / EAS secret / şifre yöneticisine.

---

## 1) Evdeki PC’de temel kurulum kontrolü (~3 dk)

PowerShell aç, sırayla çalıştır:

```powershell
# Node 20+ olmalı
node -v

# pnpm 10+ olmalı; yoksa:
npm i -g pnpm@10

# Git kurulu olmalı
git --version

# Android Studio'daki SDK yolu ayarlı mı
$env:ANDROID_HOME
```

`ANDROID_HOME` boşsa Android Studio → **SDK Manager** → “Android SDK Location”
yolunu bak, sistem ortam değişkeni olarak ekle (veya geçici olarak şimdilik
bu session için set et):

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
```

---

## 2) Repo’yu clone et (~1 dk)

```powershell
cd C:\
git clone https://github.com/alnkemre34/motogram.git
cd motogram
```

> `C:\Users\…\Desktop\motogram-fixed` yerine `C:\motogram` altında
> çalışmak Windows path-length sorunlarından kaçınmanı sağlar.

---

## 3) Yeni GitHub PAT oluştur (~2 dk)

1. https://github.com/settings/tokens/new
2. Form:
   - **Note**: `motogram-dev-home`
   - **Expiration**: 90 days
   - **Scopes**:
     - ✅ `repo`
     - ✅ `workflow`
3. **Generate token** → `ghp_...` string’ini kopyala, şifre yöneticisine kaydet.
4. Eski tokenı iptal et: https://github.com/settings/tokens → `ghp_szZf…`
   satırında **Delete** / **Revoke**.

### PAT’i Credential Manager’a kaydet

İlk push denemesinde zaten soracak, ama şimdi proaktif:

```powershell
# Eski cache varsa sil
cmdkey /list | Select-String "github"
cmdkey /delete:git:https://github.com 2>$null

# Test push (bir şey değişmedi ama auth prompt’u tetikleyecek)
cd C:\motogram
git fetch origin
# Prompt açılırsa: username=alnkemre34, password=<YENİ PAT>
```

Bir kez girdikten sonra Windows Credential Manager saklar, bir daha sormaz.

---

## 4) Bağımlılıkları kur (~2 dk)

```powershell
cd C:\motogram
pnpm install

# Shared Zod sözleşme paketini derle (mobile import ediyor)
pnpm --filter @motogram/shared build
```

> `pnpm install` ilk seferde biraz download yapar (~500 MB `node_modules`),
> sonraki seferlerde lockfile hit olduğu için hızlıdır.

---

## 5) EAS CLI kur + login (~3 dk)

```powershell
pnpm add -g eas-cli
eas login
# e-posta: motogram.social@gmail.com  (veya hesapta tanımlı e-posta)
# şifre: Expo hesap şifren

eas whoami
# Çıktı, app.json `owner` ile aynı olmalı ("alnkemre")
```

### Proje bağlantısını doğrula

```powershell
cd C:\motogram\apps\mobile
eas init --id 49c6782e-d363-4910-81aa-eeffb0a0b65a
```

“Project already exists” derse: **y** / onay. Amaç: local app.json ile
Expo cloud’daki proje aynı ID’ye bağlı mı kontrol etmek.

---

## 6) Mapbox secret’larını EAS’e tanımla (~2 dk)

Değerleri **cloud’a** yüklüyorsun, repo’ya değil:

```powershell
cd C:\motogram\apps\mobile

# SECRET token (Downloads:Read scope’lu) — Gradle build için (değeri kendi token’ınla doldur; repoya koyma)
eas secret:create --scope project --name RNMAPBOX_MAPS_DOWNLOAD_TOKEN --value "YOUR_MAPBOX_DOWNLOADS_SECRET_TOKEN"

# PUBLIC token — uygulama runtime’da tile çekerken
eas secret:create --scope project --name EXPO_PUBLIC_MAPBOX_TOKEN --value "YOUR_EXPO_PUBLIC_MAPBOX_TOKEN"

# Doğrula (değerler listelenmez, sadece isim + tarih)
eas secret:list
```

Beklenen çıktı:

```
RNMAPBOX_MAPS_DOWNLOAD_TOKEN   created: …
EXPO_PUBLIC_MAPBOX_TOKEN       created: …
```

---

## 7) İlk Dev Client build’i tetikle (~15 dk cloud bekleme)

```powershell
cd C:\motogram\apps\mobile
eas build --profile development --platform android
```

Terminal çıktısı seni **https://expo.dev/accounts/alnkemre/projects/motogram/builds**
URL’ine yönlendirir. Orada build ilerlemesini canlı izleyebilirsin:

```
[queue] Waiting for available build worker... (0-2 dk)
[install] pnpm install... (~3 dk)
[prebuild] expo prebuild → android/, ios/ üretir... (~1 dk)
[build] Gradle assembleDebug... (~8 dk)
[artifacts] APK yükleniyor... (~1 dk)
```

Başarılıysa:

- Yeşil ✅ “Build successful”
- APK download URL + QR kod

---

## 8) APK’yı emülatöre kur (~2 dk)

Önce Android emulator açık olsun (Android Studio → Device Manager → **Play**).

```powershell
eas build:run --platform android --latest
```

Otomatik olarak:
- En son başarılı dev build’i indirir
- Açık emülatöre `adb install` eder
- Motogram ikonu home screen’de belirir

### Alternatif (manuel)

Expo panel → build sayfası → APK indir → emulator penceresine sürükle-bırak.

---

## 9) Metro başlat + hot reload başlasın (~1 dk)

```powershell
cd C:\motogram
pnpm --filter @motogram/mobile-native start
# Ayrı terminalde (Android):
pnpm --filter @motogram/mobile-native android
```

Terminal’de:
```
› Metro waiting on exp://192.168.x.x:8081
› Press a | open Android
```

Emülatörde **Motogram (dev client)** ikonuna tıkla → Metro bağlanır → splash
→ login ekranı gelir.

**Artık:**
- `.ts/.tsx` değişikliği kaydet → anında hot reload (rebuild YOK)
- Yeni **native** paket eklersen (örn. `pnpm add react-native-foo`) →
  sadece o zaman tekrar `eas build` gerekir

---

## 10) Uçtan-uca smoke test (~10 dk)

VPS backend çalışıyor mu kontrol et:

```powershell
curl http://85.235.74.203/v1/health
# {"status":"ok"} dönmeli
```

Uygulama içinde:

- [ ] **Auth**: Register → Login → ana ekrana düş. `/v1/auth/login` 200.
- [ ] **Map**: Map tab → harita açılır, marker’lar yüklenir. `/v1/map/nearby` 200.
- [ ] **WebSocket**: Mesajlar → conversation aç → mesaj yaz → backend
      `/realtime` log’a düşer.
- [ ] **Media**: Story create → foto seç → upload → görünür.
- [ ] **Hot reload**: `HomeScreen.tsx` içindeki bir text’i değiştir, kaydet,
      emülatörde anında değişiyor mu.

Sorun varsa:
- 401 → token expired → uygulamayı yeniden login yap.
- Network error → emulator `adb reverse tcp:8081 tcp:8081` yap.
- Mapbox tile gelmiyor → `EXPO_PUBLIC_MAPBOX_TOKEN` secret doğru mu / URL
  restriction problemi mi bak.

---

## 11) Build sonrası güvenlik — TOKEN ROTATE

İlk dev build başarılı olup emülatörde çalıştıktan sonra:

1. Chat’e yazdığın Mapbox **SECRET** tokenını ve (varsa eski) **PAT**’i rotate:
   - Mapbox: https://account.mapbox.com/access-tokens/ → eski sk → **Delete** → yeni `sk.` oluştur (Downloads:Read)
   - GitHub: https://github.com/settings/tokens → eski `ghp_szZf…` varsa **Delete**

2. Yeni Mapbox secret’ı EAS’te güncelle:

```powershell
eas secret:delete --name RNMAPBOX_MAPS_DOWNLOAD_TOKEN
eas secret:create --scope project --name RNMAPBOX_MAPS_DOWNLOAD_TOKEN --value "<YENİ sk.>"
```

3. Yeniden bir dev build tetikle (yeni token ile doğrulama):

```powershell
eas build --profile development --platform android
```

---

## 12) Günlük geliştirme döngüsü (bundan sonra)

```powershell
# Sabah
cd C:\motogram
git pull                          # güncellemeleri çek
pnpm install                      # yeni dep varsa
pnpm --filter @motogram/shared build

# Emülatör açık, Metro başlat
pnpm --filter @motogram/mobile-native start

# Çalışırken
# - JS/TS değiştir → hot reload
# - yeni native paket → Android/iOS native rebuild

# Akşam
git add -A
git commit -m "feat: ..."
git push
```

---

## 13) Hızlı sorun giderme tablosu

| Durum | Aksiyon |
|---|---|
| `eas build` Gradle aşamasında 401 | `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` secret yok / yanlış. `eas secret:list` ile bak |
| APK kuruldu ama Metro’ya bağlanmıyor | `adb reverse tcp:8081 tcp:8081` çalıştır |
| `Unable to resolve @babel/runtime` | `metro.config.js` kontrol et, `pnpm install` tekrarla |
| Harita siyah | `EXPO_PUBLIC_MAPBOX_TOKEN` secret yok ya da URL kısıtlaması bundle id’yi tutmuyor |
| 401 her yerden | Access token süresi bitti; uygulamada logout → login |
| `eas login` çalışmıyor | İnternet + Expo status: https://status.expo.dev |
| Port 8081 dolu | PowerShell: `Get-NetTCPConnection -LocalPort 8081 | %{ Stop-Process -Id $_.OwningProcess -Force }` |

---

## 14) Sonraki adım (bu yol haritası biter bitmez)

Dev Client + hot reload stabil çalışmaya başlayınca:

- [ ] Sentry DSN ekle (opsiyonel crash reporting)
- [ ] CI pipeline’a EAS preview build ekle (PR başına)
- [ ] İç test dağıtımı: `eas build --profile preview` → Expo Internal Distribution
- [ ] Store hazırlığı: `eas build --profile production` → AAB → `eas submit`

---

> **Son hatırlatma:** Yukarıdaki komutları kopyalayıp yapıştırırken
> **Mapbox secret token’ı ve GitHub PAT’ı chat’e, repo’ya, `.env` dosyasına
> yapıştırma**. Sadece ilgili EAS secret / Credential Manager / şifre yöneticisi.
