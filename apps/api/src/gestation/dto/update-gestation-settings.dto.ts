import { IsArray, IsInt, IsOptional, Min } from "class-validator";

export class UpdateGestationSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(90)
  gestationDurationDays?: number;

  @IsOptional()
  @IsInt()
  @Min(14)
  weaningDurationDays?: number;

  @IsOptional()
  @IsArray()
  vaccineSchedule?: unknown[];
}
