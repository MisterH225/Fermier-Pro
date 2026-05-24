import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";
import { VaccineCatalogType } from "@prisma/client";

export class CreateCustomVaccineDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsEnum(VaccineCatalogType)
  vaccineType!: VaccineCatalogType;

  @IsArray()
  @IsString({ each: true })
  targetCategories!: string[];

  @IsString()
  @MaxLength(200)
  targetLabel!: string;

  @IsString()
  @MaxLength(200)
  frequency!: string;

  @IsString()
  @MaxLength(300)
  recommendedTiming!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
