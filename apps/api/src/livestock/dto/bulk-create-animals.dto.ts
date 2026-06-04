import { AnimalOrigin, AnimalProductionCategory, AnimalSex } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

const BULK_CATEGORIES: AnimalProductionCategory[] = [
  "breeding_female",
  "breeding_male",
  "fattening",
  "starter"
];

export class BulkCreateAnimalsDto {
  @IsOptional()
  @IsString()
  penId?: string;

  @IsIn(BULK_CATEGORIES)
  productionCategory!: AnimalProductionCategory;

  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(200)
  count!: number;

  @IsOptional()
  @IsEnum(AnimalSex)
  sex?: AnimalSex;

  @IsOptional()
  @IsString()
  breedId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(9999)
  entryWeightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(520)
  ageWeeksAtEntry?: number;

  @IsDateString()
  entryDate!: string;

  @IsEnum(AnimalOrigin)
  origin!: AnimalOrigin;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supplier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
