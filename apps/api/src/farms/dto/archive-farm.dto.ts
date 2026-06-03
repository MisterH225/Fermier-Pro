import { IsEnum, IsOptional } from "class-validator";

export enum ArchiveReason {
  temporarily_inactive = "temporarily_inactive",
  restructuring = "restructuring",
  end_of_season = "end_of_season",
  other = "other"
}

export class ArchiveFarmDto {
  @IsOptional()
  @IsEnum(ArchiveReason)
  reason?: ArchiveReason;
}
