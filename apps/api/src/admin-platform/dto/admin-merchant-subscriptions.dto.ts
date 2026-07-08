import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class AdminMerchantSubReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminMerchantGrantTrialDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  units?: number;
}

export class AdminMerchantApplyPromoDto {
  @IsInt()
  @Min(0)
  @Max(100)
  percentOff!: number;
}
