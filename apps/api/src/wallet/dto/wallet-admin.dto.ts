import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { Type } from "class-transformer";
import { WalletFeeTransactionType } from "@prisma/client";

export class WalletFeeQuoteQueryDto {
  @IsEnum(WalletFeeTransactionType)
  type!: WalletFeeTransactionType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount!: number;
}

export class UpdateWalletFeeConfigBodyDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  feePercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feeFixed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxFee?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RejectWithdrawalDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
