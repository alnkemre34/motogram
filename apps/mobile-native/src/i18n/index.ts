import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';

import { StorageKeys, getString, setString } from '../lib/storage';

import en from './locales/en.json';
import tr from './locales/tr.json';

function detectInitialLanguage(): 'tr' | 'en' {
  const stored = getString(StorageKeys.Language);
  if (stored === 'tr' || stored === 'en') return stored;
  const locale = RNLocalize.getLocales()[0]?.languageCode ?? 'tr';
  return locale === 'en' ? 'en' : 'tr';
}

i18n.use(initReactI18next).init({
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

