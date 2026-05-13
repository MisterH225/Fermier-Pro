import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const ANIMAL_LIFECYCLE_STATUSES = [
  "active",
  "dead",
  "sold",
  "reformed",
  "transferred"
] as const;

export type AnimalLifecycleStatus =
  (typeof ANIMAL_LIFECYCLE_STATUSES)[number];

export class PatchAnimalStatusDto {
  @IsIn([...ANIMAL_LIFECYCLE_STATUSES])
  status!: AnimalLifecycleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
