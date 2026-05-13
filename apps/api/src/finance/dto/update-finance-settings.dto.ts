import { Type } from "class-transformer";
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf
} from "class-validator";

export class UpdateFinanceSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currencySymbol?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lowBalanceThreshold?: number | null;
}
