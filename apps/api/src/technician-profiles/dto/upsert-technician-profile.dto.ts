import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { TechnicianFormationType } from "@prisma/client";

export class UpsertTechnicianProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  experienceYears?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  experienceYearsCount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  specializations?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  formation?: string;

  @IsOptional()
  @IsEnum(TechnicianFormationType)
  formationType?: TechnicianFormationType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  formationDetails?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  graduationYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pretensionSalarialeMensuelle?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  pretensionCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationCountry?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  locationLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  locationLng?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  availabilityNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  profilePhotoUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  onboardingComplete?: boolean;
}
