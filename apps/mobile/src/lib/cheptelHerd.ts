/** Statuts hors effectif cheptel actif (historique / sorties). */
export const CHEPTEL_HERD_TERMINAL_STATUSES = new Set([
  "sold",
  "dead",
  "exited",
  "reformed",
  "transferred",
  "slaughtered"
]);

export function isAnimalInCheptelHerd(status: string): boolean {
  const normalized = status === "reformed" ? "exited" : status;
  return !CHEPTEL_HERD_TERMINAL_STATUSES.has(normalized);
}
