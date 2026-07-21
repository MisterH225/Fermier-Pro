import { IsString, MaxLength, MinLength } from "class-validator";

/** Rapport obligatoire après visite — partagé au producteur (Santé). */
export class SubmitVisitReportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  subjectsTreated!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  diagnosis!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  prescription!: string;
}
