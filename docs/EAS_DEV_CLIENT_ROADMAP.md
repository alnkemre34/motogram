# Motogram — EAS Build + Dev Client Yol Haritası

> Amaç: Windows’ta yerel native build (Gradle/CMake/NDK/path-length) sorunlarından
> tamamen kurtulup, **hot reload** ile geliştirmeye devam etmek. Mevcut mobil kodu
> baştan yazmıyoruz — sadece build adımını **Expo cloud (EAS)**’a taşıyoruz.
>
> `.cursorrules` Madde 3 (React Native + Expo) ve `apps/mobile/eas.json` bu yol
> haritasıyla %100 uyumludur.

---

## 0. Ön Gereklilikler (Kullanıcı, ~5 dk)

- [ ] **Expo hesabı** (ücretsiz): https://expo.dev/signup
      - Giriş e-postası: `motogram.social@gmail.com` (tercih; [expo.dev](https://expo.dev) → Account’tan e-posta/şifre).
      - `apps/mobile/app.json → owner: "alnkemre"`: bu alan **Expo kullanıcı adı (slug)**, e-posta değil. Eşleşmeyi `eas whoami` ile doğrula.
- [ ] **Mapbox tokenları** (https://account.mapbox.com → Tokens):
      - **SECRET / Downloads:Read** scope’lu token → `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`
      - **PUBLIC** token → `EXPO_PUBLIC_MAPBOX_TOKEN`
- [ ] **Android emülatör** çalışır durumda (Android Studio AVD).
- [ ] **Node 20+ ve pnpm** (zaten kurulu).

---

## 1. Repo Düzenleme (Asistan, ~10 dk)

- [ ] Yerel `apps/mobile/android` ve `apps/mobile/ios` klasörleri (Expo prebuild
      çıktıları) tamamen silinecek — EAS cloud’da regenerate edecek.
- [ ] `apps/mobile/eas.json`:
      - `development` profili `developmentClient: true` + `distribution: internal` doğrulanacak
      - `env.EXPO_PUBLIC_API_URL` ve `env.EXPO_PUBLIC_WS_URL` VPS’i gösteriyor mu kontrol
- [ ] `apps/mobile/app.json`:
      - `@rnmapbox/maps` plugin içindeki placeholder token kaldırılacak; token EAS secret
        üzerinden enjekte edilecek.
- [ ] `.gitignore`:
      - `apps/mobile/android/` ve `apps/mobile/ios/` ignore edilmiş mi doğrula (EAS
        her build’de üretecek).

---

## 2. EAS CLI Kurulum + Login (Kullanıcı, ~5 dk)

```powershell
pnpm add -g eas-cli
eas login
eas whoami
```

Proje bağlantısı (sadece ilk kez; `projectId` `app.json`’da zaten mevcut):

```powershell
cd C:\motogram\apps\mobile
eas init --id 49c6782e-d363-4910-81aa-eeffb0a0b65a
```

---

## 3. Secrets (Kullanıcı, ~2 dk)

Sırrlar **asla repo’ya girmez**; Expo’nun cloud build’ine tanımlanır:

```powershell
eas secret:create --scope project --name RNMAPBOX_MAPS_DOWNLOAD_TOKEN --value "<MAPBOX_SECRET_TOKEN>"
eas secret:create --scope project --name EXPO_PUBLIC_MAPBOX_TOKEN    --value "<MAPBOX_PUBLIC_TOKEN>"
```

İleride eklenecekler (opsiyonel):

```powershell
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "<SENTRY_DSN>"
```

Listelemek / silmek:

```powershell
eas secret:list
eas secret:delete --id <SECRET_ID>
```

---

## 4. İlk Dev Client Build (Cloud, ~15 dk)

```powershell
cd C:\motogram\apps\mobile
eas build --profile development --platform android
```

- Kod Expo cloud’a (Linux runner) yüklenir → Gradle/CMake/NDK orada çalışır.
- Windows’taki path-length / Java sürümü / Ninja sorunları **bu aşamada yoktur**.
- Build durumu: https://expo.dev/accounts/alnkemre/projects/motogram/builds

Çıktı: indirilebilir bir **APK** / internal distribution link.

---

## 5. APK’yı Emülatöre Kurma (~2 dk)

### Kolay yol

```powershell
eas build:run --platform android --latest
```

(en son başarılı dev build’i alır, açık emülatöre kurar)

### Alternatif

Expo panelinden APK’yı indir, emülatör penceresine sürükle-bırak.

---

## 6. Metro + Hot Reload (Günlük Döngü)

```powershell
cd C:\motogram\apps\mobile
pnpm dev     # = expo start --dev-client
```

- Metro yerel makinede açılır.
- Emülatördeki **Motogram (dev client)** APK’sı açılınca Metro’ya bağlanır.
- Artık:
  - **JS/TS değişikliği** → anında hot reload (rebuild YOK)
  - **Yeni native paket** → sadece o zaman tekrar `eas build` gerekir

---

## 7. Uçtan Uca Smoke Test

> VPS (http://85.235.74.203) üzerinde backend ayakta olmalı.

- [ ] **Auth**: Login ekranı → `/v1/auth/login` → `accessToken` alındı mı (MMKV’de
      `StorageKeys.AccessToken` yazıldı mı)
- [ ] **Map**: Harita ekranı → `/v1/map/nearby` → 200 + marker listesi
- [ ] **WebSocket**: Mesajlar → `/realtime` namespace → `conversation:join` event’i
      backend tarafında log’a düşüyor mu
- [ ] **Media upload**: Story create → `/v1/media/uploads` → MinIO presigned PUT → 200
- [ ] **Sentry** (opsiyonel): test exception → panelde görünüyor mu

Hata çıkarsa fix kodda değil **env / ağ** tarafındadır — logları birlikte okuruz.

---

## 8. Preview / Production (Sonraki Adımlar — şimdi değil)

Uygulama stabilleşince:

```powershell
# Internal QA APK
eas build --profile preview --platform android

# Play Store (AAB)
eas build --profile production --platform android

# Mağaza gönderimi
eas submit --platform android --latest
```

---

## 9. Sık Karşılaşılacak Durumlar

| Durum | Aksiyon |
|---|---|
| JS kodu değiştirdim | Hiçbir şey — Metro hot reload yeter. |
| `app.json` / plugin değişti | `eas build --profile development --platform android` (yeniden). |
| Yeni native paket eklendi (`pnpm add`) | Yeni dev build gerekir. |
| `.env` / API URL değişti | `eas.json → development.env` güncelle + yeni dev build. |
| APK emülatörde Metro’ya bağlanmıyor | Aynı Wi-Fi / `adb reverse tcp:8081 tcp:8081`. |
| Mapbox tile gelmiyor | `EXPO_PUBLIC_MAPBOX_TOKEN` secret doğru mu + public token scope. |
| Sürekli 401 | Refresh token süresi dolmuş → yeniden login. |

---

## 10. Kim Ne Yapıyor — Kısa Tablo

| Aşama | Kim | Süre |
|---|---|---|
| 0. Ön gereklilikler | Kullanıcı | 5 dk |
| 1. Repo düzenleme | Asistan | 10 dk |
| 2. EAS CLI + login | Kullanıcı | 5 dk |
| 3. Secrets | Kullanıcı | 2 dk |
| 4. İlk dev build | Cloud (EAS) | ~15 dk |
| 5. APK kurulum | Kullanıcı | 2 dk |
| 6. Metro + hot reload | Kullanıcı | 1 dk |
| 7. Smoke test | İkisi | 10 dk |

**Toplam aktif iş: ~25 dk**, geri kalanı cloud build beklemesi.

---

## Notlar

- Bu yol haritası frontend’i **baştan yazmıyor**; mevcut `apps/mobile` kodu,
  `@motogram/shared` Zod sözleşmesi ve socket entegrasyonu korunuyor.
- Tüm Windows native build sorunları (path-length, Java 8, Ninja, CMake, NDK)
  cloud build’e taşındığı için yerelde **tekrar etmez**.
- `.cursorrules` (Madde 3) ve spec (React Native + Expo) ile uyumludur.
