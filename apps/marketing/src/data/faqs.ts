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
    a: 'No, y es a propósito. Wasiy es el centro de operación del edificio: visitas, reservas, registro y comunicación. Las cuotas de reservas se marcan como pagadas o pendientes de forma manual; la contabilidad completa llegará como módulo aparte cuando esté lista.',
    open: true,
  },
  {
    q: '¿Cuánto demora poner en marcha un edificio?',
    a: 'Una tarde, con honestidad. Se importan unidades y residentes por CSV, se invita a los residentes al portal y recepción empieza a registrar visitas ese mismo día.',
    open: false,
  },
  {
    q: '¿Los residentes necesitan descargar una app?',
    a: 'No. El portal del residente funciona en el navegador del celular. Pre-registrar una visita o reservar la parrilla toma menos que abrir la tienda de apps.',
    open: false,
  },
  {
    q: '¿Qué pasa si una visita llega sin anunciarse?',
    a: 'Recepción la registra como walk-in en segundos, anotando cómo se confirmó (intercom, teléfono, gerencia). Wasiy registra la realidad del edificio en vez de bloquearla con flujos de aprobación que nadie va a usar a las 10 de la noche.',
    open: false,
  },
  {
    q: '¿Quién puede ver los datos de los residentes?',
    a: 'Solo el edificio al que pertenecen. Cada ubicación está separada de las demás, y todo lo que se toca en los datos sensibles queda en el registro de actividad con usuario y hora. Si algún día te vas, la información sale en CSV: es del edificio, no nuestra.',
    open: false,
  },
  {
    q: '¿Y si en recepción no son muy de computadoras?',
    a: 'Es la pantalla que más pensamos. Funciona en el navegador, sin instalar nada, y el trabajo del día es uno: buscar el nombre y registrar el ingreso. Rosa del turno noche no tiene que aprender un sistema, tiene que dejar de escribir un cuaderno.',
    open: false,
  },
  {
    q: '¿Sirve para varias propiedades?',
    a: 'Sí, es multi-ubicación desde el primer día. Cada edificio ve solo lo suyo, y la administradora cambia de contexto en un clic con vista consolidada de pendientes.',
    open: false,
  },
];
