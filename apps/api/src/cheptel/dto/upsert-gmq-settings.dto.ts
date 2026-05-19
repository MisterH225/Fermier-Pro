import { Type } from "class-transformer";
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";

export class GmqCategorySettingDto {
  @IsString()
  categoryKey!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  targetGmqGPerDay?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(500)
  targetSaleWeightKg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  alertThresholdGmq?: number | null;
}

export class UpsertGmqSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GmqCategorySettingDto)
  categories!: GmqCategorySettingDto[];
}
