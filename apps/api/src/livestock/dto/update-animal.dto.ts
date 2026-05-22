import {
  AnimalOrigin,
  AnimalProductionCategory,
  AnimalSex
} from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength
} from "class-validator";

export class UpdateAnimalDto {
  @IsOptional()
  @IsString()
  breedId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tagCode?: string | null;

  @IsOptional()
  @IsEnum(AnimalSex)
  sex?: AnimalSex;

  @IsOptional()
  @IsEnum(AnimalProductionCategory)
  productionCategory?: AnimalProductionCategory;

  @IsOptional()
  @IsDateString()
  birthDate?: string | null;

  @IsOptional()
  @IsEnum(AnimalOrigin)
  origin?: AnimalOrigin | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supplier?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  photoUrl?: string | null;

  @IsOptional()
  @IsString()
  damId?: string | null;

  @IsOptional()
  @IsString()
  sireId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
