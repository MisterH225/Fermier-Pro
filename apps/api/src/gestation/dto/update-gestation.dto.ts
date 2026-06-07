import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { MatingType } from "@prisma/client";

export class UpdateGestationDto {
  @IsOptional()
  @IsString()
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
