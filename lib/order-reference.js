/**
 * Normalizes the optional reference entered in the shared VIN / OEM field.
 * The field is not VIN-only: suppliers also identify parts with shorter OEM codes.
 * null indicates an invalid reference; an empty string is allowed.
 */
export function normalizeVinOrOem(value) {
  if (value == null) return '';
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return '';
  if (normalized.length > 30) return null;
  return /^[A-Z0-9][A-Z0-9._ /-]*$/.test(normalized) ? normalized : null;
}
