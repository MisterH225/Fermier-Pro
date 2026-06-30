/** Occupation en têtes depuis une loge housing ou cheptel. */
export function resolvePenOccupancy(pen: {
  occupancy?: number | null;
  _count?: { placements?: number };
}): number {
  if (typeof pen.occupancy === "number" && Number.isFinite(pen.occupancy)) {
    return pen.occupancy;
  }
  return pen._count?.placements ?? 0;
}
