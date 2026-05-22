import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { MatingType } from "@prisma/client";

export class UpdateGestationDto {
  @IsOptional()
  @IsUUID()
  boarId?: string | null;

  @IsOptional()
  @IsEnum(MatingType)
  matingType?: MatingType;

  @IsOptional()
  @IsDateString()
  matingDate?: string;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
