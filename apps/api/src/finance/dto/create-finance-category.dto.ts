import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { FinanceCategoryType } from "@prisma/client";

export class CreateFinanceCategoryDto {
  @IsEnum(FinanceCategoryType)
  type!: FinanceCategoryType;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string | null;
}
