import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import {
  FarmHealthEntityType,
  FarmHealthRecordKind
} from "@prisma/client";

export class CreateFarmHealthRecordDto {
  @IsEnum(FarmHealthRecordKind)
  kind!: FarmHealthRecordKind;

  @IsEnum(FarmHealthEntityType)
  entityType!: FarmHealthEntityType;

  @IsString()
  @MaxLength(64)
  entityId!: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  attachmentUrl?: string;

  /** Champs spécifiques au `kind` (vaccination, disease, vet_visit, treatment, mortality). */
  @IsObject()
  detail!: Record<string, unknown>;
}
