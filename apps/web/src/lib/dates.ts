export function formatDate(value: string | Date, locale = 'es-PE') {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'America/Lima',
  }).format(new Date(value))
}
