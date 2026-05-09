import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class CreateBatchWeightDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(5000)
  avgWeightKg!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  headcountSnapshot?: number;

  @IsOptional()
  @IsDateString()
  measuredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
