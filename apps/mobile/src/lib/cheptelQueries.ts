import type { QueryClient } from "@tanstack/react-query";

/** Racines TanStack invalidées après une mutation animaux / loges cheptel. */
export const CHEPTEL_ANIMAL_MUTATION_ROOTS = [
  "farmAnimals",
  "farmCheptel",
  "cheptelPens",
  "cheptelHistory"
] as const;

/** Inclut les vues loge (cheptel + housing legacy). */
export const CHEPTEL_PEN_MOVE_ROOTS = [
  ...CHEPTEL_ANIMAL_MUTATION_ROOTS,
  "penContents",
  "penDetail",
  "farmBarns",
  "farmBarn"
] as const;

export function invalidateCheptelCaches(
  qc: QueryClient,
  farmId: string,
  roots: readonly string[] = CHEPTEL_ANIMAL_MUTATION_ROOTS
): void {
  for (const root of roots) {
    void qc.invalidateQueries({ queryKey: [root, farmId] });
  }
}
