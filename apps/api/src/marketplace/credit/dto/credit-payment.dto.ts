import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class CreditPaymentDeclareDto {
  @IsString()
  @MaxLength(80)
  paymentMode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  paymentRef?: string;
}

export class CreditBalanceDeclareDto extends CreditPaymentDeclareDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e12)
  amount!: number;
}

export class CreditConfirmReceivedDto {
  @IsBoolean()
  received!: boolean;
}

export class ResolveCreditArbitrationDto {
  @IsIn(["paid_late", "defaulted", "cancelled"])
  resolution!: "paid_late" | "defaulted" | "cancelled";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
