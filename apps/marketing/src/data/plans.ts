/**
 * Shared by Pricing.astro (rendering) and SchemaOrg.astro (Offer JSON-LD)
 * so displayed prices and structured-data prices cannot drift apart.
 */
export interface Plan {
  name: string;
  /** Price as displayed. */
  amount: string;
  /** Unit suffix shown next to the amount; omitted for quote-based tiers. */
  per?: string;
  /** Numeric price per unit/month, or null when pricing is quote-based. */
  price: number | null;
  pitch: string;
  features: string[];
  cta: string;
  ctaStyle: 'solid' | 'outline';
  featured?: boolean;
  badge?: string;
}

export const plans: Plan[] = [
  {
    name: 'Esencial',
    amount: 'S/ 2.50',
    per: ' / unidad / mes',
    price: 2.5,
    pitch: 'Para un solo edificio que quiere dejar el cuaderno.',
    features: [
      'Registro de visitantes',
      'Unidades y residentes',
      'Anuncios',
      'Portal del residente',
    ],
    cta: 'Empezar',
    ctaStyle: 'outline',
  },
  {
    name: 'Operativo',
    amount: 'S/ 4.00',
    per: ' / unidad / mes',
    price: 4,
    pitch: 'La operación completa: recepción, reservas y auditoría.',
    features: [
      'Todo lo de Esencial',
      'Reservas con aprobación y cuotas',
      'Vehículos',
      'Registro de actividad',
      'Exportaciones CSV',
    ],
    cta: 'Solicitar demo',
    ctaStyle: 'solid',
    featured: true,
    badge: 'El favorito',
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
    cta: 'Contactar',
    ctaStyle: 'outline',
  },
];

/** Numeric prices only — used to build the AggregateOffer range. */
export const pricedPlans = plans.filter(
  (p): p is Plan & { price: number } => p.price !== null,
);
