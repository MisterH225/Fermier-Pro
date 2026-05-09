import { Type } from "class-transformer";
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class CreateOfferDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e12)
  offeredPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
