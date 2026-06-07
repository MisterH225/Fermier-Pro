export const DEFAULT_GESTATION_DAYS = 114;
export const DEFAULT_WEANING_DAYS = 28;

export type VaccineScheduleEntry = {
  name: string;
  daysAfterMating: number;
  enabled?: boolean;
};

export const DEFAULT_VACCINE_SCHEDULE: VaccineScheduleEntry[] = [
  { name: "Parvovirose / Rouget", daysAfterMating: 30, enabled: true },
  { name: "Colibacillose (E. coli)", daysAfterMating: 85, enabled: true },
  { name: "Clostridiose", daysAfterMating: 92, enabled: true },
  { name: "Rouget (rappel)", daysAfterMating: 99, enabled: true }
];

export const DEFAULT_PRE_BIRTH_CHECKLIST: string[] = [
  "Loge maternité préparée et désinfectée",
  "Matériel mise bas disponible (cordon, iode, etc.)",
  "Vaccin colibacillose administré",
  "Poids truie contrôlé",
  "Ration alimentaire ajustée (gestation → lactation)",
  "Contact vétérinaire noté"
];

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}
