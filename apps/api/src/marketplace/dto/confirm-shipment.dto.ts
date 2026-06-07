import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { MarketplaceShipmentMethod } from "@prisma/client";

export class ConfirmShipmentDto {
  @IsDateString()
  shippedAt!: string;

  @IsOptional()
  @IsEnum(MarketplaceShipmentMethod)
  method?: MarketplaceShipmentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
