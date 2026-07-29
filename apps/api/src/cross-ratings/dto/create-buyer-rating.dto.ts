import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf
} from "class-validator";

export class CreateBuyerRatingDto {
  @ValidateIf((o: CreateBuyerRatingDto) => !o.merchantOrderId?.trim())
  @IsString()
  @IsNotEmpty()
  marketplaceTransactionId?: string;

  @ValidateIf(
    (o: CreateBuyerRatingDto) => !o.marketplaceTransactionId?.trim()
  )
  @IsString()
  @IsNotEmpty()
  merchantOrderId?: string;

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
