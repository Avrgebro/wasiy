/**
 * Shared by Faq.astro (rendering) and SchemaOrg.astro (FAQPage JSON-LD)
 * so the markup and the structured data cannot drift apart.
 */
export interface Faq {
  q: string;
  a: string;
  open: boolean;
}

export const faqs: Faq[] = [
  {
    q: '¿Wasiy maneja las cuotas de mantenimiento y la contabilidad?',
    a: 'No, y es a propósito. Wasiy es el centro de operación del edificio: visitas, reservas, registro y comunicación. Las cuotas de reservas se marcan como pagadas o pendientes de forma manual; la contabilidad completa vendrá como módulo futuro, no como estorbo presente.',
    open: true,
  },
  {
    q: '¿Cuánto demora poner en marcha un edificio?',
    a: 'Una tarde, con honestidad. Se importan unidades y residentes por CSV, se invita a los residentes al portal y recepción empieza a registrar visitas ese mismo día.',
    open: false,
  },
  {
    q: '¿Los residentes necesitan descargar una app?',
    a: 'No. El portal del residente funciona en el navegador del celular — pre-registrar una visita o reservar la parrilla toma menos que abrir la tienda de apps.',
    open: false,
  },
  {
    q: '¿Qué pasa si una visita llega sin anunciarse?',
    a: 'Recepción la registra como walk-in en segundos, anotando cómo se confirmó (intercom, teléfono, gerencia). Wasiy registra la realidad del edificio; no la bloquea con flujos de aprobación que nadie va a usar a las 10 de la noche.',
    open: false,
  },
  {
    q: '¿Sirve para varias propiedades?',
    a: 'Sí — es multi-ubicación de nacimiento. Cada edificio ve solo lo suyo, y la administradora cambia de contexto en un clic con vista consolidada de pendientes.',
    open: false,
  },
];
