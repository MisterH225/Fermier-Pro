export const VISIT_SLOT_TIMES = [
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

export type VisitPeriod = "morning" | "afternoon" | "evening";

export function slotsForPeriod(period: VisitPeriod): string[] {
  if (period === "morning") {
    return ["06:00", "07:00", "08:00", "09:00", "10:00"];
  }
  if (period === "afternoon") {
    return ["14:00", "15:00", "16:00"];
  }
  return ["17:00", "18:00"];
}

export function combineDayAndSlot(day: Date, slot: string): string {
  const d = new Date(day);
  const [h, m] = slot.split(":").map((x) => Number.parseInt(x, 10));
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d.toISOString();
}

export function toDateIso(day: Date): string {
  const y = day.getFullYear();
  const mo = String(day.getMonth() + 1).padStart(2, "0");
  const da = String(day.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}
