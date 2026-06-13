import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CounterOfferDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e9)
  counterPricePerKg?: number;

  /** Montant forfaitaire (porcelet / reproducteur). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e12)
  counterOfferedPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
