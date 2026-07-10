import { MarketplacePaymentMethod, MerchantSubscriptionTier } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ChooseProducerSubscriptionDto {
  @IsEnum(MerchantSubscriptionTier)
  tier!: MerchantSubscriptionTier;

  @IsOptional()
  @IsEnum(MarketplacePaymentMethod)
  paymentMethod?: MarketplacePaymentMethod;

  @IsOptional()
  startTrial?: boolean;
}

export class ConfirmProducerPaymentDto {
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  providerRef!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  invoiceId?: string;
}
