import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '../../locales/en.json';
import fr from '../../locales/fr.json';

export type SupportedLanguage = 'en' | 'fr';
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'fr'];

let initialized = false;

export async function initI18n(): Promise<void> {
  if (initialized) return;
  await i18next.use(LanguageDetector).init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'damia.lang',
    },
  });
  initialized = true;
}

export function t(key: string, params?: Record<string, string | number>): string {
  if (!initialized) return key;
  return params ? (i18next.t(key, params) as string) : (i18next.t(key) as string);
}

export function getLanguage(): SupportedLanguage {
  return (i18next.resolvedLanguage as SupportedLanguage) ?? 'en';
}

/**
 * Switches language and reloads the page. Live re-render of all Pixi text would
 * require subscribing every UI element to `languageChanged`; reloading is the
 * pragmatic M7 choice and the LanguageDetector persists the selection.
 */
export function setLanguage(lang: SupportedLanguage): void {
  void i18next.changeLanguage(lang).then(() => {
    window.location.reload();
  });
}
