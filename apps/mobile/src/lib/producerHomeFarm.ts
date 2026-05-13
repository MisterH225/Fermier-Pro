import type { AuthMeResponse } from "./api";

export type ProducerHomeFarmLite = { id: string; name: string };

/**
 * Ferme « principale » producteur : `primaryFarm` API sinon première ferme listée.
 */
export function resolveProducerHomeFarm(
  authMe: AuthMeResponse | null | undefined,
  farms: ProducerHomeFarmLite[] | null | undefined
): ProducerHomeFarmLite | null {
  if (authMe?.primaryFarm) {
    return {
      id: authMe.primaryFarm.id,
      name: authMe.primaryFarm.name
    };
  }
  const first = farms?.[0];
  if (first) {
    return { id: first.id, name: first.name };
  }
  return null;
}
