/**
 * Combine une date calendaire (YYYY-MM-DD) avec l'heure locale d'une référence.
 * Par défaut, utilise l'heure courante (moment de l'enregistrement).
 */
export function isoDateWithLocalTime(
  dateYmd: string,
  timeRef: Date | string = new Date()
): string {
  const ref = typeof timeRef === "string" ? new Date(timeRef) : timeRef;
  const parts = dateYmd.trim().split("-").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return new Date().toISOString();
  }
  const [year, month, day] = parts;
  const combined = new Date(
    year,
    month - 1,
    day,
    ref.getHours(),
    ref.getMinutes(),
    ref.getSeconds(),
    ref.getMilliseconds()
  );
  return combined.toISOString();
}
