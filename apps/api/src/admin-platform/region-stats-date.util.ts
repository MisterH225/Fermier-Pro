/** Bornes UTC d'une journée calendaire. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addUtcDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return startOfUtcDay(next);
}

/** Lundi 00:00 UTC de la semaine contenant `d`. */
export function startOfUtcWeek(d: Date): Date {
  const day = startOfUtcDay(d);
  const dow = day.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return addUtcDays(day, mondayOffset);
}

export function parseIsoDateParam(value: string | undefined, fallback: Date): Date {
  if (!value?.trim()) {
    return startOfUtcDay(fallback);
  }
  const parsed = new Date(`${value.trim()}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return startOfUtcDay(fallback);
  }
  return startOfUtcDay(parsed);
}
