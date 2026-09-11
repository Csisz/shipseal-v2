export function operationSupportReference(publicOperationId: string | null | undefined) {
  if (!publicOperationId) return null;
  const suffix = publicOperationId.replace(/[^A-Za-z0-9]/g, '').slice(-10).toUpperCase();
  return suffix ? `RI-${suffix}` : null;
}
