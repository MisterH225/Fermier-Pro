import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class CreateLivestockBatchDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  speciesId?: string;

  @IsOptional()
  @IsString()
  breedId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  categoryKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  headcount?: number;

  @IsOptional()
  @IsDateString()
  avgBirthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceTag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  notes?: string;
}
