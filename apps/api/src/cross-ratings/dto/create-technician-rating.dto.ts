import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class CreateTechnicianRatingDto {
  @IsString()
  @IsNotEmpty()
  technicianUserId!: string;

  @IsString()
  @IsNotEmpty()
  farmId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
