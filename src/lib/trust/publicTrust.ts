export const SHIPSEAL_PUBLIC_CONTACT_EMAIL = cleanPublicEmail(
  import.meta.env.VITE_SHIPSEAL_PUBLIC_CONTACT_EMAIL,
) || 'hello@shipseal.dev';

export const SHIPSEAL_PUBLIC_OPERATOR_NAME = cleanPublicText(
  import.meta.env.VITE_SHIPSEAL_PUBLIC_OPERATOR_NAME,
);

export const SHIPSEAL_PUBLIC_GOVERNING_LAW = cleanPublicText(
  import.meta.env.VITE_SHIPSEAL_PUBLIC_GOVERNING_LAW,
);

export const SHIPSEAL_LEGAL_DISCLAIMER =
  'ShipSeal provides an evidence-based software assessment for informational purposes. It is not legal advice, a production security audit, or a compliance certification.';

export const SHIPSEAL_STATIC_ANALYSIS_CLAIM =
  'ShipSeal analyzes repository files statically. Imported repository code is not executed.';

export const SHIPSEAL_DEEP_ANALYSIS_DISCLOSURE =
  'Deep Analysis uses AI with selected, bounded repository evidence after server-side preparation and best-effort sensitive-value redaction.';

export const SHIPSEAL_UNSUPPORTED_PUBLIC_CLAIMS = [
  'we never send repository data to ai',
  'shipseal stores no repository data',
  'encrypted end-to-end',
  'zero knowledge',
  'soc 2 compliant',
  'iso certified',
] as const;

function cleanPublicEmail(value: unknown) {
  if (typeof value !== 'string') return '';
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function cleanPublicText(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, 200);
}
