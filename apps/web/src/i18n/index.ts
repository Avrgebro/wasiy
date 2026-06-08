import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import commonEs from './locales/es/common.json'
import commonEn from './locales/en/common.json'

void i18next.use(initReactI18next).init({
  fallbackLng: 'es',
  interpolation: {
    escapeValue: false,
  },
  lng: 'es',
  ns: ['common'],
  defaultNS: 'common',
  resources: {
    es: { common: commonEs },
    en: { common: commonEn },
  },
})

export { i18next }
