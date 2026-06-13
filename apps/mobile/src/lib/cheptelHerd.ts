/** Statuts hors effectif cheptel actif (historique / sorties). */
export const CHEPTEL_HERD_TERMINAL_STATUSES = new Set([
  "sold",
  "dead",
  "exited",
  "reformed",
  "transferred",
  "slaughtered"
]);

export function isAnimalInCheptelHerd(status: string | null | undefined): boolean {
  if (!status) {
    return false;
  }
  const normalized = status === "reformed" ? "exited" : status;
  return !CHEPTEL_HERD_TERMINAL_STATUSES.has(normalized);
}
