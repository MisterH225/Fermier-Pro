import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class ProfitabilityMonthQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class ProfitabilityHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}

export class ProfitabilitySimulateQueryDto {
  @IsString()
  param!: string;

  @Type(() => Number)
  @IsNumber()
  value!: number;
}

export class ProfitabilityIcQueryDto {
  @IsOptional()
  @IsString()
  phase?: string;
}
