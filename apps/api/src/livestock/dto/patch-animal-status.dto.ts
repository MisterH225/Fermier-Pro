import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const ANIMAL_LIFECYCLE_STATUSES = [
  "active",
  "dead",
  "sold",
  "exited",
  "transferred"
] as const;

/** Valeurs acceptées à l'API (legacy `reformed` → `exited`). */
export const ANIMAL_LIFECYCLE_STATUSES_INPUT = [
  ...ANIMAL_LIFECYCLE_STATUSES,
  "reformed"
] as const;

export type AnimalLifecycleStatus =
  (typeof ANIMAL_LIFECYCLE_STATUSES)[number];

export function normalizeAnimalLifecycleStatus(
  status: string
): AnimalLifecycleStatus {
  if (status === "reformed") {
    return "exited";
  }
  return status as AnimalLifecycleStatus;
}

export class PatchAnimalStatusDto {
  @IsIn([...ANIMAL_LIFECYCLE_STATUSES_INPUT])
  status!: AnimalLifecycleStatus | "reformed";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
