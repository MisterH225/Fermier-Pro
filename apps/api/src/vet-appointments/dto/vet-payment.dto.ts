import { IsIn, IsNotEmpty, IsOptional } from "class-validator";

export class VetPaymentInitiateDto {
  @IsNotEmpty()
  @IsIn(["mobile_money", "wallet"])
  paymentMethod!: "mobile_money" | "wallet";
}

export class VetPaymentConfirmDto {
  @IsOptional()
  providerRef?: string;
}
