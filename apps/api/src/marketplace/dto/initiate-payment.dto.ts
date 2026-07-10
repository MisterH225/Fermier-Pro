import { IsIn, IsNotEmpty } from "class-validator";

export class InitiatePaymentDto {
  @IsNotEmpty()
  @IsIn(["mobile_money", "wallet"])
  paymentMethod!: "mobile_money" | "wallet";
}
