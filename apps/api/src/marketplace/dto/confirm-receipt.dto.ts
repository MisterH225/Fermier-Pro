import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";
import { MarketplaceReceiptCondition } from "@prisma/client";

export class ConfirmReceiptDto {
  @IsDateString()
  receivedAt!: string;

  @IsEnum(MarketplaceReceiptCondition)
  condition!: MarketplaceReceiptCondition;

  @IsArray()
  @IsString({ each: true })
  receivedAnimalIds!: string[];

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  realWeightKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
