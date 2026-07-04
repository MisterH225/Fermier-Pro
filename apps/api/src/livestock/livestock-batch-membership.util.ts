/** Effectif affiché : membres actifs rattachés, sinon headcount stocké (bandes legacy). */
export function effectiveBatchHeadcount(
  batchHeadcount: number,
  activeMemberCount: number
): number {
  return activeMemberCount > 0 ? activeMemberCount : Math.max(0, batchHeadcount);
}

export function isBatchDeletable(
  batchHeadcount: number,
  activeMemberCount: number
): boolean {
  return effectiveBatchHeadcount(batchHeadcount, activeMemberCount) <= 0;
}
