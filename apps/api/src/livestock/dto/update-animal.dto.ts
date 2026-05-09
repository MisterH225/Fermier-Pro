import { AnimalSex } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
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
  @IsDateString()
  birthDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
