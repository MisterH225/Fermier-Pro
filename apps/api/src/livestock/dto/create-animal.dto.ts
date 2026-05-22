import { AnimalProductionCategory, AnimalSex } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength
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

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
