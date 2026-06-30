export type LitterPenCandidate = {
  id: string;
  occupancy: number;
  capacity: number | null;
};

export function penFitsLitterHeadcount(
  occupancy: number,
  capacity: number | null | undefined,
  headcount: number
): boolean {
  const cap = capacity ?? 0;
  if (cap <= 0) {
    return true;
  }
  return Math.max(0, cap - occupancy) >= headcount;
}

/** Loge vide avec assez de places — seul cas de placement automatique à la mise bas. */
export function findEmptyPenForLitter(
  pens: LitterPenCandidate[],
  headcount: number
): string | null {
  const emptyFit = pens.find(
    (pen) =>
      pen.occupancy === 0 &&
      penFitsLitterHeadcount(pen.occupancy, pen.capacity, headcount)
  );
  return emptyFit?.id ?? null;
}

/** Classe les loges pour suggestion utilisateur quand aucune loge vide n'est disponible. */
export function rankPensForLitterSuggestion(
  pens: LitterPenCandidate[],
  headcount: number
): Array<{ id: string; suggested: boolean }> {
  const scored = pens
    .map((pen) => {
      const cap = pen.capacity ?? 0;
      const fits = penFitsLitterHeadcount(pen.occupancy, cap, headcount);
      if (!fits) {
        return null;
      }
      const free =
        cap > 0 ? Math.max(0, cap - pen.occupancy) : Number.MAX_SAFE_INTEGER;
      const score = (pen.occupancy === 0 ? 1_000 : 0) + free;
      return { id: pen.id, score };
    })
    .filter((row): row is { id: string; score: number } => row != null)
    .sort((a, b) => b.score - a.score);

  return scored.map((row, index) => ({
    id: row.id,
    suggested: index === 0
  }));
}
