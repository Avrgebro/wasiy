/**
 * Shared by Pricing.astro (rendering) and SchemaOrg.astro (Offer JSON-LD)
 * so displayed prices and structured-data prices cannot drift apart.
 */
export interface Plan {
  name: string;
  /** Price as displayed: the monthly base for the included units. */
  amount: string;
  /** Suffix shown next to the amount; omitted for quote-based tiers. */
  per?: string;
  /** What the base covers and what extra units cost; omitted for quote-based tiers. */
  includes?: string;
  /** Numeric base price per month, or null when pricing is quote-based. */
  price: number | null;
  pitch: string;
  features: string[];
  cta: string;
  /**
   * Where the CTA goes. A site path for quote-based tiers; for self-serve
   * tiers the app's /registro route, resolved against APP_URL at build time
   * by Pricing.astro so stage builds point at the stage app.
   */
  href: string;
  ctaStyle: 'solid' | 'outline';
  featured?: boolean;
  badge?: string;
}

export const plans: Plan[] = [
  {
    name: 'Esencial',
    amount: 'S/ 45',
    per: ' / mes',
    includes: 'Incluye hasta 10 unidades · S/ 4.50 por unidad adicional',
    price: 45,
    pitch: 'Para un solo edificio que quiere dejar el cuaderno.',
    features: [
      'Registro de visitantes',
      'Unidades y residentes',
      'Anuncios',
      'Portal del residente',
    ],
    cta: 'Empezar prueba gratis',
    href: '/registro?plan=esencial',
    ctaStyle: 'outline',
  },
  {
    name: 'Operativo',
    amount: 'S/ 65',
    per: ' / mes',
    includes: 'Incluye hasta 10 unidades · S/ 6.50 por unidad adicional',
    price: 65,
    pitch: 'La operación completa: recepción, reservas y auditoría.',
    features: [
      'Todo lo de Esencial',
      'Reservas con aprobación y cuotas',
      'Vehículos',
      'Registro de actividad',
      'Exportaciones CSV',
    ],
    cta: 'Empezar prueba gratis',
    href: '/registro?plan=operativo',
    ctaStyle: 'solid',
    featured: true,
    badge: 'Recomendado',
  },
  {
    name: 'Portafolio',
    amount: 'Hablemos',
    price: null,
    pitch:
      'Para administradoras con varios edificios y desarrolladoras que entregan proyectos.',
    features: [
      'Todo lo de Operativo',
      'Múltiples ubicaciones',
      'Vista consolidada de cuenta',
      'Onboarding asistido con CSV',
    ],
    cta: 'Pedir cotización',
    href: '/#contacto',
    ctaStyle: 'outline',
  },
];

/** Numeric prices only — used to build the AggregateOffer range. */
export const pricedPlans = plans.filter(
  (p): p is Plan & { price: number } => p.price !== null,
);
