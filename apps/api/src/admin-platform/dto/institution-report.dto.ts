import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches
} from "class-validator";
import type { InstitutionStatSection } from "../institution-stats-sections.constants";

export class GenerateInstitutionStatsReportDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  sections!: InstitutionStatSection[];

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "from doit être au format YYYY-MM-DD"
  })
  from!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "to doit être au format YYYY-MM-DD"
  })
  to!: string;

  @IsOptional()
  @IsString()
  regionCode?: string;

  @IsIn(["pdf", "csv"])
  format!: "pdf" | "csv";

  /** Langue du rapport (titres, analyses, libellés). Défaut : fr. */
  @IsOptional()
  @IsIn(["fr", "en"])
  locale?: "fr" | "en";

  @IsOptional()
  @IsString()
  viewAsInstitutionId?: string;
}
