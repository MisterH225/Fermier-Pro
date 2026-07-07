import { IsOptional, IsString } from "class-validator";

export class CreateDirectChatDto {
  @IsString()
  peerUserId!: string;

  @IsOptional()
  @IsString()
  marketplaceListingId?: string;

  @IsOptional()
  @IsString()
  merchantProductId?: string;
}
