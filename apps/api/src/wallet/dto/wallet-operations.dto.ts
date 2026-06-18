import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf
} from "class-validator";

export class WalletLookupRecipientQueryDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;
}

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
  @ValidateIf((o: WalletTransferDto) => !o.recipientPhone?.trim())
  @IsString()
  @IsNotEmpty()
  toUserId?: string;

  @ValidateIf((o: WalletTransferDto) => !o.toUserId?.trim())
  @IsString()
  @IsNotEmpty()
  recipientPhone?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  clientRequestId?: string;
}
