import { AnimalProductionCategory, AnimalSex } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class CreateAnimalDto {
  @IsOptional()
  @IsString()
  speciesId?: string;

  @IsOptional()
  @IsString()
  breedId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tagCode?: string;

  @IsOptional()
  @IsEnum(AnimalSex)
  sex?: AnimalSex;

  @IsOptional()
  @IsEnum(AnimalProductionCategory)
  productionCategory?: AnimalProductionCategory;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  /** Si naissance inconnue — âge estimé en semaines à l'entrée dans la ferme. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(520)
  ageWeeksAtEntry?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
