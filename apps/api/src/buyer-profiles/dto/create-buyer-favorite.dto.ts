import { IsString, MaxLength } from "class-validator";

export class CreateBuyerFavoriteDto {
  @IsString()
  @MaxLength(64)
  listingId!: string;
}
