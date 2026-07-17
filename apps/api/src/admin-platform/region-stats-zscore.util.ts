/** z-score de la valeur courante vs une série historique (moyenne + écart-type). */
export function computeZScore(
  current: number,
  historical: number[]
): number | null {
  if (historical.length === 0) {
    return null;
  }
  const mean = historical.reduce((sum, v) => sum + v, 0) / historical.length;
  const variance =
    historical.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
    historical.length;
  const std = Math.sqrt(variance);
  if (std === 0) {
    return current > mean ? 3 : current < mean ? -3 : 0;
  }
  return (current - mean) / std;
}

export function isOvermortality(zScore: number | null): boolean {
  return zScore != null && zScore > 2;
}
