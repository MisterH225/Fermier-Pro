import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { FarmDiseaseSeverity } from "@prisma/client";

export class UpdateDiseaseCaseDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diagnosis?: string;

  @IsOptional()
  @IsEnum(FarmDiseaseSeverity)
  severity?: FarmDiseaseSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  durationEstimate?: string;

  @IsOptional()
  @IsBoolean()
  treatmentOngoing?: boolean;

  @IsOptional()
  @IsBoolean()
  inIsolation?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
