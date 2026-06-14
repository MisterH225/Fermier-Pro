import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { MarketplaceReceiptCondition } from "@prisma/client";

export class AnimalWeightDto {
  @IsString()
  animalId!: string;

  @IsNumber()
  @Min(0.1)
  weightKg!: number;
}

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnimalWeightDto)
  animalWeights?: AnimalWeightDto[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  receivedHeadcount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
