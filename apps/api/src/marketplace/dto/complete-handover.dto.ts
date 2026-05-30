import { Type } from "class-transformer";
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class CompleteHandoverDto {
  /** Offre acceptée liée à cette vente. */
  @IsString()
  offerId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e7)
  soldWeightKg!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e12)
  totalPrice!: number;

  @IsOptional()
  @IsISO8601()
  soldAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
