import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { FarmDiseaseSeverity, FarmHealthEntityType } from "@prisma/client";

export class CreateDiseaseCaseDto {
  @IsEnum(FarmHealthEntityType)
  entityType!: FarmHealthEntityType;

  @IsString()
  @MaxLength(64)
  entityId!: string;

  @IsArray()
  @IsString({ each: true })
  symptoms!: string[];

  @IsString()
  @MaxLength(120)
  durationEstimate!: string;

  @IsDateString()
  estimatedOnsetDate!: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diagnosis?: string;

  @IsEnum(FarmDiseaseSeverity)
  severity!: FarmDiseaseSeverity;

  @IsOptional()
  @IsBoolean()
  treatmentOngoing?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  treatmentNotes?: string;

  @IsOptional()
  @IsBoolean()
  inIsolation?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  isolationPenId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
