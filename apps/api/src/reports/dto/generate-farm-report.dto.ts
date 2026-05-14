import { ReportPeriodType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";

export class ReportAnchorBodyDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  quarter?: number;
}

export class GenerateFarmReportDto {
  @IsString()
  farmId!: string;

  @IsEnum(ReportPeriodType)
  periodType!: ReportPeriodType;

  @ValidateNested()
  @Type(() => ReportAnchorBodyDto)
  anchor!: ReportAnchorBodyDto;
}
