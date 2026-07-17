import { IsOptional, IsString, Matches } from "class-validator";

export class RegionalStatsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "from doit être au format YYYY-MM-DD"
  })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "to doit être au format YYYY-MM-DD"
  })
  to?: string;

  @IsOptional()
  @IsString()
  regionCode?: string;

  @IsOptional()
  @IsString()
  departmentCode?: string;

  /** Aperçu SuperAdmin : UUID InstitutionConsoleUser (réservé superadmin). */
  @IsOptional()
  @IsString()
  viewAsInstitutionId?: string;
}
