/**
 * Normalize display names for duplicate detection.
 * Only trim, collapse whitespace and lowercase — no accent stripping.
 */
export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function sanitizeText(value: string, maxLength = 200): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}
