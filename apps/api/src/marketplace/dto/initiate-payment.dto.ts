import { IsIn, IsOptional } from "class-validator";

export class InitiatePaymentDto {
  @IsOptional()
  @IsIn(["mobile_money", "wallet"])
  paymentMethod?: "mobile_money" | "wallet";
}
