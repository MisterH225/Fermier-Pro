import { Type } from "class-transformer";
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class CreateWeightDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(5000)
  weightKg!: number;

  @IsOptional()
  @IsDateString()
  measuredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
