import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class WalletAmountDto {
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount!: number;
}

export class WalletTopUpConfirmDto extends WalletAmountDto {
  @IsString()
  @IsNotEmpty()
  providerRef!: string;
}

export class WalletWithdrawInitiateDto extends WalletAmountDto {
  @IsOptional()
  @IsString()
  phone?: string;
}

export class WalletWithdrawConfirmDto extends WalletWithdrawInitiateDto {
  @IsString()
  @IsNotEmpty()
  providerRef!: string;
}

export class WalletTransferDto extends WalletAmountDto {
  @IsString()
  @IsNotEmpty()
  toUserId!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  clientRequestId?: string;
}
