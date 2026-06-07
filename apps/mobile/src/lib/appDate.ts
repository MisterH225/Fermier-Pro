import type { AppLocaleCode } from "./appLocale";

export type AppDateFormatPref = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

const MONTHS_FR = [
  "Janv.",
  "Févr.",
  "Mars",
  "Avr.",
  "Mai",
  "Juin",
  "Juil.",
  "Août",
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc."
] as const;

const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toIsoDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromIsoDateString(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(y, mo - 1, day, 12, 0, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return dt;
}

export function fromIsoDateTimeString(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toIsoDateTimeString(d: Date): string {
  return d.toISOString();
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

export function formatAppDate(
  date: Date,
  format: AppDateFormatPref
): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  if (format === "YYYY-MM-DD") {
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }
  if (format === "MM/DD/YYYY") {
    return `${pad2(m)}/${pad2(d)}/${y}`;
  }
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

export function formatAppDateTime(
  date: Date,
  format: AppDateFormatPref
): string {
  return `${formatAppDate(date, format)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatAppMonthYear(
  date: Date,
  locale: AppLocaleCode
): string {
  const months = locale === "en" ? MONTHS_EN : MONTHS_FR;
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function monthYearToDate(year: number, month: number): Date {
  return new Date(year, month - 1, 1, 12, 0, 0, 0);
}

export function clampDate(d: Date, min?: Date | null, max?: Date | null): Date {
  const t = d.getTime();
  if (min && t < min.getTime()) {
    return new Date(min);
  }
  if (max && t > max.getTime()) {
    return new Date(max);
  }
  return d;
}

export function roundToMinuteInterval(d: Date, interval: number): Date {
  const x = new Date(d);
  const m = x.getMinutes();
  const rounded = Math.round(m / interval) * interval;
  x.setMinutes(rounded, 0, 0);
  return x;
}
