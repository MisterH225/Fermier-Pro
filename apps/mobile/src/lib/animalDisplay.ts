/** Numéro lisible cheptel (ex. ENG-003) — jamais l’UUID technique `publicId`. */
export function formatAnimalDisplayLabel(animal: {
  tagCode?: string | null;
  publicId?: string | null;
}): string {
  const tag = animal.tagCode?.trim();
  if (tag) {
    return tag;
  }
  return "—";
}
