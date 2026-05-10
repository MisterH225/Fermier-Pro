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

export class CreateFeedStockLotDto {
  @IsString()
  @MaxLength(200)
  productName!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(1e9)
  quantityKg!: number;

  @IsOptional()
  @IsDateString()
  purchasedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supplierName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e12)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
