import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { StorageKeys, getString, setString } from '../lib/storage';

import en from './locales/en.json';
import tr from './locales/tr.json';

// .cursorrules madde 3 - i18next ZORUNLU, hardcoded text yasak
// Spec 9.6 - Dil: kullanici tercih -> storage -> cihaz dili -> tr fallback

function detectInitialLanguage(): 'tr' | 'en' {
  const stored = getString(StorageKeys.Language);
  if (stored === 'tr' || stored === 'en') return stored;
  const locale = Localization.getLocales()[0]?.languageCode ?? 'tr';
  return locale === 'en' ? 'en' : 'tr';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    lng: detectInitialLanguage(),
    fallbackLng: 'tr',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

export function setAppLanguage(lang: 'tr' | 'en'): void {
  setString(StorageKeys.Language, lang);
  void i18n.changeLanguage(lang);
}

export default i18n;
