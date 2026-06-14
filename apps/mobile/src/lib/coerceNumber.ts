/** Normalise une valeur API (number, string Decimal Prisma, etc.) en number fini ou null. */
export function coerceFiniteNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const n = Number.parseFloat(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function formatOptionalNumber(value: unknown, digits = 0): string | null {
  const n = coerceFiniteNumber(value);
  if (n == null) {
    return null;
  }
  return n.toFixed(digits);
}

export function formatOptionalPct(value: unknown, digits = 1): string | null {
  const n = coerceFiniteNumber(value);
  if (n == null) {
    return null;
  }
  return `${n.toFixed(digits)}%`;
}

export function roundCoerced(value: unknown): number | null {
  const n = coerceFiniteNumber(value);
  return n != null ? Math.round(n) : null;
}
