import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { MatingType } from "@prisma/client";

export class CreateGestationDto {
  @IsUUID()
  farmId!: string;

  @IsUUID()
  sowId!: string;

  @IsOptional()
  @IsUUID()
  boarId?: string;

  @IsEnum(MatingType)
  matingType!: MatingType;

  @IsDateString()
  matingDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
