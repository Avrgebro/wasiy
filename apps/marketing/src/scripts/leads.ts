/**
 * Posts a marketing form to the API's public leads endpoint. Field names match
 * StoreLeadRequest. Throws with a user-facing Spanish message on failure.
 */
export type LeadPayload = {
  source: 'contacto' | 'demo';
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  profile?: string;
  units?: number;
  units_range?: string;
  interests?: string[];
  preferred_slot?: string;
  message?: string;
  /** Honeypot: always forwarded so the server can drop bot submissions. */
  website?: string;
};

export async function submitLead(apiUrl: string, payload: LeadPayload): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/public/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('No pudimos conectar. Revisa tu conexión e inténtalo otra vez.');
  }
  if (response.status === 429) {
    throw new Error('Has enviado varios mensajes. Espera un momento antes de intentarlo de nuevo.');
  }
  if (response.status === 422) {
    const body = (await response.json().catch(() => null)) as { errors?: Record<string, string[]> } | null;
    const first = body?.errors ? Object.values(body.errors).flat()[0] : undefined;
    throw new Error(first ?? 'Revisa los datos e inténtalo otra vez.');
  }
  if (!response.ok) {
    throw new Error('No pudimos enviar tu mensaje. Inténtalo otra vez o escríbenos por correo.');
  }
}

/** Reads the hidden honeypot input; bots that autofill every field give themselves away. */
export function honeypotValue(form: HTMLFormElement): string {
  return form.querySelector<HTMLInputElement>('input[name="website"]')?.value ?? '';
}
