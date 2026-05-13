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

export class UpdateLivestockBatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  breedId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  categoryKey?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  headcount?: number;

  @IsOptional()
  @IsDateString()
  avgBirthDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceTag?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  @IsDateString()
  expectedExitAt?: string | null;

  @IsOptional()
  @IsDateString()
  closedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  notes?: string | null;
}
