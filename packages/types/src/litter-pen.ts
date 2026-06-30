export type LitterPenCandidate = {
  id: string;
  occupancy?: number | null;
  capacity?: number | null;
};

export type LitterPenResolveResult =
  | { kind: "user"; penId: string }
  | { kind: "auto_empty"; penId: string }
  | { kind: "missing_chosen" }
  | { kind: "no_capacity" }
  | { kind: "no_empty" };

function normalizeOccupancy(occupancy?: number | null): number {
  return occupancy ?? 0;
}

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
  const emptyFit = pens.find((pen) => {
    const occupancy = normalizeOccupancy(pen.occupancy);
    return (
      occupancy === 0 &&
      penFitsLitterHeadcount(occupancy, pen.capacity, headcount)
    );
  });
  return emptyFit?.id ?? null;
}

/** Classe les loges pour suggestion utilisateur quand aucune loge vide n'est disponible. */
export function rankPensForLitterSuggestion(
  pens: LitterPenCandidate[],
  headcount: number
): Array<{ id: string; suggested: boolean }> {
  const scored = pens
    .map((pen) => {
      const occupancy = normalizeOccupancy(pen.occupancy);
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

export function resolveLitterPenPlacement(
  pens: LitterPenCandidate[],
  headcount: number,
  chosenPenId?: string | null
): LitterPenResolveResult {
  if (chosenPenId) {
    const chosen = pens.find((pen) => pen.id === chosenPenId);
    if (!chosen) {
      return { kind: "missing_chosen" };
    }
    const occupancy = normalizeOccupancy(chosen.occupancy);
    if (!penFitsLitterHeadcount(occupancy, chosen.capacity, headcount)) {
      return { kind: "no_capacity" };
    }
    return { kind: "user", penId: chosen.id };
  }

  const autoPenId = findEmptyPenForLitter(pens, headcount);
  if (autoPenId) {
    return { kind: "auto_empty", penId: autoPenId };
  }
  return { kind: "no_empty" };
}

export function litterPenCapacityWarning(
  occupancy: number,
  capacity: number | null | undefined,
  headcount: number
): "block" | "warn" | null {
  const cap = capacity ?? 0;
  if (cap <= 0) {
    return null;
  }
  const nextOcc = occupancy + headcount;
  if (nextOcc > cap) {
    return "block";
  }
  if (nextOcc / cap > 0.8) {
    return "warn";
  }
  return null;
}
