/** Créneaux affichés côté mobile (HH:mm, 24h). */
export const VET_VISIT_SLOT_TIMES = [
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00"
] as const;

export type VetVisitSlotTime = (typeof VET_VISIT_SLOT_TIMES)[number];

export function slotTimeFromDate(d: Date): string {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function dayBoundsFromIsoDate(dateIso: string): {
  dayStart: Date;
  dayEnd: Date;
} {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso.trim());
  if (!m) {
    const fallback = new Date();
    const dayStart = new Date(
      fallback.getFullYear(),
      fallback.getMonth(),
      fallback.getDate()
    );
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return { dayStart, dayEnd };
  }
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const dayStart = new Date(year, month, day, 0, 0, 0, 0);
  const dayEnd = new Date(year, month, day + 1, 0, 0, 0, 0);
  return { dayStart, dayEnd };
}

export function combineLocalDayAndSlot(dateIso: string, slot: string): Date {
  const { dayStart } = dayBoundsFromIsoDate(dateIso);
  const [h, min] = slot.split(":").map((x) => Number.parseInt(x, 10));
  const d = new Date(dayStart);
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(min) ? min : 0, 0, 0);
  return d;
}
