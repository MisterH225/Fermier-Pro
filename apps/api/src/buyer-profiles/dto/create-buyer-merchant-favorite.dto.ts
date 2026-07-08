import { IsString, MaxLength } from "class-validator";

export class CreateBuyerMerchantFavoriteDto {
  @IsString()
  @MaxLength(64)
  productId!: string;
}
