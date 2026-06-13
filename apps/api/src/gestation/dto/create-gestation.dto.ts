import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString
} from "class-validator";
import { MatingType } from "@prisma/client";

export class CreateGestationDto {
  @IsString()
  @IsNotEmpty()
  farmId!: string;

  @IsString()
  @IsNotEmpty()
  sowId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  boarId?: string;

  @IsEnum(MatingType)
  matingType!: MatingType;

  @IsDateString()
  matingDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
