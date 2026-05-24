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

export class SellAnimalDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(1e6)
  soldWeightKg!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e9)
  pricePerKg?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(1e12)
  totalPrice!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  buyerName?: string;

  @IsDateString()
  soldAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
