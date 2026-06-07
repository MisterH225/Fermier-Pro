import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";
import { FarmHealthEntityType } from "@prisma/client";

export class VaccineRecordSubjectDto {
  @IsEnum(FarmHealthEntityType)
  entityType!: FarmHealthEntityType;

  @IsString()
  entityId!: string;
}

export class CreateVaccineRecordsDto {
  @IsString()
  vaccineId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VaccineRecordSubjectDto)
  subjects!: VaccineRecordSubjectDto[];

  @IsOptional()
  @IsDateString()
  administeredDate?: string;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  practitioner?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  batchNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
