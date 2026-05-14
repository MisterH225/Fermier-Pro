import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { FeedTypeUnit } from "@prisma/client";

export class CreateFeedTypeDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEnum(FeedTypeUnit)
  unit!: FeedTypeUnit;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  color?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(500)
  weightPerBagKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(365)
  lowStockThresholdDays?: number;
}
