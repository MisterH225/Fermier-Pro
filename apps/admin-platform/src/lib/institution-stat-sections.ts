/** Sections de statistiques régionales (alignées sur l'API). */
export const INSTITUTION_STAT_SECTIONS = [
  "mortality",
  "herd",
  "reproduction",
  "growth",
  "vetCoverage",
  "economy",
  "movements"
] as const;

export type InstitutionStatSection = (typeof INSTITUTION_STAT_SECTIONS)[number];

/** Sections éditables dans le CRUD institution (movements réservé P-14). */
export const EDITABLE_STAT_SECTIONS = [
  "mortality",
  "herd",
  "reproduction",
  "growth",
  "vetCoverage",
  "economy"
] as const;

export type EditableStatSection = (typeof EDITABLE_STAT_SECTIONS)[number];

export type StatSectionPermissions = Partial<Record<InstitutionStatSection, boolean>>;
