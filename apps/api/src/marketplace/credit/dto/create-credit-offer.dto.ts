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

export class CreateCreditOfferDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1e12)
  offeredPrice!: number;

  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(50)
  advancePercentage!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  balanceDueDays!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsString()
  buyerFarmId?: string;
}
