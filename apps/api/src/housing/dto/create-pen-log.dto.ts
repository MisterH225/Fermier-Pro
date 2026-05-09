import { PenLogType } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class CreatePenLogDto {
  @IsEnum(PenLogType)
  type!: PenLogType;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}
