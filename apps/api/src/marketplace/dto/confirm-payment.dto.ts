import { IsOptional, IsString, MaxLength } from "class-validator";

export class ConfirmPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  providerRef?: string;
}
