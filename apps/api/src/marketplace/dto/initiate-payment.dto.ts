import { IsIn } from "class-validator";

export class InitiatePaymentDto {
  @IsIn(["mobile_money", "wallet"])
  paymentMethod!: "mobile_money" | "wallet";
}
