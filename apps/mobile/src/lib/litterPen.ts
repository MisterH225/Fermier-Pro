export type LitterPenCandidate = {
  id: string;
  occupancy?: number | null;
  capacity?: number | null;
};

function penFitsLitterHeadcount(
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

export function findEmptyPenForLitter(
  pens: LitterPenCandidate[],
  headcount: number
): string | null {
  const emptyFit = pens.find((pen) => {
    const occupancy = pen.occupancy ?? 0;
    return (
      occupancy === 0 &&
      penFitsLitterHeadcount(occupancy, pen.capacity, headcount)
    );
  });
  return emptyFit?.id ?? null;
}

export function rankPensForLitterSuggestion(
  pens: LitterPenCandidate[],
  headcount: number
): Array<{ id: string; suggested: boolean }> {
  const scored = pens
    .map((pen) => {
      const occupancy = pen.occupancy ?? 0;
      const cap = pen.capacity ?? 0;
      const fits = penFitsLitterHeadcount(occupancy, cap, headcount);
      if (!fits) {
        return null;
      }
      const free =
        cap > 0 ? Math.max(0, cap - occupancy) : Number.MAX_SAFE_INTEGER;
      const score = (occupancy === 0 ? 1_000 : 0) + free;
      return { id: pen.id, score };
    })
    .filter((row): row is { id: string; score: number } => row != null)
    .sort((a, b) => b.score - a.score);

  return scored.map((row, index) => ({
    id: row.id,
    suggested: index === 0
  }));
}
