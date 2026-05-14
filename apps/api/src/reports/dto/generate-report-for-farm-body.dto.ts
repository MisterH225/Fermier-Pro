import { ReportPeriodType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, ValidateNested } from "class-validator";
import { ReportAnchorBodyDto } from "./generate-farm-report.dto";

export class GenerateReportForFarmBodyDto {
  @IsEnum(ReportPeriodType)
  periodType!: ReportPeriodType;

  @ValidateNested()
  @Type(() => ReportAnchorBodyDto)
  anchor!: ReportAnchorBodyDto;
}
