import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CounterOfferDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e9)
  counterPricePerKg!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
