export function safeBillingReturnPath(value: unknown, fallback = '/') {
  if (typeof value !== 'string' || value.length > 500) return fallback;
  const hasControlCharacter = (candidate: string) => [...candidate].some(character => {
    const point = character.codePointAt(0) || 0;
    return point < 32 || point === 127;
  });
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || hasControlCharacter(value)) return fallback;
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return fallback; }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\') || hasControlCharacter(decoded)) return fallback;
  try {
    const base = new URL('https://www.getshipseal.com');
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function billingReturnPathWithFuturesFocus(value: unknown) {
  const safe = safeBillingReturnPath(value);
  const parsed = new URL(safe, 'https://www.getshipseal.com');
  parsed.searchParams.set('open', 'futures');
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
